import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
    allowedHosts: [
      '2dded3b3fea8.ngrok-free.app',  // Your specific ngrok host
      '.ngrok-free.app',               // Allow all ngrok free hosts
      '.ngrok.io',                     // Allow all ngrok paid hosts
    ],
  },
});
