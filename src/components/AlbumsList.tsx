"use client";

import VirtualList from "./VirtualList";
import AlbumItem from "./AlbumItem";
import { SpotifyAlbum } from "@/types/spotify";

interface AlbumsListProps {
  albums: SpotifyAlbum[];
}

export default function AlbumsList({ albums }: AlbumsListProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Top Albums</h2>
      <VirtualList<SpotifyAlbum>
        items={albums}
        itemHeight={80}
        className="h-[600px]"
      >
        {(album, index) => <AlbumItem album={album} index={index} />}
      </VirtualList>
    </div>
  );
}
