"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TimeRange } from "@/types/spotify";

const timeRanges: { label: string; value: TimeRange }[] = [
  { label: "Last 4 weeks", value: "short_term" },
  { label: "Last 6 months", value: "medium_term" },
  { label: "All time", value: "long_term" },
];

export default function TimeRangeFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTimeRange =
    (searchParams.get("time_range") as TimeRange) || "medium_term";

  const handleTimeRangeChange = (value: TimeRange) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("time_range", value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className="flex space-x-4 mb-6">
      {timeRanges.map((range) => (
        <button
          key={range.value}
          onClick={() => handleTimeRangeChange(range.value)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            currentTimeRange === range.value
              ? "bg-green-500 text-white"
              : "bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
