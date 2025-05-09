import React, { useEffect, useState, useRef } from 'react';
import { Box, Paper, Typography, Stack, Modal, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../../declarations/streamingservice_backend';
import Hls from 'hls.js';
import { Header } from './Header';
import { UploadModal } from './UploadModal';
import { FFmpegService, FFmpegProgress } from '../services/FFmpegService';
import { CustomLoader } from '../services/CustomLoader';
import DeleteIcon from '@mui/icons-material/Delete';

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
      const video_id = await actor.create_video(title, '');

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
      await actor.upload_playlist(video_id, playlistText);

      // セグメントを順次アップロード（チャンクサイズとバッチサイズを最適化）
      const CHUNK_SIZE = 512 * 1024; // 512KBに縮小
      const BATCH_SIZE = 2; // 同時アップロード数を制限
      const RETRY_COUNT = 3; // リトライ回数
      const RETRY_DELAY = 1000; // リトライ間隔（ミリ秒）

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

        for (let i = 0; i < chunks.length; i++) {
          let retries = 0;
          let success = false;

          while (retries < RETRY_COUNT && !success) {
            try {
              console.log(`Uploading segment ${segment.index}, chunk ${i + 1}/${chunks.length}`);
              const result = await actor.upload_ts_segment(
                video_id,
                segment.index,
                Array.from(chunks[i])
              );

              if ('ok' in result) {
                success = true;
                console.log(`Successfully uploaded segment ${segment.index}, chunk ${i + 1}`);
              } else {
                throw new Error(`Upload failed: ${result.err || 'Unknown error'}`);
              }
            } catch (error) {
              retries++;
              console.error(`Upload attempt ${retries} failed for segment ${segment.index}, chunk ${i + 1}:`, error);
              
              if (retries === RETRY_COUNT) {
                throw new Error(`Failed to upload segment ${segment.index} chunk ${i + 1} after ${RETRY_COUNT} retries: ${error}`);
              }
              
              // 指数バックオフで待機
              const delay = RETRY_DELAY * Math.pow(2, retries - 1);
              console.log(`Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          if (!success) {
            throw new Error(`Failed to upload segment ${segment.index} chunk ${i + 1} after all retries`);
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

      console.log('All segments uploaded successfully');

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
              const result = await actor.upload_thumbnail(video_id, Array.from(thumbnailChunks[i]));
              
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
    console.log("Attempting to play videoId:", videoId);
    if (!videoPlayer) {
      console.error('Video player not initialized yet');
      return;
    }
    
    try {
      videoPlayer.pause();
      videoPlayer.removeAttribute('src');
      videoPlayer.load();

      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT,
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND || '', {
        agent,
      }) as Actor & _SERVICE;

      console.log("Fetching playlist for video:", videoId);
      const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
      
      if (!playlistResult || !('ok' in playlistResult)) {
        console.error('Failed to fetch playlist:', playlistResult);
        return;
      }

      const m3u8Text = String(playlistResult.ok);
      console.log("Received m3u8 content:", m3u8Text.substring(0, 100) + "...");
      
      const cleanedM3u8 = m3u8Text
        .split('\n')
        .filter(line => !line.startsWith('#EXT-X-KEY') && !line.includes('IV='))
        .map(line => line.replace(/,IV=0x[0-9a-fA-F]+/, ''))
        .join('\n');
      
      // セグメントのパスを修正
      const rewrittenM3u8 = cleanedM3u8.replace(/[^\n]*?(\d+)\.ts/g, (match, p1) => {
        const segmentIndex = parseInt(p1);
        return `icsegment://${videoId}/${segmentIndex}`;
      });

      console.log("Rewritten m3u8:", rewrittenM3u8);
      const blob = new Blob([rewrittenM3u8], { type: 'application/vnd.apple.mpegurl' });
      const m3u8Url = URL.createObjectURL(blob);
      
      if (Hls.isSupported()) {
        console.log("HLS.js is supported, initializing...");
        const hls = new Hls({
          debug: true,
          enableWorker: false,
          enableSoftwareAES: false,
          emeEnabled: false,
          loader: CustomLoader,
          manifestLoadingTimeOut: 20000,
          manifestLoadingMaxRetry: 3,
          levelLoadingTimeOut: 20000,
          levelLoadingMaxRetry: 3,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 3,
          startLevel: -1,
          abrEwmaDefaultEstimate: 500000,
          maxBufferLength: 30,
          maxMaxBufferLength: 600,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 0.5,
          lowLatencyMode: false,
          backBufferLength: 90,
          // カスタムローダーの設定
          xhrSetup: (xhr, url) => {
            if (url.startsWith('icsegment://')) {
              const [_, videoId, segmentIndex] = url.split('/');
              console.log(`Loading segment ${segmentIndex} for video ${videoId}`);
              
              // セグメントの読み込みを試行
              const loadSegment = async () => {
                try {
                  const segmentResult = await actor.get_hls_segment(videoId, parseInt(segmentIndex));
                  if ('ok' in segmentResult) {
                    const segmentData = new Uint8Array(segmentResult.ok);
                    const blob = new Blob([segmentData], { type: 'video/MP2T' });
                    const segmentUrl = URL.createObjectURL(blob);
                    
                    // セグメントURLを返す
                    return segmentUrl;
                  } else {
                    throw new Error(`Failed to load segment: ${segmentResult.err}`);
                  }
                } catch (error) {
                  console.error(`Error loading segment ${segmentIndex}:`, error);
                  throw error;
                }
              };

              // セグメントの読み込みを開始
              loadSegment().then(segmentUrl => {
                // セグメントURLを設定
                Object.defineProperty(xhr, 'responseURL', { value: segmentUrl });
                Object.defineProperty(xhr, 'response', { value: segmentUrl });
                Object.defineProperty(xhr, 'status', { value: 200 });
                Object.defineProperty(xhr, 'readyState', { value: 4 });
                xhr.dispatchEvent(new Event('load'));
              }).catch(error => {
                Object.defineProperty(xhr, 'status', { value: 404 });
                Object.defineProperty(xhr, 'readyState', { value: 4 });
                xhr.dispatchEvent(new Event('error'));
              });

              return;
            }
          }
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', event, data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('Fatal network error encountered, trying to recover...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('Fatal media error encountered, trying to recover...');
                hls.recoverMediaError();
                break;
              default:
                console.log('Fatal error, cannot recover');
                hls.destroy();
                break;
            }
          }
        });

        hls.on(Hls.Events.MANIFEST_LOADING, () => {
          console.log('Manifest loading...');
        });

        hls.on(Hls.Events.MANIFEST_LOADED, () => {
          console.log('Manifest loaded successfully');
        });

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest parsed, attempting to play...');
          videoPlayer.play().catch(e => {
            console.error('Play error:', e);
            if (e.name === 'NotAllowedError') {
              console.log('Playback requires user interaction');
            }
          });
        });

        hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
          console.log('Loading fragment:', data.frag.sn);
        });

        hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
          console.log('Fragment loaded:', data.frag.sn);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR) {
            console.error('Fragment load error:', data);
          }
        });

        hls.loadSource(m3u8Url);
        hls.attachMedia(videoPlayer);

        // Cleanup function
        return () => {
          hls.destroy();
          URL.revokeObjectURL(m3u8Url);
        };
      } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        console.log("Native HLS playback supported");
        videoPlayer.src = m3u8Url;
        await videoPlayer.play().catch(e => {
          console.error('Native playback error:', e);
        });
      } else {
        console.error('HLS playback is not supported in this browser');
      }
    } catch (error) {
      console.error('Error in playHlsStream:', error);
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