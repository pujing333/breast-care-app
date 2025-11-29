import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // 加载环境变量，第三个参数 '' 表示加载所有变量，不仅仅是 VITE_ 开头的
  const env = loadEnv(mode, process.cwd(), '');
  
  // 关键逻辑：同时尝试读取 API_KEY 和 VITE_API_KEY
  // 这样无论您在 Vercel 后台设置的是哪个名字，都能生效
  const apiKey = env.API_KEY || env.VITE_API_KEY || '';

  return {
    plugins: [react()],
    // 将抓取到的 Key 硬编码注入到前端代码中
    // 前端代码里可以通过 process.env.API_KEY 访问
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
        // 本地开发时的代理配置
        '/google-api': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/google-api/, '')
        }
      }
    }
  }
})
