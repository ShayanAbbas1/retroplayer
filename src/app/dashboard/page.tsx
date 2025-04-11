import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { getSpotifyApi } from "@/lib/spotify";
import TimeRangeFilter from "@/components/TimeRangeFilter";
import ArtistsList from "@/components/ArtistsList";
import TracksList from "@/components/TracksList";
import AlbumsList from "@/components/AlbumsList";
import { TimeRange, SpotifyAlbum } from "@/types/spotify";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { time_range?: TimeRange };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const timeRange = searchParams.time_range || "medium_term";
  const spotifyApi = getSpotifyApi(session.accessToken!);

  const [topArtists, topTracks] = await Promise.all([
    spotifyApi.getMyTopArtists({ limit: 50, time_range: timeRange }),
    spotifyApi.getMyTopTracks({ limit: 50, time_range: timeRange }),
  ]);

  // Extract unique albums from top tracks
  const albumsMap = new Map<string, SpotifyAlbum>();
  topTracks.body.items.forEach((track) => {
    if (track.album && !albumsMap.has(track.album.id)) {
      albumsMap.set(track.album.id, track.album);
    }
  });
  const topAlbums = Array.from(albumsMap.values());

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-8">
          Your Spotify Stats
        </h1>

        <TimeRangeFilter />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ArtistsList artists={topArtists.body.items} />
          <TracksList tracks={topTracks.body.items} />
          <AlbumsList albums={topAlbums} />
        </div>
      </div>
    </div>
  );
}
