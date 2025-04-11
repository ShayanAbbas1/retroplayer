"use client";

import { SpotifyArtist } from "@/types/spotify";

interface ArtistItemProps {
  artist: SpotifyArtist;
  index: number;
}

export default function ArtistItem({ artist, index }: ArtistItemProps) {
  return (
    <div className="flex items-center space-x-4 w-full">
      <span className="text-gray-400 w-8">{index + 1}.</span>
      <img
        src={artist.images[0]?.url}
        alt={artist.name}
        className="w-12 h-12 rounded-full"
      />
      <div className="flex-1">
        <p className="text-white font-medium">{artist.name}</p>
        <p className="text-gray-400 text-sm">
          {artist.genres.slice(0, 2).join(", ")}
        </p>
      </div>
      <div className="text-gray-400 text-sm">
        {artist.popularity}% popularity
      </div>
    </div>
  );
}
