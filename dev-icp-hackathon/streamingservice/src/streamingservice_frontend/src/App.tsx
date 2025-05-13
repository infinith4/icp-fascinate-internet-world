"use client";
import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthClient } from '@dfinity/auth-client';
import { Identity } from '@dfinity/agent';
// import "userSWR" from 'swr';

function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);



  const initAuth = async () => {
    try {
      const authClient = await AuthClient.create();
      const isAuthenticated = await authClient.isAuthenticated();
      
      if (isAuthenticated) {
        const identity = authClient.getIdentity();
        setIdentity(identity);
        
        // セッションの有効期限をチェック (7日)
        const maxSessionTime = 7 * 24 * 60 * 60 * 1000; // 7日間（ミリ秒）
        const sessionStart = localStorage.getItem('sessionStart');
        const currentTime = Date.now();
        
        if (!sessionStart) {
          localStorage.setItem('sessionStart', currentTime.toString());
        } else {
          const sessionAge = currentTime - parseInt(sessionStart);
          if (sessionAge >= maxSessionTime) {
            await authClient.logout();
            localStorage.removeItem('sessionStart');
            setIdentity(null);
            window.location.href = '/login';
            return;
          }
          
          const timeUntilExpiry = maxSessionTime - sessionAge;
          if (timeUntilExpiry > 600000) {
            setTimeout(() => {
              handleAuthChange(null);
              window.location.href = '/login';
            }, timeUntilExpiry - 600000);
          }
        }
      }
    } catch (error) {
      console.error('Authentication initialization error:', error);
    } finally {
      setIsInitialized(true);
    }
  };

  const handleAuthChange = (newIdentity: Identity | null) => {
    setIdentity(newIdentity);
  };

  initAuth();
  if (!isInitialized) {
    return <div>Loading...</div>;
  }

  return identity ? <Outlet /> : <Navigate to="/login" replace />;
}

export default App;