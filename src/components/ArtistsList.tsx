"use client";

import { SpotifyArtist } from "@/types/spotify";
import { usePopup } from "@/contexts/PopupContext";

export default function ArtistsList({ artists }: { artists: SpotifyArtist[] }) {
  const { showPopup } = usePopup();

  return (
    <div className="space-y-4">
      {artists.map((artist) => (
        <div
          key={artist.id}
          onClick={() => showPopup(artist)}
          className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
        >
          <img
            src={artist.images[0]?.url}
            alt={artist.name}
            className="w-12 h-12 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">{artist.name}</h3>
            <p className="text-gray-400 text-sm truncate">
              {artist.genres.slice(0, 2).join(", ")}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
