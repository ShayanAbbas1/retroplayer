"use client";

import VirtualList from "./VirtualList";
import TrackItem from "./TrackItem";
import { SpotifyTrack } from "@/types/spotify";

interface TracksListProps {
  tracks: SpotifyTrack[];
}

export default function TracksList({ tracks }: TracksListProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Top Tracks</h2>
      <VirtualList<SpotifyTrack>
        items={tracks}
        itemHeight={80}
        className="h-[600px]"
      >
        {(track, index) => <TrackItem track={track} index={index} />}
      </VirtualList>
    </div>
  );
}
