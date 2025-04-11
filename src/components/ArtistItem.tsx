"use client";

import { SpotifyArtist } from "@/types/spotify";
import { usePopup } from "@/contexts/PopupContext";

interface ArtistItemProps {
  artist: SpotifyArtist;
  index: number;
}

export default function ArtistItem({ artist, index }: ArtistItemProps) {
  const { openPopup } = usePopup();

  return (
    <div
      className="flex items-center space-x-4 w-full p-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={() =>
        openPopup({
          title: artist.name,
          subtitle: `${artist.popularity}% popularity`,
          imageUrl: artist.images[0]?.url,
          details: [
            `Genres: ${artist.genres.join(", ")}`,
            `Followers: ${artist.followers.total.toLocaleString()}`,
          ],
          type: "artist",
        })
      }
    >
      <span className="text-gray-400 w-8">{index + 1}.</span>
      <img
        src={artist.images[0]?.url}
        alt={artist.name}
        className="w-12 h-12 rounded-full"
      />
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{artist.name}</p>
        <p className="text-gray-400 text-sm truncate">
          {artist.genres.slice(0, 2).join(", ")}
        </p>
      </div>
      <div className="text-gray-400 text-sm">
        {artist.popularity}% popularity
      </div>
    </div>
  );
}
