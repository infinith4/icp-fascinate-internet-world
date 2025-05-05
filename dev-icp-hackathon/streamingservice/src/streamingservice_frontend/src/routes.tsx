import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { VideoViewer } from './components/VideoViewer';
import { ImageGallery } from './components/ImageGallery';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />
  },
  {
    path: '/video-viewer',
    element: <VideoViewer />
  },
  {
    path: '/image-gallery',
    element: <ImageGallery />
  }
]);