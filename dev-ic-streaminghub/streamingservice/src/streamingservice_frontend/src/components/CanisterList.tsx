import React, { useEffect, useState } from 'react';
//import { streamingservice_backend } from 'declarations/streamingservice_backend'; // 適宜パスを調整
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { _SERVICE as _BACKEND_SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { _SERVICE as _MNG_SERVICE } from '../../../declarations/streamingservice_manager/streamingservice_manager.did';
import { createActor as createManagerActorInit } from '../../../declarations/streamingservice_manager';
import { createActor as createBackendActorInit } from '../../../declarations/streamingservice_backend';
import { Header } from './Header';
import { Box, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Typography } from '@mui/material';

interface VideoInfo {
  id: string;
  title: string;
  description: string;
  hash: string;
  //totalSizeBytes: number; // lib.rs で追加したフィールド
}

interface CanisterInfo {
  id: string;
  principal_id: string;
  status: string;
}

function CanisterList() {
  const [videoList, setVideoList] = useState<VideoInfo[]>([]);
  const [totalVideoCount, setTotalVideoCount] = useState<number>(0);
  const [totalStorageUsed, setTotalStorageUsed] = useState<number>(0); // バイト単位
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [canisterList, setCanisterList] = useState<CanisterInfo[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    initAuth();
    fetchVideoList();
    fetchCanisterList();
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

  const createManagerActor = () => {
    const agent = new HttpAgent({
      host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
      //identity: identity
    });
    return createManagerActorInit(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_MANAGER, {
      agent,
    });
  };

  const fetchCanisterList = async () => {
    try {
      console.warn(`-------------------------fetching canister list`);
      setIsLoading(true);
      const actor = createManagerActor();
      // ここでCanisterStatusを呼び出して各Canisterの状態を取得
      // 実際の実装では、管理対象のCanister IDのリストが必要です
      const canisterIdList: [string, string][] = await actor.get_canister_id_list();
      // let canisterInfoList = await Promise.all(canisterIdList.map(async (canisterId: [string, string]) => {
      //   return {
      //     id: canisterId[0],
      //     principal_id: canisterId[1],
      //     status: "unknown", // 状態は文字列で返されると仮定
      //   };
      // }));
      console.warn(`-------------------------${canisterIdList}`);
      setCanisterList(canisterIdList.map((canisterId: [string, string]) => ({
        id: canisterId[0],
        principal_id: canisterId[1],
        status: "unknown", // 状態は文字列で返されると仮定
      })));
      // if ('Ok' in result) {
      //   setCanisterList(result.map((canister: any) => ({
      //     id: canister.id.toText(),
      //     principal_id: canister.principal_id.toText(),
      //     status: 'unknown',
      //   })));
      // }
      // //  else {
      // //   console.error("Error fetching canister list:", result.Err);
      // // }
    } catch (error) {
      console.error("Error fetching canister list:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCanister = async () => {
    try {
      setIsLoading(true);
      const actor = createManagerActor();
      const result = await actor.create_and_install_canister();
      if ('Ok' in result) {
        console.warn(`-------------------------${result.Ok}`);
        await fetchCanisterList();
      } else {
        console.error("Error creating canister:", result.Err);
      }
    } catch (error) {
      console.error("Error creating canister:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBeginCanister = async (canisterId: string) => {
    try {
      setIsLoading(true);
      const actor = createManagerActor();
      const result = await actor.begin_canister(canisterId);
      if ('Ok' in result) {
        await fetchCanisterList();
      } else {
        console.error("Error starting canister:", result.Err);
      }
    } catch (error) {
      console.error("Error starting canister:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndCanister = async (canisterId: string) => {
    try {
      setIsLoading(true);
      const actor = createManagerActor();
      const result = await actor.end_canister(canisterId);
      if ('Ok' in result) {
        await fetchCanisterList();
      } else {
        console.error("Error stopping canister:", result.Err);
      }
    } catch (error) {
      console.error("Error stopping canister:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCanister = async (canisterId: string) => {
    try {
      setIsLoading(true);
      const actor = createManagerActor();
      const result = await actor.remove_canister(canisterId);
      if ('Ok' in result) {
        await fetchCanisterList();
      } else {
        console.error("Error deleting canister:", result.Err);
      }
    } catch (error) {
      console.error("Error deleting canister:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCanisterCondition = async (canisterId: string) => {
    try {
      setIsLoading(true);
      const actor = createManagerActor();
      const result = await actor.canister_condition(canisterId);
      if ('Ok' in result) {
        console.warn(`-------------------------canister_condition ${JSON.stringify(result.Ok)}`);
        await fetchCanisterList();
      } else {
        console.error("Error deleting canister:", result.Err);
      }
    } catch (error) {
      console.error("Error deleting canister:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCanisterCallMethod = async (canisterId: string) => {
    try {
      setIsLoading(true);
      const actor = createManagerActor();
      const method_name = "get_video_info";
      const args = "hi";
      const result = await actor.call_canister_method(canisterId, method_name, args);
      console.warn(`-------------------------canisterId: ${canisterId}, method_name: ${method_name}, args: ${args}`);
      if ('Ok' in result) {
        console.warn(`-------------------------method_name: ${method_name}, ${JSON.stringify(result.Ok)}`);
        await fetchCanisterList();
      } else {
        console.error("Error call greet:", result.Err);
      }
    } catch (error) {
      console.error("Error call greet:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVideoList = async () => {
    try {
        
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
        //identity: identity
      });

      const actor = createBackendActorInit(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _BACKEND_SERVICE;      
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
        <Typography variant="h4" gutterBottom>Canister Management</Typography>
        <Typography>Total Canisters: {canisterList.length}</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={handleCreateCanister}
          disabled={isLoading}
          sx={{ mb: 3 }}
        >
          Create New Canister
        </Button>
        
        {canisterList.length > 0 ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Canister ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Principal ID</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {canisterList.map((canister: CanisterInfo) => (
                  <TableRow key={canister.id}>
                    <TableCell>{canister.id}</TableCell>
                    <TableCell>{canister.status}</TableCell>
                    <TableCell>{canister.principal_id}</TableCell>
                    <TableCell>
                      <Button 
                        size="small" 
                        onClick={() => handleBeginCanister(canister.principal_id)}
                        disabled={isLoading}
                      >
                        Start
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => handleEndCanister(canister.principal_id)}
                        disabled={isLoading}
                      >
                        Stop
                      </Button>
                      <Button 
                        size="small" 
                        color="error"
                        onClick={() => handleRemoveCanister(canister.principal_id)}
                        disabled={isLoading}
                      >
                        Delete
                      </Button>
                      <Button 
                        size="small" 
                        color="error"
                        onClick={() => handleCanisterCondition(canister.principal_id)}
                        disabled={isLoading}
                      >
                        Canister Condition
                      </Button>
                      <Button 
                        size="small" 
                        color="info"
                        onClick={() => handleCanisterCallMethod(canister.principal_id)}
                        disabled={isLoading}
                      >
                        Call Method
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          ) : (
            <Typography>No canisters available.</Typography>
          )
        }

        <Typography variant="h4" sx={{ mt: 4 }} gutterBottom>Video List</Typography>
        <Typography>Total Videos: {totalVideoCount}</Typography>

        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Hash</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {videoList.map((video) => (
                <TableRow key={video.id}>
                  <TableCell>{video.id}</TableCell>
                  <TableCell>{video.title}</TableCell>
                  <TableCell>{video.description}</TableCell>
                  <TableCell>{video.hash}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}

export default CanisterList;