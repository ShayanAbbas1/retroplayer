"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  TimeRange,
  SpotifyArtist,
  SpotifyTrack,
  SpotifyAlbum,
} from "@/types/spotify";
import ArtistsList from "@/components/ArtistsList";
import TracksList from "@/components/TracksList";
import AlbumsList from "@/components/AlbumsList";
import { PopupProvider } from "@/contexts/PopupContext";
import { StreamingDataUpload } from "@/components/streaming-data-upload";
import { StreamingInsights } from "@/components/streaming-insights";
import { StreamingDataProvider } from "@/contexts/StreamingDataContext";
import RetroPlayer from "@/components/retro-player";

type TabType = "player" | "stats" | "streaming";

interface TopData {
  artists: SpotifyArtist[];
  tracks: SpotifyTrack[];
  albums: SpotifyAlbum[];
}

const EMPTY_TOP: TopData = { artists: [], tracks: [], albums: [] };

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>("medium_term");
  const [topData, setTopData] = useState<Record<TimeRange, TopData>>({
    short_term: EMPTY_TOP,
    medium_term: EMPTY_TOP,
    long_term: EMPTY_TOP,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("player");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchTopItems = async (range: TimeRange) => {
      if (!session?.accessToken) return;

      try {
        const [artistsResponse, tracksResponse] = await Promise.all([
          fetch(
            `https://api.spotify.com/v1/me/top/artists?time_range=${range}&limit=50`,
            {
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
              },
            }
          ),
          fetch(
            `https://api.spotify.com/v1/me/top/tracks?time_range=${range}&limit=50`,
            {
              headers: {
                Authorization: `Bearer ${session.accessToken}`,
              },
            }
          ),
        ]);

        if (!artistsResponse.ok || !tracksResponse.ok) {
          throw new Error("Failed to fetch top items");
        }

        const [artistsData, tracksData] = await Promise.all([
          artistsResponse.json(),
          tracksResponse.json(),
        ]);

        // Create a map of album IDs to play counts from top tracks
        const albumPlayCounts = new Map<string, number>();
        tracksData.items.forEach((track: SpotifyTrack) => {
          const count = albumPlayCounts.get(track.album.id) || 0;
          albumPlayCounts.set(track.album.id, count + 1);
        });

        // Sort albums by play count
        const sortedAlbums = Array.from(albumPlayCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([albumId, playCount]) => {
            const track = tracksData.items.find(
              (item: SpotifyTrack) => item.album.id === albumId
            );
            return {
              id: albumId,
              name: track.album.name,
              images: track.album.images,
              artists: track.album.artists,
              release_date: track.album.release_date,
              total_tracks: track.album.total_tracks,
              popularity: playCount,
            };
          });

        setTopData((prev) => ({
          ...prev,
          [range]: {
            artists: artistsData.items,
            tracks: tracksData.items,
            albums: sortedAlbums,
          },
        }));
      } catch (error) {
        console.error("Error fetching top items:", error);
      }
    };

    const fetchAllData = async () => {
      if (!session?.accessToken) return;

      try {
        setIsLoading(true);
        await Promise.all([
          fetchTopItems("short_term"),
          fetchTopItems("medium_term"),
          fetchTopItems("long_term"),
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    if (session?.accessToken) {
      fetchAllData();
    }
  }, [session?.accessToken]);

  const currentData = topData[timeRange];

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-white">Loading Spotify Playground...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <StreamingDataProvider>
      <PopupProvider>
        <div className="min-h-screen py-8 px-4">
          <div className="win-window max-w-7xl mx-auto">
            <div className="win-titlebar flex justify-between items-center">
              <span>Spotify Playground</span>
              <button onClick={() => signOut()} className="px-3 text-[11px]">
                Sign Out
              </button>
            </div>
            <div className="px-4 py-6">

            <div className="flex space-x-4 mb-6">
              <button
                onClick={() => setActiveTab("player")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "player"
                    ? "win-selected"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Player
              </button>
              <button
                onClick={() => setActiveTab("stats")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "stats"
                    ? "win-selected"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Your Stats
              </button>
              <button
                onClick={() => setActiveTab("streaming")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "streaming"
                    ? "win-selected"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                Streaming Insights
              </button>
            </div>

            {/* Always mounted: unmounting disconnects the Web Playback SDK
                and kills the audio when switching tabs. */}
            <div className={activeTab === "player" ? "mt-10" : "hidden"}>
              <RetroPlayer />
            </div>

            {activeTab === "stats" && (
              <>
                <div className="flex space-x-4 mb-6">
                  <button
                    onClick={() => setTimeRange("short_term")}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      timeRange === "short_term"
                        ? "win-selected"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Last 4 weeks
                  </button>
                  <button
                    onClick={() => setTimeRange("medium_term")}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      timeRange === "medium_term"
                        ? "win-selected"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Last 6 months
                  </button>
                  <button
                    onClick={() => setTimeRange("long_term")}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      timeRange === "long_term"
                        ? "win-selected"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    Long Term
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">
                      Top Artists
                    </h2>
                    <ArtistsList artists={currentData.artists} />
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">
                      Top Tracks
                    </h2>
                    <TracksList tracks={currentData.tracks} />
                  </div>

                  <div className="bg-gray-800 rounded-lg p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">
                      Top Albums
                    </h2>
                    <AlbumsList albums={currentData.albums} />
                  </div>
                </div>
              </>
            )}

            {activeTab === "streaming" && (
              <div className="mt-6 space-y-8">
                <StreamingDataUpload />
                <StreamingInsights />
              </div>
            )}
            </div>
          </div>
        </div>
      </PopupProvider>
    </StreamingDataProvider>
  );
}
