import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { Timer } from '../utils/Timer';

export interface FFmpegProgress {
  message: string;
  progress?: {
    type: 'upload' | 'processing';
    current: number;
    total: number;
    percent: number;
  };
}

export interface ProcessedVideo {
  playlist: Uint8Array;
  segments: { index: number; data: Uint8Array }[];
  thumbnail?: Uint8Array;  // サムネイル用のフィールドを追加
}

export class FFmpegService {
  private ffmpeg: FFmpeg;
  private loaded: boolean = false;
  private timer: Timer;
  onProgress?: (progress: FFmpegProgress) => void;
  private lastProgress: number = 0;

  constructor() {
    this.ffmpeg = new FFmpeg();
    this.timer = new Timer();
    
    // FFmpegのログイベントをリッスン
    this.ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
      if (this.onProgress) {
        // メッセージの内容に基づいて進捗を更新
        let progressPercent = this.lastProgress;

        if (message.includes('load')) {
          progressPercent = 10;
        } else if (message.includes('write')) {
          progressPercent = 25;
        } else if (message.includes('thumbnail') || message.includes('scale')) {
          progressPercent = 30;
        } else if (message.includes('Converting')) {
          progressPercent = 40;
        } else if (message.includes('segment') || message.includes('.ts')) {
          // セグメント処理中は50-90%の範囲で進捗を更新
          const currentSegment = message.match(/\d+/);
          if (currentSegment) {
            const segmentNum = parseInt(currentSegment[0]);
            progressPercent = 50 + ((segmentNum / 20) * 40); // 20セグメントを想定
            progressPercent = Math.min(90, progressPercent); // 90%を超えないようにする
          }
        }

        this.lastProgress = progressPercent;
        this.onProgress({ 
          message,
          progress: {
            type: 'processing',
            current: progressPercent,
            total: 100,
            percent: progressPercent
          }
        });
      }
    });

    // 初期進捗を報告
    if (this.onProgress) {
      this.onProgress({
        message: 'Initializing FFmpeg...',
        progress: {
          type: 'processing',
          current: 0,
          total: 100,
          percent: 0
        }
      });
    }
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      if (!crossOriginIsolated) {
        console.warn('Cross-Origin Isolation is not enabled');
      }

      if (this.onProgress) {
        this.onProgress({
          message: 'Loading FFmpeg...',
          progress: {
            type: 'processing',
            current: 10,
            total: 100,
            percent: 10
          }
        });
      }

      await this.ffmpeg.load({});

      if (this.onProgress) {
        this.onProgress({
          message: 'FFmpeg loaded successfully',
          progress: {
            type: 'processing',
            current: 20,
            total: 100,
            percent: 20
          }
        });
      }

      this.loaded = true;
    } catch (error) {
      console.error('FFmpeg load error:', error);
      throw error;
    }
  }

  async processVideo(file: File, options: {
    segmentDuration?: number;
    videoBitrate?: string;
    audioBitrate?: string;
    thumbnailTime?: number;  // サムネイル生成時の動画時間位置（秒）
  } = {}): Promise<ProcessedVideo> {
    console.log('processVideo');
    this.timer.start();

    if (!this.loaded) {
      await this.load();
    }

    const {
      segmentDuration = 2,
      videoBitrate = '800k',
      audioBitrate = '128k',
      thumbnailTime = 1  // デフォルトは1秒位置
    } = options;

    try {
      // ファイル書き込み進捗
      if (this.onProgress) {
        this.onProgress({
          message: 'Writing input file...',
          progress: {
            type: 'processing',
            current: 25,
            total: 100,
            percent: 25
          }
        });
      }

      const inputFileName = 'input.mp4';
      const inputData = await fetchFile(file);
      await this.ffmpeg.writeFile(inputFileName, inputData);
      this.timer.split('fileWrite');

      // サムネイル生成進捗
      if (this.onProgress) {
        this.onProgress({
          message: 'Generating thumbnail...',
          progress: {
            type: 'processing',
            current: 30,
            total: 100,
            percent: 30
          }
        });
      }
      
      await this.ffmpeg.exec([
        '-ss', thumbnailTime.toString(),
        '-i', inputFileName,
        '-vf', 'scale=480:-1',  // 幅480pxに設定（高さは自動調整）
        '-vframes', '1',
        'thumbnail.jpg'
      ]);

      const thumbnail = await this.ffmpeg.readFile('thumbnail.jpg');
      await this.ffmpeg.deleteFile('thumbnail.jpg');
      this.timer.split('thumbnailGeneration');

      // HLS変換進捗
      if (this.onProgress) {
        this.onProgress({
          message: 'Converting to HLS format...',
          progress: {
            type: 'processing',
            current: 40,
            total: 100,
            percent: 40
          }
        });
      }

      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'copy',          // ビデオコーデックをそのままコピー
        '-c:a', 'aac',          // オーディオをAACにエンコード
        '-b:a', audioBitrate,
        '-f', 'hls',
        '-hls_time', segmentDuration.toString(),
        '-hls_segment_type', 'mpegts',
        '-hls_list_size', '0',
        '-hls_segment_filename', 'segment_%03d.ts',
        'playlist.m3u8'
      ]);
      this.timer.split('hlsConversion');

      // プレイリストとセグメントの処理
      const playlist = await this.ffmpeg.readFile('playlist.m3u8');
      const segments: { index: number; data: Uint8Array }[] = [];
      let segmentIndex = 0;

      // セグメント読み込みの進捗計算
      const m3u8Content = new TextDecoder().decode(playlist as Uint8Array);
      const totalSegments = (m3u8Content.match(/\.ts/g) || []).length;
      const segmentProgressStart = 50;
      const segmentProgressEnd = 90;
      const segmentProgressRange = segmentProgressEnd - segmentProgressStart;

      while (true) {
        try {
          const segmentName = `segment_${String(segmentIndex).padStart(3, '0')}.ts`;
          const segmentData = await this.ffmpeg.readFile(segmentName);
          
          if (!segmentData) break;
          
          segments.push({
            index: segmentIndex,
            data: segmentData as Uint8Array
          });
          
          if (this.onProgress) {
            const segmentProgress = (segmentIndex + 1) / totalSegments;
            const currentProgress = segmentProgressStart + (segmentProgress * segmentProgressRange);
            
            this.onProgress({
              message: `Reading segment ${segmentIndex + 1}/${totalSegments}`,
              progress: {
                type: 'processing',
                current: segmentIndex + 1,
                total: totalSegments,
                percent: currentProgress
              }
            });
          }
          
          segmentIndex++;
        } catch (e) {
          break;
        }
      }
      this.timer.split('segmentProcessing');

      // クリーンアップ進捗
      if (this.onProgress) {
        this.onProgress({
          message: 'Cleaning up...',
          progress: {
            type: 'processing',
            current: 95,
            total: 100,
            percent: 95
          }
        });
      }

      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile('playlist.m3u8');
      for (let i = 0; i < segmentIndex; i++) {
        const segmentName = `segment_${String(i).padStart(3, '0')}.ts`;
        await this.ffmpeg.deleteFile(segmentName);
      }
      this.timer.split('cleanup');

      // 完了進捗
      if (this.onProgress) {
        this.onProgress({
          message: 'Processing complete',
          progress: {
            type: 'processing',
            current: 100,
            total: 100,
            percent: 100
          }
        });
      }

      // 計測結果の出力
      const timings = this.timer.stop();
      const formattedTimings = this.timer.formatResults(timings);
      console.log('Processing timings:', formattedTimings);

      return { 
        playlist: playlist as Uint8Array, 
        segments,
        thumbnail: thumbnail as Uint8Array
      };
    } catch (error) {
      console.error('Video processing error:', error);
      throw error;
    }
  }
}