import React, { useEffect, useState, useRef } from 'react';
import { Box, Paper, Typography, Stack, Modal, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../../declarations/streamingservice_backend';
import Hls, { ErrorData } from 'hls.js';
import { Header } from './Header';
import { UploadModal } from './UploadModal';
import { FFmpegService, FFmpegProgress } from '../services/FFmpegService';
import { createCustomLoader } from '../services/CustomLoader';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { time } from 'console';

interface Image {
  id: string;
  title: string;
  thumbnailUrl?: string;
}

interface VideoGalleryProps {
  identity: Identity;
  onAuthChange: (identity: Identity | null) => void;
}

export const VideoGallery: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<HTMLVideoElement | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const canisterId = searchParams.get('canisterId');
  const ffmpegService = useRef(new FFmpegService());
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState<string | null>(null);
  const hlsInstance = useRef<Hls | null>(null);
  const backendApiVersion = import.meta.env.VITE_BACKEND_API_VERSION;

  useEffect(() => {
    initFFmpeg();
    checkAuth();
  }, []);

  const initFFmpeg = async () => {
    try {
      await ffmpegService.current.load();
      setFfmpegLoaded(true);
    } catch (error) {
      console.error('FFmpeg initialization error:', error);
    }
  };

  const checkAuth = async () => {
    const authClient = await AuthClient.create();
    const isAuthenticated = await authClient.isAuthenticated();
    
    if (isAuthenticated) {
      const identity = authClient.getIdentity();
      setIdentity(identity);
    }
  };

  const handleAuthChange = (newIdentity: Identity | null) => {
    setIdentity(newIdentity);
  };

  const handleUploadClick = () => {
    // if (!identity) {
    //   alert('アップロードするにはログインが必要です。');
    //   return;
    // }
    
    if (!ffmpegLoaded) {
      alert('FFmpegの初期化中です。しばらくお待ちください。');
      return;
    }
    setUploadModalOpen(true);
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
      const CHUNK_SIZE = 1 * 1024 * 1024; // 512KBに縮小
      const BATCH_SIZE = 10; // 同時アップロード数を制限
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

  const handleVideoClick = async (videoId: string) => {
    setSelectedVideo(videoId);
  };

  const handleCloseModal = () => {
    if (videoPlayer) {
      videoPlayer.pause();
      videoPlayer.removeAttribute('src');
      videoPlayer.load();
    }
    
    // HLSインスタンスがあれば破棄
    if (hlsInstance.current) {
      hlsInstance.current.destroy();
      hlsInstance.current = null;
    }
    
    setSelectedVideo(null);
  };

  const handleVideoDoubleClick = () => {
    if (videoPlayer) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoPlayer.requestFullscreen();
      }
    }
  };

  useEffect(() => {
    if (selectedVideo && videoPlayer) {
      playHlsStream(selectedVideo);
    }
  }, [selectedVideo, videoPlayer]);

  // function downloadBlob(url: string, filename: string) {
  
  //   // <a> タグを作成
  //   const a = document.createElement('a');
  
  //   // <a> タグの属性を設定
  //   a.href = url;
  //   a.download = filename || 'download'; // filename が指定されていなければ 'download' とする
  
  //   // <a> タグをドキュメントに追加 (非表示でも可)
  //   document.body.appendChild(a);
  
  //   // <a> タグをクリックしてダウンロードを開始
  //   a.click();
  
  //   // <a> タグをドキュメントから削除
  //   document.body.removeChild(a);
  
  //   // 生成した Blob URL を解放 (メモリリークを防ぐため)
  //   URL.revokeObjectURL(url);
  // }
  function parseIcSegmentUrl(url: string): { id: string; segmentId: string } | null {
    const regex = /^icsegment:\/\/(\d+)\/(.+)$/;
    const match = url.match(regex);
    console.warn(`match: ${match}`);
  
    if (match && match.length === 3) {
      const id = match[1];
      const segmentId = getSegmentIndex(match[2]);
      return { id, segmentId };
    } else {
      // パターンに一致しない場合
      return null;
    }
  }
  function getSegmentIndex(segmentName: string): string {
    // segment_任意の桁数数字_任意の桁数数字.ts のパターンにマッチ
    // (\d+) で、末尾の数字部分をキャプチャ（1桁以上）
    const regex = /^segment_\d+(_(\d+))?\.ts$/;
    const match = segmentName.match(regex);
  
    if (match) {
      // グループ2（_の後の数字）が存在する場合
      if (match[2] !== undefined) {
        return match[2];
      } else {
        // segment_YYYYMMDDhhmmss.ts のように、最後の_と数字がない場合
        // このケースではnullを返すか、別の処理をするかを定義してください。
        // 今回はnullを返します。
        return '';
      }
    } else {
      // パターンに一致しない場合
      return '';
    }
  }
  
  const playHlsStream = async (videoId: string) => {
    if (!Hls.isSupported()) {
      console.error('HLS is not supported in this browser.');
      return;
    }

    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      // Fetch the HLS playlist
      const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
      if (!('ok' in playlistResult)) {
        throw new Error('Failed to get playlist');
      }

      // Modify the playlist to use icsegment:// URLs
      const modifiedPlaylist = playlistResult.ok.replace(/^(.*\.ts)$/gm, `icsegment://${videoId}/$1`);

      // Create a Blob with the modified playlist content
      const playlistBlob = new Blob([modifiedPlaylist], { type: 'application/x-mpegURL' });
      const playlistUrl = URL.createObjectURL(playlistBlob);
      // downloadBlob(playlistUrl, "playlist")
      console.warn(`--------------------playlistUrl: ${playlistUrl}`);

      // Create custom loader
      const customLoader = createCustomLoader(actor, videoId);
      // videoId に保管されている segment id に対するchunk 数の配列を返すAPI
      const segmentInfoResult = await actor.get_segment_info(videoId);
      console.warn(`--------------------segmentInfoResult: ${JSON.stringify(segmentInfoResult)}`);
      if (!('ok' in segmentInfoResult)) {
        throw new Error(`Failed to get_segment_info ${videoId}.`);
      }
      const segmentInfoResultOk = segmentInfoResult.ok;

      // Initialize HLS
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
      }
      const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

      ////////////////////////////////////////
      class CustomHlsLoader extends Hls.DefaultConfig.loader {
        async load(context: any, config: any, callbacks: any) {
          console.warn(`---------------------context.url: ${context.url}`);
          //await sleep(5000);
          if (context.url.startsWith('icsegment://')) {
            const match = context.url.match(/^icsegment:\/\/(.+)\/(\d+)$/);
            if (true) {
              const parsedIcSegment = parseIcSegmentUrl(context.url);
              const vId = parsedIcSegment?.id || '';
              const segmentId = Number(parsedIcSegment?.segmentId);
              console.warn(`---------------------vId: ${vId}, segIdx: ${segmentId}`);

              const segmentDataChunks: Uint8Array[] = [];

              const chunkPromises = [];
              const segmentInfoTotalChunkCount: number = segmentInfoResultOk.find((item: { segment_id: number; }) => item.segment_id === segmentId)?.total_chunk_count ?? 0;
              for (let chunkIndex = 0; chunkIndex < segmentInfoTotalChunkCount; chunkIndex++) {
                console.log(`Segment ${segmentId}: Creating promise for chunk ${chunkIndex + 1}/${segmentInfoTotalChunkCount}`);
                chunkPromises.push(
                  actor.get_segment_chunk(vId, segmentId, chunkIndex)
                    .then(chunkResult => {
                      if ('ok' in chunkResult) {
                        return new Uint8Array(chunkResult.ok.segment_chunk_data as number[]);
                      } else {
                        let errorDetails = 'Unknown error';
                        if (chunkResult.err) {
                            errorDetails = JSON.stringify(chunkResult.err); // エラー内容を文字列化
                        }
                        console.error(`Failed to get chunk ${chunkIndex} for segment ${segmentId}. Details: ${errorDetails}`);
                        throw new Error(`Failed to get chunk ${chunkIndex} for segment ${segmentId}. Error: ${errorDetails}`);
                      }
                    })
                );
              }

              // すべてのチャンクのPromiseが解決するのを待機
              const remainingChunks = await Promise.all(chunkPromises);
              segmentDataChunks.push(...remainingChunks); // 取得したすべてのチャンクを配列に追加

              // すべてのチャンクを1つの Uint8Array に結合
              // まず、結合後の合計サイズを計算
              const combinedLength = segmentDataChunks.reduce((acc, chunk) => acc + chunk.length, 0);
              const combinedSegmentData = new Uint8Array(combinedLength);

              // 各チャンクを結合後の配列にコピー
              let offset = 0;
              for (const chunk of segmentDataChunks) {
                combinedSegmentData.set(chunk, offset);
                offset += chunk.length;
              }

              //console.warn(`-------------------combinedSegmentData: ${JSON.stringify(combinedSegmentData)}`);

              callbacks.onSuccess({
                data: combinedSegmentData,
                stats: {
                  loaded: combinedLength,
                  total: combinedLength,
                  retry: 0,
                  aborted: false,
                  loading: { first: 0, start: 0, end: 0 },
                  parsing: { start: 0, end: 0 },
                  buffering: { first: 0, start: 0, end: 0 }
                },
                url: context.url
              }, context, {});  // Pass empty object instead of null
                  
              // actor.get_segment_chunk(vId, segmentId, 0)
              //   .then((result: any) => {
              //     if (result && 'ok' in result) {
              //       console.log(`result: ${JSON.stringify(result)}`);
              //       const data = new Uint8Array(result.ok);
              //       if (data.length > 0) {
              //         // Log the first few bytes to verify MPEG-TS sync byte
              //         console.log('First bytes of segment:', Array.from(data.slice(0, 4)));
                      
              //         callbacks.onSuccess({
              //           data: data.buffer,
              //           stats: {
              //             loaded: data.length,
              //             total: data.length,
              //             retry: 0,
              //             aborted: false,
              //             loading: { first: 0, start: 0, end: 0 },
              //             parsing: { start: 0, end: 0 },
              //             buffering: { first: 0, start: 0, end: 0 }
              //           },
              //           url: context.url
              //         }, context, {});  // Pass empty object instead of null
              //       } else {
              //         throw new Error('Empty segment data');
              //       }
              //     } else {
              //       throw new Error(result.err || 'Segment fetch error');
              //     }
              //   })
              //   .catch((error) => {
              //     console.error('Failed to load segment:', error);
              //     callbacks.onError({
              //       code: 500,
              //       text: `Failed to load segment: ${error.message}`,
              //       url: context.url
              //     }, context, null);
              //   });
              return;
            }
          }
          super.load(context, config, callbacks);
        }
      }
      ////////////////////////////////////////

      hlsInstance.current = new Hls({
        debug: true,
        enableWorker: true,
        loader: CustomHlsLoader,
      });

      hlsInstance.current.loadSource(playlistUrl);
      hlsInstance.current.attachMedia(videoPlayer!);

      hlsInstance.current.on(Hls.Events.MANIFEST_PARSED, () => {
        videoPlayer?.play();
      });

      hlsInstance.current.on(Hls.Events.ERROR, (event, data: ErrorData) => {
        if (data.fatal) {
          switch (data.type) {
            case 'networkError':
              console.error(`Fatal network error encountered, trying to recover. url: ${data.url}, data: ${JSON.stringify(data.response)}`);
              hlsInstance.current?.startLoad();
              break;
            case 'mediaError':
              console.error(`Fatal media error encountered, trying to recover. url: ${data.url}`);
              hlsInstance.current?.recoverMediaError();
              break;
            default:
              console.error(`Fatal error, cannot recover. url: ${data.url}`);
              hlsInstance.current?.destroy();
              break;
          }
        }
      });

    } catch (error) {
      console.error('Error setting up HLS stream:', error);
    }
  };

  const loadImages = async () => {
    if (!canisterId) return;

    setLoading(true);
    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
        //identity: identity
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      // Get video list from backend
      const videoList = await actor.get_video_list();
      console.log('Video List:', videoList);
      const videosWithThumbnails = await Promise.all(
        videoList.map(async ([id, title]) => {
          try {
            console.log('Loading thumbnail for video:', id);
            const thumbnailResult = await actor.get_thumbnail(id);
            if ('ok' in thumbnailResult) {
              console.log('thumbnailResult.ok', thumbnailResult.ok);
              // Convert thumbnail data to URL
              const blob = new Blob([new Uint8Array(thumbnailResult.ok)], { type: 'image/jpeg' });
              const thumbnailUrl = URL.createObjectURL(blob);
              console.warn(`--------------------thumbnailUrl: ${thumbnailUrl}`);
              return { id, title, thumbnailUrl };
            }
          } catch (error) {
            console.error(`Error loading thumbnail for video ${id}:`, error);
          }
          return { id, title };
        })
      );

      setImages(videosWithThumbnails);
    } catch (error) {
      console.error('Error loading images:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadImages();
  }, [canisterId]);

  useEffect(() => {
    if (selectedVideo) {
      // videoPlayerRef.currentが設定されるまで少し待つ
      const initializeVideo = setTimeout(() => {
        if (videoPlayer) {
          playHlsStream(selectedVideo);
        } else {
          console.warn('Video player still not initialized, retrying...');
        }
      }, 100);

      return () => clearTimeout(initializeVideo);
    }
  }, [selectedVideo, videoPlayer]);

  const handleDeleteClick = (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation(); // クリックイベントの伝播を停止
    setVideoToDelete(videoId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!videoToDelete) return;

    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      await actor.delete_video(videoToDelete);
      
      // 削除後にリストを更新
      const videoList = await actor.get_video_list();
      const videosWithThumbnails = await Promise.all(
        videoList.map(async ([id, title]) => {
          try {
            const thumbnailResult = await actor.get_thumbnail(id);
            if ('ok' in thumbnailResult) {
              const blob = new Blob([new Uint8Array(thumbnailResult.ok)], { type: 'image/jpeg' });
              const thumbnailUrl = URL.createObjectURL(blob);
              console.warn(`--------------------thumbnailUrl: ${thumbnailUrl}`);
              return { id, title, thumbnailUrl };
            }
          } catch (error) {
            console.error(`Error loading thumbnail for video ${id}:`, error);
          }
          return { id, title };
        })
      );

      setImages(videosWithThumbnails);
      setDeleteDialogOpen(false);
      setVideoToDelete(null);
    } catch (error) {
      console.error('Failed to delete video:', error);
      alert('動画の削除に失敗しました。');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setVideoToDelete(null);
  };

  

  // プレイリストをダウンロード
  const handleDownloadPlaylistClick = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation(); // クリックイベントの伝播を停止
    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
      });
      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      // プレイリストを取得
      const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
      if (!('ok' in playlistResult)) {
        throw new Error('Failed to get playlist');
      }
      const m3u8Content = playlistResult.ok;
      const blob = new Blob([m3u8Content], { type: 'application/x-mpegURL' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `playlist-${videoId}.m3u8`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    
    } catch (error) {
      console.error('Error downloading Playlist:', error);
      alert('Playlist のダウンロード中にエラーが発生しました。');
    }
  };

  // プレイリストをストリーミング再生用に処理して既存のvideoPlayerで再生する
  const handleStreamPlaylistClick = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation(); // クリックイベントの伝播を停止
    try {
      // ビデオを選択して、モーダルを開く
      setSelectedVideo(videoId);
      
    } catch (error) {
      console.error('Error streaming playlist:', error);
      alert('プレイリストのストリーミング準備中にエラーが発生しました。');
    }
  };

  const handleDownloadClick = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation(); // クリックイベントの伝播を停止
    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      // プレイリストを取得
      const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
      if (!('ok' in playlistResult)) {
        throw new Error('Failed to get playlist');
      }

      // セグメントを取得
      const m3u8Content = playlistResult.ok;
      const segmentLines = m3u8Content.split('\n').filter(line => line.endsWith('.ts'));
      const segments: { index: number; data: Uint8Array, original_segment_name: String }[] = [];

      for (let i = 0; i < segmentLines.length; i++) {
        const segmentResult = await actor.get_segment_chunk(videoId, i, 0);
        console.log(`--------------------segmentResult: ${JSON.stringify(segmentResult)}`);
        if ('ok' in segmentResult) {
          console.table(`original_segment_name: ${segmentLines[i]}`);
          const responseData = segmentResult.ok; // responseData は SegmentChunkResponse オブジェクト

          console.table(`original_segment_name: ${segmentLines[i]}`);
          // responseData オブジェクトから total_chunk_count にアクセス
          console.log(`Total chunks expected for segment ${i}: ${responseData.total_chunk_count}`);
  
          // responseData オブジェクトから実際のチャンクデータ (segment_chunk_data) にアクセス
          // Vec<u8> は TypeScript では Uint8Array もしくは number[] にマッピングされます。
          // Uint8Array コンストラクタは number[] を受け付けるため、多くの場合 new Uint8Array() に渡せます。
          // Candid生成によっては `as number[]` のような型アサーションが必要になる場合があります。
          const chunkData = new Uint8Array(responseData.segment_chunk_data as number[]);
  
          // ここで取得したデータは、あくまでセグメント i の「チャンク 0」のデータです。
          // もしセグメント i の全てのチャンクを結合して完全なセグメントデータを作りたい場合は、
          // responseData.total_chunk_count を使って、chunk_index = 0 から total_chunk_count - 1 まで
          // ループして全てのチャンクを取得し、それらを結合する必要があります。
  
          segments.push({
            index: i, // これはセグメントのインデックス
            original_segment_name: segmentLines[i].toString(),
            data: chunkData, // 取得したチャンクデータ (ここではチャンク0のみ)
            // 必要であれば、セグメントの合計チャンク数もクライアント側で保持
            //total_chunk_count: responseData.total_chunk_count,
          });
        } else {
          throw new Error(`Failed to get segment ${i}`);
        }
      }

      // FFmpegでMP4に変換
      const result = await ffmpegService.current.convertHlsToMp4(m3u8Content, segments);

      // MP4としてダウンロード
      const blob = new Blob([result.data], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `video-${videoId}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error downloading video:', error);
      alert('動画のダウンロード中にエラーが発生しました。');
    }
  };
  const handleDownloadTsFilesClick = async (e: React.MouseEvent, videoId: string) => {
    e.stopPropagation(); // クリックイベントの伝播を停止
    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      // プレイリストを取得
      const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
      if (!('ok' in playlistResult)) {
        throw new Error('Failed to get playlist');
      }

      const m3u8Content = playlistResult.ok;
      const segmentLines = m3u8Content.split('\n').filter(line => line.endsWith('.ts'));

      // 各セグメントについて処理
      for (let i = 0; i < segmentLines.length; i++) {
        console.log(`Processing segment ${i + 1}/${segmentLines.length}: ${segmentLines[i]}`);
        const segmentDataChunks: Uint8Array[] = [];
        let totalChunksInSegment = 0;

        // 最初のチャンクを取得して、そのセグメントの総チャンク数を確認
        const firstChunkResult = await actor.get_segment_chunk(videoId, i, 0);

        if (!('ok' in firstChunkResult)) {
          let errorDetails = 'Unknown error';
          if (firstChunkResult.err) {
            errorDetails = JSON.stringify(firstChunkResult.err); // エラー内容を文字列化
          }
          console.error(`Failed to get first chunk for segment ${i}. Details: ${errorDetails}`);
          throw new Error(`Failed to get first chunk for segment ${i}. Error: ${errorDetails}`);
        }
        
        const firstChunkResponse = firstChunkResult.ok;
        totalChunksInSegment = firstChunkResponse.total_chunk_count;
        console.log(`Segment ${i}: Total chunks expected: ${totalChunksInSegment}`);
        segmentDataChunks.push(new Uint8Array(firstChunkResponse.segment_chunk_data as number[]));

        // 残りのチャンクを取得 (総チャンク数が1より大きい場合)
        for (let chunkIndex = 1; chunkIndex < totalChunksInSegment; chunkIndex++) {
          console.log(`Segment ${i}: Fetching chunk ${chunkIndex + 1}/${totalChunksInSegment}`);
          const chunkResult = await actor.get_segment_chunk(videoId, i, chunkIndex);
          if ('ok' in chunkResult) {
            segmentDataChunks.push(new Uint8Array(chunkResult.ok.segment_chunk_data as number[]));
          } else {
            let errorDetails = 'Unknown error';
            if (chunkResult.err) {
                errorDetails = JSON.stringify(chunkResult.err); // エラー内容を文字列化
            }
            console.error(`Failed to get chunk ${chunkIndex} for segment ${i}. Details: ${errorDetails}`);
            throw new Error(`Failed to get chunk ${chunkIndex} for segment ${i}. Error: ${errorDetails}`);
          }
        }

        // すべてのチャンクを1つの Uint8Array に結合
        // まず、結合後の合計サイズを計算
        const combinedLength = segmentDataChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedSegmentData = new Uint8Array(combinedLength);

        // 各チャンクを結合後の配列にコピー
        let offset = 0;
        for (const chunk of segmentDataChunks) {
          combinedSegmentData.set(chunk, offset);
          offset += chunk.length;
        }

        // 結合されたTSセグメントとしてダウンロード
        const blob = new Blob([combinedSegmentData], { type: 'video/mp2t' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // ダウンロードファイル名をセグメントのインデックスに基づいて命名
        a.download = `video-${videoId}-segment-${i}.ts`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log(`Segment ${i} (video-${videoId}-segment-${i}.ts) downloaded successfully.`);
      }

    } catch (error) {
      console.error('Error downloading TS files:', error);
      alert('TSファイルのダウンロード中にエラーが発生しました。');
    }
  };

  return (
    <Box>
      <Header 
        onUploadClick={handleUploadClick}
        identity={identity}
        onAuthChange={handleAuthChange}
      />
      <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh', mt: '64px' }}>
        <Typography variant="h4" sx={{ mb: 4, textAlign: 'center' }}>
          Videos Gallery
        </Typography>
        {loading ? (
          <Typography variant="h6" sx={{ textAlign: 'center' }}>Loading...</Typography>
        ) : (
          <Stack spacing={3}>
            <Stack
              direction="row"
              sx={{
                flexWrap: 'wrap',
                gap: { xs: 2, sm: 3 },
                justifyContent: 'center',
                alignItems: 'stretch'
              }}
            >
              {images.map((image) => (
                <Box 
                  key={image.id} 
                  sx={{ 
                    width: {
                      xs: '100%',
                      sm: 'calc(50% - 24px)',
                      md: 'calc(33.333% - 24px)'
                    },
                    minWidth: { xs: '280px', sm: '320px' },
                    display: 'flex',
                    cursor: 'pointer'
                  }}
                  onClick={() => handleVideoClick(image.id)}
                >
                  <Paper 
                    elevation={3} 
                    sx={{ 
                      p: 2,
                      width: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      bgcolor: '#fff',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      transition: 'transform 0.2s ease',
                      '&:hover': {
                        transform: 'scale(1.02)'
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography 
                        variant="h6" 
                        sx={{ 
                          textAlign: 'center',
                          flex: 1
                        }}
                      >
                        {image.title}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          onClick={(e) => handleDownloadPlaylistClick(e, image.id)}
                          sx={{
                            color: 'primary.main',
                            '&:hover': {
                              backgroundColor: 'primary.light',
                              color: 'white'
                            }
                          }}
                          title="プレイリストをダウンロード"
                        >
                          <QueueMusicIcon />
                        </IconButton>
                        <IconButton
                          onClick={(e) => handleStreamPlaylistClick(e, image.id)}
                          sx={{
                            color: 'success.main',
                            '&:hover': {
                              backgroundColor: 'success.light',
                              color: 'white'
                            }
                          }}
                          title="ブラウザでストリーミング再生"
                        >
                          <PlayArrowIcon />
                        </IconButton>
                        <IconButton
                          onClick={(e) => handleDownloadClick(e, image.id)}
                          sx={{
                            color: 'primary.main',
                            '&:hover': {
                              backgroundColor: 'primary.light',
                              color: 'white'
                            }
                          }}
                          title="MP4としてダウンロード"
                        >
                          <DownloadIcon />
                        </IconButton>
                        <IconButton
                          onClick={(e) => handleDownloadTsFilesClick(e, image.id)}
                          sx={{
                            color: 'primary.main',
                            '&:hover': {
                              backgroundColor: 'primary.light',
                              color: 'white'
                            }
                          }}
                          title="TSとしてダウンロード"
                        >
                          <DownloadIcon />
                        </IconButton>
                        <IconButton
                          onClick={(e) => handleDeleteClick(e, image.id)}
                          sx={{
                            color: 'error.main',
                            '&:hover': {
                              backgroundColor: 'error.light',
                              color: 'white'
                            }
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </Box>
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        paddingTop: '56.25%',
                        overflow: 'hidden',
                        borderRadius: '4px',
                        bgcolor: '#f0f0f0'
                      }}
                    >
                      {image.thumbnailUrl ? (
                        <img
                          src={image.thumbnailUrl}
                          alt={image.title}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#666'
                          }}
                        >
                          No thumbnail
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Box>
              ))}
            </Stack>
          </Stack>
        )}

        <Modal
          open={selectedVideo !== null}
          onClose={handleCloseModal}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              maxWidth: '1200px',
              bgcolor: '#000',
              borderRadius: 1,
              overflow: 'hidden',
              aspectRatio: '16/9'
            }}
          >
            <video
              ref={(el) => {
                if (el) {
                  console.log('Setting video player element');
                  setVideoPlayer(el);
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              }}
              controls
              playsInline
              onDoubleClick={handleVideoDoubleClick}
            />
          </Box>
        </Modal>

        {/* Upload Modal */}
        <UploadModal
          open={uploadModalOpen}
          onClose={() => setUploadModalOpen(false)}
          onUpload={handleUpload}
          progress={uploadProgress}
          ffmpegService={ffmpegService.current}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialogOpen}
          onClose={handleDeleteCancel}
          aria-labelledby="delete-dialog-title"
        >
          <DialogTitle id="delete-dialog-title">
            動画の削除
          </DialogTitle>
          <DialogContent>
            <Typography>
              この動画を削除してもよろしいですか？この操作は取り消せません。
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleDeleteCancel} color="primary">
              キャンセル
            </Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              削除
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
};