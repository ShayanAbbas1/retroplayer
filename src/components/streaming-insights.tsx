"use client";

import { useEffect, useState } from "react";
import { streamingDataService } from "../lib/streaming-data-service";
import type { StreamingDataState } from "../types/streaming-data";
import VirtualListWrapper from "./VirtualListWrapper";

export function StreamingInsights() {
  const [state, setState] = useState<StreamingDataState>(
    streamingDataService.getState()
  );
  const [topArtists, setTopArtists] = useState<
    { artist: string; count: number }[]
  >([]);
  const [topTracks, setTopTracks] = useState<
    { track: string; count: number }[]
  >([]);
  const [totalListeningTime, setTotalListeningTime] = useState<{
    ms: number;
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
  }>(0);

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
    const totalListeningTimeSubscription = streamingDataService
      .getTotalListeningTime$()
      .subscribe(setTotalListeningTime);

    return () => {
      stateSubscription.unsubscribe();
      topArtistsSubscription.unsubscribe();
      topTracksSubscription.unsubscribe();
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

  // Sort topArtists and topTracks by count descending
  const sortedTopArtists = [...topArtists].sort((a, b) => b.count - a.count);
  const sortedTopTracks = [...topTracks].sort((a, b) => b.count - a.count);

  const formatTime = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-green-500">
            Top Artists
          </h2>
          <VirtualListWrapper
            items={sortedTopArtists}
            itemHeight={56}
            className="max-h-96"
            renderItem={({ artist, count }) => (
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-white font-medium truncate">
                    {artist}
                  </span>
                </div>
                <span className="text-gray-400 text-sm ml-4 whitespace-nowrap">
                  {count} plays
                </span>
              </div>
            )}
          />
        </div>

        <div className="bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-green-500">
            Top Tracks
          </h2>
          <VirtualListWrapper
            items={sortedTopTracks}
            itemHeight={56}
            className="max-h-96"
            renderItem={({ track, count }) => (
              <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700 transition-colors">
                <div className="flex-1 min-w-0">
                  <span className="text-white font-medium truncate">
                    {track}
                  </span>
                </div>
                <span className="text-gray-400 text-sm ml-4 whitespace-nowrap">
                  {count} plays
                </span>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}
