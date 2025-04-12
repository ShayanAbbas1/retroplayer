"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { SpotifyArtist, SpotifyTrack, SpotifyAlbum } from "@/types/spotify";

interface MusicTasteAnalyzerProps {
  artists: SpotifyArtist[];
  tracks: SpotifyTrack[];
  albums: SpotifyAlbum[];
}

export default function MusicTasteAnalyzer({
  artists,
  tracks,
  albums,
}: MusicTasteAnalyzerProps) {
  const { data: session } = useSession();
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeMusicTaste = async () => {
    if (!process.env.NEXT_PUBLIC_MISTRAL_API_KEY) {
      setError("Mistral API key is not configured");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch long-term data directly from Spotify API
      const [artistsResponse, tracksResponse] = await Promise.all([
        fetch(
          "https://api.spotify.com/v1/me/top/artists?time_range=long_term&limit=5",
          {
            headers: {
              Authorization: `Bearer ${session?.accessToken}`,
            },
          }
        ),
        fetch(
          "https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=5",
          {
            headers: {
              Authorization: `Bearer ${session?.accessToken}`,
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
        .slice(0, 5)
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

      const topArtists = artistsData.items
        .map((a: SpotifyArtist) => a.name)
        .join(", ");
      const topTracks = tracksData.items
        .map((t: SpotifyTrack) => t.name)
        .join(", ");
      const topAlbums = sortedAlbums.map((a) => a.name).join(", ");

      const prompt = `You are a brutally honest music critic who only finds flaws in people's music taste with a sharp wit and no filter, your response should be in the form of a roast and use casual language. Your task is to roast this person's music taste based on their all-time top 5 artists (${topArtists}), top 5 tracks (${topTracks}), and top 5 albums (${topAlbums}).

      Make wild, specific assumptions about their personality, lifestyle, and life choices based solely on their music taste. Be creative and funny and just roast, don't hold back. Include:
      - Their dating life
      - Their social media presence
      - Chances of them being employed
      - Their questionable life decisions
      - Their taste in memes
      - Their most embarrassing moments
      
      Use a mix of playful exaggeration and uncomfortably accurate observations. Throw in some music references and puns. Keep it under 200 words.`;

      const response = await fetch(
        "https://api.mistral.ai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_MISTRAL_API_KEY}`,
          },
          body: JSON.stringify({
            model: "mistral-tiny",
            messages: [
              {
                role: "system",
                content:
                  "You are a witty, sarcastic music critic who specializes in roasting people's music taste. Your roasts should be funny, creative, and slightly uncomfortable in their accuracy. Mix humor with sharp observations.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.8,
            max_tokens: 500,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices?.[0]?.message?.content) {
        throw new Error("Invalid response format from Mistral API");
      }

      const analysisText = data.choices[0].message.content;
      setAnalysis(analysisText);
      const cacheKey = `musicAnalysis_${artists[0]?.id}_${tracks[0]?.id}_${albums[0]?.id}`;
      sessionStorage.setItem(cacheKey, analysisText);
    } catch (error) {
      console.error("Error analyzing music taste:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to analyze music taste. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const cacheKey = `musicAnalysis_${artists[0]?.id}_${tracks[0]?.id}_${albums[0]?.id}`;
    const cachedAnalysis = sessionStorage.getItem(cacheKey);

    if (cachedAnalysis) {
      setAnalysis(cachedAnalysis);
    } else {
      analyzeMusicTaste();
    }
  }, [artists, tracks, albums]);

  const handleRegenerate = () => {
    const cacheKey = `musicAnalysis_${artists[0]?.id}_${tracks[0]?.id}_${albums[0]?.id}`;
    sessionStorage.removeItem(cacheKey);
    analyzeMusicTaste();
  };

  if (!process.env.NEXT_PUBLIC_MISTRAL_API_KEY) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
        <p className="text-red-400">Mistral API key is not configured</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg p-6 border border-gray-700 shadow-xl">
      {isLoading ? (
        <div className="flex items-center justify-center py-8 space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-green-500"></div>
          <p className="text-gray-300 text-lg">Preparing your roast...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={handleRegenerate}
            className="mt-2 text-sm text-red-400 hover:text-red-300"
          >
            Try again
          </button>
        </div>
      ) : analysis ? (
        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-line">
              {analysis}
            </p>
            <button
              onClick={handleRegenerate}
              className="ml-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
            >
              Get roasted again
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
