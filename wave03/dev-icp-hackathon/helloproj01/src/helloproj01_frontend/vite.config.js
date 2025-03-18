import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vite';
import environment from 'vite-plugin-environment';
import vue from '@vitejs/plugin-vue';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export default defineConfig({
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
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4943',
        changeOrigin: true,
      },
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
});
