"use client";

import { SpotifyTrack } from "@/types/spotify";

interface TrackItemProps {
  track: SpotifyTrack;
  index: number;
}

export default function TrackItem({ track, index }: TrackItemProps) {
  return (
    <div className="flex items-center space-x-4 w-full">
      <span className="text-gray-400 w-8">{index + 1}.</span>
      <img
        src={track.album.images[0]?.url}
        alt={track.name}
        className="w-12 h-12 rounded"
      />
      <div className="flex-1">
        <p className="text-white font-medium">{track.name}</p>
        <p className="text-gray-400 text-sm">
          {track.artists.map((artist) => artist.name).join(", ")}
        </p>
      </div>
      <div className="text-gray-400 text-sm">
        {track.popularity}% popularity
      </div>
    </div>
  );
}
