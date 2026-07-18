import { useMemo, useState } from "react";
import { useStreamingData } from "../contexts/StreamingDataContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { StreamingData } from "../types/streaming-data";

const TABS = [
  { key: "artists", label: "Top Artists" },
  { key: "albums", label: "Top Albums" },
  { key: "tracks", label: "Top Tracks" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const COLORS = [
  "#22c55e",
  "#3b82f6",
  "#f59e42",
  "#ef4444",
  "#a855f7",
  "#14b8a6",
  "#eab308",
  "#6366f1",
  "#f43f5e",
  "#0ea5e9",
];

export function MusicTrendsGraph() {
  const { data } = useStreamingData();
  const [tab, setTab] = useState<TabKey>("artists");

  // Helper to extract year from timestamp
  const getYear = (ts: string | null | undefined): string | null => {
    if (!ts) return null;
    return ts.slice(0, 4);
  };

  // Build the graph data for the selected tab
  const { chartData, topNames } = useMemo(() => {
    let getName: (entry: StreamingData) => string | null;
    if (tab === "artists") {
      getName = (entry) => entry.master_metadata_album_artist_name;
    } else if (tab === "albums") {
      getName = (entry) => entry.master_metadata_album_album_name;
    } else {
      getName = (entry) => entry.master_metadata_track_name;
    }

    // 1. Count total plays for each item
    const playCounts: Record<string, number> = {};
    data.forEach((entry) => {
      const name = getName(entry);
      if (name) {
        playCounts[name] = (playCounts[name] || 0) + 1;
      }
    });
    // 2. Get top 10 items by total plays
    const topNames = Object.entries(playCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name]) => name);

    // 3. For each year, count plays for each top item
    const yearSet = new Set<string>();
    const yearItemPlays: Record<string, Record<string, number>> = {};
    data.forEach((entry) => {
      const name = getName(entry);
      const year = getYear(entry.ts);
      if (!name || !year) return;
      if (!topNames.includes(name)) return;
      yearSet.add(year);
      if (!yearItemPlays[year]) yearItemPlays[year] = {};
      yearItemPlays[year][name] = (yearItemPlays[year][name] || 0) + 1;
    });
    const years = Array.from(yearSet).sort();
    // 4. Build chart data: [{ year, [item1]: count, [item2]: count, ... }]
    const chartData = years.map((year) => {
      const row: Record<string, unknown> = { year };
      topNames.forEach((name) => {
        row[name] = yearItemPlays[year]?.[name] || 0;
      });
      return row;
    });
    return { chartData, topNames };
  }, [data, tab]);

  return (
    <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg p-6 border border-gray-700 shadow-xl mb-8">
      <div className="flex space-x-2 mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              tab === t.key
                ? "win-selected"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            }`}
            onClick={() => setTab(t.key)}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Legend />
          {topNames.map((name, idx) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={COLORS[idx % COLORS.length]}
              dot={false}
              name={name}
              strokeWidth={2}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
