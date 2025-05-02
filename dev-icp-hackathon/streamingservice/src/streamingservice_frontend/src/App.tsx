import React, { useState, useEffect, useRef } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { _SERVICE } from '../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../declarations/streamingservice_backend';
import Hls from 'hls.js';
import { FFmpegService, FFmpegProgress } from './services/FFmpegService';
import { Timer } from './utils/Timer';

type VideoInfo = {
  id: string;
  title: string;
  description: string;
  hash: string;
};

interface ProgressBarProps {
  progress: number;
  message: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progress, message }) => (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ marginBottom: '5px' }}>{message}</div>
    <div style={{ 
      width: '100%', 
      height: '20px', 
      backgroundColor: '#eee',
      borderRadius: '10px',
      overflow: 'hidden'
    }}>
      <div style={{
        width: `${Math.min(100, Math.max(0, progress))}%`,
        height: '100%',
        backgroundColor: '#4CAF50',
        transition: 'width 0.3s ease'
      }} />
    </div>
    <div style={{ textAlign: 'right' }}>{progress.toFixed(1)}%</div>
  </div>
);

function App() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ message: string; progress: number } | null>(null);
  const ffmpegService = useRef(new FFmpegService());
  const ffmpegMessageRef = useRef<HTMLParagraphElement>(null);

  const timer = new Timer();
  const agent = HttpAgent.createSync({
    host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
    callOptions: {
      update: {
        timeout: 300000,
      },
    },
  });
  
  const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
    agent,
  }) as Actor & _SERVICE;

  useEffect(() => {
    initFFmpeg();
    const videoContainer = document.getElementById('video-container');
    console.log('videoContainer:', videoContainer);
    if (!videoContainer) return;

    // video要素を作成
    const player = document.createElement('video');
    player.controls = true;
    player.playsInline = true;
    player.autoplay = true;
    
    // video要素のスタイルを設定
    player.style.width = '100%';
    player.style.height = '100%';
    player.style.objectFit = 'contain'; // アスペクト比を保持しながらコンテナに収める
    player.style.backgroundColor = '#000';
    player.style.display = 'block';
    
    // video-containerにvideo要素を追加
    videoContainer.appendChild(player);
    setVideoPlayer(player);

    loadVideos();

    return () => {
      console.log('Cleaning up video player');
      if (player && videoContainer.contains(player)) {
        console.log('remove Cleaning up video player');
        videoContainer.removeChild(player);
      }
    };
  }, []);

  const initFFmpeg = async () => {
    try {
      const ffmpeg = ffmpegService.current;
      ffmpeg.onProgress = ({ message }) => {
        if (ffmpegMessageRef.current) {
          ffmpegMessageRef.current.innerHTML = message;
        }
      };
      
      await ffmpeg.load();
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

  const handleFileUploadWithFfmpeg = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setUploadProgress({ message: 'Starting upload...', progress: 0 });

    try {
      console.log('create_video:');
      const video_id = await actor.create_video(file.name, '');

      // FFmpeg処理の進捗表示を設定
      ffmpegService.current.onProgress = (progress: FFmpegProgress) => {
        if (progress.progress) {
          setUploadProgress({
            message: progress.message,
            progress: progress.progress.percent
          });
        } else {
          setUploadProgress({
            message: progress.message,
            progress: uploadProgress?.progress || 0
          });
        }
      };

      const { playlist, segments } = await ffmpegService.current.processVideo(file);
      console.log('processVideo:');

      // プレイリストのアップロード
      const playlistText = new TextDecoder().decode(playlist);
      console.log('playlist:', playlistText);
      setUploadProgress({ message: 'Uploading playlist...', progress: 0 });
      const playlistResult = await actor.upload_playlist(video_id, playlistText);
      
      if ('err' in playlistResult) {
        throw new Error(`Failed to upload playlist: ${playlistResult.err}`);
      }

      // セグメントのアップロード
      const totalSegments = segments.length;
      const CHUNK_SIZE = 1024 * 1024; // 1MB
      let uploadedSegments = 0;
      let totalChunks = 0;
      let uploadedChunks = 0;

      // 総チャンク数を計算
      for (const segment of segments) {
        totalChunks += Math.ceil(segment.data.length / CHUNK_SIZE);
      }

      for (const segment of segments) {
        const uint8Array = new Uint8Array(segment.data);
        const segmentChunks = Math.ceil(uint8Array.length / CHUNK_SIZE);
        let uploadedSegmentChunks = 0;

        for (let offset = 0; offset < uint8Array.length; offset += CHUNK_SIZE) {
          const chunk = uint8Array.slice(offset, offset + CHUNK_SIZE);
          console.log('upload_ts_segment:', segment.index);
          const result = await actor.upload_ts_segment(
            video_id,
            segment.index,
            Array.from(chunk)
          );
          
          if ('err' in result) {
            throw new Error(`Failed to upload segment ${segment.index}: ${result.err}`);
          }

          uploadedSegmentChunks++;
          uploadedChunks++;
          
          const totalProgress = (uploadedChunks / totalChunks) * 100;
          setUploadProgress({
            message: `Uploading segment ${uploadedSegments + 1}/${totalSegments} (${uploadedSegmentChunks}/${segmentChunks} chunks)`,
            progress: totalProgress
          });
        }

        uploadedSegments++;
      }

      await loadVideos();
      setUploadProgress({ message: 'Upload completed!', progress: 100 });
      alert('アップロード成功');
    } catch (e) {
      console.error('Error during upload:', e);
      alert('アップロード中にエラーが発生しました: ' + (e as Error).message);
    } finally {
      setLoading(false);
      setTimeout(() => setUploadProgress(null), 2000); // 2秒後にプログレスバーを非表示
    }
    
    const resulttimer = timer.stop();
    console.log('Timer results:', timer.formatResults(resulttimer));
  };

  const handleFileUploadHls = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      // m3u8ファイルとtsファイルをアップロード
      const files = event.target.files;
      console.log('files:', files);
      const title = files?.[0].name;
      console.log('title:', title);
      const description = '';
      const video_id = await actor.create_video(title || 'Untitled', description);
      if (!files) return;

      let playlistFile: File | null = null;
      const tsFiles: { file: File, index: number }[] = [];

      // ファイルを分類
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.name.endsWith('.m3u8')) {
          playlistFile = f;
        } else if (f.name.endsWith('.ts')) {
          // 例: IC-Hello-Starter-001.ts → 001
          const match = f.name.match(/(\d+)\.ts$/);
          if (match) {
            tsFiles.push({ file: f, index: parseInt(match[1], 10) });
          }
        }
      }

      // m3u8アップロード
      if (playlistFile) {
        const text = await playlistFile.text();
        console.log('text:', text);
        console.log('upload_playlist:');
        const result = await actor.upload_playlist(video_id, text);
        console.log('upload_playlist:', result);
        if ('err' in result) {
          alert('プレイリストアップロード失敗: ' + result.err);
          setLoading(false);
          return;
        }
      }

      // tsセグメントアップロード
      for (const { file, index } of tsFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = Array.from(new Uint8Array(arrayBuffer));
        const result = await actor.upload_ts_segment(video_id, index, uint8Array);
        console.log('upload_ts_segment. index: ', index);
        if ('err' in result) {
          alert(`セグメント${index}アップロード失敗: ` + result.err);
          setLoading(false);
          return;
        }
      }

      await loadVideos();
      alert('アップロード成功');
    } catch (e) {
      alert('アップロード中にエラーが発生しました');
      console.error(e);
    }
    setLoading(false);
  };
  
  //ファイルアップロード処理（チャンク分割＆upload_video_segment呼び出し）
  const handleFileUploadOriginal = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const title = prompt('Enter video title:') || 'Untitled';
    const description = prompt('Enter video description:') || 'No description';

    try {
      const videoId = await actor.create_video(title, description);
      console.log(videoId);
      // Split video into chunks and upload
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
        const chunkBuffer = await chunk.arrayBuffer();
        console.log("------------chunk", i);
        console.log(chunk);
        const result = await actor.upload_video_chunk(videoId, i, Array.from(new Uint8Array(chunkBuffer)));
        if ('err' in result) {
          throw new Error(result.err);
        }
      }

      await loadVideos(); // Reload video list
    } catch (error) {
      console.error('Error uploading video:', error);
    } finally {
      setLoading(false);
    }
  };

  const playVideoOriginal = async (videoId: string) => {
    if (!videoPlayer) return;

    setLoading(true);
    try {
      const chunks: Blob[] = [];
      let chunkIndex = 0;
      
      while (true) {
        try {
          const result = await actor.get_video_chunk(videoId, chunkIndex);
          console.log("----------------------");
          console.log(result);
          
          if ('err' in result) {
            break;
          }
          chunks.push(new Blob([new Uint8Array(result.ok)]));
          chunkIndex++;
        } catch (error) {
          break;
        }
      }

      const videoBlob = new Blob(chunks, { type: 'video/mp4' });
      videoPlayer.src = URL.createObjectURL(videoBlob);
      console.log("URL.createObjectURL(videoBlob)");
      console.log(URL.createObjectURL(videoBlob));
      setCurrentVideo(videoId);
    } catch (error) {
      console.error('Error playing video:', error);
    } finally {
      setLoading(false);
    }
  };

  // HLS.jsによるHLSストリーミング再生関数（MediaSource APIは使わない）
  const playHlsStream = async (videoId: string) => {
    console.log('playHlsStream:', videoId);
    setCurrentVideo(videoId);
    const video = videoPlayer;
    console.log('video:', video);
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

                actor.get_hls_segment(vId, segmentId)
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
        actor.get_hls_segment(videoId, Number(segIdx)).then((result: any) => {
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

  const deleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video?')) {
      return;
    }
    
    setLoading(true);
    try {
      const result = await actor.delete_video(videoId);
      if ('ok' in result) {
        await loadVideos(); // 動画リストを再読み込み
        if (currentVideo === videoId) {
          setCurrentVideo(null); // 現在再生中の動画が削除された場合、再生を停止
          if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.removeAttribute('src');
            videoPlayer.load();
          }
        }
      } else {
        alert('削除失敗: ' + result.err);
      }
    } catch (e) {
      alert('削除中にエラーが発生しました');
      console.error(e);
    }
    setLoading(false);
  };

  return (
    <div className="App">
      <header>
        <h1>Video Streaming Service</h1>
      </header>
      <main>
        <div className="upload-section-hls">
          <label>upload-section-hls: 
            <input
              type="file"
              accept=".m3u8,.ts,video/*"
              multiple
              onChange={handleFileUploadHls}
              disabled={loading}
            />
          </label>
          {loading && <p>Loading...</p>}
        </div>
        <div className="upload-section-ffmpeg">
          <label>upload-section-ffmpeg: 
            <input
              type="file"
              accept=".mp4,video/*"
              multiple
              onChange={handleFileUploadWithFfmpeg}
              disabled={loading}
            />
          </label>
          {loading && <p>Loading...</p>}
        </div>
        <div className="upload-section-original">
          <label>upload-section-original: 
            <input
              type="file"
              accept=".mp4,video/*"
              multiple
              onChange={handleFileUploadOriginal}
              disabled={loading}
            />
          </label>
          {loading && <p>Loading...</p>}
        </div>
        {uploadProgress && (
            <ProgressBar
              progress={uploadProgress.progress}
              message={uploadProgress.message}
            />
          )}
        <div className="video-list">
          <h2>Available Videos</h2>
          <p ref={ffmpegMessageRef}></p>
          <ul>
            {videos.map((video) => (
              <li key={video.id}>
                <h3>{video.title}</h3>
                <p>{video.description}</p>
                <button 
                  onClick={() => playHlsStream(video.id)}
                  disabled={loading}
                >
                  {currentVideo === video.id ? 'Playing...' : 'Play HLS'}
                </button>
                <button 
                  onClick={() => downloadStream(video.id)}
                  disabled={loading}
                >
                  {currentVideo === video.id ? 'Downloading...' : 'Download'}
                </button>
                <button 
                  onClick={() => deleteVideo(video.id)}
                  disabled={loading}
                  style={{ backgroundColor: '#ff4444' }}
                >
                  Delete
                </button>

                <button 
                  onClick={() => playVideoOriginal(video.id)}
                  disabled={loading}
                >
                  {currentVideo === video.id ? 'Playing...' : 'Play Original MP4'}
                </button>
              </li>
            ))}
          </ul>
          <div 
            id="video-container" 
            style={{
              width: '100%',
              maxWidth: '800px',
              margin: '0 auto',
              position: 'relative',
              backgroundColor: '#000',
              aspectRatio: '16/9',
              overflow: 'hidden', // はみ出し部分を隠す
              cursor: 'pointer'
            }}
          />
        </div>
        <p>
          <video controls src="https://webdesign-trends.net/wp/wp-content/uploads/2021/09/sample-video.mp4" style={{ width: '736px'}}  ></video>
        </p>
      </main>
    </div>
  );
}

export default App;