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
    elapsedTime?: string;
    remainingTime?: string;
  };
}

export interface ProcessedVideo {
  playlist: Uint8Array;
  segments: { index: number; data: Uint8Array }[];
  thumbnail?: Uint8Array;
}

export interface HlsToMp4Result {
  data: Uint8Array;
}

export class FFmpegService {
  private ffmpeg: FFmpeg;
  private loaded: boolean = false;
  private timer: Timer;
  onProgress?: (progress: FFmpegProgress) => void;
  private lastProgress: number = 0;
  private isInitializing: boolean = false;
  private processStartTime: number = 0;

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
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        const remainingTime = this.calculateRemainingTime(progressPercent, elapsedMs);
        
        this.onProgress({
          message,
          progress: {
            type: 'processing',
            current: progressPercent,
            total: 100,
            percent: progressPercent,
            elapsedTime,
            remainingTime
          }
        });
      }
    });

    this.processStartTime = performance.now();
    
    if (this.onProgress) {
      this.onProgress({
        message: 'Initializing FFmpeg...',
        progress: {
          type: 'processing',
          current: 0,
          total: 100,
          percent: 0,
          elapsedTime: '0s',
          remainingTime: '計算中...'
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
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        const remainingTime = this.calculateRemainingTime(10, elapsedMs);
        
        this.onProgress({
          message: 'Loading FFmpeg...',
          progress: {
            type: 'processing',
            current: 10,
            total: 100,
            percent: 10,
            elapsedTime,
            remainingTime
          }
        });
      }

      await this.ffmpeg.load({});

      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        const remainingTime = this.calculateRemainingTime(20, elapsedMs);
        
        this.onProgress({
          message: 'FFmpeg loaded successfully',
          progress: {
            type: 'processing',
            current: 20,
            total: 100,
            percent: 20,
            elapsedTime,
            remainingTime
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
    preset?: string;
    crf?: string;
    audioBitrate?: string;
    thumbnailTime?: number;
  } = {}): Promise<ProcessedVideo> {
    console.log('processVideo');
    this.timer.start();
    this.processStartTime = performance.now();

    if (!this.loaded) {
      await this.load();
    }

    const {
      segmentDuration = 0.5,
      videoBitrate = '500k',
      preset = 'ultrafast',
      crf = '35',
      audioBitrate = '128k',
      thumbnailTime = 1
    } = options;

    try {
      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        const remainingTime = this.calculateRemainingTime(25, elapsedMs);
        
        this.onProgress({
          message: 'Writing input file...',
          progress: {
            type: 'processing',
            current: 25,
            total: 100,
            percent: 25,
            elapsedTime,
            remainingTime
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
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        const remainingTime = this.calculateRemainingTime(30, elapsedMs);
        
        this.onProgress({
          message: 'Generating thumbnail...',
          progress: {
            type: 'processing',
            current: 30,
            total: 100,
            percent: 30,
            elapsedTime,
            remainingTime
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
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        const remainingTime = this.calculateRemainingTime(40, elapsedMs);
        
        this.onProgress({
          message: 'Converting to HLS format...',
          progress: {
            type: 'processing',
            current: 40,
            total: 100,
            percent: 40,
            elapsedTime,
            remainingTime
          }
        });
      }

      //すべてのセグメントが厳密に指定のサイズ以下になることを100%保証できない。
      //ffmpeg -i "./270940.mp4" -c:v copy -c:a copy -f hls -hls_playlist_type event -hls_time 2 -g 24 -hls_segment_type mpegts -hls_segment_filename "./270940%3d.ts" "./270940.m3u8"
      //ffmpeg -i "./270940.mp4" -c:v copy -c:a copy -b:a 128k -f hls -hls_playlist_type vod -hls_time 2 -g 24 -hls_segment_filename "./270940%3d.ts" "./270940.m3u8"
      //ffmpeg -i "./203923-922675870.mp4" -c:v libx264 -preset faster -crf 27 -c:a copy -b:v 1M -f hls -hls_playlist_type event -hls_time 2 -g 24 -hls_segment_filename "./203923-922675870%3d.ts" "./203923-922675870.m3u8"
      //segmentDuration: 0.2, preset: ultrafast, bitrate: 500k, crf: 32 -> speed: 0.04 - 0.035
      //segmentDuration: 0.2, ultrafast, bitrate： 500kb, crf: 32 がちょうどよさそう。 speed: 0.15くらい
      //segmentDuration: 0.5, ultrafast, bitrate： 500kb, crf: 30 -> speed: 0.03くらい
      // HLS変換
      console.warn(`segmentDuration: ${segmentDuration}, preset: ${preset}, bitrate: ${videoBitrate}, crf: ${crf}`);
      await this.ffmpeg.exec([
        '-i', inputFileName, // 入力ファイル名 (元のコマンドに合わせる)
        '-c:v', 'libx264',
        '-preset', preset, //ultrafast, superfast, veryfast, faster, fast, medium, slow, veryslow
        '-crf', crf.toString(),
        '-b:v', videoBitrate.toString(), // 動画ビットレートを 1M に設定 (元のコマンドに合わせる)
        '-c:a', 'copy', // 音声コーデックをコピーに設定 (元のコマンドに合わせる)
        //'-b:a', audioBitrate,
        '-f', 'hls', // フォーマットを hls に設定
        '-hls_playlist_type', 'event', // プレイリストタイプを vod に設定 (元のコマンドに合わせる)
        '-hls_time', segmentDuration.toString(), // セグメント長を 5秒 に設定 (元のコマンドに合わせる)
        '-g', '24', // GOPサイズを 24 に設定 (元のコマンドに合わせる)
        '-hls_segment_type', 'mpegts',
        '-hls_segment_filename', segmentPattern,// セグメントファイル名パターン (元のコマンドに合わせる)
        playlistFileName // プレイリストファイル名 (元のコマンドに合わせる)
      ]);
  // await this.ffmpeg.exec([
  //     '-i', inputFileName, // 入力ファイル名 (元のコマンドに合わせる)
  //     //'-b:v', '1M', // 動画ビットレートを 1M に設定 (元のコマンドに合わせる)
  //     '-c:v', 'copy',
  //     '-c:a', 'copy', // 音声コーデックをコピーに設定 (元のコマンドに合わせる)
  //     //'-b:a', audioBitrate,
  //     '-f', 'hls', // フォーマットを hls に設定
  //     '-hls_playlist_type', 'event', // プレイリストタイプを vod に設定 (元のコマンドに合わせる)
  //     '-hls_time', segmentDuration.toString(), // セグメント長を 5秒 に設定 (元のコマンドに合わせる)
  //     '-g', '5', // GOPサイズを 24 に設定 (元のコマンドに合わせる)
  //     '-hls_segment_type', 'mpegts',
  //     '-hls_segment_filename', segmentPattern,// セグメントファイル名パターン (元のコマンドに合わせる)
  //     playlistFileName // プレイリストファイル名 (元のコマンドに合わせる)
  // ]);
      // await this.ffmpeg.exec([
      //   '-i', inputFileName,
      //   '-c:v', 'copy',
      //   '-c:a', 'aac',
      //   '-b:a', audioBitrate,
      //   '-f', 'hls',
      //   '-hls_time', segmentDuration.toString(),
      //   '-hls_segment_type', 'mpegts',
      //   '-hls_list_size', '0',
      //   '-hls_segment_filename', segmentPattern,
      //   '-hls_flags', 'independent_segments',
      //   '-hls_playlist_type', 'event',
      //   '-hls_start_number_source', 'epoch',
      //   '-hls_init_time', '0',
      //   '-hls_base_url', '',
      //   playlistFileName
      // ]);
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

      let totalBytes = 0;

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
            totalBytes += data.length;
            segments.push({
              index: i,
              data: data
            });
            
            success = true;
            
            if (this.onProgress) {            
              const segmentPercent = ((i + 1) / totalSegments) * 100;
              const elapsedMs = performance.now() - this.processStartTime;
              const elapsedTime = this.timer.formatTime(elapsedMs);
              const remainingTime = this.calculateRemainingTime(segmentPercent, elapsedMs);
              
              this.onProgress({
                message: `Reading segment ${i + 1}/${totalSegments}`,
                progress: {
                  type: 'processing',
                  current: i + 1,
                  total: totalSegments,
                  percent: segmentPercent,
                  elapsedTime,
                  remainingTime
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
        console.log(`----------------------totalBytes: ${totalBytes} bytes`);

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
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        const remainingTime = this.calculateRemainingTime(95, elapsedMs);
        
        this.onProgress({
          message: 'Cleaning up...',
          progress: {
            type: 'processing',
            current: 95,
            total: 100,
            percent: 95,
            elapsedTime,
            remainingTime
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
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: 'Processing complete',
          progress: {
            type: 'processing',
            current: 100,
            total: 100,
            percent: 100,
            elapsedTime,
            remainingTime: '0s'
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

  async convertHlsToMp4(playlist: string, segments: { index: number; original_segment_name: String; data: Uint8Array }[]): Promise<HlsToMp4Result> {
    if (!this.loaded) {
      await this.load();
    }

    const timestamp = `${new Date().toISOString().replace(/[-:]/g, '').replace('T', '').replace(/\..+/, '')}`;
    const playlistFileName = `playlist_${timestamp}.m3u8`;
    const outputFileName = `output_${timestamp}.mp4`;

    try {
      // セグメントファイルを書き込み
      for (const segment of segments) {
        const segmentName = segment.original_segment_name.toString();
        console.log(`segmentName: ${segmentName}`);
        await this.ffmpeg.writeFile(segmentName, segment.data);
        console.log(`writed File: ${segmentName}`);
      }

      // プレイリストを書き込み
      await this.ffmpeg.writeFile(playlistFileName, new TextEncoder().encode(playlist));
      //ffmpeg -i your_playlist.m3u8 -c copy output.mp4
      // MP4に変換
      await this.ffmpeg.exec([
        '-i', playlistFileName,
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-f', 'mp4',
        outputFileName
      ]);

      // 変換されたファイルを読み込み
      const outputData = await this.ffmpeg.readFile(outputFileName);
      if (!outputData) {
        throw new Error('Failed to read converted file');
      }

      // クリーンアップ
      try {
        await this.ffmpeg.deleteFile(playlistFileName);
        await this.ffmpeg.deleteFile(outputFileName);
        for (const segment of segments) {
          const segmentName = `segment_${timestamp}_${String(segment.index).padStart(3, '0')}.ts`;
          await this.ffmpeg.deleteFile(segmentName);
        }
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
      }

      return { data: outputData as Uint8Array };
    } catch (error) {
      console.error('HLS to MP4 conversion error:', error);
      throw error;
    }
  }

  async convertTsToMp4(tsData: Uint8Array): Promise<Uint8Array> {
    if (!this.loaded) {
      await this.load();
    }

    const timestamp = `${new Date().toISOString().replace(/[-:]/g, '').replace('T', '').replace(/\..+/, '')}`;
    const inputFileName = `input_${timestamp}.ts`;
    const outputFileName = `output_${timestamp}.mp4`;

    try {
      console.log("Writing input file...");
      // セグメントを一時ファイルとして書き込み
      await this.ffmpeg.writeFile(inputFileName, tsData);
      console.log("Input file written successfully");

      // 入力ファイルの存在確認
      const inputFileExists = await this.ffmpeg.readFile(inputFileName);
      if (!inputFileExists) {
        throw new Error('Failed to write input file');
      }
      console.log("Input file verified");

      console.log("Starting MP4 conversion...");
      // MP4に変換（より互換性の高いオプションを使用）
      await this.ffmpeg.exec([
        '-i', inputFileName,
        '-c:v', 'libx264',  // H.264エンコーダーを使用
        '-preset', 'ultrafast',  // 高速エンコード
        '-tune', 'zerolatency',  // 低レイテンシー
        '-profile:v', 'baseline',  // 基本的なプロファイル
        '-level', '3.0',  // 互換性の高いレベル
        '-c:a', 'aac',  // AACオーディオコーデック
        '-b:a', '128k',  // オーディオビットレート
        '-f', 'mp4',
        '-movflags', '+faststart',  // 高速スタート
        outputFileName
      ]);
      console.log("MP4 conversion completed");

      // 出力ファイルの存在確認
      console.log("Reading output file...");
      const outputData = await this.ffmpeg.readFile(outputFileName);
      if (!outputData) {
        throw new Error('Failed to read converted file');
      }
      console.log("Output file read successfully");

      // クリーンアップ
      console.log("Cleaning up temporary files...");
      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
        console.log("Cleanup completed");
      } catch (cleanupError) {
        console.warn('Cleanup error:', cleanupError);
        // クリーンアップエラーは無視して続行
      }

      return outputData as Uint8Array;
    } catch (error) {
      console.error('TS to MP4 conversion error:', error);
      // エラー発生時もクリーンアップを試みる
      try {
        await this.ffmpeg.deleteFile(inputFileName);
        await this.ffmpeg.deleteFile(outputFileName);
      } catch (cleanupError) {
        console.warn('Cleanup error during error handling:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * 残り時間を計算して整形された文字列を返す
   * @param percent 現在の進捗パーセント (0-100)
   * @param elapsedMs 経過時間 (ミリ秒)
   */
  private calculateRemainingTime(percent: number, elapsedMs: number): string {
    if (percent <= 0) return '計算中...';
    
    const rate = percent / 100;
    if (rate >= 1) return '0s';
    
    // 進捗率から残り時間を推定
    const estimatedTotalMs = elapsedMs / rate;
    const remainingMs = estimatedTotalMs - elapsedMs;
    
    if (isNaN(remainingMs) || remainingMs <= 0) {
      return '計算中...';
    }
    
    return this.timer.formatTime(remainingMs);
  }
}
