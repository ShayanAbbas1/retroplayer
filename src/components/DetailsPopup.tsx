"use client";

import { SpotifyArtist, SpotifyTrack, SpotifyAlbum } from "@/types/spotify";

type PopupItem = SpotifyArtist | SpotifyTrack | SpotifyAlbum;

interface DetailsPopupProps {
  item: PopupItem;
  onClose: () => void;
}

export default function DetailsPopup({ item, onClose }: DetailsPopupProps) {
  const isArtist = "genres" in item;
  const isTrack = "album" in item;
  const isAlbum = "release_date" in item && !isTrack;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-4">
            <img
              src={
                isArtist
                  ? item.images[0]?.url
                  : isTrack
                  ? item.album.images[0]?.url
                  : item.images[0]?.url
              }
              alt={item.name}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <h2 className="text-xl font-bold text-white">{item.name}</h2>
              <p className="text-gray-400">
                {isArtist
                  ? "Artist"
                  : isTrack
                  ? `Track • ${item.artists[0].name}`
                  : `Album • ${item.artists[0].name}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {isArtist && (
            <>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">
                  Genres
                </h3>
                <p className="text-white">
                  {item.genres.slice(0, 3).join(", ")}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">
                  Popularity
                </h3>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${item.popularity}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {isTrack && (
            <>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">
                  Album
                </h3>
                <p className="text-white">{item.album.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">
                  Popularity
                </h3>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${item.popularity}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {isAlbum && (
            <>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">
                  Release Date
                </h3>
                <p className="text-white">{item.release_date}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-1">
                  Total Tracks
                </h3>
                <p className="text-white">{item.total_tracks}</p>
              </div>
              {item.popularity && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">
                    Popularity
                  </h3>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${item.popularity}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
