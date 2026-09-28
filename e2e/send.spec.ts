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

/** 统计时间线 canvas 上"绿色信号带"像素数（alpha>0 且接近 #2e9e5b） */
async function greenPixels(page: Page): Promise<number> {
  return page.evaluate(() => {
    const c = document.querySelector('[data-testid=timeline-canvas]') as HTMLCanvasElement
    if (!c) return -1
    const d = (c.getContext('2d') as CanvasRenderingContext2D).getImageData(0, 0, c.width, c.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i]
      const g = d[i + 1]
      const b = d[i + 2]
      if (d[i + 3] > 200 && g > 120 && r < 100 && b < 130) n++
    }
    return n
  })
}

test('自由发报：全局鼠标发报解码为小写并统计整场正确率', async ({ page }) => {
  await page.goto('/')

  // 默认自由模式；速度设为 10 WPM
  await expect(page.getByTestId('mode-free')).toBeEnabled()
  const wpmSlider = page.getByTestId('param-速度').locator('input[type=range]')
  await wpmSlider.fill('10')

  // 开始前时间线无绿色信号（只有网格与提示文字）
  const greenBefore = await greenPixels(page)
  expect(greenBefore).toBe(0)

  // 开始练习（点击按钮本身在控件上，不会触发发报）
  await page.getByTestId('start-btn').click()
  await expect(page.getByTestId('mode-free')).toBeDisabled() // 练习中锁定模式切换

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

  // 时间线上出现绿色信号带（回归保护：坐标体系错位会导致 0 像素）
  const greenAfter = await greenPixels(page)
  expect(greenAfter).toBeGreaterThan(0)

  // 清空解码流
  await page.getByTestId('clear-decoded').click()
  await expect(page.getByTestId('decoded-stream')).toHaveText('\u00a0')

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

test('对照发报：照文发报实时比对，结束报告采用全文比对结果', async ({ page }) => {
  await page.goto('/')

  // 切到对照模式，填入 "E T"（两个单词：E=点 T=划）
  await page.getByTestId('mode-article').click()
  await expect(page.getByTestId('material-input')).toBeVisible()
  await page.getByTestId('material-input').fill('E T')

  const wpmSlider = page.getByTestId('param-速度').locator('input[type=range]')
  await wpmSlider.fill('10')

  await page.getByTestId('start-btn').click()

  // E（点）→ 词间隔（10WPM 时 wordMs=840ms）→ T（划）
  const title = await page.locator('.page-title').boundingBox()
  if (!title) throw new Error('page-title not found')
  await pressAt(page, title.x + title.width / 2, title.y + title.height / 2, DIT_MS)
  await page.waitForTimeout(1100)
  const live = await page.locator('.decode-stream').boundingBox()
  if (!live) throw new Error('decode-stream not found')
  await pressAt(page, live.x + live.width / 2, live.y + live.height / 2, DAH_MS)
  await page.waitForTimeout(500)

  // 实时比对：发全 "E T" → 100%，进度 3/3（含词分隔空格）
  await expect(page.getByTestId('decoded-stream')).toHaveText('e t')
  await expect(page.getByTestId('article-accuracy')).toHaveText('100%')
  await expect(page.getByTestId('article-progress')).toHaveAttribute('style', /width:\s*100%/)

  // 逐组 chips：两个词全对，连续 ≥2 → 均带大块标记
  const chips = page.getByTestId('article-groups').locator('.word-chip')
  await expect(chips).toHaveCount(2)
  await expect(chips.first()).toContainText('e')
  await expect(chips.first()).toHaveClass(/match/)
  await expect(chips.nth(1)).toHaveClass(/match block/)

  // 结束 → 报告采用全文比对结果："E T" 含词分隔空格共 3 字符全对、100%
  await page.getByTestId('stop-btn').click()
  const report = page.getByTestId('report-card')
  await expect(report).toBeVisible()
  await expect(report).toContainText('100%')
  await expect(report).toContainText('3/3')

  // 展开折叠区查看逐字符 diff（全绿）
  await page.getByText('逐字符 diff（详细）').click()
  await expect(page.getByTestId('diff-result')).toBeVisible()
})

test('对照发报：数字组一键生成 4 字一组纯数字素材', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('mode-article').click()
  await page.getByTestId('material-tab-digits').click()
  await page.getByTestId('material-generate').click()

  const text = await page.getByTestId('material-input').inputValue()
  const groups = text.trim().split(/\s+/)
  expect(groups.length).toBeGreaterThanOrEqual(5)
  for (const g of groups) expect(g).toMatch(/^\d{4}$/)
})
