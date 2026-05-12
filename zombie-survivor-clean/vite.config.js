import { defineConfig } from 'vite';
import basicSSL from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSSL()],
  server: {
    https: true,
    port: 3000,
  },
  base: './',
});