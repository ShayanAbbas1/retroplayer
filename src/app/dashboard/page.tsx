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
import MusicTasteAnalyzer from "@/components/MusicTasteAnalyzer";

interface SpotifyApiTrack {
  id: string;
  name: string;
  album: {
    id: string;
    name: string;
    images: { url: string }[];
    artists: { name: string }[];
    release_date: string;
    total_tracks: number;
  };
  artists: { name: string }[];
  popularity: number;
}

type TabType = "stats" | "analysis";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [timeRange, setTimeRange] = useState<TimeRange>("medium_term");
  const [topArtists, setTopArtists] = useState<SpotifyArtist[]>([]);
  const [topTracks, setTopTracks] = useState<SpotifyTrack[]>([]);
  const [topAlbums, setTopAlbums] = useState<SpotifyAlbum[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const [longTermArtists, setLongTermArtists] = useState<SpotifyArtist[]>([]);
  const [longTermTracks, setLongTermTracks] = useState<SpotifyTrack[]>([]);
  const [longTermAlbums, setLongTermAlbums] = useState<SpotifyAlbum[]>([]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    const fetchTopItems = async (range: TimeRange) => {
      if (!session?.accessToken) return;

      try {
        setIsLoading(true);
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

        if (range === "long_term") {
          setLongTermArtists(artistsData.items);
          setLongTermTracks(tracksData.items);
          const uniqueAlbums = new Map<string, SpotifyAlbum>();
          tracksData.items.forEach((track: SpotifyApiTrack) => {
            if (
              track.album &&
              track.album.id &&
              !uniqueAlbums.has(track.album.id)
            ) {
              uniqueAlbums.set(track.album.id, {
                id: track.album.id,
                name: track.album.name,
                images: track.album.images,
                artists: track.album.artists,
                release_date: track.album.release_date,
                total_tracks: track.album.total_tracks,
              });
            }
          });
          setLongTermAlbums(Array.from(uniqueAlbums.values()));
        } else {
          setTopArtists(artistsData.items);
          setTopTracks(tracksData.items);
          const uniqueAlbums = new Map<string, SpotifyAlbum>();
          tracksData.items.forEach((track: SpotifyApiTrack) => {
            if (
              track.album &&
              track.album.id &&
              !uniqueAlbums.has(track.album.id)
            ) {
              uniqueAlbums.set(track.album.id, {
                id: track.album.id,
                name: track.album.name,
                images: track.album.images,
                artists: track.album.artists,
                release_date: track.album.release_date,
                total_tracks: track.album.total_tracks,
              });
            }
          });
          setTopAlbums(Array.from(uniqueAlbums.values()));
        }
      } catch (error) {
        console.error("Error fetching top items:", error);
      } finally {
        setIsLoading(false);
      }
    };

    // Fetch both current time range and long term data
    fetchTopItems(timeRange);
    fetchTopItems("long_term");
  }, [session?.accessToken, timeRange]);

  useEffect(() => {
    console.log("Top Artists:", topArtists);
    console.log("Top Tracks:", topTracks);
    console.log("Top Albums:", topAlbums);
  }, [topArtists, topTracks, topAlbums]);

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-white">Loading your Spotify stats...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <PopupProvider>
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Your Spotify Stats</h1>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>

          <div className="flex space-x-4 mb-6">
            <button
              onClick={() => setActiveTab("stats")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "stats"
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Your Stats
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === "analysis"
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              AI Analysis
            </button>
          </div>

          {activeTab === "stats" && (
            <>
              <div className="flex space-x-4 mb-6">
                <button
                  onClick={() => setTimeRange("short_term")}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    timeRange === "short_term"
                      ? "bg-gray-800 text-white border-t border-l border-r border-gray-700"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Last 4 weeks
                </button>
                <button
                  onClick={() => setTimeRange("medium_term")}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    timeRange === "medium_term"
                      ? "bg-gray-800 text-white border-t border-l border-r border-gray-700"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Last 6 months
                </button>
                <button
                  onClick={() => setTimeRange("long_term")}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    timeRange === "long_term"
                      ? "bg-gray-800 text-white border-t border-l border-r border-gray-700"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  All time
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Top Artists
                  </h2>
                  <ArtistsList artists={topArtists} />
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Top Tracks
                  </h2>
                  <TracksList tracks={topTracks} />
                </div>

                <div className="bg-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Top Albums
                  </h2>
                  <AlbumsList albums={topAlbums} />
                </div>
              </div>
            </>
          )}

          {activeTab === "analysis" && (
            <div className="mt-6">
              <MusicTasteAnalyzer
                artists={longTermArtists}
                tracks={longTermTracks}
                albums={longTermAlbums}
              />
            </div>
          )}
        </div>
      </div>
    </PopupProvider>
  );
}
