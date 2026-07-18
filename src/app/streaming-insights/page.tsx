"use client";

import { StreamingDataUpload } from "../../components/streaming-data-upload";
import { StreamingInsights } from "../../components/streaming-insights";
import { StreamingDataProvider } from "../../contexts/StreamingDataContext";

export default function StreamingInsightsPage() {
  return (
    <StreamingDataProvider>
      <div className="container mx-auto px-4 py-8">
        <div className="win-window">
        <div className="win-titlebar">Your Spotify Streaming Insights</div>
        <div className="px-4 py-6">
        <div className="prose max-w-none mb-8">
          <p className="text-gray-600 mb-4">
            This feature allows you to analyze your complete Spotify listening
            history. To use it:
          </p>
          <ol className="list-decimal list-inside space-y-2 text-gray-600">
            <li>
              Request your data from Spotify by visiting your{" "}
              <a
                href="https://www.spotify.com/us/account/privacy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700"
              >
                privacy settings
              </a>
            </li>
            <li>
              Select &quot;Extended streaming history&quot; and request your
              data
            </li>
            <li>
              Wait for Spotify to prepare your data (this can take up to 30
              days)
            </li>
            <li>
              Once you receive the email from Spotify, download the zip file
            </li>
            <li>Upload the zip file below to see your insights</li>
          </ol>
          <p className="text-gray-600 mt-4">
            Your data will be processed entirely in your browser and won&apos;t
            be sent to any server.
          </p>
        </div>
        <div className="space-y-8">
          <StreamingDataUpload />
          <StreamingInsights />
        </div>
        </div>
        </div>
      </div>
    </StreamingDataProvider>
  );
}
