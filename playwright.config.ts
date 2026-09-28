import { defineConfig } from '@playwright/test'

/**
 * E2E 配置：跑在 vite preview（生产构建产物）上，验证 base 路径 + 真实浏览器行为。
 * 若 4173 已有 preview 服务则直接复用（本地调试）。
 * Chromium 启动加 --autoplay-policy 允许 AudioContext 在 headless 下推进 currentTime。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173/morsepass/',
    launchOptions: {
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command:
      'node node_modules/vite/bin/vite.js build && node node_modules/vite/bin/vite.js preview --port 4173 --strictPort',
    port: 4173,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
