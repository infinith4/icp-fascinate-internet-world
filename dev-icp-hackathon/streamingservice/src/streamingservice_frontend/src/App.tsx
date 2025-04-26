import React, { useState, useEffect, useRef } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { _SERVICE } from '../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../declarations/streamingservice_backend';
import Hls from 'hls.js';

type VideoInfo = {
  id: string;
  title: string;
  description: string;
  hash: string;
};

function App() {

  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<HTMLVideoElement | null>(null);
  const [mediaSource, setMediaSource] = useState<MediaSource | null>(null);
  const [sourceBuffer, setSourceBuffer] = useState<SourceBuffer | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      //TODO: mp4 から m3u8ファイルとtsファイル を生成
      // handleFileUpload内
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
      const rewrittenM3u8 = m3u8Text.replace(/[^\n]*?(\d+)\.ts/g, (_, p1) => `icsegment://${videoId}/${p1}`);
      const blob = new Blob([rewrittenM3u8], { type: 'application/vnd.apple.mpegurl' });
      const m3u8Url = URL.createObjectURL(blob);
      if (Hls.isSupported()) {
        class CustomLoader extends Hls.DefaultConfig.loader {
          load(context: any, config: any, callbacks: any) {
            if (context.url.startsWith('icsegment://')) {
              const match = context.url.match(/^icsegment:\/\/(.+)\/(\d+)$/);
              if (match) {
                const [, vId, segIdx] = match;
                actor.get_hls_segment(vId, Number(segIdx)).then((result: any) => {
                  if (result && 'ok' in result) {
                    const uint8Array = new Uint8Array(result.ok);
                    callbacks.onSuccess({
                      data: uint8Array.buffer,
                      url: context.url
                    }, context, null);
                  } else {
                    callbacks.onError({ code: 400, text: 'Segment fetch error', url: context.url }, context, null);
                  }
                }).catch(() => {
                  callbacks.onError({ code: 500, text: 'Segment fetch exception', url: context.url }, context, null);
                });
                return;
              }
            }
            super.load(context, config, callbacks);
          }
        }
        const hls = new Hls({ 
          loader: CustomLoader,
          debug: true // デバッグログを有効化
        });
        hls.loadSource(m3u8Url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          video.play().catch(e => {
            if (e.name !== 'AbortError') {
              console.warn('play() error:', e);
            }
          });
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = m3u8Url;
        video.addEventListener('loadedmetadata', function () {
          video.play().catch(e => {
            if (e.name !== 'AbortError') {
              console.warn('play() error:', e);
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
            onChange={handleFileUpload}
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