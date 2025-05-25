import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { VideoGallery } from './components/VideoGallery';
// import { ImageGallery } from './components/ImageGallery';
import { LandingPage } from './components/LandingPage';
import { Login } from './components/Login';
import CanisterList from './components/CanisterList';

// export const router = createBrowserRouter([
//   {
//     path: `/`,
//     element: <App />,
//     children: [
//       {
//         index: true,
//         element: <VideoGallery />
//       },
//       {
//         path: `video-gallery?canisterId=${import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_FRONTEND}`,
//         element: <VideoGallery />
//       },
//       {
//         path: `canister-list?canisterId=${import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_FRONTEND}`,
//         element: <CanisterList />
//       },
//       // {
//       //   path: 'image-gallery',
//       //   element: <ImageGallery />
//       // }
//     ]
//   },
//   {
//     path: `/login?canisterId=${import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_FRONTEND}`,
//     element: <Login />
//   },
//   {
//     path: `/landing?canisterId=${import.meta.env.VITE_CANISTER_ID_STREAMINGSERVICE_FRONTEND}`,
//     element: <LandingPage />
//   }
// ]);
export const router = createBrowserRouter([
  {
    path: `/`,
    element: <App />,
    children: [
      {
        index: true,
        element: <VideoGallery />
      },
      {
        path: `video-gallery`,
        element: <VideoGallery />
      },
      {
        path: `canister-list`,
        element: <CanisterList />
      },
      // {
      //   path: 'image-gallery',
      //   element: <ImageGallery />
      // }
    ]
  },
  {
    path: `/login`,
    element: <Login />
  },
  {
    path: `/landing`,
    element: <LandingPage />
  }
]);