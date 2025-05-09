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

  constructor() {
    this.ffmpeg = new FFmpeg();
    this.timer = new Timer();
    this.ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
      if (this.onProgress) {
        this.onProgress({ message });
      }
    });
  }

  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      // CORSとSharedArrayBufferのサポートに必要なヘッダーを確認
      if (!crossOriginIsolated) {
        console.warn('Cross-Origin Isolation is not enabled');
      }

      await this.ffmpeg.load({
        // log: true, // Removed as it is not a valid property
        //corePath: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
      });

      this.loaded = true;
    } catch (error) {
      console.error('FFmpeg load error:', error);
      throw error;
    }
  }
  // FFmpegを使用して動画をHLS形式に変換するメソッド
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
      // 入力ファイルを書き込む
      const inputFileName = 'input.mp4';
      const inputData = await fetchFile(file);
      await this.ffmpeg.writeFile(inputFileName, inputData);
      this.timer.split('fileWrite');

      // サムネイルを生成
      if (this.onProgress) {
        this.onProgress({ message: 'Generating thumbnail...' });
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

      // HLS変換を実行
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',        // H.264エンコーダーを使用
        '-preset', 'ultrafast',   // 高速エンコード
        '-tune', 'fastdecode',    // デコード速度を優先
        '-crf', '23',            // 品質設定（18-28の範囲、低いほど高品質）
        '-maxrate', '10M',        // 最大ビットレート
        '-bufsize', '10M',        // バッファサイズ
        '-c:a', 'aac',           // オーディオをAACにエンコード
        '-b:a', audioBitrate,
        '-f', 'hls',
        '-hls_time', segmentDuration.toString(),
        '-hls_segment_type', 'mpegts',
        '-hls_list_size', '0',
        '-hls_segment_filename', 'segment_%03d.ts',
        '-max_muxing_queue_size', '9999',
        'playlist.m3u8'
      ]);
      this.timer.split('hlsConversion');

      // プレイリストとセグメントの処理
      const playlist = await this.ffmpeg.readFile('playlist.m3u8');
      const segments: { index: number; data: Uint8Array }[] = [];
      let segmentIndex = 0;

      // セグメント読み込みの進捗を報告
      let totalSegments = 0;
      const m3u8Content = new TextDecoder().decode(playlist as Uint8Array);
      totalSegments = (m3u8Content.match(/\.ts/g) || []).length;

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
            this.onProgress({
              message: `Reading segment ${segmentIndex + 1}/${totalSegments}`,
              progress: {
                type: 'processing',
                current: segmentIndex + 1,
                total: totalSegments,
                percent: ((segmentIndex + 1) / totalSegments) * 100
              }
            });
          }
          
          segmentIndex++;
        } catch (e) {
          break;
        }
      }
      this.timer.split('segmentProcessing');

      // クリーンアップ
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile('playlist.m3u8');
      for (let i = 0; i < segmentIndex; i++) {
        const segmentName = `segment_${String(i).padStart(3, '0')}.ts`;
        await this.ffmpeg.deleteFile(segmentName);
      }
      this.timer.split('cleanup');

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