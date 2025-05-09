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
  thumbnail?: Uint8Array;
}

export class FFmpegService {
  private ffmpeg: FFmpeg;
  private loaded: boolean = false;
  private timer: Timer;
  onProgress?: (progress: FFmpegProgress) => void;
  private lastProgress: number = 0;
  private isInitializing: boolean = false;

  constructor() {
    this.ffmpeg = new FFmpeg();
    this.timer = new Timer();
    this.isInitializing = true;
    
    this.ffmpeg.on('log', ({ message }: { message: string }) => {
      console.log('FFmpeg:', message);
      if (this.onProgress) {
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
          const currentSegment = message.match(/\d+/);
          if (currentSegment) {
            const segmentNum = parseInt(currentSegment[0]);
            progressPercent = 50 + ((segmentNum / 20) * 40);
            progressPercent = Math.min(90, progressPercent);
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
      this.isInitializing = true;
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
      this.isInitializing = false;
    } catch (error) {
      this.isInitializing = false;
      console.error('FFmpeg load error:', error);
      throw error;
    }
  }

  isFFmpegInitializing(): boolean {
    return this.isInitializing;
  }

  isFFmpegLoaded(): boolean {
    return this.loaded;
  }

  async processVideo(file: File, options: {
    segmentDuration?: number;
    videoBitrate?: string;
    audioBitrate?: string;
    thumbnailTime?: number;
  } = {}): Promise<ProcessedVideo> {
    console.log('processVideo');
    this.timer.start();

    if (!this.loaded) {
      await this.load();
    }

    const {
      segmentDuration = 2,
      videoBitrate = '1M',
      audioBitrate = '128k',
      thumbnailTime = 1
    } = options;

    try {
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

      const timestamp = `${new Date().toISOString().replace(/[-:]/g, '').replace('T', '').replace(/\..+/, '')}`;
      const inputFileName = `input_${timestamp}.mp4`;
      const thumbnailFileName = `thumbnail_${timestamp}.jpg`;
      const playlistFileName = `playlist_${timestamp}.m3u8`;
      const segmentPattern = `segment_${timestamp}_%03d.ts`;

      const inputData = await fetchFile(file);
      
      // メモリ使用量を制限するためにファイルサイズをチェック
      const maxFileSize = 1000 * 1024 * 1024; // 100MB
      if (file.size > maxFileSize) {
        throw new Error(`File size exceeds maximum limit of ${maxFileSize / (1024 * 1024)}MB`);
      }

      await this.ffmpeg.writeFile(inputFileName, inputData);
      this.timer.split('fileWrite');

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
        thumbnailFileName
      ]);

      const thumbnail = await this.ffmpeg.readFile(thumbnailFileName);
      await this.ffmpeg.deleteFile(thumbnailFileName);
      this.timer.split('thumbnailGeneration');

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

      // HLS変換
      console.log("segmentDuration: ", segmentDuration);
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', audioBitrate,
        '-f', 'hls',
        '-hls_time', segmentDuration.toString(),
        '-hls_segment_type', 'mpegts',
        '-hls_list_size', '0',
        '-hls_segment_filename', segmentPattern,
        '-hls_flags', 'independent_segments',
        '-hls_playlist_type', 'event',
        '-hls_start_number_source', 'epoch',
        '-hls_init_time', '0',
        '-hls_base_url', '',
        playlistFileName
      ]);
      this.timer.split('hlsConversion');

      // 変換完了後、十分な待機時間を設定
      await new Promise(resolve => setTimeout(resolve, 2000));

      // プレイリストの読み込み
      let playlist: Uint8Array;
      try {
        const playlistData = await this.ffmpeg.readFile(playlistFileName);
        if (!playlistData) {
          throw new Error('Failed to read playlist file');
        }
        playlist = playlistData as Uint8Array;
      } catch (error) {
        console.error('Error reading playlist:', error);
        throw new Error('Failed to read playlist file: ' + error);
      }

      const segments: { index: number; data: Uint8Array }[] = [];

      // セグメント読み込みの進捗を報告
      const m3u8Content = new TextDecoder().decode(playlist);
      console.log('M3U8 content:', m3u8Content);
      
      // プレイリストからセグメントファイル名を抽出
      const segmentLines = m3u8Content.split('\n').filter(line => line.endsWith('.ts'));
      console.log('Segment lines from playlist:', segmentLines);
      
      const totalSegments = segmentLines.length;
      console.log('Total segments found:', totalSegments);

      if (totalSegments === 0) {
        throw new Error('No segments found in playlist');
      }

      // セグメントファイルの存在確認と読み込み
      for (let i = 0; i < totalSegments; i++) {
        let retries = 3;
        let success = false;
        let lastError: any = null;

        while (retries > 0 && !success) {
          try {
            // プレイリストに記載されているセグメントファイル名を使用
            const segmentName = segmentLines[i];
            console.log(`Attempting to read segment: ${segmentName} (attempts remaining: ${retries})`);
            
            // セグメントファイルの読み込みを試行
            const segmentData = await this.ffmpeg.readFile(segmentName);
            if (!segmentData) {
              throw new Error(`No data found for segment: ${segmentName}`);
            }

            // データの検証
            const data = segmentData as Uint8Array;
            if (data.length === 0) {
              throw new Error(`Empty segment data for: ${segmentName}`);
            }
            
            console.log(`Successfully read segment ${i}, size: ${data.length} bytes`);
            segments.push({
              index: i,
              data: data
            });
            
            success = true;
            
            if (this.onProgress) {            
              this.onProgress({
                message: `Reading segment ${i + 1}/${totalSegments}`,
                progress: {
                  type: 'processing',
                  current: i + 1,
                  total: totalSegments,
                  percent: ((i + 1) / totalSegments) * 100
                }
              });
            }
          } catch (e) {
            lastError = e;
            console.error(`Error reading segment ${i} (attempt ${4 - retries}/3):`, e);
            retries--;
            
            if (retries > 0) {
              // リトライ前に待機時間を増加
              const waitTime = 2000 * (4 - retries); // 2秒、4秒、6秒と待機時間を増加
              console.log(`Waiting ${waitTime}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            }
          }
        }

        if (!success) {
          console.error(`Failed to read segment ${i} after all retries. Last error:`, lastError);
          throw new Error(`Failed to read segment ${i} after all retries: ${lastError}`);
        }
      }

      console.log(`Total segments processed: ${segments.length}`);
      if (segments.length === 0) {
        throw new Error('No segments were successfully processed');
      }

      this.timer.split('segmentProcessing');

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

      // クリーンアップ
      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(playlistFileName);
        for (let i = 0; i < totalSegments; i++) {
          const segmentName = `segment_${timestamp}_${String(i).padStart(3, '0')}.ts`;
          await this.ffmpeg.deleteFile(segmentName);
        }
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
      }
      this.timer.split('cleanup');

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

      const timings = this.timer.stop();
      const formattedTimings = this.timer.formatResults(timings);
      console.log('Processing timings:', formattedTimings);

      return { 
        playlist: playlist, 
        segments,
        thumbnail: thumbnail as Uint8Array
      };
    } catch (error) {
      console.error('Video processing error:', error);
      throw error;
    }
  }
}
