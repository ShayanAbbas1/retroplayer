"use client";

import { useEffect, useRef, useState } from "react";
import type { PlayerControls, PlayerTrack } from "@/lib/use-spotify-player";
import { formatClock, formatMarquee } from "./winamp-format";
import styles from "./winamp.module.css";

// ---------------------------------------------------------------------------
// Pixel bitmap fonts. Rows are top-to-bottom, "1" = lit pixel.
// ---------------------------------------------------------------------------

const DIGIT_FONT: Record<string, string[]> = {
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  ":": ["00000", "00100", "00100", "00000", "00100", "00100", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
};

const TEXT_FONT: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "110", "011"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "110", "001", "110"],
  "6": ["011", "100", "110", "101", "010"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["010", "101", "010", "101", "010"],
  "9": ["010", "101", "011", "001", "110"],
  " ": ["000", "000", "000", "000", "000"],
  "-": ["000", "000", "111", "000", "000"],
  ".": ["000", "000", "000", "000", "010"],
  ",": ["000", "000", "000", "010", "100"],
  ":": ["000", "010", "000", "010", "000"],
  "'": ["010", "010", "000", "000", "000"],
  '"': ["101", "101", "000", "000", "000"],
  "!": ["010", "010", "010", "000", "010"],
  "?": ["110", "001", "010", "000", "010"],
  "(": ["001", "010", "010", "010", "001"],
  ")": ["100", "010", "010", "010", "100"],
  "/": ["001", "001", "010", "100", "100"],
  "&": ["010", "101", "010", "101", "011"],
  "+": ["000", "010", "111", "010", "000"],
};

interface PixelTextProps {
  text: string;
  font: Record<string, string[]>;
  glyphW: number;
  glyphH: number;
  gap?: number;
  color: string;
  className?: string;
}

