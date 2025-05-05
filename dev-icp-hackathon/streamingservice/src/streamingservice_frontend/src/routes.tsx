import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { VideoGallery } from './components/VideoGallery';
import { LandingPage } from './components/LandingPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />
  },
  {
    path: '/landing',
    element: <LandingPage />
  },
  {
    path: '/video-gallery',
    element: <VideoGallery />
  }
]);