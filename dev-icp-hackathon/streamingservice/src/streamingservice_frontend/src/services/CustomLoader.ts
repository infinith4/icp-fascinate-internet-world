import { Actor } from '@dfinity/agent';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import * as HlsTypes from 'hls.js';

/**
 * セグメントローダークラス
 * 動画セグメントの効率的なロードと管理を行う
 */
export class CustomSegmentLoader {
  private actor: Actor & _SERVICE;
  private videoId: string;
  private segmentCache: Map<number, Uint8Array> = new Map();
  private pendingRequests: Map<number, Promise<Uint8Array>> = new Map();
  private maxConcurrentRequests: number = 2; // 同時リクエスト数の制限
  private activeRequests: number = 0;
  private requestQueue: number[] = [];

  constructor(actor: Actor & _SERVICE, videoId: string) {
    this.actor = actor;
    this.videoId = videoId;
  }

  /**
   * セグメントをロードする
   * キャッシュ、リクエスト制限、キューイングを管理
   */
  async loadSegment(index: number): Promise<Uint8Array> {
    // キャッシュにあればそれを返す
    if (this.segmentCache.has(index)) {
      console.log(`Segment ${index} returned from cache`);
      return this.segmentCache.get(index)!;
    }

    // 既に同じセグメントのリクエストが進行中ならそれを返す
    if (this.pendingRequests.has(index)) {
      console.log(`Segment ${index} request already in progress, waiting...`);
      return this.pendingRequests.get(index)!;
    }

    // 同時リクエスト数を制限
    if (this.activeRequests >= this.maxConcurrentRequests) {
      console.log(`Too many active requests (${this.activeRequests}), queuing segment ${index}`);
      // キューに追加して待機
      return new Promise((resolve) => {
        this.requestQueue.push(index);
        // このセグメントのリクエストが完了したら通知するためのプロミスを作成
        const pendingPromise = new Promise<Uint8Array>((innerResolve) => {
          // キューに追加したリクエストの完了を監視するインターバル
          const checkInterval = setInterval(() => {
            if (this.segmentCache.has(index)) {
              clearInterval(checkInterval);
              innerResolve(this.segmentCache.get(index)!);
            }
          }, 100);
        });
        this.pendingRequests.set(index, pendingPromise);
        resolve(pendingPromise);
      });
    }

    // 新しいリクエストを開始
    this.activeRequests++;
    console.log(`Starting request for segment ${index}, active requests: ${this.activeRequests}`);

    const requestPromise = this.fetchSegment(index);
    this.pendingRequests.set(index, requestPromise);

    try {
      const data = await requestPromise;
      // キャッシュに保存
      this.segmentCache.set(index, data);
      return data;
    } finally {
      // リクエスト完了後の処理
      this.activeRequests--;
      this.pendingRequests.delete(index);
      console.log(`Completed request for segment ${index}, active requests: ${this.activeRequests}`);
      
      // キューにリクエストがあれば次を処理
      this.processNextQueuedRequest();
    }
  }

  /**
   * サーバーからセグメントをフェッチする
   * get_segment_chunkを使用して全てのチャンクを取得し結合する
   */
  private async fetchSegment(index: number): Promise<Uint8Array> {
    console.log(`Fetching segment ${index} from server using chunks`);
    try {
      // セグメントのチャンクを格納する配列
      const segmentDataChunks: Uint8Array[] = [];
      let totalChunksInSegment = 0;

      // 最初のチャンクを取得して、そのセグメントの総チャンク数を確認
      // TypeScript doesn't recognize get_segment_chunk in the type definition, so we need to use type assertion
      const firstChunkResult = await (this.actor as any).get_segment_chunk(this.videoId, index, 0);

      if (!('ok' in firstChunkResult)) {
        let errorDetails = 'Unknown error';
        if (firstChunkResult.err) {
          errorDetails = JSON.stringify(firstChunkResult.err);
        }
        console.error(`Failed to get first chunk for segment ${index}. Details: ${errorDetails}`);
        return this.createDummySegment();
      }
      
      const firstChunkResponse = firstChunkResult.ok;
      totalChunksInSegment = firstChunkResponse.total_chunk_count;
      console.log(`Segment ${index}: Total chunks expected: ${totalChunksInSegment}`);
      segmentDataChunks.push(new Uint8Array(firstChunkResponse.segment_chunk_data as number[]));

      // 残りのチャンクを取得 (総チャンク数が1より大きい場合)
      for (let chunkIndex = 1; chunkIndex < totalChunksInSegment; chunkIndex++) {
        console.log(`Segment ${index}: Fetching chunk ${chunkIndex + 1}/${totalChunksInSegment}`);
        const chunkResult = await (this.actor as any).get_segment_chunk(this.videoId, index, chunkIndex);
        if ('ok' in chunkResult) {
          segmentDataChunks.push(new Uint8Array(chunkResult.ok.segment_chunk_data as number[]));
        } else {
          let errorDetails = 'Unknown error';
          if (chunkResult.err) {
            errorDetails = JSON.stringify(chunkResult.err);
          }
          console.error(`Failed to get chunk ${chunkIndex} for segment ${index}. Details: ${errorDetails}`);
          // チャンク取得に失敗した場合でも、これまでに取得したチャンクで処理を続行
          break;
        }
      }

      // すべてのチャンクを1つの Uint8Array に結合
      // まず、結合後の合計サイズを計算
      const combinedLength = segmentDataChunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const combinedSegmentData = new Uint8Array(combinedLength);

      // 各チャンクを結合後の配列にコピー
      let offset = 0;
      for (const chunk of segmentDataChunks) {
        combinedSegmentData.set(chunk, offset);
        offset += chunk.length;
      }

      // セグメントデータの検証
      if (combinedSegmentData.length === 0) {
        console.error(`Combined segment ${index} is empty`);
        return this.createDummySegment();
      }
      
      // MPEG-TS ヘッダーの検証 (0x47 で始まるべき)
      if (combinedSegmentData[0] !== 0x47) {
        console.warn(`Segment ${index} does not start with valid MPEG-TS sync byte (0x47), found: ${combinedSegmentData[0].toString(16)}`);
        return this.createDummySegment();
      }
      
      console.log(`Segment ${index} fetched successfully, size: ${combinedSegmentData.length} bytes from ${segmentDataChunks.length} chunks`);
      return combinedSegmentData;
    } catch (error) {
      console.error(`Error fetching segment ${index}:`, error);
      // エラーの場合もダミーセグメントを返す
      return this.createDummySegment();
    }
  }

