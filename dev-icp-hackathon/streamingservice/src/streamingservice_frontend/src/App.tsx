import React, { useState, useEffect, useRef } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { _SERVICE } from '../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../declarations/streamingservice_backend';

type VideoInfo = {
  id: string;
  title: string;
  description: string;
  hash: string;
};

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);

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
    console.log("player");
    console.log(player);
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
        console.log("------------chunk");
        console.log(chunk);
        const result = await actor.upload_video_chunk(videoId, Array.from(new Uint8Array(chunkBuffer)), i);
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

  // 動画再生関数
  const playVideo = async (videoId: string) => {
    setLoading(true);
    setCurrentVideo(videoId);
    const player = videoRef.current;
    if (!player) {
      setLoading(false);
      return;
    }
    if (!videoPlayer) {
      setLoading(false);
      return;
    }

    // 既存のMediaSourceやSourceBufferをクリーンアップ
    if (mediaSource) {
      mediaSource.removeEventListener('sourceopen', () => {});
      setMediaSource(null);
    }
    if (sourceBuffer) {
      setSourceBuffer(null);
    }

    // 新しいMediaSourceを作成
    const newMediaSource = new MediaSource();
    setMediaSource(newMediaSource);
    player.src = URL.createObjectURL(newMediaSource);
    player.load();
    player.style.display = 'block';

    videoPlayer.src = URL.createObjectURL(newMediaSource);
    videoPlayer.load();
    videoPlayer.style.display = 'block';

    newMediaSource.addEventListener('sourceopen', async () => {
      // video/mp4 など、バックエンドで保存している形式に合わせてください
      const mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
      if (!MediaSource.isTypeSupported(mimeCodec)) {
        alert('このブラウザは指定のコーデックに対応していません: ' + mimeCodec);
        setLoading(false);
        return;
      }
      const sb = newMediaSource.addSourceBuffer(mimeCodec);
      setSourceBuffer(sb);

      try {
        let chunkIndex = 0;
        let isEnd = false;

        // チャンクを順次appendBuffer
        while (!isEnd) {
          const chunkResult = await actor.get_video_chunk(videoId, chunkIndex);
          if ('ok' in chunkResult && chunkResult.ok.length > 0) {
            const chunkArray = new Uint8Array(chunkResult.ok);
            await new Promise<void>((resolve, reject) => {
              sb.addEventListener('updateend', () => resolve(), { once: true });
              sb.appendBuffer(chunkArray);
            });
            chunkIndex++;
          } else {
            isEnd = true;
          }
        }
        console.log("chunkIndex");
        console.log(chunkIndex);
        console.log("isEnd");
        console.log(isEnd);

        // 最後のappendBufferが完了してからendOfStreamを呼ぶ
        console.log("sb.updating");
        console.log(sb.updating);
        if (sb.updating) {
          sb.addEventListener('updateend', () => {
            if (newMediaSource.readyState === 'open') {
              newMediaSource.endOfStream();
              videoPlayer.play();
            }
          }, { once: true });
        } else {
          console.log("newMediaSource.readyState");
          console.log(newMediaSource.readyState);
          newMediaSource.endOfStream();
          videoPlayer.play();
          if (newMediaSource.readyState === 'open') {
            newMediaSource.endOfStream();
            videoPlayer.play();
          }
        }
      } catch (error) {
        console.error('Error streaming video:', error);
      } finally {
        setLoading(false);
      }
    });
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
            accept="video/*"
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
                  onClick={() => playVideo(video.id)}
                  disabled={loading}
                >
                  {currentVideo === video.id ? 'Playing...' : 'Play'}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <video ref={videoRef} controls style={{ width: 640, height: 360, display: 'block', margin: '16px auto' }} />
      </main>
    </div>
  );
}

export default App;