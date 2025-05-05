import React from 'react';
import { Box, Paper, Typography, Stack } from '@mui/material';

interface Image {
  id: string;
  title: string;
  url: string;
}

interface ImageGalleryProps {
  images?: Image[];
}

const defaultImages: Image[] = [
  {
    id: '1',
    title: 'Image 1',
    url: 'https://picsum.photos/800/450'
  },
  {
    id: '2',
    title: 'Image 2',
    url: 'https://picsum.photos/800/450'
  },
  {
    id: '3',
    title: 'Image 3',
    url: 'https://picsum.photos/800/450'
  }
];

export const ImageGallery: React.FC<ImageGalleryProps> = ({ images = defaultImages }) => {
  return (
    <Box sx={{ p: 3, bgcolor: '#f5f5f5', minHeight: '100vh' }}>
      <Typography variant="h4" sx={{ mb: 4, textAlign: 'center' }}>
        Image Gallery
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
          {images.map((image) => (
            <Box key={image.id} sx={{ width: { xs: '100%', md: '30%' }, minWidth: 300 }}>
              <Paper 
                elevation={3} 
                sx={{ 
                  p: 2,
                  height: '100%',
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
                    borderRadius: '4px'
                  }}
                >
                  <img
                    src={image.url}
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
                </Box>
              </Paper>
            </Box>
          ))}
        </Stack>
      </Stack>
    </Box>
  );
};