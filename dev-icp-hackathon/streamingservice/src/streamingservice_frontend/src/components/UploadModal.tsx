import React, { useState, useRef } from 'react';
import {
  Modal,
  Box,
  Typography,
  Button,
  TextField,
  LinearProgress,
  IconButton
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';
import { FFmpegService } from '../services/FFmpegService';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File, title: string) => Promise<void>;
  progress?: number;
  ffmpegService: FFmpegService;
}

export const UploadModal: React.FC<UploadModalProps> = ({ 
  open, 
  onClose, 
  onUpload,
  progress = 0,
  ffmpegService
}) => {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isFFmpegInitializing = ffmpegService.isFFmpegInitializing();
  const isFFmpegLoaded = ffmpegService.isFFmpegLoaded();

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('video/')) {
      setFile(droppedFile);
      if (!title) {
        setTitle(droppedFile.name.split('.')[0]);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      setFile(selectedFile);
      if (!title) {
        setTitle(selectedFile.name.split('.')[0]);
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title) return;

    setUploading(true);
    try {
      await onUpload(file, title);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
      setFile(null);
      setTitle('');
    }
  };

  return (
    <Modal
      open={open}
      onClose={!uploading ? onClose : undefined}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 600,
          bgcolor: 'background.paper',
          borderRadius: 1,
          boxShadow: 24,
          p: 4
        }}
      >
        <IconButton
          sx={{
            position: 'absolute',
            right: 8,
            top: 8
          }}
          onClick={onClose}
          disabled={uploading}
        >
          <CloseIcon />
        </IconButton>

        <Typography variant="h6" component="h2" gutterBottom>
          動画をアップロード
        </Typography>

        <Box
          sx={{
            mt: 2,
            mb: 3,
            border: '2px dashed',
            borderColor: 'grey.300',
            borderRadius: 1,
            p: 3,
            textAlign: 'center',
            cursor: uploading ? 'default' : 'pointer',
            '&:hover': {
              borderColor: uploading ? 'grey.300' : 'primary.main',
              bgcolor: uploading ? 'transparent' : 'grey.50'
            }
          }}
          onDrop={!uploading ? handleDrop : undefined}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="video/*"
            style={{ display: 'none' }}
            disabled={uploading}
          />
          <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="body1" gutterBottom>
            {file ? file.name : 'ドラッグ＆ドロップまたはクリックして動画を選択'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            対応形式: MP4, WebM, MOV
          </Typography>
        </Box>

        <TextField
          fullWidth
          label="タイトル"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          margin="normal"
          disabled={uploading}
        />

        {uploading && (
          <Box sx={{ width: '100%', mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
              {Math.round(progress)}%
            </Typography>
          </Box>
        )}

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button onClick={onClose} disabled={uploading || isFFmpegInitializing}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={!file || !title || uploading || isFFmpegInitializing || !isFFmpegLoaded}
          >
            {isFFmpegInitializing ? 'FFmpeg初期化中...' : 'アップロード'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};