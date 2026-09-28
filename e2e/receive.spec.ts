import { test, expect } from '@playwright/test'

/**
 * 听抄页 E2E：素材输入 → 实时比对 → 保存；播放调度冒烟（不等待完整播放）。
 */

test('听抄：输入与素材实时比对，正确率与错字提示', async ({ page }) => {
  await page.goto('/#/receive')

  await page.getByTestId('material-input').fill('PARIS')

  // 完全正确 → 100%
  await page.getByTestId('copy-input').fill('PARIS')
  await expect(page.getByTestId('receive-accuracy')).toHaveText('100%')

  // 抄错一个字符 → 正确率下降，出现错字标记
  await page.getByTestId('copy-input').fill('PARIX')
  await expect(page.getByTestId('receive-accuracy')).not.toHaveText('100%')

  // 结束并保存 → 出现保存提示
  await page.getByRole('button', { name: '结束并保存' }).click()
  await expect(page.getByText('已保存到练习历史')).toBeVisible()
})

test('听抄：播放调度冒烟（开始/停止不抛错）', async ({ page }) => {
  await page.goto('/#/receive')

  await page.getByTestId('material-input').fill('E')
  await page.getByTestId('play-btn').click()
  // playing=true 后按钮文案切换
  await expect(page.getByTestId('play-btn')).toHaveText('停止播放')

  await page.getByTestId('play-btn').click()
  await expect(page.getByTestId('play-btn')).toHaveText('播放摩尔斯码')
})
