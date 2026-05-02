import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: 'build.html',
      output: {
        entryFileNames: 'assets/app-three.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => (
          assetInfo.name && assetInfo.name.endsWith('.css')
            ? 'assets/app-three.css'
            : 'assets/[name][extname]'
        ),
      },
    },
  },
  plugins: [react()],
});
