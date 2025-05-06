import React, { useEffect, useState, useRef } from 'react';
import { Box, Paper, Typography, Stack, Modal } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { Actor, HttpAgent } from '@dfinity/agent';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../../declarations/streamingservice_backend';
import Hls from 'hls.js';
import { Header } from './Header';
import { UploadModal } from './UploadModal';
import { FFmpegService, FFmpegProgress } from '../services/FFmpegService';

interface Image {
  id: string;
  title: string;
  thumbnailUrl?: string;
}

interface VideoGalleryProps {
  images?: Image[];
}

export const VideoGallery: React.FC<VideoGalleryProps> = () => {
  const [searchParams] = useSearchParams();
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoPlayer, setVideoPlayer] = useState<HTMLVideoElement | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const canisterId = searchParams.get('canisterId');
  const ffmpegService = useRef(new FFmpegService());
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);

  useEffect(() => {
    initFFmpeg();
  }, []);

  const initFFmpeg = async () => {
    try {
      await ffmpegService.current.load();
      setFfmpegLoaded(true);
    } catch (error) {
      console.error('FFmpeg initialization error:', error);
    }
  };

  const handleUploadClick = () => {
    if (!ffmpegLoaded) {
      alert('FFmpegの初期化中です。しばらくお待ちください。');
      return;
    }
    setUploadModalOpen(true);
  };

    // const handleFileUploadWithFfmpeg = async (event: React.ChangeEvent<HTMLInputElement>) => {
    //   const file = event.target.files?.[0];
    //   if (!file) return;
    //   setLoading(true);
    //   setUploadProgress({ message: 'Starting upload...', progress: 0 });
  
    //   try {
    //     console.log('create_video:');
    //     const video_id = await actor.create_video(file.name, '');
  
    //     // FFmpeg処理の進捗表示を設定
    //     ffmpegService.current.onProgress = (progress: FFmpegProgress) => {
    //       if (progress.progress) {
    //         setUploadProgress({
    //           message: progress.message,
    //           progress: progress.progress.percent
    //         });
    //       } else {
    //         setUploadProgress({
    //           message: progress.message,
    //           progress: uploadProgress?.progress || 0
    //         });
    //       }
    //     };
  
    //     const { playlist, segments, thumbnail } = await ffmpegService.current.processVideo(file);
    //     console.log('processVideo:');
    //     console.log('thumbnail:', thumbnail);
    //     // サムネイルのアップロード
    //     if (thumbnail) {
    //       setUploadProgress({ message: 'Uploading thumbnail...', progress: 0 });
    //       const thumbnailResult = await actor.upload_thumbnail(video_id, Array.from(thumbnail));
    //       console.log('thumbnailResult:', thumbnailResult);
    //       if ('err' in thumbnailResult) {
    //         throw new Error(`Failed to upload thumbnail: ${thumbnailResult.err}`);
    //       }
    //     }
  
    //     // プレイリストのアップロード
    //     const playlistText = new TextDecoder().decode(playlist);
    //     console.log('playlist:', playlistText);
    //     setUploadProgress({ message: 'Uploading playlist...', progress: 0 });
    //     const playlistResult = await actor.upload_playlist(video_id, playlistText);
        
    //     if ('err' in playlistResult) {
    //       throw new Error(`Failed to upload playlist: ${playlistResult.err}`);
    //     }
  
    //     // セグメントのアップロード
    //     const totalSegments = segments.length;
    //     const CHUNK_SIZE = 1024 * 1024; // 1MB
    //     let uploadedSegments = 0;
    //     let totalChunks = 0;
    //     let uploadedChunks = 0;
  
    //     // 総チャンク数を計算
    //     for (const segment of segments) {
    //       totalChunks += Math.ceil(segment.data.length / CHUNK_SIZE);
    //     }
  
    //     for (const segment of segments) {
    //       const uint8Array = new Uint8Array(segment.data);
    //       const segmentChunks = Math.ceil(uint8Array.length / CHUNK_SIZE);
    //       let uploadedSegmentChunks = 0;
  
    //       for (let offset = 0; offset < uint8Array.length; offset += CHUNK_SIZE) {
    //         const chunk = uint8Array.slice(offset, offset + CHUNK_SIZE);
    //         console.log('upload_ts_segment:', segment.index);
    //         const result = await actor.upload_ts_segment(
    //           video_id,
    //           segment.index,
    //           Array.from(chunk)
    //         );
            
    //         if ('err' in result) {
    //           throw new Error(`Failed to upload segment ${segment.index}: ${result.err}`);
    //         }
  
    //         uploadedSegmentChunks++;
    //         uploadedChunks++;
            
    //         const totalProgress = (uploadedChunks / totalChunks) * 100;
    //         setUploadProgress({
    //           message: `Uploading segment ${uploadedSegments + 1}/${totalSegments} (${uploadedSegmentChunks}/${segmentChunks} chunks)`,
    //           progress: totalProgress
    //         });
    //       }
  
    //       uploadedSegments++;
    //     }
  
    //     await loadVideos();
    //     setUploadProgress({ message: 'Upload completed!', progress: 100 });
    //     alert('アップロード成功');
    //   } catch (e) {
    //     console.error('Error during upload:', e);
    //     alert('アップロード中にエラーが発生しました: ' + (e as Error).message);
    //   } finally {
    //     setLoading(false);
    //     setTimeout(() => setUploadProgress(null), 2000); // 2秒後にプログレスバーを非表示
    //   }
      
    //   const resulttimer = timer.stop();
    //   console.log('Timer results:', timer.formatResults(resulttimer));
    // };
  const handleUpload = async (file: File, title: string) => {
    try {
      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT
      });

      const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
        agent,
      }) as Actor & _SERVICE;

      // 動画IDを作成
      const video_id = await actor.create_video(title, '');

      // FFmpegの進捗ハンドラーを設定
      ffmpegService.current.onProgress = (progress: FFmpegProgress) => {
        if (progress.progress) {
          setUploadProgress(progress.progress.percent);
        }
      };

      // FFmpegで動画を処理
      const { playlist, segments, thumbnail } = await ffmpegService.current.processVideo(file);

      // プレイリストをアップロード
      const playlistText = new TextDecoder().decode(playlist);
      await actor.upload_playlist(video_id, playlistText);

      // セグメントを順次アップロード
      for (const segment of segments) {
        await actor.upload_ts_segment(video_id, segment.index, Array.from(segment.data));
      }

      // サムネイルがある場合はアップロード
      if (thumbnail) {
        await actor.upload_thumbnail(video_id, Array.from(thumbnail));
      }

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

  const playHlsStream = async (videoId: string) => {
    console.log("videoId", videoId);
    if (!videoPlayer) return;
    
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();

    const agent = new HttpAgent({
      host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT
    });

    const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND || '', {
      agent,
    }) as Actor & _SERVICE;

    const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
    if (playlistResult && 'ok' in playlistResult) {
      const m3u8Text = String(playlistResult.ok);
      const cleanedM3u8 = m3u8Text
        .split('\n')
        .filter(line => !line.startsWith('#EXT-X-KEY') && !line.includes('IV='))
        .map(line => line.replace(/,IV=0x[0-9a-fA-F]+/, ''))
        .join('\n');
      
      const rewrittenM3u8 = cleanedM3u8.replace(/[^\n]*?(\d+)\.ts/g, (_, p1) => `icsegment://${videoId}/${p1}`);
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
                        }, context, {});
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
          loader: CustomLoader
        });

        hls.loadSource(m3u8Url);
        hls.attachMedia(videoPlayer);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          videoPlayer.play().catch(e => {
            if (e.name !== 'AbortError') {
              console.warn('Play error:', e);
            }
          });
        });
      } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
        videoPlayer.src = m3u8Url;
        videoPlayer.play().catch(e => {
          if (e.name !== 'AbortError') {
            console.warn('Play error:', e);
          }
        });
      } else {
        console.error('HLS is not supported in this browser.');
      }
    }
  };

  useEffect(() => {
    const loadImages = async () => {
      if (!canisterId) return;

      setLoading(true);
      try {
        const agent = new HttpAgent({
          host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT
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

    loadImages();
  }, [canisterId]);

  useEffect(() => {
    if (selectedVideo) {
      playHlsStream(selectedVideo);
    }
  }, [selectedVideo, videoPlayer]);

  return (
    <Box>
      <Header onUploadClick={handleUploadClick} />
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
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        mb: 1,
                        textAlign: 'center'
                      }}
                    >
                      {image.title}
                    </Typography>
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
              ref={(el) => setVideoPlayer(el)}
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
          onClose={() => {
            setUploadModalOpen(false);
            setUploadProgress(0);
          }}
          onUpload={handleUpload}
          progress={uploadProgress}
        />
      </Box>
    </Box>
  );
};