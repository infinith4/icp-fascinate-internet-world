import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

export interface FFmpegProgress {
  message: string;
}

export interface ProcessedVideo {
  playlist: Uint8Array;
  segments: { index: number; data: Uint8Array }[];
}

export class FFmpegService {
  private ffmpeg: FFmpeg;
  private loaded: boolean = false;
  onProgress?: (progress: FFmpegProgress) => void;

  constructor() {
    this.ffmpeg = new FFmpeg();
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

  async processVideo(file: File, options: {
    segmentDuration?: number;
    videoBitrate?: string;
    audioBitrate?: string;
  } = {}): Promise<ProcessedVideo> {
    if (!this.loaded) {
      await this.load();
    }

    const {
      segmentDuration = 2,
      videoBitrate = '800k',
      audioBitrate = '128k'
    } = options;

    try {
      // 入力ファイルを書き込む
      const inputFileName = 'input.mp4';
      const inputData = await fetchFile(file);
      await this.ffmpeg.writeFile(inputFileName, inputData);

      // HLS変換を実行
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

      // プレイリストファイルを読み取り
      const playlist = await this.ffmpeg.readFile('playlist.m3u8');

      // セグメントファイルを読み取り
      const segments: { index: number; data: Uint8Array }[] = [];
      let segmentIndex = 0;

      while (true) {
        try {
          const segmentName = `segment_${String(segmentIndex).padStart(3, '0')}.ts`;
          const segmentData = await this.ffmpeg.readFile(segmentName);
          
          if (!segmentData) break;
          
          segments.push({
            index: segmentIndex,
            data: segmentData as Uint8Array
          });
          
          segmentIndex++;
        } catch (e) {
          // ファイルが見つからない場合は終了
          break;
        }
      }

      // 一時ファイルをクリーンアップ
      await this.ffmpeg.deleteFile(inputFileName);
      await this.ffmpeg.deleteFile('playlist.m3u8');
      for (let i = 0; i < segmentIndex; i++) {
        const segmentName = `segment_${String(i).padStart(3, '0')}.ts`;
        await this.ffmpeg.deleteFile(segmentName);
      }

      return {
        playlist: playlist as Uint8Array,
        segments
      };
    } catch (error) {
      console.error('Video processing error:', error);
      throw error;
    }
  }
}