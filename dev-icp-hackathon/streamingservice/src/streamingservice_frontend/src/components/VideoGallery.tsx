import React, { useEffect, useState, useRef, MutableRefObject } from 'react';
import { Box, Paper, Typography, Stack, Modal, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../../declarations/streamingservice_backend';
import Hls, { LoaderContext, LoaderConfiguration, LoaderCallbacks, LoaderStats, LoaderResponse } from 'hls.js';
import { Header } from './Header';
import { UploadModal } from './UploadModal';
import { FFmpegService, FFmpegProgress } from '../services/FFmpegService';
import { createCustomLoader } from '../services/CustomLoader';
import { ErrorTypes, ErrorDetails } from 'hls.js';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

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

  const playHlsStream = async (videoId: string) => {
    console.log("------------------------------------------Attempting to play videoId:", videoId);
    
    if (!videoPlayer) {
      console.error("Video player element is not available");
      return;
    }

    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      // プレイリストを取得
      console.log("Fetching HLS playlist...");
      const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
      if (!('ok' in playlistResult)) {
        console.error("Failed to get playlist:", playlistResult.err);
        throw new Error('Failed to get playlist');
      }
      
      let m3u8Content = playlistResult.ok;
      console.log("Retrieved m3u8 content:", m3u8Content);

      // プレイリストからセグメント情報を解析
      const segmentLines = m3u8Content.split('\n').filter(line => line.endsWith('.ts'));
      console.log("Segment lines:", segmentLines);
      const totalSegments = segmentLines.length;
      
      if (totalSegments === 0) {
        console.error("No segments found in playlist");
        throw new Error('No segments found in playlist');
      }

      // セグメントファイル名からインデックスを抽出する関数
      const getSegmentIndex = (segmentName: string): number => {
        // segment_20250510135854_1746885534.ts のような形式からインデックスを抽出
        // 2つ目の_以降の数字がインデックス
        const match = segmentName.match(/segment_[^_]+_(\d+)\.ts/);
        if (match) {
          return parseInt(match[1], 10);
        }
        console.error(`Could not parse index from segment name: ${segmentName}`);
        return -1;
      };

      // プレイリストの内容を検証
      console.log("Validating m3u8 content...");
      
      // 必須のヘッダーが含まれているか確認
      if (!m3u8Content.includes('#EXTM3U')) {
        console.warn("Adding missing #EXTM3U header");
        m3u8Content = '#EXTM3U\n' + m3u8Content;
      }
      
      // セグメント継続時間が指定されているか確認
      if (!m3u8Content.includes('#EXTINF:')) {
        console.warn("Adding missing segment duration information");
        // 各セグメント行の前に継続時間情報を追加
        const lines = m3u8Content.split('\n');
        const newLines = [];
        
        for (const line of lines) {
          if (line.endsWith('.ts') && !lines[lines.indexOf(line) - 1].includes('#EXTINF:')) {
            // デフォルトの継続時間を4秒に設定
            newLines.push('#EXTINF:4.0,');
          }
          newLines.push(line);
        }
        
        m3u8Content = newLines.join('\n');
      }
      
      // EXT-X-VERSION が含まれているか確認
      if (!m3u8Content.includes('#EXT-X-VERSION:')) {
        console.warn("Adding missing version information");
        const lines = m3u8Content.split('\n');
        // #EXTM3U の後にバージョン情報を追加
        const extM3uIndex = lines.indexOf('#EXTM3U');
        if (extM3uIndex !== -1) {
          lines.splice(extM3uIndex + 1, 0, '#EXT-X-VERSION:3');
        } else {
          lines.unshift('#EXT-X-VERSION:3');
        }
        m3u8Content = lines.join('\n');
      }
      
      // EXT-X-TARGETDURATION が含まれているか確認
      if (!m3u8Content.includes('#EXT-X-TARGETDURATION:')) {
        console.warn("Adding missing target duration");
        const lines = m3u8Content.split('\n');
        // バージョン情報の後にターゲット継続時間を追加
        const versionIndex = lines.findIndex(line => line.includes('#EXT-X-VERSION:'));
        if (versionIndex !== -1) {
          lines.splice(versionIndex + 1, 0, '#EXT-X-TARGETDURATION:4');
        } else {
          // バージョン情報がない場合は先頭に追加
          lines.unshift('#EXT-X-TARGETDURATION:4');
        }
        m3u8Content = lines.join('\n');
      }
      
      // EXT-X-MEDIA-SEQUENCE が含まれているか確認
      if (!m3u8Content.includes('#EXT-X-MEDIA-SEQUENCE:')) {
        console.warn("Adding missing media sequence");
        const lines = m3u8Content.split('\n');
        // ターゲット継続時間の後にメディアシーケンスを追加
        const targetDurationIndex = lines.findIndex(line => line.includes('#EXT-X-TARGETDURATION:'));
        if (targetDurationIndex !== -1) {
          lines.splice(targetDurationIndex + 1, 0, '#EXT-X-MEDIA-SEQUENCE:0');
        } else {
          // ターゲット継続時間がない場合は先頭に追加
          lines.unshift('#EXT-X-MEDIA-SEQUENCE:0');
        }
        m3u8Content = lines.join('\n');
      }
      
      console.log("Final m3u8 content:", m3u8Content);
      
      // HLS.jsがサポートされているか確認
      if (Hls.isSupported()) {
        console.log("HLS.js is supported, initializing player");
        
        // 既存のHlsインスタンスがあれば破棄
        if (hlsInstance.current) {
          hlsInstance.current.destroy();
          hlsInstance.current = null;
        }
        
        console.log("Creating custom loader...");
        const customLoader = createCustomLoader(actor, videoId, m3u8Content, segmentLines);
        
        console.log("Initializing HLS.js with custom configuration...");
        // 新しいHlsインスタンスを作成（改善された設定）
        const hls = new Hls({
          debug: true, // デバッグを有効化して詳細なログを確認
          enableWorker: true,
          lowLatencyMode: false, // 低遅延モードを無効化して安定性を向上
          backBufferLength: 90,
          maxBufferLength: 30, // バッファ長を調整
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000, // バッファサイズを増加 (60MB)
          fragLoadingMaxRetry: 8, // フラグメントロードの再試行回数を増加
          manifestLoadingMaxRetry: 8, // マニフェストロードの再試行回数を増加
          levelLoadingMaxRetry: 8,
          fragLoadingRetryDelay: 1000, // 再試行間隔を調整
          fragLoadingMaxRetryTimeout: 10000, // 最大タイムアウト時間を設定
          // カスタムローダーを使用
          loader: customLoader
        });
        
        // hlsInstanceに保存
        hlsInstance.current = hls;
        
        // メディアをアタッチ
        hls.attachMedia(videoPlayer);
        
        // マニフェストがロードされたらメディアを再生
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log("HLS manifest parsed, starting playback");
          videoPlayer.play().catch(e => {
            console.warn("Autoplay prevented:", e);
          });
        });
        
        // 改善されたエラーハンドリング
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS error:", data);
          
          // フラグメント解析エラーの特別処理
          if (data.details === 'fragParsingError') {
            console.warn("Fragment parsing error detected, attempting to recover");
            
            // 現在のフラグメントをスキップして次へ進む
            if (data.frag) {
              console.log(`Skipping problematic fragment: ${data.frag.sn}, level: ${data.frag.level}`);
              
              // 現在の再生位置を少し進める
              videoPlayer.currentTime += 0.5;
              
              // 次のフラグメントから再開を試みる
              hls.startLoad();
            }
            
            // 致命的なエラーの場合はメディアエラーリカバリーを試みる
            if (data.fatal) {
              console.error("Fatal fragment parsing error, attempting media recovery");
              hls.recoverMediaError();
            }
            return;
          }
          
          // バッファエラーの処理
          if (data.details === 'bufferAddCodecError' || data.details === 'bufferAppendError') {
            console.warn(`Buffer error detected: ${data.details}, attempting to recover`);
            
            // バッファをクリアして再開
            hls.recoverMediaError();
            return;
          }
          
          // その他の致命的なエラー処理
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log("Fatal network error encountered, trying to recover");
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log("Fatal media error encountered, trying to recover");
                hls.recoverMediaError();
                break;
              default:
                console.log("Fatal error, cannot recover");
                hls.destroy();
                break;
            }
          }
        });
        
        hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
          console.log("Fragment loading:", data.frag.sn);
        });
        
        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          console.log("Fragment loaded successfully:", data.frag.sn);
        });
        
        const cleanedM3u8 = m3u8Content
          .split('\n')
          .filter(line => !line.startsWith('#EXT-X-KEY') && !line.includes('IV='))
          .map(line => line.replace(/,IV=0x[0-9a-fA-F]+/, ''))
          .join('\n');
        console.log("Cleaned m3u8 content:", cleanedM3u8);
        
        const rewrittenM3u8 = cleanedM3u8.replace(/[^\n]*?(\d+)\.ts/g, (_, p1) => `icsegment://${videoId}/${p1}`);
        console.log("Rewritten m3u8 content:", rewrittenM3u8);
        
        const playlistBlob = new Blob([rewrittenM3u8], { type: 'application/vnd.apple.mpegurl' });
        const playlistUrl = URL.createObjectURL(playlistBlob);
        
        // プレイリストをロード
        hls.loadSource(playlistUrl);
        console.log("HLS source loaded with Blob URL:", playlistUrl);
        
        // クリーンアップ関数を設定
        videoPlayer.addEventListener('ended', () => {
          // 再生終了時にBlobURLを解放
          URL.revokeObjectURL(playlistUrl);
        });
        
      } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        // HLS.jsがサポートされていない場合、ネイティブHLSサポートを試みる（Safari等）
        console.log("Using native HLS support");
        
        // ネイティブ再生用にプレイリストをBlobとして作成
        const playlistBlob = new Blob([m3u8Content], { type: 'application/vnd.apple.mpegurl' });
        const playlistUrl = URL.createObjectURL(playlistBlob);
        
        // ビデオプレーヤーにセット
        videoPlayer.src = playlistUrl;
        videoPlayer.addEventListener('loadedmetadata', () => {
          videoPlayer.play().catch(e => {
            console.warn("Autoplay prevented:", e);
          });
        });
        
        // クリーンアップ関数を設定
        videoPlayer.addEventListener('ended', () => {
          // 再生終了時にBlobURLを解放
          URL.revokeObjectURL(playlistUrl);
        });
      } else {
        console.error("HLS playback is not supported in this browser");
        alert("このブラウザではHLS再生がサポートされていません。");
      }
    } catch (error) {
      console.error("Error playing HLS stream:", error);
      alert("動画の再生中にエラーが発生しました。詳細はコンソールを確認してください。");
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