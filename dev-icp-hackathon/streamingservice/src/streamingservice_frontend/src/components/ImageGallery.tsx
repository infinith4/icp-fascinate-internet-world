// import React, { useEffect, useState } from 'react';
// import { Box, Paper, Typography, Stack, Modal } from '@mui/material';
// import { useSearchParams } from 'react-router-dom';
// import { Actor, HttpAgent } from '@dfinity/agent';
// import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
// import { createActor } from '../../../declarations/streamingservice_backend';
// import Hls from 'hls.js';

// interface Image {
//   id: string;
//   title: string;
//   thumbnailUrl?: string;
// }

// interface ImageGalleryProps {
//   images?: Image[];
// }

// export const ImageGallery: React.FC<ImageGalleryProps> = () => {
//   const [searchParams] = useSearchParams();
//   const [images, setImages] = useState<Image[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
//   const [videoPlayer, setVideoPlayer] = useState<HTMLVideoElement | null>(null);
//   const canisterId = searchParams.get('canisterId');

//   const handleVideoClick = async (videoId: string) => {
//     setSelectedVideo(videoId);
//   };

//   const handleCloseModal = () => {
//     if (videoPlayer) {
//       videoPlayer.pause();
//       videoPlayer.removeAttribute('src');
//       videoPlayer.load();
//     }
//     setSelectedVideo(null);
//   };

//   const handleVideoDoubleClick = () => {
//     if (videoPlayer) {
//       if (document.fullscreenElement) {
//         document.exitFullscreen();
//       } else {
//         videoPlayer.requestFullscreen();
//       }
//     }
//   };

//   const playHlsStream = async (videoId: string) => {
//     console.log("videoId", videoId);
//     if (!videoPlayer) return;
    
//     videoPlayer.pause();
//     videoPlayer.removeAttribute('src');
//     videoPlayer.load();

//     const agent = new HttpAgent({
//       host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT
//     });

//     const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND || '', {
//       agent,
//     }) as Actor & _SERVICE;

//     const playlistResult = await actor.get_hls_playlist(videoId, import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND ?? '');
//     if (playlistResult && 'ok' in playlistResult) {
//       const m3u8Text = String(playlistResult.ok);
//       const cleanedM3u8 = m3u8Text
//         .split('\n')
//         .filter(line => !line.startsWith('#EXT-X-KEY') && !line.includes('IV='))
//         .map(line => line.replace(/,IV=0x[0-9a-fA-F]+/, ''))
//         .join('\n');
      
//       const rewrittenM3u8 = cleanedM3u8.replace(/[^\n]*?(\d+)\.ts/g, (_, p1) => `icsegment://${videoId}/${p1}`);
//       const blob = new Blob([rewrittenM3u8], { type: 'application/vnd.apple.mpegurl' });
//       const m3u8Url = URL.createObjectURL(blob);
      
//       if (Hls.isSupported()) {
//         class CustomLoader extends Hls.DefaultConfig.loader {
//           load(context: any, config: any, callbacks: any) {
//             console.log("context", context);
//             if (context.url.startsWith('icsegment://')) {
//               const match = context.url.match(/^icsegment:\/\/(.+)\/(\d+)$/);
//               if (match) {
//                 const [, vId, segIdx] = match;
//                 const segmentId = Number(segIdx);

//                 actor.get_hls_segment(vId, segmentId)
//                   .then((result: any) => {
//                     if (result && 'ok' in result) {
//                       const data = new Uint8Array(result.ok);
//                       if (data.length > 0) {
//                         callbacks.onSuccess({
//                           data: data.buffer,
//                           stats: {
//                             loaded: data.length,
//                             total: data.length,
//                             retry: 0,
//                             aborted: false,
//                             loading: { first: 0, start: 0, end: 0 },
//                             parsing: { start: 0, end: 0 },
//                             buffering: { first: 0, start: 0, end: 0 }
//                           },
//                           url: context.url
//                         }, context, {});
//                       } else {
//                         throw new Error('Empty segment data');
//                       }
//                     } else {
//                       throw new Error(result.err || 'Segment fetch error');
//                     }
//                   })
//                   .catch((error) => {
//                     console.error('Failed to load segment:', error);
//                     callbacks.onError({
//                       code: 500,
//                       text: `Failed to load segment: ${error.message}`,
//                       url: context.url
//                     }, context, null);
//                   });
//                 return;
//               }
//             }
//             super.load(context, config, callbacks);
//           }
//         }

//         const hls = new Hls({
//           debug: true,
//           enableWorker: false,
//           enableSoftwareAES: false,
//           emeEnabled: false,
//           loader: CustomLoader
//         });

//         hls.loadSource(m3u8Url);
//         hls.attachMedia(videoPlayer);

//         hls.on(Hls.Events.MANIFEST_PARSED, () => {
//           videoPlayer.play().catch(e => {
//             if (e.name !== 'AbortError') {
//               console.warn('Play error:', e);
//             }
//           });
//         });
//       } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
//         videoPlayer.src = m3u8Url;
//         videoPlayer.play().catch(e => {
//           if (e.name !== 'AbortError') {
//             console.warn('Play error:', e);
//           }
//         });
//       } else {
//         console.error('HLS is not supported in this browser.');
//       }
//     }
//   };

