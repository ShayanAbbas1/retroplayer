"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { streamingDataService } from "../lib/streaming-data-service";
import type { StreamingDataState } from "../types/streaming-data";
import { MusicTrendsGraph } from "./music-trends-graph";

const TABS = [
  { key: "artists", label: "Top Artists" },
  { key: "tracks", label: "Top Tracks" },
  { key: "albums", label: "Top Albums" },
  { key: "graphs", label: "Graphs" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

type SortKey = "name" | "plays" | "duration";

type TableRow = {
  name: string;
  plays: number;
  duration: number;
};

export function StreamingInsights() {
  const [state, setState] = useState<StreamingDataState>(
    streamingDataService.getState()
  );
  const [topArtists, setTopArtists] = useState<
    { artist: string; count: number; durationMs: number }[]
  >([]);
  const [topTracks, setTopTracks] = useState<
    { track: string; count: number; durationMs: number }[]
  >([]);
  const [topAlbums, setTopAlbums] = useState<
    { album: string; count: number; durationMs: number }[]
  >([]);
  const [totalListeningTime, setTotalListeningTime] = useState<{
    ms: number;
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
  }>({ ms: 0, seconds: 0, minutes: 0, hours: 0, days: 0 });
  const [activeTab, setActiveTab] = useState<TabKey>("artists");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("plays");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const rowHeight = 48;

  // useMemo for rows must be declared before virtualization logic uses it
  const rows: TableRow[] = useMemo(() => {
    let baseRows: TableRow[] = [];
    if (activeTab === "artists") {
      baseRows = topArtists.map((a) => ({
        name: a.artist,
        plays: a.count,
        duration: a.durationMs,
      }));
    } else if (activeTab === "tracks") {
      baseRows = topTracks.map((t) => ({
        name: t.track,
        plays: t.count,
        duration: t.durationMs,
      }));
    } else if (activeTab === "albums") {
      baseRows = topAlbums.map((a) => ({
        name: a.album,
        plays: a.count,
        duration: a.durationMs,
      }));
    }
    if (search.trim()) {
      baseRows = baseRows.filter((row) =>
        row.name.toLowerCase().includes(search.trim().toLowerCase())
      );
    }
    return [...baseRows].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortKey === "plays") {
        cmp = a.plays - b.plays;
      } else if (sortKey === "duration") {
        cmp = a.duration - b.duration;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [activeTab, topArtists, topTracks, topAlbums, search, sortKey, sortDir]);

  // Virtualization logic for table rows
  const [scrollTop, setScrollTop] = useState(0);
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);
  const visibleRowCount = Math.ceil(448 / rowHeight); // 28rem max height / rowHeight
  const totalRows = rows.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight));
  const endIndex = Math.min(totalRows, startIndex + visibleRowCount);
  const visibleRows = rows.slice(startIndex, endIndex);
  const offsetY = startIndex * rowHeight;

  useEffect(() => {
    const stateSubscription = streamingDataService
      .getState$()
      .subscribe(setState);
    const topArtistsSubscription = streamingDataService
      .getTopArtists$()
      .subscribe(setTopArtists);
    const topTracksSubscription = streamingDataService
      .getTopTracks$()
      .subscribe(setTopTracks);
    const topAlbumsSubscription = streamingDataService
      .getTopAlbums$()
      .subscribe(setTopAlbums);
    const totalListeningTimeSubscription = streamingDataService
      .getTotalListeningTime$()
      .subscribe(setTotalListeningTime);

    return () => {
      stateSubscription.unsubscribe();
      topArtistsSubscription.unsubscribe();
      topTracksSubscription.unsubscribe();
      topAlbumsSubscription.unsubscribe();
      totalListeningTimeSubscription.unsubscribe();
    };
  }, []);

  if (state.isLoading) {
    return (
      <div className="text-center py-8 text-white">
        Loading your streaming data...
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error: {state.error.message}
      </div>
    );
  }

  if (state.data.length === 0) {
    return null;
  }

  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(" ");
  };

  return (
    <div className="space-y-8">
      <div className="bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-green-500">
          Total Listening Time
        </h2>
        <div className="space-y-2">
          <p className="text-sm text-gray-400">
            That&apos;s {totalListeningTime.days} days,{" "}
            {totalListeningTime.hours} hours, and {totalListeningTime.minutes}{" "}
            minutes of pure music bliss! 🎵
          </p>
        </div>
      </div>
      <div className="bg-gray-800 rounded-lg shadow p-6">
        <div className="flex space-x-2 mb-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                activeTab === tab.key
                  ? "win-selected"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              onClick={() => setActiveTab(tab.key as TabKey)}
              disabled={state.isLoading}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {activeTab === "graphs" ? (
          <div>
            <MusicTrendsGraph />
            {/* More graphs can be added here in the future */}
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center">
              <input
                type="text"
                className="w-full md:w-1/3 px-3 py-2 rounded bg-gray-900 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder={`Search ${TABS.find(
                  (t) => t.key === activeTab
                )?.label.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={state.isLoading}
              />
            </div>
            <div
              className="overflow-x-auto"
              style={{ maxHeight: "28rem", overflowY: "auto" }}
              onScroll={(e) => {
                if (tableBodyRef.current) {
                  setScrollTop((e.target as HTMLDivElement).scrollTop);
                }
              }}
            >
              <table className="min-w-full divide-y divide-gray-700">
                <thead>
                  <tr>
                    <th
                      className="px-4 py-2 text-left cursor-pointer select-none w-1/2"
                      onClick={() => {
                        setSortKey("name");
                        setSortDir(
                          sortKey === "name" && sortDir === "desc"
                            ? "asc"
                            : "desc"
                        );
                      }}
                    >
                      Name{" "}
                      {sortKey === "name"
                        ? sortDir === "desc"
                          ? "↓"
                          : "↑"
                        : ""}
                    </th>
                    <th
                      className="px-4 py-2 text-left cursor-pointer select-none w-1/4"
                      onClick={() => {
                        setSortKey("plays");
                        setSortDir(
                          sortKey === "plays" && sortDir === "desc"
                            ? "asc"
                            : "desc"
                        );
                      }}
                    >
                      Plays{" "}
                      {sortKey === "plays"
                        ? sortDir === "desc"
                          ? "↓"
                          : "↑"
                        : ""}
                    </th>
                    <th
                      className="px-4 py-2 text-left cursor-pointer select-none w-1/4"
                      onClick={() => {
                        setSortKey("duration");
                        setSortDir(
                          sortKey === "duration" && sortDir === "desc"
                            ? "asc"
                            : "desc"
                        );
                      }}
                    >
                      Time Played{" "}
                      {sortKey === "duration"
                        ? sortDir === "desc"
                          ? "↓"
                          : "↑"
                        : ""}
                    </th>
                  </tr>
                </thead>
                <tbody ref={tableBodyRef}>
                  {offsetY > 0 && (
                    <tr style={{ height: offsetY }} aria-hidden="true">
                      <td colSpan={3} style={{ padding: 0, border: 0 }}></td>
                    </tr>
                  )}
                  {visibleRows.map((row) => (
                    <tr
                      key={row.name}
                      className="hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-2 text-white truncate max-w-xs align-middle w-1/2">
                        {row.name}
                      </td>
                      <td className="px-4 py-2 text-gray-300 align-middle w-1/4">
                        {row.plays}
                      </td>
                      <td className="px-4 py-2 text-gray-300 align-middle w-1/4">
                        {formatDuration(row.duration)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-6 text-center text-gray-400"
                      >
                        No results found.
                      </td>
                    </tr>
                  )}
                  {totalRows > endIndex && (
                    <tr
                      style={{ height: (totalRows - endIndex) * rowHeight }}
                      aria-hidden="true"
                    >
                      <td colSpan={3} style={{ padding: 0, border: 0 }}></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
