"use client";

import { useState } from "react";
import WinampSkin from "@/components/skins/winamp";

export default function Preview() {
  const [paused, setPaused] = useState(false);
  const [volume, setVolume] = useState(0.75);
  const [positionMs, setPositionMs] = useState(83_000);
  return (
    <div style={{ minHeight: "100vh", background: "#101014", padding: 60 }}>
      <WinampSkin
        track={{
          name: "Paranoid Android",
          artists: "Radiohead",
          albumName: "OK Computer",
          albumArtUrl: "",
          uri: "spotify:track:preview",
        }}
        paused={paused}
        positionMs={positionMs}
        durationMs={383_000}
        volume={volume}
        controls={{
          play: async () => {},
          pause: () => setPaused(true),
          resume: () => setPaused(false),
          next: () => {},
          previous: () => {},
          seek: (ms) => setPositionMs(ms),
          setVolume: (v) => setVolume(v),
        }}
      />
    </div>
  );
}
