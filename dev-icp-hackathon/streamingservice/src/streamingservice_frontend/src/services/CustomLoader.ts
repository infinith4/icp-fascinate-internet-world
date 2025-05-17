import Hls from 'hls.js';
import { Actor } from '@dfinity/agent';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';

// HLS custom loader for streaming

// Define the loader interface to match hls.js requirements
interface LoaderContext {
  url: string;
  responseType: string;
  rangeStart?: number;
  rangeEnd?: number;
  [key: string]: any;
}

interface LoaderConfiguration {
  [key: string]: any;
}

interface LoaderCallbacks {
  onSuccess: (response: any, stats: any, context: LoaderContext) => void;
  onError: (error: any, context: LoaderContext) => void;
  onTimeout: (stats: any, context: LoaderContext) => void;
  [key: string]: any;
}

interface LoaderStats {
  trequest: number;
  tfirst: number;
  tload: number;
  loaded: number;
  total: number;
  bw: number;
}

interface LoaderResponse {
  url: string;
  data: Uint8Array;
}

interface CustomLoader {
  load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks): void;
  abort(): void;
  destroy(): void;
  new(config: LoaderConfiguration): CustomLoader;
}

export const createCustomLoader = (actor: Actor & _SERVICE, videoId: string): any => {
  return class CustomLoader {
    private context: LoaderContext | null = null;
    private callbacks: LoaderCallbacks | null = null;
    private stats: LoaderStats;

    constructor(config: LoaderConfiguration) {
      this.stats = { trequest: 0, tfirst: 0, tload: 0, loaded: 0, total: 0, bw: 0 };
    }

    destroy(): void {
      this.context = null;
      this.callbacks = null;
    }

    abort(): void {
      // Implement abort logic if needed
    }

    load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks): void {
      this.context = context;
      this.callbacks = callbacks;

      const url = new URL(context.url);
      if (url.protocol === 'icsegment:') {
        const segmentPath = url.pathname.split('/').pop();
        if (segmentPath) {
          const segmentIndex = parseInt(segmentPath.split('-')[1], 10);
          this.loadSegment(segmentIndex);
        }
      } else {
        // For non-icsegment URLs (like the initial m3u8 file), use fetch
        fetch(context.url)
          .then(response => response.arrayBuffer())
          .then(data => {
            const response: LoaderResponse = {
              url: context.url,
              data: new Uint8Array(data),
            };
            this.callbacks?.onSuccess(response, this.stats, context);
          })
          .catch(error => {
            this.callbacks?.onError({
              type: 'networkError',
              details: 'fragLoadError',
              fatal: true,
              error
            }, context);
          });
      }
    }

    private async loadSegment(segmentIndex: number): Promise<void> {
        console.log(`---------------------- loadSegment ${segmentIndex}----------------------`);
      try {
        let offset = 0;
        let segmentData: number[] = [];

        while (true) {
          const result = await actor.get_segment_chunk(videoId, segmentIndex, offset);
          if ('err' in result) {
            throw new Error(`Failed to get segment chunk: ${JSON.stringify(result.err)}`);
          }

          const chunkData = result.ok.segment_chunk_data;
          // Ensure chunkData is an array before concatenating
          if (chunkData instanceof Uint8Array) {
            segmentData = segmentData.concat(Array.from(chunkData));
          } else {
            segmentData = segmentData.concat(chunkData as number[]);
          }

          if (offset + chunkData.length >= result.ok.total_chunk_count) {
            break;
          }

          offset += chunkData.length;
        }

        const response: LoaderResponse = {
          url: this.context!.url,
          data: new Uint8Array(segmentData),
        };

        this.callbacks?.onSuccess(response, this.stats, this.context!);
      } catch (error: any) {
        console.error('Error loading segment:', error);
        this.callbacks?.onError({
          type: 'networkError',
          details: 'fragLoadError',
          fatal: true,
          error
        }, this.context!);
      }
    }
  };
};