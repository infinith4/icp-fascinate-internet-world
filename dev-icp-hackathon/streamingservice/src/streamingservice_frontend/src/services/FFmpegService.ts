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
  private ffmpegSpeed: number | null = null;
  private speedHistory: number[] = [];
  private lastFrameTime: number = 0;
  private lastFrameNumber: number | null = null;
  private totalFrames: number | null = null;
  private frameRate: number | null = null;
  private lastRemainingMs: number | null = null;
  private estimatedSegments: number = 20; // デフォルト推定セグメント数
  private videoDuration: number | null = null; // ビデオ時間（秒）
  private uploadStartTime: number = 0; // アップロード開始時間
  private uploadTotalBytes: number = 0; // アップロード合計サイズ
  private uploadedBytes: number = 0; // アップロード済みサイズ
  private currentProcessingTime: number | null = null; // 現在の処理時間位置（秒）

  constructor() {
    this.ffmpeg = new FFmpeg();
    this.timer = new Timer();
    this.isInitializing = true;
    
    this.ffmpeg.on('log', ({ message }: { message: string }) => {
      console.log('FFmpeg:', message);
      if (this.onProgress) {
        let progressPercent = this.lastProgress;

        // ログメッセージからFFmpeg処理情報を抽出
        this.extractFFmpegInfo(message);

        // 初期化と入力処理の進捗（0-25%）
        if (message.includes('load')) {
          progressPercent = 10;
        } else if (message.includes('write')) {
          progressPercent = 25;
        }
        // サムネイル生成（25-30%）
        else if (message.includes('thumbnail') || message.includes('scale')) {
          progressPercent = 30;
        }
        // HLS変換前の準備（30-40%）
        else if (message.includes('Converting')) {
          progressPercent = 40;
        }
        // メインのHLS変換処理の進捗状況（40-90%）
        else if (message.match(/frame=\s*\d+/)) {
          // フレーム情報に基づく進捗
          const frameMatch = message.match(/frame=\s*(\d+)/);
          if (frameMatch && this.totalFrames) {
            const currentFrame = parseInt(frameMatch[1]);
            const frameProgress = Math.min(1, currentFrame / this.totalFrames);
            // フレーム進捗を40-80%の範囲にマッピング
            progressPercent = 40 + (frameProgress * 40);
            progressPercent = Math.min(80, progressPercent);
          }
        }
        // セグメントファイル生成の進捗（80-90%）
        else if (message.includes('segment') || message.includes('.ts')) {
          const currentSegment = message.match(/\d+/);
          if (currentSegment) {
            const segmentNum = parseInt(currentSegment[0]);
            // 推定セグメント数に基づいて進捗を計算
            const segmentProgress = Math.min(1, segmentNum / Math.max(1, this.estimatedSegments));
            progressPercent = 80 + (segmentProgress * 10);
            progressPercent = Math.min(90, progressPercent);
          }
        }

        this.lastProgress = progressPercent;
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        const remainingTime = this.calculateRemainingTime(progressPercent, elapsedMs, message);
        
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
    
    // アップロード進捗の初期化
    this.uploadStartTime = performance.now();
    this.uploadTotalBytes = file.size;
    this.uploadedBytes = 0;

    if (!this.loaded) {
      await this.load();
    }

    const {
      segmentDuration = 0.3,
      videoBitrate = '600k',
      preset = 'ultrafast',
      crf = '33',
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

      // アップロード進捗を報告するfetchFile関数のラッパー
      const inputData = await this.fetchFileWithProgress(file);
      
      // メモリ使用量を制限するためにファイルサイズをチェック
      const maxFileSize = 1000 * 1024 * 1024; // 100MB
      if (file.size > maxFileSize) {
        throw new Error(`File size exceeds maximum limit of ${maxFileSize / (1024 * 1024)}MB`);
      }

      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: 'ファイルのアップロードが完了しました。処理を開始します...',
          progress: {
            type: 'processing',
            current: 5,
            total: 100,
            percent: 5,
            elapsedTime,
            remainingTime: this.calculateRemainingTime(5, elapsedMs)
          }
        });
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

    this.processStartTime = performance.now();
    this.uploadStartTime = performance.now();
    
    // アップロード合計サイズを計算
    this.uploadTotalBytes = new TextEncoder().encode(playlist).length;
    segments.forEach(segment => {
      this.uploadTotalBytes += segment.data.length;
    });
    this.uploadedBytes = 0;

    const timestamp = `${new Date().toISOString().replace(/[-:]/g, '').replace('T', '').replace(/\..+/, '')}`;
    const playlistFileName = `playlist_${timestamp}.m3u8`;
    const outputFileName = `output_${timestamp}.mp4`;

    try {
      // セグメントファイルを書き込み
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const segmentName = segment.original_segment_name.toString();
        console.log(`segmentName: ${segmentName}`);
        await this.ffmpeg.writeFile(segmentName, segment.data);
        console.log(`writed File: ${segmentName}`);
        
        // アップロード進捗を更新
        this.uploadedBytes += segment.data.length;
        if (this.onProgress) {
          const progress = Math.min(40, Math.floor((this.uploadedBytes / this.uploadTotalBytes) * 40));
          const elapsedMs = performance.now() - this.uploadStartTime;
          const elapsedTime = this.timer.formatTime(elapsedMs);
          const remainingTime = this.calculateRemainingTimeForUpload(this.uploadedBytes, this.uploadTotalBytes, elapsedMs);
          
          this.onProgress({
            message: `セグメントをアップロード中... (${i + 1}/${segments.length})`,
            progress: {
              type: 'upload',
              current: this.uploadedBytes,
              total: this.uploadTotalBytes,
              percent: progress,
              elapsedTime,
              remainingTime
            }
          });
        }
      }

      // プレイリストを書き込み
      const playlistData = new TextEncoder().encode(playlist);
      await this.ffmpeg.writeFile(playlistFileName, playlistData);
      
      // アップロード完了を報告
      this.uploadedBytes += playlistData.length;
      if (this.onProgress) {
        const elapsedMs = performance.now() - this.uploadStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: 'ファイルのアップロードが完了しました。変換を開始します...',
          progress: {
            type: 'processing',
            current: 40,
            total: 100,
            percent: 40,
            elapsedTime,
            remainingTime: this.calculateRemainingTime(40, elapsedMs)
          }
        });
      }
      //ffmpeg -i your_playlist.m3u8 -c copy output.mp4
      // MP4に変換
      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: 'MP4に変換中...',
          progress: {
            type: 'processing',
            current: 50,
            total: 100,
            percent: 50,
            elapsedTime,
            remainingTime: this.calculateRemainingTime(50, elapsedMs)
          }
        });
      }
      
      await this.ffmpeg.exec([
        '-i', playlistFileName,
        '-c:v', 'copy',
        '-c:a', 'copy',
        '-f', 'mp4',
        outputFileName
      ]);

      // 変換されたファイルを読み込み
      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: '変換されたファイルを読み込み中...',
          progress: {
            type: 'processing',
            current: 80,
            total: 100,
            percent: 80,
            elapsedTime,
            remainingTime: this.calculateRemainingTime(80, elapsedMs)
          }
        });
      }
      
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

      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: '変換が完了しました',
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

    this.processStartTime = performance.now();
    this.uploadStartTime = performance.now();
    this.uploadTotalBytes = tsData.length;
    this.uploadedBytes = 0;

    const timestamp = `${new Date().toISOString().replace(/[-:]/g, '').replace('T', '').replace(/\..+/, '')}`;
    const inputFileName = `input_${timestamp}.ts`;
    const outputFileName = `output_${timestamp}.mp4`;

    try {
      console.log("Writing input file...");
      
      // アップロード進捗を報告
      if (this.onProgress) {
        this.onProgress({
          message: 'ファイルをアップロード中...',
          progress: {
            type: 'upload',
            current: 0,
            total: tsData.length,
            percent: 0,
            elapsedTime: '0s',
            remainingTime: '計算中...'
          }
        });
      }
      
      // セグメントを一時ファイルとして書き込み
      await this.ffmpeg.writeFile(inputFileName, tsData);
      console.log("Input file written successfully");
      
      // アップロード完了を報告
      this.uploadedBytes = tsData.length;
      if (this.onProgress) {
        const elapsedMs = performance.now() - this.uploadStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: 'ファイルのアップロードが完了しました',
          progress: {
            type: 'upload',
            current: tsData.length,
            total: tsData.length,
            percent: 40, // アップロードは全体の40%として扱う
            elapsedTime,
            remainingTime: this.calculateRemainingTime(40, elapsedMs)
          }
        });
      }

      // 入力ファイルの存在確認
      const inputFileExists = await this.ffmpeg.readFile(inputFileName);
      if (!inputFileExists) {
        throw new Error('Failed to write input file');
      }
      console.log("Input file verified");

      console.log("Starting MP4 conversion...");
      // 変換開始を報告
      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: 'MP4に変換中...',
          progress: {
            type: 'processing',
            current: 50,
            total: 100,
            percent: 50,
            elapsedTime,
            remainingTime: this.calculateRemainingTime(50, elapsedMs)
          }
        });
      }
      
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
      
      // 変換完了を報告
      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: '変換が完了しました。ファイルを読み込み中...',
          progress: {
            type: 'processing',
            current: 80,
            total: 100,
            percent: 80,
            elapsedTime,
            remainingTime: this.calculateRemainingTime(80, elapsedMs)
          }
        });
      }

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

      // 処理完了を報告
      if (this.onProgress) {
        const elapsedMs = performance.now() - this.processStartTime;
        const elapsedTime = this.timer.formatTime(elapsedMs);
        
        this.onProgress({
          message: '処理が完了しました',
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
   * FFmpegのログメッセージから処理情報を抽出する
   * @param message FFmpegのログメッセージ
   */
  private extractFFmpegInfo(message: string): void {
    // 現在の処理時間位置を抽出 (例: "time=00:00:07.88")
    const timeMatch = message.match(/time=(\d+):(\d+):(\d+\.\d+)/);
    if (timeMatch) {
      const hours = parseInt(timeMatch[1], 10);
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseFloat(timeMatch[3]);
      
      // 秒数に変換
      this.currentProcessingTime = hours * 3600 + minutes * 60 + seconds;
      
      // 動画の総時間が分かっている場合は、進捗率を計算して更新
      if (this.videoDuration !== null && this.videoDuration > 0) {
        // 進捗率（0-100%）を計算
        const progressPercent = Math.min(100, Math.round((this.currentProcessingTime / this.videoDuration) * 100));
        
        // 40-90%の範囲にマッピング（FFmpeg処理中の範囲）
        const mappedProgress = 40 + (progressPercent * 0.5); // 40% + 最大50%
        
        // 進捗情報のログ
        console.log(`Current time: ${this.currentProcessingTime.toFixed(2)}s / ${this.videoDuration.toFixed(2)}s (${progressPercent}%) -> Mapped: ${mappedProgress.toFixed(1)}%`);
        
        // 進捗率を更新（必要があれば）
        this.lastProgress = Math.max(this.lastProgress, Math.min(90, mappedProgress));
      }
    }
    
    // 処理速度を抽出 (例: "speed=0.5x")
    const speedMatch = message.match(/speed=(\d+\.?\d*)x/);
    if (speedMatch && speedMatch[1]) {
      const speed = parseFloat(speedMatch[1]);
      
      // 移動平均を使用して速度を安定させる
      this.speedHistory.push(speed);
      
      // 直近5つの速度のみを保持
      if (this.speedHistory.length > 5) {
        this.speedHistory.shift();
      }
      
      // 移動平均を計算
      const averageSpeed = this.speedHistory.reduce((sum, s) => sum + s, 0) / this.speedHistory.length;
      this.ffmpegSpeed = averageSpeed;
      
      console.warn(`FFmpeg speed: ${speed}x, Average speed: ${averageSpeed.toFixed(2)}x`);
    }
    
    // 動画時間情報を抽出（例：Duration: 00:01:23.45）
    const durationMatch = message.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (durationMatch && this.videoDuration === null) {
      const hours = parseInt(durationMatch[1], 10);
      const minutes = parseInt(durationMatch[2], 10);
      const seconds = parseFloat(durationMatch[3]);
      
      this.videoDuration = hours * 3600 + minutes * 60 + seconds;
      console.warn(`Video duration: ${this.videoDuration.toFixed(2)} seconds`);
      
      // セグメント時間から推定セグメント数を計算
      if (this.videoDuration > 0) {
        // processVideo メソッド内の segmentDuration デフォルト値は 0.5 秒
        const segmentDuration = 0.5; // デフォルト値
        this.estimatedSegments = Math.ceil(this.videoDuration / segmentDuration);
        console.warn(`Estimated segments: ${this.estimatedSegments} (based on ${segmentDuration}s segments)`);
      }
    }
    
    // フレーム情報を抽出 (例: "frame= 120 fps= 24")
    const frameMatch = message.match(/frame=\s*(\d+)\s+fps=\s*(\d+\.?\d*)/);
    if (frameMatch && frameMatch[1] && frameMatch[2]) {
      const currentFrame = parseInt(frameMatch[1]);
      const currentFps = parseFloat(frameMatch[2]);
      
      // フレームレートが取得できていない場合は設定
      if (this.frameRate === null && currentFps > 0) {
        this.frameRate = currentFps;
      }
      
      // 前回のフレーム処理からの経過時間を記録
      const currentTime = performance.now();
      if (this.lastFrameNumber !== null) {
        const framesDone = currentFrame - this.lastFrameNumber;
        const timeElapsed = currentTime - this.lastFrameTime;
        
        // 実際の処理フレームレートを計算（フレーム数/秒）
        if (timeElapsed > 0) {
          const actualFps = (framesDone / timeElapsed) * 1000;
          console.log(`Actual processing rate: ${actualFps.toFixed(2)} fps`);
        }
      }
      
      this.lastFrameNumber = currentFrame;
      this.lastFrameTime = currentTime;
      
      // 総フレーム数の推定（Durationが見つかった場合）
      if (this.totalFrames === null && this.frameRate !== null) {
        const durationMatch = message.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/);
        if (durationMatch) {
          const hours = parseInt(durationMatch[1]);
          const minutes = parseInt(durationMatch[2]);
          const seconds = parseInt(durationMatch[3]);
          const milliseconds = parseInt(durationMatch[4]) * 10; // 通常、小数点以下2桁までなので10倍
          
          const totalSeconds = hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
          this.totalFrames = Math.round(totalSeconds * this.frameRate);
          console.log(`Estimated total frames: ${this.totalFrames}`);
        }
      }
    }
  }

  /**
   * アップロード進捗を追跡するfetchFile関数のラッパー
   * @param file アップロードするファイル
   */
  private async fetchFileWithProgress(file: File): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      // FileReader APIを使用してファイル読み込みの進捗をトラックする
      const reader = new FileReader();
      
      reader.onprogress = (event) => {
        if (event.lengthComputable && this.onProgress) {
          this.uploadedBytes = event.loaded;
          const percent = Math.floor((event.loaded / event.total) * 100) / 20; // 0-5%にスケール
          
          const elapsedMs = performance.now() - this.uploadStartTime;
          const elapsedTime = this.timer.formatTime(elapsedMs);
          
          // アップロード速度の計算（バイト/秒）
          const bytesPerSecond = event.loaded / (elapsedMs / 1000);
          const remainingBytes = event.total - event.loaded;
          const remainingSeconds = remainingBytes / bytesPerSecond;
          const remainingTime = this.timer.formatTime(remainingSeconds * 1000);
          
          this.onProgress({
            message: `ファイルをアップロード中... (${Math.floor((event.loaded / event.total) * 100)}%)`,
            progress: {
              type: 'upload',
              current: event.loaded,
              total: event.total,
              percent: percent,
              elapsedTime,
              remainingTime
            }
          });
        }
      };
      
      reader.onload = () => {
        // 読み込み完了
        this.uploadedBytes = file.size;
        
        if (this.onProgress) {
          const elapsedMs = performance.now() - this.uploadStartTime;
          const elapsedTime = this.timer.formatTime(elapsedMs);
          
          this.onProgress({
            message: 'ファイルの読み込みが完了しました',
            progress: {
              type: 'upload',
              current: file.size,
              total: file.size,
              percent: 5, // 5%
              elapsedTime,
              remainingTime: this.calculateRemainingTime(5, elapsedMs)
            }
          });
        }
        
        // ArrayBufferをUint8Arrayに変換して返す
        const arrayBuffer = reader.result as ArrayBuffer;
        resolve(new Uint8Array(arrayBuffer));
      };
      
      reader.onerror = () => {
        reject(new Error('ファイルの読み込みに失敗しました'));
      };
      
      // ファイルの読み込みを開始
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 残り時間を計算して整形された文字列を返す
   * @param percent 現在の進捗パーセント (0-100)
   * @param elapsedMs 経過時間 (ミリ秒)
   * @param message 現在のFFmpegログメッセージ
   */
  private calculateRemainingTime(percent: number, elapsedMs: number, message?: string): string {
    // 無効な値や進捗がない場合
    if (percent <= 0 || elapsedMs <= 0) return '計算中...';
    
    // 進捗が100%の場合は残り時間はゼロ
    if (percent >= 100) return '0s';
    
    // 進捗の変化を確認して、その割合で残り時間を決める
    let remainingMs = 0;

    // 現在のログがtime=を含む処理中のものであり、かつ動画時間と現在の処理時間が取得できている場合
    if (this.videoDuration !== null && this.currentProcessingTime !== null && message?.includes('time=')) {
      // 実際の処理時間に基づいて残り時間を計算
      const processingRatio = this.currentProcessingTime / this.videoDuration;
      if (processingRatio > 0) {
        // 経過時間から処理速度を計算し、残り時間を推定
        const timeBasedEstimate = (elapsedMs / processingRatio) * (1 - processingRatio);
        
        // FFmpegのspeed値も考慮（利用可能であれば）
        if (this.ffmpegSpeed !== null && this.ffmpegSpeed > 0) {
          const speedFactor = Math.min(2.0, Math.max(0.5, 1 / this.ffmpegSpeed));
          remainingMs = timeBasedEstimate * speedFactor;
          
          console.log(`Time-based remaining estimate: ${this.timer.formatTime(timeBasedEstimate)} (adjusted by speed: ${this.ffmpegSpeed.toFixed(2)}x -> ${this.timer.formatTime(remainingMs)})`);
        } else {
          remainingMs = timeBasedEstimate;
          console.log(`Time-based remaining estimate: ${this.timer.formatTime(timeBasedEstimate)}`);
        }
        
        // 処理が進んでいるのに極端に長い推定時間が出る場合は抑制
        if (processingRatio > 0.5 && remainingMs > 5 * 60 * 1000) { // 5分以上
          remainingMs = Math.min(remainingMs, 5 * 60 * 1000);
        }
        
        // このセクションからリターンして他の計算をスキップ
        // 極端な値を制限
        const maxRemainingMs = 10 * 60 * 1000; // 最大10分
        remainingMs = Math.min(remainingMs, maxRemainingMs);
        
        // 前回の推定値との比較で急激な増加を防止
        if (this.lastRemainingMs !== null) {
          // 前回より50%以上増えた場合は、増加を抑制
          if (remainingMs > this.lastRemainingMs * 1.5) {
            remainingMs = this.lastRemainingMs * 1.5;
            console.log(`Limiting increase in remaining time estimation (time-based)`);
          }
        }
        
        // 不正な値の場合は「計算中...」と表示
        if (isNaN(remainingMs) || remainingMs <= 0) {
          return '計算中...';
        }
        
        // 細かい変動を減らすために計算結果を丸める
        remainingMs = Math.ceil(remainingMs / 5000) * 5000;
        
        // 次回の計算のために値を保存
        this.lastRemainingMs = remainingMs;
        
        return this.timer.formatTime(remainingMs);
      }
    }

    // time=情報がない場合は従来の計算方法を使用
    // 常に進捗率に基づく計算をベースとする
    const progressRatio = percent / 100;
    const baseEstimate = Math.max(0, (elapsedMs / progressRatio) - elapsedMs);
    
    // FFmpegの処理速度情報が利用可能な場合はそれも考慮
    if (this.ffmpegSpeed !== null && this.ffmpegSpeed > 0) {
      // TypeScriptのnull安全性のため、ローカル変数にコピー
      const speed = this.ffmpegSpeed;
      
      // 処理速度が1.0より小さいと、予測が大きくなりすぎる可能性がある
      // 必ず残り時間が減少するように調整
      let speedFactor = 1.0;
      
      // 速度が0.5より遅い場合は、換算率を調整
      if (speed < 0.5) {
        // 極端に低速な場合は換算率を抑える（0.1xでも10倍にはしない）
        speedFactor = Math.min(2.0, 1 / speed);
      }
      
      // 速度補正を適用した予測時間
      const estimatedBySpeed = elapsedMs * (speedFactor - progressRatio);
      
      // フレーム情報も利用可能な場合はより正確な計算
      if (this.lastFrameNumber !== null && this.totalFrames !== null && this.lastFrameNumber > 0) {
        const remainingFrames = Math.max(0, this.totalFrames - this.lastFrameNumber);
        const frameRate = this.frameRate || 24; // デフォルトは24fps
        
        // フレーム処理速度からの推定（処理速度で補正）
        const frameBasedEstimate = (remainingFrames / frameRate) * 1000 / Math.max(0.5, speed);
        
        // 進捗ベースと速度ベースとフレームベースの重み付け平均
        const weightedEstimate = (baseEstimate * 0.3) + (estimatedBySpeed * 0.3) + (frameBasedEstimate * 0.4);
        remainingMs = Math.max(0, weightedEstimate);
        
        console.log(
          `Remaining time estimates - Progress: ${this.timer.formatTime(baseEstimate)}, ` +
          `Speed: ${this.timer.formatTime(estimatedBySpeed)}, ` +
          `Frames: ${this.timer.formatTime(frameBasedEstimate)}, ` +
          `Weighted: ${this.timer.formatTime(remainingMs)}, ` +
          `Type: ${message?.includes('upload') ? 'upload' : 'processing'}, ` +
          `Current time: ${this.currentProcessingTime?.toFixed(2) || 'N/A'}`
        );
      } else {
        // フレーム情報がない場合は進捗と速度から推定
        // 進捗ベースと速度ベースの加重平均
        remainingMs = (baseEstimate * 0.6) + (estimatedBySpeed * 0.4);
      }
    } else {
      // 速度情報がない場合は進捗だけで計算
      remainingMs = baseEstimate;
    }
    
    // 処理段階に基づいて調整
    if (percent < 30) {
      // 初期段階では上限を設ける
      const maxEstimatedMs = 4 * 60 * 1000; // 4分
      remainingMs = Math.min(remainingMs, maxEstimatedMs);
    } else if (percent >= 70) {
      // 終盤（70%以上）では下限を設ける（短すぎる予測を防止）
      const minRemainingForLateStage = 10 * 1000; // 最低10秒
      remainingMs = Math.max(remainingMs, minRemainingForLateStage);
    }
    
    // 前回の推定値との比較で急激な増加を防止
    if (this.lastRemainingMs !== null) {
      // 前回より20%以上増えた場合は、増加を抑制
      if (remainingMs > this.lastRemainingMs * 1.2) {
        // 前回の値から最大20%までの増加に制限
        remainingMs = this.lastRemainingMs * 1.2;
        console.log(`Limiting increase in remaining time estimation`);
      }
      
      // 進捗が進んでいるのに残り時間が増えている場合は前回の値を維持
      const significantProgress = 5; // 5%以上の進捗を意味のある変化と見なす
      if (percent > this.lastProgress + significantProgress && remainingMs > this.lastRemainingMs) {
        remainingMs = this.lastRemainingMs;
        console.log(`Progress increased (${this.lastProgress} -> ${percent}) but remaining time increased, keeping previous estimate`);
      }
    }
    
    // 不正な値の場合は「計算中...」と表示
    if (isNaN(remainingMs) || remainingMs <= 0) {
      return '計算中...';
    }
    
    // 細かい変動を減らすために計算結果を丸める（10秒単位）
    remainingMs = Math.ceil(remainingMs / 10000) * 10000;
    
    // 次回の計算のために値を保存
    this.lastRemainingMs = remainingMs;
    
    return this.timer.formatTime(remainingMs);
  }
  
  /**
   * アップロード用の残り時間を計算
   * @param uploadedBytes アップロード済みバイト数
   * @param totalBytes 合計バイト数
   * @param elapsedMs 経過時間（ミリ秒）
   */
  private calculateRemainingTimeForUpload(uploadedBytes: number, totalBytes: number, elapsedMs: number): string {
    if (uploadedBytes <= 0 || totalBytes <= 0 || elapsedMs <= 0) {
      return '計算中...';
    }
    
    if (uploadedBytes >= totalBytes) {
      return '0s';
    }
    
    // 現在の速度（バイト/秒）を計算
    const bytesPerSecond = uploadedBytes / (elapsedMs / 1000);
    if (bytesPerSecond <= 0) {
      return '計算中...';
    }
    
    // 残りのバイト数
    const remainingBytes = totalBytes - uploadedBytes;
    
    // 残り時間（秒）
    const remainingSeconds = remainingBytes / bytesPerSecond;
    
    // ミリ秒に変換
    const remainingMs = remainingSeconds * 1000;
    
    // 極端な値を制限
    const maxRemainingMs = 10 * 60 * 1000; // 最大10分
    const limitedRemainingMs = Math.min(remainingMs, maxRemainingMs);
    
    // アップロード進捗をログに出力
    console.log(
      `Upload progress - Bytes: ${uploadedBytes}/${totalBytes} (${Math.floor((uploadedBytes / totalBytes) * 100)}%), ` +
      `Speed: ${(bytesPerSecond / 1024).toFixed(2)} KB/s, ` +
      `Remaining: ${this.timer.formatTime(limitedRemainingMs)}`
    );
    
    return this.timer.formatTime(limitedRemainingMs);
  }
}
