import React, { useState, useEffect } from 'react';
import { Actor, HttpAgent } from '@dfinity/agent';
import { createActor } from './declarations/video_streaming_backend';

function App() {
  const [videos, setVideos] = useState<{id: string, title: string, description: string}[]>([]);
  const [currentVideo, setCurrentVideo] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<HTMLVideoElement | null>(null);

  const agent = new HttpAgent();
  const actor = createActor(process.env.REACT_APP_CANISTER_ID!, {
    agent,
  });

  useEffect(() => {
    // Initialize video player
    const player = document.createElement('video');
    player.controls = true;
    setVideoPlayer(player);
    document.body.appendChild(player);

    return () => {
      if (player) {
        document.body.removeChild(player);
      }
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const title = prompt('Enter video title:') || 'Untitled';
    const description = prompt('Enter video description:') || 'No description';

    try {
      const videoId = await actor.create_video(title, description);
      
      // Split video into chunks and upload
      const chunkSize = 1024 * 1024; // 1MB chunks
      const totalChunks = Math.ceil(file.size / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = file.slice(i * chunkSize, (i + 1) * chunkSize);
        const chunkBuffer = await chunk.arrayBuffer();
        await actor.upload_video_chunk(videoId, Array.from(new Uint8Array(chunkBuffer)), i);
      }

      setVideos([...videos, { id: videoId, title, description }]);
    } catch (error) {
      console.error('Error uploading video:', error);
    }
  };

  const playVideo = async (videoId: string) => {
    if (!videoPlayer) return;

    try {
      const chunks: Blob[] = [];
      let chunkIndex = 0;
      
      while (true) {
        try {
          const chunk = await actor.get_video_chunk(videoId, chunkIndex);
          chunks.push(new Blob([new Uint8Array(chunk)]));
          chunkIndex++;
        } catch (error) {
          break;
        }
      }

      const videoBlob = new Blob(chunks, { type: 'video/mp4' });
      videoPlayer.src = URL.createObjectURL(videoBlob);
      setCurrentVideo(videoId);
    } catch (error) {
      console.error('Error playing video:', error);
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
          />
        </div>

        <div className="video-list">
          <h2>Available Videos</h2>
          <ul>
            {videos.map((video) => (
              <li key={video.id}>
                <h3>{video.title}</h3>
                <p>{video.description}</p>
                <button onClick={() => playVideo(video.id)}>
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