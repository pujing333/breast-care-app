import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量，允许读取系统级变量 (如 Vercel 的 API_KEY)
  // Use __dirname to avoid TS error with process.cwd() and ensure env is loaded from config directory
  const env = loadEnv(mode, __dirname, '');
  
  // 尝试获取 Key，兼容两种命名习惯
  const apiKey = env.API_KEY || env.VITE_API_KEY || '';

  return {
    plugins: [react()],
    // 关键配置：将服务器端的 Key 硬编码注入到前端代码的 process.env.API_KEY 中
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey),
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
