import React, { useState, useEffect } from 'react';
import { Actor, HttpAgent, ActorMethod } from '@dfinity/agent';
import { _SERVICE } from '../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../declarations/streamingservice_backend';

type VideoInfo = {
  id: string;
  title: string;
  description: string;
  hash: string;
};

type VideoChunkResult = {
  ok?: Uint8Array;
  err?: string;
};

function App() {
  const [videos, setVideos] = useState<VideoInfo[]>([]);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<HTMLVideoElement | null>(null);
  const [loading, setLoading] = useState(false);

  const agent = new HttpAgent({
    host: 'http://localhost:4943',
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
        hash // ハッシュは空文字列として設定
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

  const playVideo = async (videoId: string) => {
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
      </main>
    </div>
  );
}

export default App;