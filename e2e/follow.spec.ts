import { test, expect } from '@playwright/test'

/**
 * 跟发页 E2E 冒烟：倒计时 → 自动播放+收卷 → 报告可见。
 * 素材用单字符 "E"（默认 15 WPM 下播放 < 1s），全程约 5s 倒计时 + 2.5s 自动收卷。
 */

test('跟发：倒计时后自动播放并自动收卷出报告', async ({ page }) => {
  test.setTimeout(30_000)
  await page.goto('/#/follow')

  await page.getByTestId('material-input').fill('E')
  await page.getByTestId('follow-start').click()

  // 倒计时出现
  await expect(page.getByTestId('countdown')).toBeVisible()

  // 倒计时结束进入 running：出现"结束"按钮
  await expect(page.getByTestId('follow-stop')).toBeVisible({ timeout: 8_000 })

  // 播放结束 1.5s 后自动收卷 → 回到 idle（开始按钮重现）+ 报告卡出现
  await expect(page.getByTestId('follow-start')).toBeVisible({ timeout: 12_000 })
  await expect(page.getByTestId('report-card')).toBeVisible()
})
