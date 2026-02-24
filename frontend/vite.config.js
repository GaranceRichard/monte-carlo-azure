import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/ado": {
        target: "https://dev.azure.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/ado/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            delete proxyRes.headers["www-authenticate"];
          });
        },
      },
      "/vssps": {
        target: "https://app.vssps.visualstudio.com",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/vssps/, ""),
        configure: (proxy) => {
          proxy.on("proxyRes", (proxyRes) => {
            delete proxyRes.headers["www-authenticate"];
          });
        },
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts')) return 'vendor-recharts'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react'
        },
      },
    },
  },
})
