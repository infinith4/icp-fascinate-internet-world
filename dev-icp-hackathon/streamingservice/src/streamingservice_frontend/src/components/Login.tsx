import React from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Button, Container, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export function getIdentityProvider(): string {
  if(import.meta.env.VITE_DFX_NETWORK === "local") {// Safari detection
    const isSafari = /^(?!.*chrome\/\d+)(?!.*chromium\/\d+).*safari\/\d+/i.test(navigator.userAgent);
    console.log('isSafari:', isSafari);
    console.log('VITE_LOCAL_CANISTER_PORT:', import.meta.env.VITE_LOCAL_CANISTER_PORT);
    console.log('VITE_CANISTER_ID_INTERNET_IDENTITY:', import.meta.env.VITE_CANISTER_ID_INTERNET_IDENTITY);
    console.log('VITE_DFX_NETWORK:', import.meta.env.VITE_DFX_NETWORK);
    if(isSafari)
      return `http://localhost:${import.meta.env.VITE_LOCAL_CANISTER_PORT}/?canisterId=${import.meta.env.VITE_CANISTER_ID_INTERNET_IDENTITY}`
    else
      return `http://${import.meta.env.VITE_CANISTER_ID_INTERNET_IDENTITY}.localhost:${import.meta.env.VITE_LOCAL_CANISTER_PORT}`;
  } else if (import.meta.env.VITE_DFX_NETWORK === "ic") {
    return `https://identity.ic0.app/#authorize`;  //NOTE: 本番環境は必ずこのURLでなければならない
  } else {
    return `https://${import.meta.env.VITE_CANISTER_ID_INTERNET_IDENTITY}.dfinity.network`;
  }
}

export const Login: React.FC = () => {
  const navigate = useNavigate();

  const handleLogin = async () => {
    try {
      console.log('Login button clicked');
      const authClient = await AuthClient.create();
      
      await authClient.login({
        identityProvider: getIdentityProvider(),
        maxTimeToLive: BigInt(7) * BigInt(24) * BigInt(3600) * BigInt(1000000000), // 7日間
        onSuccess: () => {
          navigate('/', { replace: true });
        },
        onError: (error?: string) => {
          console.error('Login failed:', error);
        },
      });
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ 
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <Typography component="h1" variant="h4" gutterBottom>
          Video Streaming Service
        </Typography>
        <Typography variant="body1" sx={{ mb: 4 }}>
          Please login to continue
        </Typography>
        <Button
          variant="contained"
          color="primary"
          size="large"
          onClick={handleLogin}
        >
          Login with Internet Identity
        </Button>
      </Box>
    </Container>
  );
};