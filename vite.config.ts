import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CLIENT_PORT, SERVER_PORT  } from './src/shared/config';

export default defineConfig({
  plugins: [ react() ],
  root: 'src/client',
  publicDir: '../../public',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: CLIENT_PORT,
    proxy: {
      '/socket.io': {
        target: `http://localhost:${SERVER_PORT}`,
        ws: true
      }
    }
  }
});
