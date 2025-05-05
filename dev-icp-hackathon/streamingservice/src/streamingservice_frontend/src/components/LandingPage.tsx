import React from 'react';
import { Box, Container, Typography, Button, Paper } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SpeedIcon from '@mui/icons-material/Speed';
import { Header } from './Header';

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  const handleUploadClick = () => {
    // TODO: Implement upload functionality
    console.log('Upload clicked');
  };

  return (
    <Box>
      <Header onUploadClick={handleUploadClick} />
      <Box sx={{ mt: '64px' }}>
        {/* Hero Section */}
        <Box
          sx={{
            bgcolor: 'primary.main',
            color: 'white',
            py: 8,
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Container maxWidth="lg">
            <Box 
              sx={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                alignItems: 'center',
                gap: { xs: 4, sm: 4 }
              }}
            >
              <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 16px)' } }}>
                <Typography variant="h2" component="h1" gutterBottom>
                  IC Streaming Service
                </Typography>
                <Typography variant="h5" paragraph>
                  高速で安全な分散型動画ストリーミングプラットフォーム
                </Typography>
                <Button
                  variant="contained"
                  size="large"
                  color="secondary"
                  startIcon={<PlayCircleOutlineIcon />}
                  onClick={() => navigate(`/video-gallery?canisterId=${import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_FRONTEND}`)}
                  sx={{ mt: 2 }}
                >
                  ビデオギャラリーを見る
                </Button>
              </Box>
              <Box sx={{ 
                flex: { xs: '1 1 100%', md: '1 1 calc(50% - 16px)' },
                display: 'flex',
                justifyContent: 'center'
              }}>
                <Box
                  component="img"
                  src="/hero_ic_streamingservice.png"
                  alt="Streaming Service"
                  sx={{
                    width: '100%',
                    height: 'auto',
                    maxWidth: 500,
                    display: 'block'
                  }}
                />
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Features Section */}
        <Container maxWidth="lg" sx={{ py: 8 }}>
          <Typography variant="h3" component="h2" align="center" gutterBottom>
            主な機能
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 3,
            mt: 4
          }}>
            <Box sx={{ 
              flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
              minWidth: { xs: '280px', sm: '320px' }
            }}>
              <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
                <PlayCircleOutlineIcon color="primary" sx={{ fontSize: 40 }} />
                <Typography variant="h5" component="h3" sx={{ my: 2 }}>
                  HLSストリーミング
                </Typography>
                <Typography color="text.secondary">
                  高品質な動画をスムーズに再生。適応ビットレートでどのデバイスでも最適な視聴体験を提供します。
                </Typography>
              </Paper>
            </Box>
            <Box sx={{ 
              flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
              minWidth: { xs: '280px', sm: '320px' }
            }}>
              <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
                <CloudUploadIcon color="primary" sx={{ fontSize: 40 }} />
                <Typography variant="h5" component="h3" sx={{ my: 2 }}>
                  簡単アップロード
                </Typography>
                <Typography color="text.secondary">
                  ドラッグ＆ドロップで簡単にアップロード。自動的にHLS形式に変換されます。
                </Typography>
              </Paper>
            </Box>
            <Box sx={{ 
              flex: { xs: '1 1 100%', md: '1 1 calc(33.333% - 16px)' },
              minWidth: { xs: '280px', sm: '320px' }
            }}>
              <Paper elevation={3} sx={{ p: 3, height: '100%' }}>
                <SpeedIcon color="primary" sx={{ fontSize: 40 }} />
                <Typography variant="h5" component="h3" sx={{ my: 2 }}>
                  高速配信
                </Typography>
                <Typography color="text.secondary">
                  Internet Computerの分散型インフラストラクチャを活用し、世界中で高速な動画配信を実現します。
                </Typography>
              </Paper>
            </Box>
          </Box>
        </Container>

        {/* CTA Section */}
        <Box sx={{ bgcolor: 'grey.100', py: 8 }}>
          <Container maxWidth="lg">
            <Box textAlign="center">
              <Typography variant="h4" component="h2" gutterBottom>
                さあ、始めましょう
              </Typography>
              <Typography variant="h6" color="text.secondary" paragraph>
                高品質な動画配信をInternet Computer上で実現
              </Typography>
              <Button
                variant="contained"
                size="large"
                color="primary"
                onClick={() => navigate(`/video-gallery?canisterId=${import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_FRONTEND}`)}
                sx={{ mt: 2 }}
              >
                ギャラリーを見る
              </Button>
            </Box>
          </Container>
        </Box>
      </Box>
    </Box>
  );
};