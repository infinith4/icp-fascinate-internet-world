import React from 'react';
import { 
  AppBar, 
  Box, 
  Toolbar, 
  Typography, 
  Button, 
  Avatar, 
  IconButton 
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

interface HeaderProps {
  onUploadClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onUploadClick }) => {
  const navigate = useNavigate();

  return (
    <AppBar position="fixed" sx={{ bgcolor: 'white', color: 'text.primary' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant="h6"
            component="div"
            sx={{ 
              cursor: 'pointer',
              fontWeight: 'bold',
              '&:hover': { opacity: 0.8 }
            }}
            onClick={() => navigate('/')}
          >
            IC Streaming
          </Typography>
          <Button 
            color="inherit" 
            onClick={() => navigate(`/video-gallery?canisterId=${import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_FRONTEND}`)}
            sx={{ ml: 2 }}
          >
            Videos
          </Button>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CloudUploadIcon />}
            onClick={onUploadClick}
          >
            アップロード
          </Button>
          <IconButton 
            color="inherit"
            size="large"
            sx={{ 
              bgcolor: 'grey.100',
              '&:hover': { bgcolor: 'grey.200' }
            }}
          >
            <Avatar sx={{ width: 32, height: 32 }}>
              <AccountCircleIcon />
            </Avatar>
          </IconButton>
        </Box>
      </Toolbar>
    </AppBar>
  );
};