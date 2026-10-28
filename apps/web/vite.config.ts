import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // #124: after lazy-loading the trip, profile and admin screens, the
        // entry chunk was still 511 kB, 218 kB of it react-dom (with its
        // scheduler), the largest vendor. It gets its own long-lived chunk;
        // the 500 kB warning limit stays as it is. (codeSplitting groups are
        // Rolldown's replacement for the deprecated manualChunks.)
        codeSplitting: {
          groups: [
            { name: 'react-dom', test: /node_modules[\\/]\.pnpm[\\/](react-dom|scheduler)@/ },
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:4000' },
    },
  },
});
