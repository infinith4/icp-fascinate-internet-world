import React from 'react';
import { 
  AppBar, 
  Box, 
  Toolbar, 
  Typography, 
  Button, 
  Avatar, 
  IconButton,
  Menu,
  MenuItem
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { Identity } from '@dfinity/agent';
import { AuthClient } from '@dfinity/auth-client';

interface HeaderProps {
  onUploadClick?: () => void;
  identity: Identity | null;
  onAuthChange: (identity: Identity | null) => void;
}

export const Header: React.FC<HeaderProps> = ({ onUploadClick, identity, onAuthChange }) => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleCanisterList = async () => {
    navigate('/canister-list');
  };

  const handleLogout = async () => {
    const authClient = await AuthClient.create();
    await authClient.logout();
    localStorage.removeItem('sessionStart'); // セッション情報をクリア
    onAuthChange(null);
    handleMenuClose();
    navigate('/');
  };

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
            Streaming
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
          {identity ? (
            <>
              {onUploadClick && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<CloudUploadIcon />}
                  onClick={onUploadClick}
                >
                  アップロード
                </Button>
              )}
              <IconButton 
                color="inherit"
                size="large"
                onClick={handleMenuClick}
                sx={{ 
                  bgcolor: 'grey.100',
                  '&:hover': { bgcolor: 'grey.200' }
                }}
              >
                <Avatar sx={{ width: 32, height: 32 }}>
                  <AccountCircleIcon />
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem onClick={handleCanisterList}>
                  Canister 一覧
                </MenuItem>
                <MenuItem disabled>
                  <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                    {identity.getPrincipal().toString().slice(0, 10)}...
                  </Typography>
                </MenuItem>
                <MenuItem onClick={handleLogout}>
                  ログアウト
                </MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate(`/login?canisterId=${import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_FRONTEND}`)}
            >
              ログイン
            </Button>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};