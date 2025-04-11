"use client";

import { SpotifyAlbum } from "@/types/spotify";
import { usePopup } from "@/contexts/PopupContext";

interface AlbumItemProps {
  album: SpotifyAlbum;
  index: number;
}

export default function AlbumItem({ album, index }: AlbumItemProps) {
  const { openPopup } = usePopup();

  return (
    <div
      className="flex items-center space-x-4 w-full p-2 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
      onClick={() =>
        openPopup({
          title: album.name,
          subtitle: album.artists.map((artist) => artist.name).join(", "),
          imageUrl: album.images[0]?.url,
          details: [
            `Release Date: ${album.release_date}`,
            `Total Tracks: ${album.total_tracks}`,
          ],
          type: "album",
        })
      }
    >
      <span className="text-gray-400 w-8">{index + 1}.</span>
      <img
        src={album.images[0]?.url}
        alt={album.name}
        className="w-12 h-12 rounded"
      />
      <div className="flex-1 min-w-0">
        <p className="text-white font-medium truncate">{album.name}</p>
        <p className="text-gray-400 text-sm truncate">
          {album.artists.map((artist) => artist.name).join(", ")}
        </p>
        <p className="text-gray-400 text-xs">
          {album.release_date.split("-")[0]} • {album.total_tracks} tracks
        </p>
      </div>
    </div>
  );
}
