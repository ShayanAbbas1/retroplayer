"use client";
import { useState } from "react";
import { streamingDataService } from "../lib/streaming-data-service";
import { useStreamingData } from "../contexts/StreamingDataContext";

export function StreamingDataUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const { setData } = useStreamingData();

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith(".zip")) {
      const data = await streamingDataService.processZipFile(file);
      if (data != null) setData(data);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith(".zip")) {
      const data = await streamingDataService.processZipFile(file);
      if (data != null) setData(data);
    }
  };

  return (
    <>
      <div className="mb-6 bg-gray-900 border border-gray-700 rounded-lg p-4 text-left text-white">
        <h2 className="text-lg font-semibold mb-2 text-green-500">
          How to get your Spotify streaming data
        </h2>
        <ol className="list-decimal list-inside space-y-1 text-gray-200">
          <li>
            Go to{" "}
            <a
              href="https://www.spotify.com/de-en/account/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-green-400 underline hover:text-green-300"
            >
              your Spotify privacy page
            </a>
            .
          </li>
          <li>
            Click on{" "}
            <span className="font-semibold">
              &quot;Extended streaming history&quot;
            </span>{" "}
            and follow the instructions to request your data.
          </li>
          <li>
            Spotify will email you a download link according to their provided
            timeline.
          </li>
          <li>
            Download the ZIP file from the email and upload it here. We will
            process your data and show your insights!
          </li>
        </ol>
      </div>
      <div
        className={`p-8 border-2 border-dashed rounded-lg text-center ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".zip"
          onChange={handleFileInput}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer text-blue-500 hover:text-blue-700"
        >
          <div className="text-lg font-medium mb-2">
            {isDragging ? "Drop your file here" : "Upload your streaming data"}
          </div>
          <div className="text-sm text-gray-500">
            Drag and drop your zip file here, or click to select a file
          </div>
        </label>
      </div>
    </>
  );
}
