import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import environment from 'vite-plugin-environment';
import vue from '@vitejs/plugin-vue';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default defineConfig(({mode}) => ({
  build: {
    emptyOutDir: true,
  },
  optimizeDeps: {
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
    exclude: ['secrets_backend', 'vetkd_system_api'],
  },
  server: mode === 'development' ? {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4943',
        changeOrigin: true,
      },
    },
  } : {
    headers: {
      "Content-Security-Policy":
        "default-src 'self' https://ic0.app; connect-src 'self' https://ic0.app; script-src 'self' 'unsafe-inline' 'unsafe-eval';",
    },
  },
  plugins: [
    vue(),
    environment('all', { prefix: 'CANISTER_' }),
    environment('all', { prefix: 'DFX_' }),
    environment('all', { prefix: 'MASTERPASSWORD' }),
  ],
  resolve: {
    alias: [
      { find: 'declarations', replacement: fileURLToPath(new URL('../declarations', import.meta.url)) },
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
    ],
    dedupe: ['@dfinity/agent'],
    extensions: ['.js', '.ts', '.vue', '.did.js', '.did']
  }
}));
