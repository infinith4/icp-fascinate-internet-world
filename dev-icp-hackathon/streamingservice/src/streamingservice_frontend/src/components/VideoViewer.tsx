import React from 'react';
import { Paper, Typography, Stack } from '@mui/material';
import Box from '@mui/material/Box';

interface VideoViewerProps {
  videos?: Array<{
    id: string;
    title: string;
    url?: string;
  }>;
}

const defaultVideos = [
  {
    id: '1',
    title: 'Video Player 1',
    url: 'https://webdesign-trends.net/wp/wp-content/uploads/2021/09/sample-video.mp4'
  },
  {
    id: '2',
    title: 'Video Player 2',
    url: 'https://webdesign-trends.net/wp/wp-content/uploads/2021/09/sample-video.mp4'
  },
  {
    id: '3',
    title: 'Video Player 3',
    url: 'https://webdesign-trends.net/wp/wp-content/uploads/2021/09/sample-video.mp4'
  }
];

export const VideoViewer: React.FC<VideoViewerProps> = ({ videos = defaultVideos }) => {
  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ mb: 4, textAlign: 'center' }}>
        Video Gallery
      </Typography>
      <Stack spacing={3}>
        <Stack
          direction="row"
          spacing={3}
          sx={{
            flexWrap: 'wrap',
            gap: 3,
            justifyContent: 'center'
          }}
        >
          {videos.map((video) => (
            <Box key={video.id} sx={{ width: { xs: '100%', md: '30%' }, minWidth: 300 }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 2,
                  height: '100%',
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