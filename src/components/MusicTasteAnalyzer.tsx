"use client";

import { useState, useEffect } from "react";
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
  const [analysis, setAnalysis] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyzeMusicTaste = async () => {
    if (!process.env.NEXT_PUBLIC_MISTRAL_API_KEY) {
      setError("Mistral API key is not configured");
      return;
    }

    if (artists.length === 0 || tracks.length === 0 || albums.length === 0) {
      setError("Not enough data to analyze. Please wait for data to load.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const topArtists = artists
        .slice(0, 5)
        .map((a) => a.name)
        .join(", ");
      const topTracks = tracks
        .slice(0, 5)
        .map((t) => t.name)
        .join(", ");
      const topAlbums = albums
        .slice(0, 5)
        .map((a) => a.name)
        .join(", ");

      const prompt = `Let's analyze *your* music taste with brutal honesty and a dash of mockery.  
        Based on your top 5 artists (${topArtists}), top 5 tracks (${topTracks}), and top 5 albums (${topAlbums}), I'm going to tell you EXACTLY who you are — and I'm not holding back.  
        I'll make wildly specific assumptions about your life choices, personality quirks, and fashion sense based entirely on your music. Expect uncomfortable accuracy, layered with playful exaggeration.  
        Think of this as a musical intervention disguised as a roast. I'll toss in some music references that'll either make you feel seen… or completely exposed.  
        Don't worry, it's (mostly) all in good fun. You might want to keep tissues nearby — whether for laughter or shame is up to you.  
        Limit your savage insights to 200 words of musical judgment.`;

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
                  "You are a witty music critic with a great sense of humor. Your analysis should be entertaining and insightful, with a touch of sarcasm.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
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
      // Cache the analysis in session storage with a unique key based on the data
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
    // Create a unique cache key based on the first items
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
          <p className="text-gray-300 text-lg">Analyzing your music taste...</p>
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
          <div className="flex justify-between items-center">
            <p className="text-gray-300 text-lg leading-relaxed whitespace-pre-line">
              {analysis}
            </p>
            <button
              onClick={handleRegenerate}
              className="ml-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-white transition-colors"
            >
              Regenerate
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