//   useEffect(() => {
//     const loadImages = async () => {
//       if (!canisterId) return;

//       setLoading(true);
//       try {
//         const agent = new HttpAgent({
//           host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT
//         });

//         const actor = createActor(import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_BACKEND, {
//           agent,
//         }) as Actor & _SERVICE;

//         // Get video list from backend
//         const videoList = await actor.get_video_list();
//         console.log('Video List:', videoList);
//         const videosWithThumbnails = await Promise.all(
//           videoList.map(async ([id, title]) => {
//             try {
//               console.log('Loading thumbnail for video:', id);
//               const thumbnailResult = await actor.get_thumbnail(id);
//               if ('ok' in thumbnailResult) {
//                 console.log('thumbnailResult.ok', thumbnailResult.ok);
//                 // Convert thumbnail data to URL
//                 const blob = new Blob([new Uint8Array(thumbnailResult.ok)], { type: 'image/jpeg' });
//                 const thumbnailUrl = URL.createObjectURL(blob);
//                 return { id, title, thumbnailUrl };
//               }
//             } catch (error) {
//               console.error(`Error loading thumbnail for video ${id}:`, error);
//             }
//             return { id, title };
//           })
//         );

//         setImages(videosWithThumbnails);
//       } catch (error) {
//         console.error('Error loading images:', error);
//       } finally {
//         setLoading(false);
//       }
//     };

//     loadImages();
//   }, [canisterId]);

//   useEffect(() => {
//     if (selectedVideo) {
//       playHlsStream(selectedVideo);
//     }
//   }, [selectedVideo, videoPlayer]);

//   return (
//     <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
//       <Typography variant="h4" sx={{ mb: 4, textAlign: 'center' }}>
//         Video Thumbnails
//       </Typography>
//       {loading ? (
//         <Typography variant="h6" sx={{ textAlign: 'center' }}>Loading...</Typography>
//       ) : (
//         <Stack spacing={3}>
//           <Stack
//             direction="row"
//             sx={{
//               flexWrap: 'wrap',
//               gap: { xs: 2, sm: 3 },
//               justifyContent: 'center',
//               alignItems: 'stretch'
//             }}
//           >
//             {images.map((image) => (
//               <Box 
//                 key={image.id} 
//                 sx={{ 
//                   width: {
//                     xs: '100%',
//                     sm: 'calc(50% - 24px)',
//                     md: 'calc(33.333% - 24px)'
//                   },
//                   minWidth: { xs: '280px', sm: '320px' },
//                   display: 'flex',
//                   cursor: 'pointer'
//                 }}
//                 onClick={() => handleVideoClick(image.id)}
//               >
//                 <Paper 
//                   elevation={3} 
//                   sx={{ 
//                     p: 2,
//                     width: '100%',
//                     display: 'flex',
//                     flexDirection: 'column',
//                     bgcolor: '#fff',
//                     borderRadius: '8px',
//                     overflow: 'hidden',
//                     transition: 'transform 0.2s ease',
//                     '&:hover': {
//                       transform: 'scale(1.02)'
//                     }
//                   }}
//                 >
//                   <Typography 
//                     variant="h6" 
//                     sx={{ 
//                       mb: 1,
//                       textAlign: 'center'
//                     }}
//                   >
//                     {image.title}
//                   </Typography>
//                   <Box
//                     sx={{
//                       position: 'relative',
//                       width: '100%',
//                       paddingTop: '56.25%',
//                       overflow: 'hidden',
//                       borderRadius: '4px',
//                       bgcolor: '#f0f0f0'
//                     }}
//                   >
//                     {image.thumbnailUrl ? (
//                       <img
//                         src={image.thumbnailUrl}
//                         alt={image.title}
//                         style={{
//                           position: 'absolute',
//                           top: 0,
//                           left: 0,
//                           width: '100%',
//                           height: '100%',
//                           objectFit: 'cover',
//                         }}
//                       />
//                     ) : (
//                       <Box
//                         sx={{
//                           position: 'absolute',
//                           top: 0,
//                           left: 0,
//                           width: '100%',
//                           height: '100%',
//                           display: 'flex',
//                           alignItems: 'center',
//                           justifyContent: 'center',
//                           color: '#666'
//                         }}
//                       >
//                         No thumbnail
//                       </Box>
//                     )}
//                   </Box>
//                 </Paper>
//               </Box>
//             ))}
//           </Stack>
//         </Stack>
//       )}

//       <Modal
//         open={selectedVideo !== null}
//         onClose={handleCloseModal}
//         sx={{
//           display: 'flex',
//           alignItems: 'center',
//           justifyContent: 'center',
//           p: 2
//         }}
//       >
//         <Box
//           sx={{
//             position: 'relative',
//             width: '100%',
//             maxWidth: '1200px',
//             bgcolor: '#000',
//             borderRadius: 1,
//             overflow: 'hidden',
//             aspectRatio: '16/9'
//           }}
//         >
//           <video
//             ref={(el) => setVideoPlayer(el)}
//             style={{
//               width: '100%',
//               height: '100%',
//               objectFit: 'contain'
//             }}
//             controls
//             playsInline
//             onDoubleClick={handleVideoDoubleClick}
//           />
//         </Box>
//       </Modal>
//     </Box>
//   );
// };