import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  // GitHub Pages 的项目页地址是 /game24/，构建时需要带上前缀；开发服务器仍用根路径
  base: command === 'build' ? '/game24/' : '/',
  plugins: [react(), tailwindcss()],
}));
