import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量，允许读取不带 VITE_ 前缀的变量
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    // 关键配置：将服务端的 API_KEY 注入到前端代码中
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
        'components': path.resolve(__dirname, './components')
      }
    },
    server: {
      host: true,
      proxy: {
        '/google-api': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/google-api/, '')
        }
      }
    }
  }
})