// Renders a string as crisp bitmap glyphs via a single SVG of <rect> pixels.
function PixelText({
  text,
  font,
  glyphW,
  glyphH,
  gap = 1,
  color,
  className,
}: PixelTextProps) {
  const advance = glyphW + gap;
  const width = text.length * advance;
  const rects: React.ReactElement[] = [];
  for (let i = 0; i < text.length; i++) {
    const glyph = font[text[i]] ?? font[" "];
    const originX = i * advance;
    for (let row = 0; row < glyph.length; row++) {
      const bits = glyph[row];
      for (let col = 0; col < bits.length; col++) {
        if (bits[col] === "1") {
          rects.push(
            <rect
              key={`${i}-${row}-${col}`}
              x={originX + col}
              y={row}
              width={1}
              height={1}
            />
          );
        }
      }
    }
  }
  return (
    <svg
      className={className}
      width={width}
      height={glyphH}
      viewBox={`0 0 ${width} ${glyphH}`}
      shapeRendering="crispEdges"
      fill={color}
      style={{ display: "block" }}
    >
      {rects}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Simulated spectrum analyzer (DRM blocks real audio data — see AGENTS.md).
// ---------------------------------------------------------------------------

const VIS_W = 76;
const VIS_H = 15;
const BAR_COUNT = 19;
const BAR_W = 3;
const BAR_GAP = 1;

function Spectrum({ paused }: { paused: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const heights = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const targets = useRef<number[]>(new Array(BAR_COUNT).fill(0));
  const peaks = useRef<number[]>(new Array(BAR_COUNT).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = 0;

    const draw = (t: number) => {
      raf = requestAnimationFrame(draw);
      if (t - last < 45) return;
      last = t;

      for (let i = 0; i < BAR_COUNT; i++) {
        if (paused) {
          targets.current[i] = 0;
        } else if (Math.random() < 0.35) {
          targets.current[i] = Math.random() * VIS_H;
        }
        const h = heights.current[i];
        const target = targets.current[i];
        heights.current[i] = h + (target - h) * (target > h ? 0.6 : 0.25);
        if (heights.current[i] > peaks.current[i]) {
          peaks.current[i] = heights.current[i];
        } else {
          peaks.current[i] = Math.max(0, peaks.current[i] - 0.6);
        }
      }

      ctx.clearRect(0, 0, VIS_W, VIS_H);
      for (let i = 0; i < BAR_COUNT; i++) {
        const x = i * (BAR_W + BAR_GAP);
        const h = Math.round(heights.current[i]);
        for (let row = 0; row < h; row++) {
          const y = VIS_H - 1 - row;
          const frac = row / VIS_H;
          // green low -> yellow -> red top, segmented per pixel row
          ctx.fillStyle =
            frac > 0.72 ? "#e04000" : frac > 0.45 ? "#e0d000" : "#1ee000";
          ctx.fillRect(x, y, BAR_W, 1);
        }
        const peakY = VIS_H - 1 - Math.round(peaks.current[i]);
        ctx.fillStyle = "#c8c8c8";
        ctx.fillRect(x, Math.min(VIS_H - 1, Math.max(0, peakY)), BAR_W, 1);
      }
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  return (
    <canvas
      ref={canvasRef}
      width={VIS_W}
      height={VIS_H}
      className={styles.visCanvas}
    />
  );
}

// ---------------------------------------------------------------------------
// Transport button glyphs (crisp SVG shapes).
// ---------------------------------------------------------------------------

function Glyph({ kind }: { kind: string }) {
  const common = { fill: "#0a0a0a", shapeRendering: "crispEdges" as const };
  switch (kind) {
    case "prev":
      return (
        <svg width={10} height={8} viewBox="0 0 10 8" {...common}>
          <rect x={1} y={1} width={1} height={6} />
          <polygon points="6,1 6,7 2,4" />
          <polygon points="9,1 9,7 5,4" />
        </svg>
      );
    case "next":
      return (
        <svg width={10} height={8} viewBox="0 0 10 8" {...common}>
          <polygon points="1,1 1,7 5,4" />
          <polygon points="4,1 4,7 8,4" />
          <rect x={8} y={1} width={1} height={6} />
        </svg>
      );
    case "play":
      return (
        <svg width={8} height={8} viewBox="0 0 8 8" {...common}>
          <polygon points="1,1 1,7 7,4" />
        </svg>
      );
    case "pause":
      return (
        <svg width={8} height={8} viewBox="0 0 8 8" {...common}>
          <rect x={1} y={1} width={2} height={6} />
          <rect x={5} y={1} width={2} height={6} />
        </svg>
      );
    case "stop":
      return (
        <svg width={8} height={8} viewBox="0 0 8 8" {...common}>
          <rect x={1} y={1} width={6} height={6} />
        </svg>
      );
    case "eject":
      return (
        <svg width={10} height={8} viewBox="0 0 10 8" {...common}>
          <polygon points="5,1 1,5 9,5" />
          <rect x={1} y={6} width={8} height={2} />
        </svg>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Main window
// ---------------------------------------------------------------------------

export interface WinampSkinProps {
  track: PlayerTrack | null;
  paused: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  controls: PlayerControls;
}

export default function WinampSkin({
  track,
  paused,
  positionMs,
  durationMs,
  volume,
  controls,
}: WinampSkinProps) {
  const [trackNo, setTrackNo] = useState(1);
  const lastUri = useRef<string | null>(null);
  const [blinkOff, setBlinkOff] = useState(false);

  useEffect(() => {
    if (track?.uri && track.uri !== lastUri.current) {
      const first = lastUri.current === null;
      lastUri.current = track.uri;
      if (!first) setTrackNo((n) => n + 1);
    }
  }, [track?.uri]);

  // Time display blinks apart while paused.
  useEffect(() => {
    if (!paused) return;
    const id = setInterval(() => setBlinkOff((b) => !b), 500);
    return () => clearInterval(id);
  }, [paused]);

  const clock = formatClock(positionMs);
  const marquee = formatMarquee(
    trackNo,
    track?.artists ?? "",
    track?.name ?? ""
  );
  // Duplicate with a separator so translateX(-50%) loops seamlessly.
  const marqueeLoop = `${marquee}   ***   `;
  const posPct =
    durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;

  const statusGlyph = paused ? "pause" : "play";

  return (
    <div className={styles.scaler}>
      <div className={styles.window}>
        {/* Title bar */}
        <div className={styles.titlebar}>
          <div className={styles.menuBtn} />
          <div className={styles.wordmark}>WINAMP</div>
          <div className={styles.titleButtons}>
            <button
              type="button"
              className={styles.minBtn}
              aria-label="Minimize"
              tabIndex={-1}
            />
            <button
              type="button"
              className={styles.shadeBtn}
              aria-label="Windowshade"
              tabIndex={-1}
            />
            <button
              type="button"
              className={styles.closeBtn}
              aria-label="Close"
              tabIndex={-1}
            />
          </div>
        </div>

        {/* Clutterbar (visual only) */}
        <div className={styles.clutterbar}>
          {["O", "A", "I", "D", "V"].map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>

        {/* Play / pause status indicator */}
        <div className={styles.statusIndicator}>
          <Glyph kind={statusGlyph} />
        </div>

        {/* Green time display */}
        <div
          className={styles.timeDisplay}
          style={{ visibility: paused && blinkOff ? "hidden" : "visible" }}
        >
          <PixelText
            text={clock}
            font={DIGIT_FONT}
            glyphW={5}
            glyphH={7}
            gap={1}
            color="#00e000"
          />
        </div>

        {/* Song title marquee */}
        <div className={styles.marqueeWindow}>
          <div className={styles.marqueeTrack}>
            <PixelText
              text={marqueeLoop}
              font={TEXT_FONT}
              glyphW={3}
              glyphH={5}
              gap={1}
              color="#00e000"
            />
            <PixelText
              text={marqueeLoop}
              font={TEXT_FONT}
              glyphW={3}
              glyphH={5}
              gap={1}
              color="#00e000"
            />
          </div>
        </div>

        {/* Bitrate / samplerate readouts */}
        <div className={styles.kbps}>
          <PixelText
            text="160"
            font={TEXT_FONT}
            glyphW={3}
            glyphH={5}
            gap={1}
            color="#00e000"
          />
        </div>
        <div className={styles.khz}>
          <PixelText
            text="44"
            font={TEXT_FONT}
            glyphW={3}
            glyphH={5}
            gap={1}
            color="#00e000"
          />
        </div>

        {/* Mono / stereo indicators */}
        <div className={`${styles.mono} ${styles.indicatorDim}`}>MONO</div>
        <div className={`${styles.stereo} ${styles.indicatorLit}`}>STEREO</div>

        {/* Spectrum analyzer */}
        <div className={styles.vis}>
          <Spectrum paused={paused} />
        </div>

        {/* Volume slider */}
        <div className={styles.volSlider}>
          <div className={styles.volGroove} />
          <div className={styles.volThumb} style={{ left: `${volume * 54}px` }} />
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => controls.setVolume(Number(e.target.value))}
            aria-label="Volume"
            className={styles.rangeOverlay}
          />
        </div>

        {/* Balance slider (visual only) */}
        <div className={styles.balSlider}>
          <div className={styles.balGroove} />
          <div className={styles.balThumb} />
        </div>

        {/* EQ / PL toggle buttons (visual only) */}
        <button type="button" className={styles.eqBtn} tabIndex={-1}>
          EQ
        </button>
        <button type="button" className={styles.plBtn} tabIndex={-1}>
          PL
        </button>

        {/* Position slider */}
        <div className={styles.posSlider}>
          <div className={styles.posGroove} />
          <div className={styles.posThumb} style={{ left: `${posPct * 2.19}px` }} />
          <input
            type="range"
            min={0}
            max={durationMs || 0}
            value={Math.min(positionMs, durationMs || 0)}
            onChange={(e) => controls.seek(Number(e.target.value))}
            aria-label="Seek"
            className={styles.rangeOverlay}
          />
        </div>

        {/* Transport row */}
        <div className={styles.transport}>
          <button
            type="button"
            className={styles.tBtn}
            onClick={() => controls.previous()}
            aria-label="Previous"
          >
            <Glyph kind="prev" />
          </button>
          <button
            type="button"
            className={styles.tBtn}
            onClick={() => controls.resume()}
            aria-label="Play"
          >
            <Glyph kind="play" />
          </button>
          <button
            type="button"
            className={styles.tBtn}
            onClick={() => controls.pause()}
            aria-label="Pause"
          >
            <Glyph kind="pause" />
          </button>
          <button
            type="button"
            className={styles.tBtn}
            onClick={() => {
              controls.pause();
              controls.seek(0);
            }}
            aria-label="Stop"
          >
            <Glyph kind="stop" />
          </button>
          <button
            type="button"
            className={styles.tBtn}
            onClick={() => controls.next()}
            aria-label="Next"
          >
            <Glyph kind="next" />
          </button>
          <button
            type="button"
            className={`${styles.tBtn} ${styles.ejectBtn}`}
            aria-label="Eject"
            tabIndex={-1}
          >
            <Glyph kind="eject" />
          </button>
        </div>
      </div>
    </div>
  );
}