  /**
   * 有効なMPEG-TSヘッダーを持つダミーセグメントを作成
   * エラー時のフォールバックとして使用
   */
  private createDummySegment(): Uint8Array {
    // 最小限の有効なMPEG-TSパケット
    // 0x47はシンクバイト、残りはPAT（Program Association Table）の最小構造
    const dummyData = new Uint8Array([
      0x47, 0x40, 0x00, 0x10, 0x00, 0x00, 0xB0, 0x0D, 0x00, 0x01, 0xC1, 0x00, 0x00,
      0x00, 0x01, 0xF0, 0x01, 0x2E, 0x70, 0x19, 0x05
    ]);
    
    return dummyData;
  }

  /**
   * キューに入っているリクエストを処理する
   */
  private processNextQueuedRequest() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const nextIndex = this.requestQueue.shift()!;
      console.log(`Processing queued request for segment ${nextIndex}`);
      // 再帰的に呼び出すことで、キューからのリクエストを処理
      this.loadSegment(nextIndex).catch(err => {
        console.error(`Error processing queued request for segment ${nextIndex}:`, err);
      });
    }
  }
}

/**
 * HLS.js用のカスタムローダー
 * プレイリストとセグメントの効率的なロードを行う
 */
export class CustomHlsLoader {
  private segmentLoader: CustomSegmentLoader;
  private segmentMap: Map<string, number> = new Map();
  private m3u8Content: string;
  stats: any;

  constructor(
    config: any, 
    actor: Actor & _SERVICE, 
    videoId: string, 
    m3u8Content: string,
    segmentLines: string[]
  ) {
    this.segmentLoader = new CustomSegmentLoader(actor, videoId);
    
    // プレイリストの内容を検証・修正
    this.m3u8Content = this.validateM3u8Content(m3u8Content, segmentLines);
    
    this.stats = { 
      aborted: false,
      loaded: 0,
      retry: 0,
      total: 0,
      chunkCount: 0,
      bwEstimate: 0,
      loading: { start: 0, first: 0, end: 0 },
      parsing: { start: 0, end: 0 },
      buffering: { start: 0, first: 0, end: 0 }
    };
    
    // セグメント名とインデックスのマッピングを作成
    segmentLines.forEach((segmentName, index) => {
      this.segmentMap.set(segmentName, index);
    });
  }

