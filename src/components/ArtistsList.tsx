"use client";

import VirtualList from "./VirtualList";
import ArtistItem from "./ArtistItem";
import { SpotifyArtist } from "@/types/spotify";

interface ArtistsListProps {
  artists: SpotifyArtist[];
}

export default function ArtistsList({ artists }: ArtistsListProps) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg">
      <h2 className="text-2xl font-bold text-white mb-4">Top Artists</h2>
      <VirtualList<SpotifyArtist>
        items={artists}
        itemHeight={80}
        className="h-[600px]"
      >
        {(artist, index) => <ArtistItem artist={artist} index={index} />}
      </VirtualList>
    </div>
  );
}
