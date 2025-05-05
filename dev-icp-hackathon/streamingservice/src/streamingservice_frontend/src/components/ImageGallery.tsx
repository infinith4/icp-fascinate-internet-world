import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { Actor, HttpAgent } from '@dfinity/agent';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../../declarations/streamingservice_backend';

interface Image {
  id: string;
  title: string;
  thumbnailUrl?: string;
}

interface ImageGalleryProps {
  images?: Image[];
}

export const ImageGallery: React.FC<ImageGalleryProps> = () => {
  const [searchParams] = useSearchParams();
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(false);
  const canisterId = searchParams.get('canisterId');

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

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ mb: 4, textAlign: 'center' }}>
        Video Thumbnails
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
                  display: 'flex'
                }}
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
                    overflow: 'hidden'
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
    </Box>
  );
};