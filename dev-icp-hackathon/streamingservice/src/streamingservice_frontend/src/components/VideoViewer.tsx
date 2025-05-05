import React, { useEffect, useState } from 'react';
import { Paper, Typography, Stack } from '@mui/material';
import Box from '@mui/material/Box';
import { useSearchParams } from 'react-router-dom';
import { Actor, HttpAgent } from '@dfinity/agent';
import { _SERVICE } from '../../../declarations/streamingservice_backend/streamingservice_backend.did';
import { createActor } from '../../../declarations/streamingservice_backend';

interface VideoViewerProps {
  videos?: Array<{
    id: string;
    title: string;
    url?: string;
  }>;
}

export const VideoViewer: React.FC<VideoViewerProps> = () => {
  const [searchParams] = useSearchParams();
  const [videos, setVideos] = useState<Array<{ id: string; title: string; url?: string }>>([]);
  const canisterId = searchParams.get('canisterId');

  useEffect(() => {
    const loadVideos = async () => {
      if (!canisterId) return;

      const agent = new HttpAgent({
        host: 'http://localhost:' + import.meta.env.VITE_LOCAL_CANISTER_PORT
      });

      const actor = createActor(canisterId, {
        agent,
      }) as Actor & _SERVICE;

      try {
        const videoList = await actor.get_video_list();
        setVideos(videoList.map(([id, title]) => ({
          id,
          title
        })));
      } catch (error) {
        console.error('Error loading videos:', error);
      }
    };

    loadVideos();
  }, [canisterId]);

  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ mb: 4, textAlign: 'center' }}>
        Video Gallery
      </Typography>
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
          {videos.map((video) => (
            <Box 
              key={video.id} 
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
                  bgcolor: '#000',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}
              >
                <Typography 
                  variant="h6" 
                  sx={{ 
                    color: '#fff', 
                    mb: 1,
                    textAlign: 'center'
                  }}
                >
                  {video.title}
                </Typography>
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: '56.25%', // 16:9 アスペクト比
                  }}
                >
                  <video
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                    controls
                    playsInline
                    src={video.url}
                  />
                </Box>
              </Paper>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};