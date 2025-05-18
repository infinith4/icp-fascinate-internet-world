import Hls from 'hls.js';
import { Actor } from '@dfinity/agent';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { text } from 'stream/consumers';

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

interface LoaderPlaylistResponse {
  url: string;
  data: string;
}

interface CustomLoader {
  load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks): void;
  abort(): void;
  destroy(): void;
  new(config: LoaderConfiguration): CustomLoader;
}

async function fetchDataFromBlobURL(blobUrl: string) {
  try {
    // 2. fetch API を使用して Blob URL からデータを取得
    // const response = fetch(blobUrl)
    // .then(res => res.blob())
    // .then(blob => {
    //   console.warn(`------------blob.text: ${blob.text().then(res => {
    //     console.warn(`-------------res ${res}`);
    //   })}`);
    // })

    const response = await fetch(blobUrl);

    // // 3. レスポンスが正常か確認
    // if (!response.ok) {
    //   throw new Error(`HTTP error! status: ${response.status}`);
    // }

    // 4. レスポンスデータを目的の形式で取得
    // 例えば、ArrayBufferとして取得する場合:
    // const arrayBuffer = await response.arrayBuffer();
    // console.log("Data as ArrayBuffer:", arrayBuffer);

    //例えば、テキストとして取得する場合 (Blobがテキストデータの場合):
    const textData = await (await response.blob()).text();
    console.log("Data as Text:", textData);

    // 例えば、JSONとして取得する場合 (BlobがJSONデータの場合):
    // const jsonData = await response.json();
    // console.log("Data as JSON:", jsonData);

    // 例えば、Blobとして再度取得する場合 (あまり意味はないかもしれませんが、可能です):
    // const newBlob = await response.blob();
    // console.log("Data as new Blob:", newBlob);

    return textData; // または他の形式のデータ

  } catch (error) {
    console.error("Error fetching data from Blob URL:", error);
    return null;
  } finally {
    // 5. 生成した Blob URL を解放 (メモリリークを防ぐため)
    URL.revokeObjectURL(blobUrl);
  }
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
      
      console.warn(`--------------------customloader. url: ${url}`);
      if (url.protocol === 'icsegment:') {
        const segmentPath = url.pathname.split('/').pop();
        if (segmentPath) {
          const segmentIndex = parseInt(segmentPath.split('-')[1], 10);
          this.loadSegment(segmentIndex);
        }
      } else {
        // For non-icsegment URLs (like the initial m3u8 file), use fetch
        // console.log(`fetchDataFromBlobURL context.url: ${context.url}`)
        // const responseFetchDataFromBlobURL = fetchDataFromBlobURL(context.url);
        // console.log(`fetchDataFromBlobURL response: ${responseFetchDataFromBlobURL}`);
        
        fetch(context.url)
          .then(response => {
            if (!response.ok) {
              // HTTPエラーレスポンスの場合、エラーをスローして .catch() で処理
              throw new Error(`HTTP error ${response.status} for ${context.url}`);
            }
            return response.blob(); // Blobとしてレスポンスボディを取得 (Promise<Blob>を返す)
          })
          .then(blob => {
            return blob.text(); // Blobをテキストとして読み込み (Promise<string>を返す)
          })
          .then(textData => { // textData は解決された string
            console.warn(`-------------------textData: ${textData}`);
            const response: LoaderPlaylistResponse = {
              url: context.url,
              data: textData, // ここで string 型のデータがセットされる
            };
            
            console.warn(`-------------------this.callbacks: ${JSON.stringify(this.callbacks)}`);
            // this.stats は適切な統計情報を持っていると仮定
            this.callbacks?.onSuccess(response, this.stats, context);
          })
          .catch(error => {
            console.error("Failed to load playlist:", error); // エラーログ
            // Hls.js のエラーオブジェクト形式に合わせることを推奨
            // もし Hls オブジェクトが利用可能であれば、より具体的なエラータイプを設定できます。
            // 例: Hls.ErrorTypes.NETWORK_ERROR, Hls.ErrorDetails.MANIFEST_LOAD_ERROR
            const errorData = {
              // type: Hls.ErrorTypes.NETWORK_ERROR, // Hls.js の型を使う場合
              // details: Hls.ErrorDetails.MANIFEST_LOAD_ERROR, // Hls.js の型を使う場合
              type: 'networkError', // 元のコードに合わせたフォールバック
              details: 'playlistLoadError', // 'fragLoadError' から変更 (プレイリストなので)
              fatal: true, // 致命的なエラーかどうか
              error: error, // 元のJavaScriptエラーオブジェクト
              // networkDetails: xhr // XHRを使わないので、Fetch APIのresponseオブジェクトなどを渡すことも検討可能
            };
            this.callbacks?.onError(errorData, context);
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
        
        console.warn(`--------------------this.context!.url: ${this.context!.url}`);
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