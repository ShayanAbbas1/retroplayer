import { useMemo, useState } from "react";
import { useStreamingData } from "../contexts/StreamingDataContext";
import { ResponsiveHeatMap } from "@nivo/heatmap";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function ListeningHeatmapWidget() {
  const { data } = useStreamingData();
  const [selectedArtist, setSelectedArtist] = useState<string>("All Artists");

  // Get all unique artists
  const artistList = useMemo(() => {
    const set = new Set<string>();
    data.forEach((entry) => {
      if (entry.master_metadata_album_artist_name) {
        set.add(entry.master_metadata_album_artist_name);
      }
    });
    return ["All Artists", ...Array.from(set).sort()];
  }, [data]);

  // Prepare heatmap data for Nivo: [{ id: hour, data: [{ x: day, y: count }, ...] }]
  const heatmapData = useMemo(() => {
    // hour -> day -> count
    const grid: Record<number, Record<string, number>> = {};
    HOURS.forEach((h) => {
      grid[h] = {};
      DAYS.forEach((d) => (grid[h][d] = 0));
    });
    data.forEach((entry) => {
      if (
        selectedArtist !== "All Artists" &&
        entry.master_metadata_album_artist_name !== selectedArtist
      ) {
        return;
      }
      const date = new Date(entry.ts);
      const hour = date.getHours();
      const day = DAYS[date.getDay()];
      grid[hour][day]++;
    });
    return HOURS.map((h) => ({
      id: h.toString(),
      data: DAYS.map((d) => ({ x: d, y: grid[h][d] })),
    }));
  }, [data, selectedArtist]);

  return (
    <div>
      <div className="mb-4 flex items-center space-x-2">
        <label htmlFor="artist-select" className="text-gray-300 text-sm">
          Artist:
        </label>
        <select
          id="artist-select"
          className="bg-gray-900 text-white border border-gray-700 rounded px-2 py-1"
          value={selectedArtist}
          onChange={(e) => setSelectedArtist(e.target.value)}
        >
          {artistList.map((artist) => (
            <option key={artist} value={artist}>
              {artist}
            </option>
          ))}
        </select>
      </div>
      <div style={{ height: 400 }}>
        <ResponsiveHeatMap
          data={heatmapData}
          margin={{ top: 40, right: 60, bottom: 40, left: 60 }}
          axisTop={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: "Day of Week",
            legendOffset: 36,
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: "Hour",
            legendOffset: -40,
          }}
          colors={(cell) =>
            `rgba(37, 99, 235, ${Math.max(
              0.1,
              Math.min(1, (cell.value ?? 0) / 10)
            )})`
          }
          borderColor={{ from: "color", modifiers: [["darker", 0.4]] }}
          labelTextColor={{ from: "color", modifiers: [["darker", 1.8]] }}
          animate={false}
          isInteractive={true}
          tooltip={({ cell }) => (
            <span className="text-xs text-white bg-gray-800 p-1 rounded">
              {`${cell.value} plays on ${cell.x} at ${cell.serieId}:00`}
            </span>
          )}
        />
      </div>
    </div>
  );
}
