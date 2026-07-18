import type {
  StreamingData,
  StreamingDataState,
} from "../types/streaming-data";
import type JSZip from "jszip";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";

class StreamingDataService {
  private static STORAGE_KEY = "spotify_streaming_data";

  private stateSubject = new BehaviorSubject<StreamingDataState>({
    data: [],
    isLoading: false,
    error: null,
  });

  private listeners: ((state: StreamingDataState) => void)[] = [];

  constructor() {
    // Rehydrate from sessionStorage if present
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(StreamingDataService.STORAGE_KEY);
      if (stored) {
        try {
          const data = JSON.parse(stored);
          if (Array.isArray(data)) {
            this.stateSubject.next({
              data,
              isLoading: false,
              error: null,
            });
          }
        } catch {}
      }
    }
  }

  public getState(): StreamingDataState {
    return this.stateSubject.getValue();
  }

  public getState$(): Observable<StreamingDataState> {
    return this.stateSubject.asObservable();
  }

  public subscribe(listener: (state: StreamingDataState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) =>
      listener(this.stateSubject.getValue())
    );
  }

  public async processZipFile(
    file: File
  ): Promise<StreamingData[] | undefined> {
    this.stateSubject.next({
      ...this.stateSubject.getValue(),
      isLoading: true,
      error: null,
    });
    this.notifyListeners();

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);


      const processFile = async (
        filename: string,
        zipFile: JSZip.JSZipObject
      ): Promise<StreamingData[]> => {
        if (
          !filename.includes("Streaming_History_Audio_") ||
          !filename.endsWith(".json")
        ) {
          return [];
        }

        const content = await zipFile.async("text");

        let jsonData;
        try {
          jsonData = JSON.parse(content);
        } catch (error) {
          console.error(`Error parsing JSON in ${filename}:`, error);
          return [];
        }

        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

        return dataArray.filter(
          (item): item is StreamingData =>
            typeof item === "object" &&
            item !== null &&
            "ts" in item &&
            "ms_played" in item
        );
      };

      const filePromises = Object.entries(zip.files).map(
        ([filename, zipFile]) =>
          processFile(filename, zipFile as JSZip.JSZipObject)
      );

      const results = await Promise.all(filePromises);

      const combinedData = results.flat();

      if (combinedData.length === 0) {
        throw new Error("No valid streaming data found in the zip file");
      }

      this.stateSubject.next({
        data: combinedData,
        isLoading: false,
        error: null,
      });
      return combinedData;
    } catch (error) {
      console.error("Error processing zip file:", error);
      this.stateSubject.next({
        ...this.stateSubject.getValue(),
        isLoading: false,
        error:
          error instanceof Error ? error : new Error("Unknown error occurred"),
      });
      return undefined;
    }

    this.notifyListeners();
  }

  public getTopArtists$(): Observable<
    { artist: string; count: number; durationMs: number }[]
  > {
    return this.stateSubject.pipe(
      map((state: StreamingDataState) => {
        const artistCounts = new Map<
          string,
          { count: number; durationMs: number }
        >();

        state.data.forEach((item: StreamingData) => {
          if (item.master_metadata_album_artist_name) {
            const prev = artistCounts.get(
              item.master_metadata_album_artist_name
            ) || { count: 0, durationMs: 0 };
            artistCounts.set(item.master_metadata_album_artist_name, {
              count: prev.count + 1,
              durationMs: prev.durationMs + item.ms_played,
            });
          }
        });

        return Array.from(artistCounts.entries())
          .map(([artist, { count, durationMs }]) => ({
            artist,
            count,
            durationMs,
          }))
          .sort((a, b) => b.count - a.count);
      })
    );
  }

  public getTopTracks$(): Observable<
    { track: string; count: number; durationMs: number }[]
  > {
    return this.stateSubject.pipe(
      map((state: StreamingDataState) => {
        const trackCounts = new Map<
          string,
          { count: number; durationMs: number }
        >();

        state.data.forEach((item: StreamingData) => {
          if (item.master_metadata_track_name) {
            const prev = trackCounts.get(item.master_metadata_track_name) || {
              count: 0,
              durationMs: 0,
            };
            trackCounts.set(item.master_metadata_track_name, {
              count: prev.count + 1,
              durationMs: prev.durationMs + item.ms_played,
            });
          }
        });

        return Array.from(trackCounts.entries())
          .map(([track, { count, durationMs }]) => ({
            track,
            count,
            durationMs,
          }))
          .sort((a, b) => b.count - a.count);
      })
    );
  }

  public getTopAlbums$(): Observable<
    { album: string; count: number; durationMs: number }[]
  > {
    return this.stateSubject.pipe(
      map((state: StreamingDataState) => {
        const albumCounts = new Map<
          string,
          { count: number; durationMs: number }
        >();

        state.data.forEach((item: StreamingData) => {
          if (item.master_metadata_album_album_name) {
            const prev = albumCounts.get(
              item.master_metadata_album_album_name
            ) || {
              count: 0,
              durationMs: 0,
            };
            albumCounts.set(item.master_metadata_album_album_name, {
              count: prev.count + 1,
              durationMs: prev.durationMs + item.ms_played,
            });
          }
        });

        return Array.from(albumCounts.entries())
          .map(([album, { count, durationMs }]) => ({
            album,
            count,
            durationMs,
          }))
          .sort((a, b) => b.count - a.count);
      })
    );
  }

  public getTotalListeningTime$(): Observable<{
    ms: number;
    seconds: number;
    minutes: number;
    hours: number;
    days: number;
  }> {
    return this.stateSubject.pipe(
      map((state: StreamingDataState) => {
        const totalMs = state.data.reduce(
          (total, item) => total + item.ms_played,
          0
        );
        const seconds = Math.floor(totalMs / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        return {
          ms: totalMs,
          seconds,
          minutes,
          hours,
          days,
        };
      })
    );
  }

  public getListeningTimeByDate$(): Observable<
    { date: string; time: number }[]
  > {
    return this.stateSubject.pipe(
      map((state: StreamingDataState) => {
        const dateMap = new Map<string, number>();

        state.data.forEach((item: StreamingData) => {
          const date = new Date(item.ts).toISOString().split("T")[0];
          const currentTime = dateMap.get(date) || 0;
          dateMap.set(date, currentTime + item.ms_played);
        });

        return Array.from(dateMap.entries())
          .map(([date, time]) => ({ date, time }))
          .sort((a, b) => a.date.localeCompare(b.date));
      })
    );
  }
}

export const streamingDataService = new StreamingDataService();
