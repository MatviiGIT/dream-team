import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages hosts this project under /dream-team/.
  // Vite rewrites the source TSX entry into bundled JavaScript during build.
  base: '/dream-team/',
  plugins: [react()],
});
