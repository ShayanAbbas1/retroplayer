"use client";

import { SpotifyAlbum } from "@/types/spotify";
import { usePopup } from "@/contexts/PopupContext";

export default function AlbumsList({ albums }: { albums: SpotifyAlbum[] }) {
  const { showPopup } = usePopup();

  return (
    <div className="space-y-4">
      {albums.map((album) => (
        <div
          key={album.id}
          onClick={() => showPopup(album)}
          className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
        >
          <img
            src={album.images[0]?.url}
            alt={album.name}
            className="w-12 h-12 rounded object-cover"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-medium truncate">{album.name}</h3>
            <p className="text-gray-400 text-sm truncate">
              {album.artists[0].name}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
