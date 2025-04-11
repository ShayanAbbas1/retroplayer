"use client";

import { SpotifyTrack } from "@/types/spotify";
import { usePopup } from "@/contexts/PopupContext";

export default function TracksList({ tracks }: { tracks: SpotifyTrack[] }) {
  const { showPopup } = usePopup();

  return (
    <div className="space-y-4">
      {tracks.map((track) => (
        <div
          key={track.id}
          onClick={() => showPopup(track)}
          className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
        >
          <img
            src={track.album.images[0]?.url}
            alt={track.name}
            className="w-12 h-12 rounded object-cover"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">{track.name}</h3>
            <p className="text-gray-400 text-sm truncate">
              {track.artists[0].name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
