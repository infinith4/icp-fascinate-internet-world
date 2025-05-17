import React, { useState, useEffect, useRef } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { _SERVICE } from '../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../declarations/streamingservice_backend';
import Hls from 'hls.js';
import { FFmpegService, FFmpegProgress } from './services/FFmpegService';

type VideoInfo = {
  id: string;
  title: string;
  description: string;
  hash: string;
};

interface Image {
  id: string;
  title: string;
  thumbnailUrl?: string;
}

function App() {

  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<HTMLVideoElement | null>(null);
  const [mediaSource, setMediaSource] = useState<MediaSource | null>(null);
  const [sourceBuffer, setSourceBuffer] = useState<SourceBuffer | null>(null);
  const [loading, setLoading] = useState(false);
  const backendApiVersion = import.meta.env.VITE_BACKEND_API_VERSION;
  const [uploadProgress, setUploadProgress] = useState(0);
  const ffmpegService = useRef(new FFmpegService());
  const [images, setImages] = useState<Image[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  const agent = HttpAgent.createSync({
    host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
    callOptions: {
      update: {
        timeout: 300000, // 5 minutes
      },
    },
  });
  const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
    agent,
  }) as Actor & _SERVICE;

  useEffect(() => {
    initFFmpeg();
    // Initialize video player
    const player = document.createElement('video');
    player.controls = true;
    setVideoPlayer(player);
    document.body.appendChild(player);

    // Load video list
    loadVideos();

    return () => {
      if (player) {
        document.body.removeChild(player);
      }
    };
  }, []);

  const initFFmpeg = async () => {
    try {
      await ffmpegService.current.load();
      setFfmpegLoaded(true);
    } catch (error) {
      console.error('FFmpeg initialization error:', error);
    }
  };
  const loadVideos = async () => {
    try {
      const videoList = await actor.get_video_list();
      setVideos(videoList.map(([id, title, description, hash]: [string, string, string, string]) => ({
        id,
        title,
        description,
        hash
      })));
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  };

  const handleUpload = async (file: File, title: string) => {
    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
        //identity: identity
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      // 動画IDを作成
      const video_id = await actor.create_video(backendApiVersion, title, '');

      // FFmpegの進捗ハンドラーを設定
      ffmpegService.current.onProgress = (progress: FFmpegProgress) => {
        if (progress.progress) {
          // FFmpeg処理の進捗は0-30%で表示
          setUploadProgress(progress.progress.percent * 0.3);
        }
      };

      console.log("start ffmpeg");
      // FFmpegで動画を処理
      const { playlist, segments, thumbnail } = await ffmpegService.current.processVideo(file);
      console.log("end ffmpeg");

      // プレイリストをアップロード
      const playlistText = new TextDecoder().decode(playlist);
      await actor.upload_playlist(backendApiVersion, video_id, playlistText);

      // セグメントを順次アップロード（チャンクサイズとバッチサイズを最適化）
      const CHUNK_SIZE = 1.5 * 1024 * 1024; // 512KBに縮小
      const BATCH_SIZE = 1; // 同時アップロード数を制限
      const RETRY_COUNT = 3; // リトライ回数
      const RETRY_DELAY = 2000; // リトライ間隔（ミリ秒）

      // 全セグメントの総チャンク数を計算
      let totalChunks = 0;
      const segmentChunks = segments.map(segment => {
        const numChunks = Math.ceil(segment.data.length / CHUNK_SIZE);
        totalChunks += numChunks;
        return numChunks;
      });

      let uploadedChunks = 0;
      const uploadSegment = async (segment: { index: number; data: Uint8Array }) => {
        const chunks: Uint8Array[] = [];
        for (let offset = 0; offset < segment.data.length; offset += CHUNK_SIZE) {
          chunks.push(segment.data.slice(offset, Math.min(offset + CHUNK_SIZE, segment.data.length)));
        }

        for (let chunk_index = 0; chunk_index < chunks.length; chunk_index++) {
          let retries = 0;
          let success = false;

          while (retries < RETRY_COUNT && !success) {
            try {
              console.log(`--------------Uploading segment ${segment.index} / ${segments.length}, chunk ${chunk_index + 1}/${chunks.length}`);
              const result = await actor.upload_ts_segment_chunk(
                backendApiVersion,
                video_id,
                segment.index,
                chunk_index,
                chunks.length,
                Array.from(chunks[chunk_index])
              );

              if ('ok' in result) {
                success = true;
                console.log(`--------------Successfully uploaded segment ${segment.index} / ${segments.length}, chunk ${chunk_index + 1}/${chunks.length}`);
              } else {
                throw new Error(`Upload failed: ${result.err || 'Unknown error'}`);
              }
            } catch (error) {
              retries++;
              console.error(`Upload attempt ${retries} failed for segment ${segment.index}, chunk ${chunk_index + 1}:`, error);
              
              if (retries === RETRY_COUNT) {
                throw new Error(`Failed to upload segment ${segment.index} chunk ${chunk_index + 1} after ${RETRY_COUNT} retries: ${error}`);
              }
              
              // 指数バックオフで待機
              const delay = RETRY_DELAY * Math.pow(2, retries - 1);
              console.log(`Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          if (!success) {
            throw new Error(`Failed to upload segment ${segment.index} chunk ${chunk_index + 1} after all retries`);
          }

          uploadedChunks++;
          // アップロード進捗は30-100%で表示（FFmpeg処理が0-30%）
          const uploadProgress = (uploadedChunks / totalChunks) * 70;
          setUploadProgress(30 + uploadProgress);
        }
      };

      // バッチ処理でセグメントをアップロード
      console.log(`Starting batch upload of ${segments.length} segments with batch size ${BATCH_SIZE}`);
      
      for (let i = 0; i < segments.length; i += BATCH_SIZE) {
        const batch = segments.slice(i, Math.min(i + BATCH_SIZE, segments.length));
        console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(segments.length / BATCH_SIZE)}`);
        
        try {
          // バッチ内の各セグメントを並列でアップロード
          const uploadPromises = batch.map(async (segment) => {
            console.log(`Starting upload of segment ${segment.index}`);
            await uploadSegment(segment);
            console.log(`Completed upload of segment ${segment.index}`);
          });

          // バッチ内のすべてのアップロードが完了するまで待機
          await Promise.all(uploadPromises);
          console.log(`Completed batch ${Math.floor(i / BATCH_SIZE) + 1}`);
        } catch (error) {
          console.error(`Failed to upload batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error);
          throw new Error(`Batch upload failed: ${error}`);
        }
      }

      console.log(`All segments uploaded successfully. segments: ${segments.length}`);

      // サムネイルがある場合はアップロード
      if (thumbnail) {
        console.log('Uploading thumbnail...');
        const thumbnailChunks: Uint8Array[] = [];
        for (let offset = 0; offset < thumbnail.length; offset += CHUNK_SIZE) {
          thumbnailChunks.push(thumbnail.slice(offset, Math.min(offset + CHUNK_SIZE, thumbnail.length)));
        }

        for (let i = 0; i < thumbnailChunks.length; i++) {
          let retries = 0;
          let success = false;

          while (retries < RETRY_COUNT && !success) {
            try {
              console.log(`Uploading thumbnail chunk ${i + 1}/${thumbnailChunks.length}`);
              const result = await actor.upload_thumbnail(backendApiVersion, video_id, Array.from(thumbnailChunks[i]));
              
              if ('ok' in result) {
                success = true;
                console.log(`Successfully uploaded thumbnail chunk ${i + 1}`);
              } else {
                throw new Error(`Thumbnail upload failed: ${result.err || 'Unknown error'}`);
              }
            } catch (error) {
              retries++;
              console.error(`Thumbnail upload attempt ${retries} failed for chunk ${i + 1}:`, error);
              
              if (retries === RETRY_COUNT) {
                throw new Error(`Failed to upload thumbnail chunk ${i + 1} after ${RETRY_COUNT} retries: ${error}`);
              }
              
              const delay = RETRY_DELAY * Math.pow(2, retries - 1);
              console.log(`Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          if (!success) {
            throw new Error(`Failed to upload thumbnail chunk ${i + 1} after all retries`);
          }
        }
        console.log('Thumbnail upload completed');
      }

      console.log('get_video_list');
      // 動画リストを更新
      const videoList = await actor.get_video_list();
      const videosWithThumbnails = await Promise.all(
        videoList.map(async ([id, title]) => {
          try {
            const thumbnailResult = await actor.get_thumbnail(id);
            if ('ok' in thumbnailResult) {
              const blob = new Blob([new Uint8Array(thumbnailResult.ok)], { type: 'image/jpeg' });
              const thumbnailUrl = URL.createObjectURL(blob);
              return { id, title, thumbnailUrl };
            }
          } catch (error) {
            console.error(`Error loading thumbnail for video ${id}:`, error);
          }
          return { id, title };
        })
      );

      setImages(videosWithThumbnails);
      setUploadModalOpen(false);
      setUploadProgress(0);
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  };

  // ファイルアップロード処理（チャンク分割＆upload_video_segment呼び出し）
  // const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
  //   const file = event.target.files?.[0];
  //   if (!file) return;
  //   setLoading(true);
  //   try {
  //     // 動画エントリ作成
  //     const title = file.name;
  //     const description = '';
  //     const video_id = await actor.create_video(title, description);
  //     // チャンクサイズ（例: 1MB）
  //     const CHUNK_SIZE = 1024 * 1024;
  //     const arrayBuffer = await file.arrayBuffer();
  //     const uint8Array = new Uint8Array(arrayBuffer);
  //     const totalChunks = Math.ceil(uint8Array.length / CHUNK_SIZE);
  //     for (let i = 0; i < totalChunks; i++) {
  //       const start = i * CHUNK_SIZE;
  //       const end = Math.min(start + CHUNK_SIZE, uint8Array.length);
  //       const chunk = Array.from(uint8Array.slice(start, end));
  //       console.log('Uploading chunk', i + 1, 'of', totalChunks);
  //       const result = await actor.upload_video_segment(video_id, chunk, i);
  //       console.log('Chunk upload result:', result);
  //       if (!('ok' in result)) {
  //         alert('アップロード失敗: ' + (result.err ?? 'unknown error'));
  //         setLoading(false);
  //         return;
  //       }
  //     }
  //     await loadVideos();
  //     alert('アップロード成功');
  //   } catch (e) {
  //     alert('アップロード中にエラーが発生しました');
  //     console.error(e);
  //   }
  //   setLoading(false);
  // };

  const playTsSegment = (segmentData: Uint8Array) => {
    if (!videoPlayer) return;
    const blob = new Blob([segmentData], { type: 'video/mp2t' });
    const url = URL.createObjectURL(blob);
    videoPlayer.src = url;
    videoPlayer.play();
  };

  // HLS.jsによるHLSストリーミング再生関数（MediaSource APIは使わない）
  const playHlsStream = async (videoId: string) => {
    setCurrentVideo(videoId);
    const video = videoPlayer;
    if (!video) return;
    video.pause();
    video.removeAttribute('src');
    video.load();

    const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
    if (playlistResult && 'ok' in playlistResult) {
      const m3u8Text = String(playlistResult.ok);
      // Remove any encryption related tags and attributes from m3u8
      const cleanedM3u8 = m3u8Text
        .split('\n')
        .filter(line => !line.startsWith('#EXT-X-KEY') && !line.includes('IV='))
        .map(line => line.replace(/,IV=0x[0-9a-fA-F]+/, ''))
        .join('\n');
      
      const rewrittenM3u8 = cleanedM3u8.replace(/[^\n]*?(\d+)\.ts/g, (_, p1) => `icsegment://${videoId}/${p1}`);
      console.log('Processed m3u8:', rewrittenM3u8);
      
      const blob = new Blob([rewrittenM3u8], { type: 'application/vnd.apple.mpegurl' });
      const m3u8Url = URL.createObjectURL(blob);
      
      if (Hls.isSupported()) {
        class CustomLoader extends Hls.DefaultConfig.loader {
          load(context: any, config: any, callbacks: any) {
            if (context.url.startsWith('icsegment://')) {
              const match = context.url.match(/^icsegment:\/\/(.+)\/(\d+)$/);
              if (match) {
                const [, vId, segIdx] = match;
                const segmentId = Number(segIdx);

                actor.get_segment_chunk(vId, segmentId, 0)
                  .then((result: any) => {
                    if (result && 'ok' in result) {
                      const data = new Uint8Array(result.ok);
                      if (data.length > 0) {
                        // Log the first few bytes to verify MPEG-TS sync byte
                        console.log('First bytes of segment:', Array.from(data.slice(0, 4)));
                        
                        callbacks.onSuccess({
                          data: data.buffer,
                          stats: {
                            loaded: data.length,
                            total: data.length,
                            retry: 0,
                            aborted: false,
                            loading: { first: 0, start: 0, end: 0 },
                            parsing: { start: 0, end: 0 },
                            buffering: { first: 0, start: 0, end: 0 }
                          },
                          url: context.url
                        }, context, {});  // Pass empty object instead of null
                      } else {
                        throw new Error('Empty segment data');
                      }
                    } else {
                      throw new Error(result.err || 'Segment fetch error');
                    }
                  })
                  .catch((error) => {
                    console.error('Failed to load segment:', error);
                    callbacks.onError({
                      code: 500,
                      text: `Failed to load segment: ${error.message}`,
                      url: context.url
                    }, context, null);
                  });
                return;
              }
            }
            super.load(context, config, callbacks);
          }
        }

        const hls = new Hls({
          debug: true,
          enableWorker: false,
          enableSoftwareAES: false,
          emeEnabled: false,
          loader: CustomLoader,
          progressive: true,
          lowLatencyMode: false,
          maxBufferSize: 0,
          maxBufferLength: 30,
          manifestLoadingTimeOut: 20000,
          manifestLoadingMaxRetry: 6,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 20000,
          levelLoadingMaxRetry: 6,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 6,
          startFragPrefetch: true
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          console.warn('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Fatal network error encountered, try to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Fatal media error encountered, try to recover...');
                hls.recoverMediaError();
                break;
              default:
                console.log('Fatal error, cannot recover');
                hls.destroy();
                break;
            }
          }
        });

        hls.on(Hls.Events.FRAG_LOADING, (_event, data) => {
          console.log('Fragment loading:', data);
        });

        hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
          console.log('Fragment loaded:', data);
        });

        hls.loadSource(m3u8Url);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('Manifest parsed, attempting playback');
          video.play().catch(e => {
            if (e.name !== 'AbortError') {
              console.warn('Play error:', e);
            }
          });
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = m3u8Url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(e => {
            if (e.name !== 'AbortError') {
              console.warn('Play error:', e);
            }
          });
        });
      } else {
        alert('HLS is not supported in this browser.');
      }
    } else {
      alert('HLSプレイリスト取得失敗');
    }
  };
  const downloadStream = async (videoId: string) => {

    console.log('downloadStream:',  videoId);
    const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
    if (playlistResult && 'ok' in playlistResult) {
      const m3u8Text = String(playlistResult.ok);
      // m3u8内の.tsパスをicsegment://videoId/segmentIndexに書き換え（接頭辞除去）
      const rewrittenM3u8 = m3u8Text.replace(/[^\n]*?(\d+)\.ts/g, (_, p1) => `icsegment://${videoId}/${p1}`);
      const blob = new Blob([rewrittenM3u8], { type: 'application/vnd.apple.mpegurl' });
      const m3u8Url = URL.createObjectURL(blob);
      console.log('m3u8Url:', m3u8Url);
      if (true) {
        const segIdx = 0;
        actor.get_segment_chunk(videoId, Number(segIdx), 0).then((result: any) => {
          console.log('Segment data:', result);
          // セグメントデータをファイル出力
          const downloadblob = new Blob([result.ok], { type: 'video/mp2t' });
          const url = URL.createObjectURL(downloadblob);
          const a = document.createElement('a');
          a.href = url;
          console.log('url:', url);
          a.download = `segment_${segIdx}.ts`;
          document.body.appendChild(a);
          a.click();
          // document.body.removeChild(a);
          // URL.revokeObjectURL(url);

        });
      }
    } else {
      alert('HLSプレイリスト取得失敗');
    }
  };

  return (
    <div className="App">
      <header>
        <h1>Video Streaming Service</h1>
      </header>
      <main>
        <div className="upload-section">
          <input
            type="file"
            accept=".m3u8,.ts,video/*"
            multiple
            onChange={handleUpload}
            disabled={loading}
          />
          {loading && <p>Loading...</p>}
        </div>
        <div className="video-list">
          <h2>Available Videos</h2>
          <ul>
            {videos.map((video) => (
              <li key={video.id}>
                <h3>{video.title}</h3>
                <p>{video.description}</p>
                <button 
                  onClick={() => playHlsStream(video.id)}
                  disabled={loading}
                >
                  {currentVideo === video.id ? 'Playing...' : 'Play'}
                </button>
                <button 
                  onClick={() => downloadStream(video.id)}
                  disabled={loading}
                >
                  {currentVideo === video.id ? 'Downloading...' : 'Download'}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}

export default App;