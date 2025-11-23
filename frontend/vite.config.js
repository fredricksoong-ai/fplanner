import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split vendor code
          if (id.includes('node_modules')) {
            // ECharts is large - put it in its own chunk (lazy loaded for charts page)
            if (id.includes('echarts')) {
              return 'echarts';
            }
            // Other vendor code
            return 'vendor';
          }
          
          // Split large utility modules
          if (id.includes('/utils/')) {
            return 'utils';
          }
          
          // Split chart modules (only loaded on charts page)
          if (id.includes('/charts/')) {
            return 'charts';
          }
          
          // Split data analysis modules
          if (id.includes('/dataAnalysis/')) {
            return 'data-analysis';
          }
          
          // Split team builder modules
          if (id.includes('/teamBuilder/')) {
            return 'team-builder';
          }
        },
        // Optimize chunk size
        chunkSizeWarningLimit: 1000
      }
    },
    // Enable code splitting
    chunkSizeWarningLimit: 1000
  }
});