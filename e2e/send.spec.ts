import { test, expect, type Page } from '@playwright/test'

/**
 * 发报页 E2E：真实 pointer 序列 → 解码 → 整场统计。
 * 10 WPM：Td = 120ms → 点 < 240ms、字符间隙 ≥ 240ms。
 * 按压时长留出调度余量：点 130ms（偏差 8.3% < 默认容差 20%）、划 370ms（2.8%）。
 */

const DIT_MS = 130
const DAH_MS = 370
const CHAR_GAP_MS = 320

async function press(page: Page, durationMs: number): Promise<void> {
  await page.mouse.down()
  await page.waitForTimeout(durationMs)
  await page.mouse.up()
}

async function pressAt(page: Page, x: number, y: number, durationMs: number): Promise<void> {
  await page.mouse.move(x, y)
  await press(page, durationMs)
}

test('全局鼠标发报：任意位置点击解码为小写并统计整场正确率', async ({ page }) => {
  await page.goto('/')

  // 速度设为 10 WPM
  const wpmSlider = page.getByTestId('param-速度').locator('input[type=range]')
  await wpmSlider.fill('10')

  // 开始练习（点击按钮本身在控件上，不会触发发报）
  await page.getByTestId('start-btn').click()

  // 第一个点按在页面标题上（非控件）
  const title = await page.locator('.page-title').boundingBox()
  if (!title) throw new Error('page-title not found')
  await pressAt(page, title.x + title.width / 2, title.y + title.height / 2, DIT_MS)
  await page.waitForTimeout(CHAR_GAP_MS)

  // 第二个划按在实时区卡片中央 —— 证明鼠标位置无关（全局捕获）
  const live = await page.getByTestId('live-area').boundingBox()
  if (!live) throw new Error('live-area not found')
  await pressAt(page, live.x + live.width / 2, live.y + live.height / 2, DAH_MS)
  await page.waitForTimeout(500) // 等字符边界定时器提交 "t"

  await expect(page.getByTestId('decoded-stream')).toHaveText('et')
  await expect(page.getByTestId('pending-morse')).toHaveText('\u00a0') // 无未决符号

  // 结束练习 → 整场报告：2 字符全部正确（节奏均在容差内）
  await page.getByTestId('stop-btn').click()
  await expect(page.getByTestId('report-card')).toBeVisible()
  const report = page.getByTestId('report-card')
  await expect(report).toContainText('100%')
  await expect(report).toContainText('2/2')
  await expect(report).toContainText('已保存到练习历史')

  // 实时徽章同样反映整场正确率
  await expect(page.getByTestId('accuracy')).toHaveText('100%')
})
