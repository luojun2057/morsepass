import { test, expect } from '@playwright/test'
import * as fs from 'fs'

test('码表互转：双向实时转换', async ({ page }) => {
  await page.goto('/#/tools')

  // 文本 → 摩尔斯
  await page.getByTestId('conv-text-in').fill('SOS')
  await expect(page.getByTestId('conv-text-out')).toHaveText('... --- ...')

  // 摩尔斯 → 文本（含单词分隔）
  await page.getByTestId('conv-morse-in').fill('.... .. / - .... . .-. .')
  await expect(page.getByTestId('conv-morse-out')).toHaveText('HI THERE')

  // 兼容全角点划写法
  await page.getByTestId('conv-morse-in').fill('··· −−−')
  await expect(page.getByTestId('conv-morse-out')).toHaveText('SO')
})

test('WAV 导出：触发浏览器下载且文件合法', async ({ page }) => {
  await page.goto('/#/tools')
  await page.getByTestId('tab-wav').click()

  await page.getByTestId('wav-text').fill('E')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('wav-export').click(),
  ])

  expect(download.suggestedFilename()).toMatch(/^morsepass-\d+\.wav$/)
  const path = await download.path()
  expect(path).toBeTruthy()
  const size = fs.statSync(path as string).size
  expect(size).toBeGreaterThan(44) // 至少包含完整 WAV 头

  // 校验头部魔数
  const fd = fs.openSync(path as string, 'r')
  const head = Buffer.alloc(4)
  fs.readSync(fd, head, 0, 4, 0)
  fs.closeSync(fd)
  expect(head.toString('ascii')).toBe('RIFF')
})
