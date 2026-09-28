import { test, expect } from '@playwright/test'

test('听选 Quiz：出题、正确计分、下一题、错误计分', async ({ page }) => {
  await page.goto('/#/challenge')

  await page.getByTestId('quiz-start').click()
  await expect(page.locator('[data-testid^="quiz-option-"]')).toHaveCount(4)

  // 点击正确项 → 计正确 1
  await page.locator('[data-testid^="quiz-option-"][data-correct="true"]').click()
  await expect(page.getByTestId('quiz-score')).toContainText('对 1')

  // 下一题 → 新题面出现
  await page.getByTestId('quiz-next').click()
  await expect(page.locator('[data-testid^="quiz-option-"]')).toHaveCount(4)

  // 点击错误项 → 计错误 1
  await page.locator('[data-testid^="quiz-option-"][data-correct="false"]').first().click()
  await expect(page.getByTestId('quiz-score')).toContainText('错 1')
})

test('Echo 回发：播放后自动进入复述，手动评分给出差异反馈', async ({ page }) => {
  await page.goto('/#/challenge')
  await page.getByTestId('tab-echo').click()

  await page.getByTestId('echo-start').click()
  // 播放结束自动开始复述会话（默认 15 WPM，播放 ≤ 3s，留足余量）
  await expect(page.getByTestId('echo-running')).toBeVisible({ timeout: 15000 })

  // 不发内容直接评分 → 判定不正确
  await page.getByTestId('echo-grade').click()
  await expect(page.getByTestId('echo-feedback')).toContainText('✗')

  // 下一轮 → 再次自动进入复述
  await page.getByTestId('echo-next').click()
  await expect(page.getByTestId('echo-running')).toBeVisible({ timeout: 15000 })
})

test('QSB 衰落开关可切换', async ({ page }) => {
  await page.goto('/#/challenge')
  const toggle = page.getByTestId('qsb-toggle')
  await toggle.check()
  await expect(toggle).toBeChecked()
  await toggle.uncheck()
  await expect(toggle).not.toBeChecked()
})
