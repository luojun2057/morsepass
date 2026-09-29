import { test, expect, type Page } from '@playwright/test'

/**
 * 自动键 E2E。10 WPM：Td = 120ms → 点 120ms、划 360ms、间隙 120ms。
 * 按住时长窗口（Mode A 间隙中松手会取消排队元素，落点须在元素内部）：
 * - 短按 60ms → 1 个元素；260ms → 2 点（i）；500ms → 3 点（s）
 * - 双桨挤压 500ms（划进行中松手）→ Mode A：a（di-dah）；Mode B：r（di-dah-dit）
 */

/** 统计时间线 canvas 上"绿色信号带"像素数（与 send.spec 同口径） */
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

async function startAuto(page: Page, wpm = '10'): Promise<void> {
  await page.goto('/')
  await page.getByTestId('keyer-auto').click()
  await page.getByTestId('param-速度').locator('input[type=range]').fill(wpm)
  await page.getByTestId('start-btn').click()
  // 练习中设置区折叠，键控 tabs 随之卸载——卸载即锁定，无法切换
  await expect(page.getByTestId('keyer-auto')).toHaveCount(0)
  await expect(page.locator('.settings-bar .sum')).toContainText('自动键')
}

test('自动键：右键发点、左键发划，解码/时间线/报告照常', async ({ page }) => {
  await startAuto(page)

  // 点桨 = 鼠标右键：短按发一点（E）
  await page.mouse.down({ button: 'right' })
  await page.waitForTimeout(60)
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(500)
  await expect(page.getByTestId('decoded-stream')).toHaveText('e')

  // 划桨 = 鼠标左键：短按发一划（T）
  await page.mouse.down()
  await page.waitForTimeout(60)
  await page.mouse.up()
  await page.waitForTimeout(500)
  await expect(page.getByTestId('decoded-stream')).toHaveText('et')

  // 时间线出现信号（自动键事件走同一条解码/记录链路）
  expect(await greenPixels(page)).toBeGreaterThan(0)

  await page.getByTestId('stop-btn').click()
  const report = page.getByTestId('report-card')
  await expect(report).toBeVisible()
  await expect(report).toContainText('100%')
  await expect(report).toContainText('2/2')
})

test('自动键：按住桨自动重复（260ms → 两点 i，500ms → 三点 s）', async ({ page }) => {
  await startAuto(page)

  await page.mouse.down({ button: 'right' })
  await page.waitForTimeout(260)
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(600)
  await expect(page.getByTestId('decoded-stream')).toHaveText('i')

  await page.mouse.down({ button: 'right' })
  await page.waitForTimeout(500)
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(600)
  await expect(page.getByTestId('decoded-stream')).toHaveText('is')
})

test('自动键：双桨挤压交替——Mode A 发 a，Mode B 补发一点成 r', async ({ page }) => {
  await startAuto(page)

  // Mode A（默认）：di-dah = a
  await page.mouse.down({ button: 'right' })
  await page.mouse.down({ button: 'left' })
  await page.waitForTimeout(500)
  await page.mouse.up({ button: 'right' })
  await page.mouse.up({ button: 'left' })
  await page.waitForTimeout(900)
  await expect(page.getByTestId('decoded-stream')).toHaveText('a')

  await page.getByTestId('stop-btn').click()
  await page.getByRole('button', { name: '关闭' }).click()

  // 切 Mode B：di-dah-dit = r
  await page.getByTestId('keyer-style').selectOption('b')
  await page.getByTestId('start-btn').click()
  await page.mouse.down({ button: 'right' })
  await page.mouse.down({ button: 'left' })
  await page.waitForTimeout(500)
  await page.mouse.up({ button: 'right' })
  await page.mouse.up({ button: 'left' })
  await page.waitForTimeout(1300)
  await expect(page.getByTestId('decoded-stream')).toHaveText('r')
  await page.getByTestId('stop-btn').click()
  await expect(page.getByTestId('report-card')).toBeVisible()
})

test('自动键：点划互换后左键发点、右键发划', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('keyer-auto').click()
  await page.getByTestId('param-速度').locator('input[type=range]').fill('10')
  await page.getByTestId('paddle-reverse').click()
  await expect(page.getByTestId('dit-mouse-label')).toHaveText('鼠标左键')
  await expect(page.getByTestId('dah-mouse-label')).toHaveText('鼠标右键')
  await page.getByTestId('start-btn').click()

  await page.mouse.down() // 互换后左键 = 点
  await page.waitForTimeout(60)
  await page.mouse.up()
  await page.waitForTimeout(500)
  await expect(page.getByTestId('decoded-stream')).toHaveText('e')

  await page.mouse.down({ button: 'right' }) // 右键 = 划
  await page.waitForTimeout(60)
  await page.mouse.up({ button: 'right' })
  await page.waitForTimeout(500)
  await expect(page.getByTestId('decoded-stream')).toHaveText('et')
})

test('自动键：键盘双桨绑定并发码（按住划桨键发 m）', async ({ page }) => {
  await page.goto('/')
  await page.getByTestId('keyer-auto').click()
  await page.getByTestId('param-速度').locator('input[type=range]').fill('10')

  const ditRow = page.locator('.param-row', { has: page.getByTestId('dit-key-binding') })
  await ditRow.getByRole('button', { name: '设置按键' }).click()
  await page.keyboard.press('KeyJ')
  const dahRow = page.locator('.param-row', { has: page.getByTestId('dah-key-binding') })
  await dahRow.getByRole('button', { name: '设置按键' }).click()
  await page.keyboard.press('KeyK')
  await expect(page.getByTestId('dit-key-binding')).toHaveText('KeyJ')
  await expect(page.getByTestId('dah-key-binding')).toHaveText('KeyK')

  await page.getByTestId('start-btn').click()
  await page.keyboard.down('KeyK')
  await page.waitForTimeout(660) // 两划：dah 0-360、dah 480-840（进行中松手）
  await page.keyboard.up('KeyK')
  await page.waitForTimeout(1300)
  await expect(page.getByTestId('decoded-stream')).toHaveText('m')
})