  /**
   * M3U8プレイリストの内容を検証し、必要に応じて修正する
   */
  private validateM3u8Content(content: string, segmentLines: string[]): string {
    console.log("Validating m3u8 content...");
    
    // 必須のヘッダーが含まれているか確認
    if (!content.includes('#EXTM3U')) {
      console.warn("Adding missing #EXTM3U header");
      content = '#EXTM3U\n' + content;
    }
    
    // セグメント継続時間が指定されているか確認
    if (!content.includes('#EXTINF:')) {
      console.warn("Adding missing segment duration information");
      // 各セグメント行の前に継続時間情報を追加
      const lines = content.split('\n');
      const newLines = [];
      
      for (const line of lines) {
        if (line.endsWith('.ts') && !lines[lines.indexOf(line) - 1].includes('#EXTINF:')) {
          // デフォルトの継続時間を4秒に設定
          newLines.push('#EXTINF:4.0,');
        }
        newLines.push(line);
      }
      
      content = newLines.join('\n');
    }
    
    // EXT-X-VERSION が含まれているか確認
    if (!content.includes('#EXT-X-VERSION:')) {
      console.warn("Adding missing version information");
      const lines = content.split('\n');
      // #EXTM3U の後にバージョン情報を追加
      const extM3uIndex = lines.indexOf('#EXTM3U');
      if (extM3uIndex !== -1) {
        lines.splice(extM3uIndex + 1, 0, '#EXT-X-VERSION:3');
      } else {
        lines.unshift('#EXT-X-VERSION:3');
      }
      content = lines.join('\n');
    }
    
    // EXT-X-TARGETDURATION が含まれているか確認
    if (!content.includes('#EXT-X-TARGETDURATION:')) {
      console.warn("Adding missing target duration");
      const lines = content.split('\n');
      // バージョン情報の後にターゲット継続時間を追加
      const versionIndex = lines.findIndex(line => line.includes('#EXT-X-VERSION:'));
      if (versionIndex !== -1) {
        lines.splice(versionIndex + 1, 0, '#EXT-X-TARGETDURATION:4');
      } else {
        // バージョン情報がない場合は先頭に追加
        lines.unshift('#EXT-X-TARGETDURATION:4');
      }
      content = lines.join('\n');
    }
    
    // EXT-X-MEDIA-SEQUENCE が含まれているか確認
    if (!content.includes('#EXT-X-MEDIA-SEQUENCE:')) {
      console.warn("Adding missing media sequence");
      const lines = content.split('\n');
      // ターゲット継続時間の後にメディアシーケンスを追加
      const targetDurationIndex = lines.findIndex(line => line.includes('#EXT-X-TARGETDURATION:'));
      if (targetDurationIndex !== -1) {
        lines.splice(targetDurationIndex + 1, 0, '#EXT-X-MEDIA-SEQUENCE:0');
      } else {
        // ターゲット継続時間がない場合は先頭に追加
        lines.unshift('#EXT-X-MEDIA-SEQUENCE:0');
      }
      content = lines.join('\n');
    }
    
    console.log("Final m3u8 content:", content);
    return content;
  }

  destroy(): void {
    // リソースのクリーンアップ
  }

  abort(): void {
    // リクエストの中止処理
  }

  load(context: HlsTypes.LoaderContext, config: any, callbacks: any): void {
    const { url } = context;
    console.log("--------------------------load url ", url );
    const stats = this.stats;
    
    // リクエスト開始時間を記録
    stats.loading.start = performance.now();
    
    // プレイリストのリクエストの場合
    if (url.endsWith('.m3u8')) {
      console.log('Loading playlist:', url);
      
      // 最初のデータ受信時間を記録
      stats.loading.first = performance.now();
      
      const response: HlsTypes.LoaderResponse = {
        url,
        data: new TextEncoder().encode(this.m3u8Content),
      };
      
      // データサイズを記録
      stats.loaded = this.m3u8Content.length;
      stats.total = this.m3u8Content.length;
      
      // ロード完了時間を記録
      stats.loading.end = performance.now();
      
      setTimeout(() => {
        callbacks.onSuccess(response, stats, context, null);
      }, 0);
      return;
    }
    
    // セグメントのリクエストの場合
    if (url.endsWith('.ts')) {
      const segmentName = url.split('/').pop() || '';
      const segmentIndex = this.segmentMap.get(segmentName);
      
      if (segmentIndex === undefined) {
        console.error(`Unknown segment name: ${segmentName}`);
        callbacks.onError({ code: 0, text: `Unknown segment: ${segmentName}` }, context, stats, null);
        return;
      }
      
      console.log(`Loading segment: ${segmentName}, index: ${segmentIndex}`);
      
      // 最初のデータ受信時間を記録
      stats.loading.first = performance.now();
      
      // セグメントをロード
      this.segmentLoader.loadSegment(segmentIndex)
        .then(data => {
          // データサイズを記録
          stats.loaded = data.length;
          stats.total = data.length;
          
          // ロード完了時間を記録
          stats.loading.end = performance.now();
          
          const response: HlsTypes.LoaderResponse = {
            url,
            data: data,
          };
          
          callbacks.onSuccess(response, stats, context, null);
        })
        .catch(error => {
          console.error(`Error loading segment ${segmentIndex}:`, error);
          callbacks.onError({ code: 0, text: error.message }, context, stats, null);
        });
      
      return;
    }
    
    // その他のリクエスト
    console.warn(`Unhandled request type: ${url}`);
    callbacks.onError({ code: 0, text: `Unhandled request type: ${url}` }, context, stats, null);
  }
}

/**
 * HLS.js用のカスタムローダーファクトリー
 * カスタムローダーのインスタンスを作成する
 */
export const createCustomLoader = (
  actor: Actor & _SERVICE, 
  videoId: string, 
  m3u8Content: string,
  segmentLines: string[]
): any => {
  return function CustomLoaderFactory(config: any) {
    return new CustomHlsLoader(config, actor, videoId, m3u8Content, segmentLines);
  };
};