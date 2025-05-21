import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { VideoGallery } from './components/VideoGallery';
// import { ImageGallery } from './components/ImageGallery';
import { LandingPage } from './components/LandingPage';
import { Login } from './components/Login';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <VideoGallery />
      },
      {
        path: 'video-gallery',
        element: <VideoGallery />
      },
      // {
      //   path: 'image-gallery',
      //   element: <ImageGallery />
      // }
    ]
  },
  {
    path: '/login',
    element: <Login />
  },
  {
    path: '/landing',
    element: <LandingPage />
  }
]);