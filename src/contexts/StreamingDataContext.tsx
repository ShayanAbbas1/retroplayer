import React, { createContext, useContext, useState, useCallback } from "react";
import type { StreamingData } from "../types/streaming-data";

interface StreamingDataContextValue {
  data: StreamingData[];
  setData: (data: StreamingData[]) => void;
  clearData: () => void;
}

const StreamingDataContext = createContext<
  StreamingDataContextValue | undefined
>(undefined);

export function StreamingDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [data, setDataState] = useState<StreamingData[]>([]);

  const setData = useCallback((newData: StreamingData[]) => {
    setDataState(newData);
  }, []);

  const clearData = useCallback(() => {
    setDataState([]);
  }, []);

  return (
    <StreamingDataContext.Provider value={{ data, setData, clearData }}>
      {children}
    </StreamingDataContext.Provider>
  );
}

export function useStreamingData() {
  const ctx = useContext(StreamingDataContext);
  if (!ctx)
    throw new Error(
      "useStreamingData must be used within a StreamingDataProvider"
    );
  return ctx;
}
