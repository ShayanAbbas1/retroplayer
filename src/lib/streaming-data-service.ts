import type {
  StreamingData,
  StreamingDataState,
} from "../types/streaming-data";
import type JSZip from "jszip";
import { BehaviorSubject, Observable } from "rxjs";
import { map } from "rxjs/operators";

class StreamingDataService {
  private stateSubject = new BehaviorSubject<StreamingDataState>({
    data: [],
    isLoading: false,
    error: null,
  });

  private listeners: ((state: StreamingDataState) => void)[] = [];

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

  public async processZipFile(file: File): Promise<void> {
    this.stateSubject.next({
      ...this.stateSubject.getValue(),
      isLoading: true,
      error: null,
    });
    this.notifyListeners();

    try {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);

      console.log("Zip file loaded, processing files...");
      console.log("Files in zip:", Object.keys(zip.files));

      const processFile = async (
        filename: string,
        zipFile: JSZip.JSZipObject
      ): Promise<StreamingData[]> => {
        console.log("Processing file:", filename);
        if (
          !filename.includes("Streaming_History_Audio_") ||
          !filename.endsWith(".json")
        ) {
          console.log(`Skipping file: ${filename}`);
          return [];
        }

        console.log(`Processing file: ${filename}`);
        const content = await zipFile.async("text");
        console.log(`File content length: ${content.length}`);

        let jsonData;
        try {
          jsonData = JSON.parse(content);
          console.log(
            `Parsed JSON data type: ${
              Array.isArray(jsonData) ? "array" : typeof jsonData
            }`
          );
        } catch (error) {
          console.error(`Error parsing JSON in ${filename}:`, error);
          return [];
        }

        const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
        console.log(`Found ${dataArray.length} entries in ${filename}`);

        const validData = dataArray.filter((item): item is StreamingData => {
          const isValid =
            typeof item === "object" &&
            item !== null &&
            "ts" in item &&
            "ms_played" in item;
          if (!isValid) {
            console.log(`Invalid entry in ${filename}:`, item);
          }
          return isValid;
        });

        console.log(`Valid entries in ${filename}: ${validData.length}`);
        return validData;
      };

      const filePromises = Object.entries(zip.files).map(
        ([filename, zipFile]) =>
          processFile(filename, zipFile as JSZip.JSZipObject)
      );

      const results = await Promise.all(filePromises);
      console.log("Results from all files:", results);

      const combinedData = results.flat();
      console.log("Combined data:", combinedData);
      console.log(`Total valid entries processed: ${combinedData.length}`);

      if (combinedData.length === 0) {
        throw new Error("No valid streaming data found in the zip file");
      }

      this.stateSubject.next({
        data: combinedData,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error("Error processing zip file:", error);
      this.stateSubject.next({
        ...this.stateSubject.getValue(),
        isLoading: false,
        error:
          error instanceof Error ? error : new Error("Unknown error occurred"),
      });
    }

    this.notifyListeners();
  }

  public getTopArtists$(): Observable<{ artist: string; count: number }[]> {
    return this.stateSubject.pipe(
      map((state: StreamingDataState) => {
        const artistCounts = new Map<string, number>();

        state.data.forEach((item: StreamingData) => {
          if (item.master_metadata_album_artist_name) {
            const count =
              artistCounts.get(item.master_metadata_album_artist_name) || 0;
            artistCounts.set(item.master_metadata_album_artist_name, count + 1);
          }
        });

        return Array.from(artistCounts.entries())
          .map(([artist, count]) => ({ artist, count }))
          .sort((a, b) => b.count - a.count);
      })
    );
  }

  public getTopTracks$(): Observable<{ track: string; count: number }[]> {
    return this.stateSubject.pipe(
      map((state: StreamingDataState) => {
        const trackCounts = new Map<string, number>();

        state.data.forEach((item: StreamingData) => {
          if (item.master_metadata_track_name) {
            const count = trackCounts.get(item.master_metadata_track_name) || 0;
            trackCounts.set(item.master_metadata_track_name, count + 1);
          }
        });

        return Array.from(trackCounts.entries())
          .map(([track, count]) => ({ track, count }))
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
