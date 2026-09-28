/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 项目页部署在 /morsepass/ 子路径下。
// 如仓库改名或部署到根路径，通过环境变量 MP_BASE 覆盖，无需改代码。
export default defineConfig({
  base: process.env.MP_BASE || '/morsepass/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'MorsePass · 摩尔斯码训练器',
        short_name: 'MorsePass',
        description: '网页版摩尔斯码收发训练器：发报 / 听抄 / 跟发 / Koch 课程',
        lang: 'zh-CN',
        theme_color: '#f6f7f9',
        background_color: '#f6f7f9',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
  },
})
