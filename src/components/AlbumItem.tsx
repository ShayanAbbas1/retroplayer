"use client";

import { SpotifyAlbum } from "@/types/spotify";

interface AlbumItemProps {
  album: SpotifyAlbum;
  index: number;
}

export default function AlbumItem({ album, index }: AlbumItemProps) {
  return (
    <div className="flex items-center space-x-4 w-full">
      <span className="text-gray-400 w-8">{index + 1}.</span>
      <img
        src={album.images[0]?.url}
        alt={album.name}
        className="w-12 h-12 rounded"
      />
      <div className="flex-1">
        <p className="text-white font-medium">{album.name}</p>
        <p className="text-gray-400 text-sm">
          {album.artists.map((artist) => artist.name).join(", ")}
        </p>
        <p className="text-gray-400 text-xs">
          {album.release_date.split("-")[0]} • {album.total_tracks} tracks
        </p>
      </div>
      <div className="text-gray-400 text-sm">
        {album.popularity}% popularity
      </div>
    </div>
  );
}
