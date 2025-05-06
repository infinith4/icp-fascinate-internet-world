import React from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Button, Container, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export const Login: React.FC = () => {
  const handleLogin = async () => {
    const authClient = await AuthClient.create();
    
    // Start the login process
    await authClient.login({
      identityProvider: process.env.DFX_NETWORK === 'ic' 
        ? 'https://identity.ic0.app'
        : `http://localhost:4943?canisterId=${process.env.INTERNET_IDENTITY_CANISTER_ID}`,
      onSuccess: () => {
        window.location.href = '/';
      },
      onError: (error?: string) => {
        console.error('Login failed:', error);
      },
    });
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