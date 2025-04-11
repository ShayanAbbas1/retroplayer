"use client";

import { SpotifyTrack } from "@/types/spotify";
import { usePopup } from "@/contexts/PopupContext";

interface TrackItemProps {
  track: SpotifyTrack;
  index: number;
}

export default function TrackItem({ track, index }: TrackItemProps) {
  const { openPopup } = usePopup();

  return (
    <div
      className="flex items-center space-x-4 w-full p-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={() =>
        openPopup({
          title: track.name,
          subtitle: track.artists.map((artist) => artist.name).join(", "),
          imageUrl: track.album.images[0]?.url,
          details: [
            `Album: ${track.album.name}`,
            `Release Date: ${track.album.release_date}`,
            `Popularity: ${track.popularity}%`,
          ],
          type: "track",
        })
      }
    >
      <span className="text-gray-400 w-8">{index + 1}.</span>
      <img
        src={track.album.images[0]?.url}
        alt={track.name}
        className="w-12 h-12 rounded"
      />
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{track.name}</p>
        <p className="text-gray-400 text-sm truncate">
          {track.artists.map((artist) => artist.name).join(", ")}
        </p>
      </div>
      <div className="text-gray-400 text-sm">
        {track.popularity}% popularity
      </div>
    </div>
  );
}
