import React, { useEffect, useState } from 'react';
//import { streamingservice_backend } from 'declarations/streamingservice_backend'; // 適宜パスを調整
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../../declarations/streamingservice_backend';
import { Header } from './Header';
import { Box } from '@mui/material';

interface VideoInfo {
  id: string;
  title: string;
  description: string;
  hash: string;
  //totalSizeBytes: number; // lib.rs で追加したフィールド
}

function CanisterList() {
  const [videoList, setVideoList] = useState<VideoInfo[]>([]);
  const [totalVideoCount, setTotalVideoCount] = useState<number>(0);
  const [totalStorageUsed, setTotalStorageUsed] = useState<number>(0); // バイト単位
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    initAuth();
    fetchVideoList();
  }, []);

  const initAuth = async () => {
    try {
      const authClient = await AuthClient.create();
      const isAuthenticated = await authClient.isAuthenticated();
      
      if (isAuthenticated) {
        const identity = authClient.getIdentity();
        setIdentity(identity);
      }
    } catch (error) {
      console.error("Error initializing auth:", error);
    }
  };

  const handleAuthChange = (newIdentity: Identity | null) => {
    setIdentity(newIdentity);
  };

  const fetchVideoList = async () => {
    try {
        
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
        //identity: identity
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;      
      console.error(`-------${await actor.get_video_list()}`);

      const rawVideoList: [string, string, string, string][] = await actor.get_video_list();

      let currentTotalSize = 0;
      const formattedList: VideoInfo[] = rawVideoList.map(videoTuple => {
        //const totalSizeBytes = Number(videoTuple[4]); // bigint を number に変換
        //currentTotalSize += totalSizeBytes;
        return {
          id: videoTuple[0],
          title: videoTuple[1],
          description: videoTuple[2],
          hash: videoTuple[3],
          //totalSizeBytes: totalSizeBytes,
        };
      });

      setVideoList(formattedList);
      setTotalVideoCount(formattedList.length);
      setTotalStorageUsed(currentTotalSize);
    } catch (error) {
      console.error("Error fetching video list:", error);
    }
  };

//   const formatBytes = (bytes: number, decimals = 2) => {
//     if (bytes === 0) return '0 Bytes';
//     const k = 1024;
//     const dm = decimals < 0 ? 0 : decimals;
//     const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
//     const i = Math.floor(Math.log(bytes) / Math.log(k));
//     return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
//   };

  return (
    <Box>
      <Header 
        identity={identity}
        onAuthChange={handleAuthChange}
      />
      <Box sx={{ mt: 8, p: 3 }}>
        <h1>Canister Video List</h1>
        <p>Total Videos: {totalVideoCount}</p>
        {/* <p>Total Storage Used: {formatBytes(totalStorageUsed)}</p> */}

        <h2>Videos</h2>
        {videoList.length === 0 ? (
            <p>No videos uploaded yet.</p>
        ) : (
            <table>
            <thead>
                <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Description</th>
                <th>Hash</th>
                {/* <th>Size</th> */}
                </tr>
            </thead>
            <tbody>
                {videoList.map((video) => (
                <tr key={video.id}>
                    <td>{video.id}</td>
                    <td>{video.title}</td>
                    <td>{video.description}</td>
                    <td>{video.hash}</td>
                    {/* <td>{formatBytes(video.totalSizeBytes)}</td> */}
                </tr>
                ))}
            </tbody>
            </table>
        )}
      </Box>
    </Box>
  );
}

export default CanisterList;