import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // Listen on all addresses (0.0.0.0)
    port: 8080,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/api/project': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy specific API endpoints, not the entire /project path
      '/project/create': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/project/upload': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/history': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/history_static': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/upload': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/analyze': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/settings': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/notifications': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
}));
