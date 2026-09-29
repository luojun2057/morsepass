import { describe, expect, it } from 'vitest'
import {
  ATTACK_SEC,
  RELEASE_SEC,
  buildGainSchedule,
  type GainAutomationEvent,
} from '@/core/audio/engine'

/** 便捷断言：包络序列形如 [set0, ramp vol, set vol, ramp 0] 的完整梯形段 */
function expectTrapezoid(seg: GainAutomationEvent[], volume: number, onSec: number, offSec: number, a: number, r: number): void {
  expect(seg.map((e) => e.type)).toEqual(['set', 'ramp', 'set', 'ramp'])
  expect(seg[0].time).toBeCloseTo(onSec, 6)
  expect(seg[0].value).toBeCloseTo(0.0001, 6)
  expect(seg[1].time).toBeCloseTo(onSec + a, 6)
  expect(seg[1].value).toBe(volume)
  expect(seg[2].time).toBeCloseTo(offSec - r, 6)
  expect(seg[2].value).toBe(volume)
  expect(seg[3].time).toBeCloseTo(offSec, 6)
  expect(seg[3].value).toBeCloseTo(0.0001, 6)
}

describe('buildGainSchedule 播放包络（梯形）', () => {
  it('默认参数：attack 5ms / release 6ms', () => {
    expect(ATTACK_SEC).toBe(0.005)
    expect(RELEASE_SEC).toBe(0.006)
  })

  it('单符号：attack → 平台保持 → release，不含全程线性衰减', () => {
    // 点 0-120ms（10WPM）
    const seg = buildGainSchedule(
      [
        { t: 0, on: true },
        { t: 120, on: false },
      ],
      { volume: 0.5 },
    )
    expectTrapezoid(seg, 0.5, 0, 0.12, 0.005, 0.006)
    // 平台确实存在：hold 点早于 release 起点
    expect(seg[2].time).toBeLessThan(seg[3].time)
    expect(seg[2].time).toBeCloseTo(0.12 - 0.006, 6)
  })

  it('连续两符号：各自完整梯形，平台贯穿符号中段', () => {
    // E T：点 0-120ms，字符间隔 120ms，划 240-360ms
    const seg = buildGainSchedule(
      [
        { t: 0, on: true },
        { t: 120, on: false },
        { t: 240, on: true },
        { t: 360, on: false },
      ],
      { volume: 0.8 },
    )
    expect(seg).toHaveLength(8)
    // 时序单调不减
    for (let i = 1; i < seg.length; i++) expect(seg[i].time).toBeGreaterThanOrEqual(seg[i - 1].time)
    expectTrapezoid(seg.slice(0, 4), 0.8, 0, 0.12, 0.005, 0.006)
    expectTrapezoid(seg.slice(4, 8), 0.8, 0.24, 0.36, 0.005, 0.006)
  })

  it('短符号 clamp：过渡不超过符号时长，且保留最小过渡', () => {
    // 5ms 超短符号（模拟极限情况）
    const seg = buildGainSchedule(
      [
        { t: 0, on: true },
        { t: 5, on: false },
      ],
      { volume: 0.5 },
    )
    const a = seg[1].time - seg[0].time
    const r = seg[3].time - seg[2].time
    // 不超过符号本身时长
    expect(a + r).toBeLessThanOrEqual(0.005 + 1e-9)
    // 仍有最小可闻过渡
    expect(a).toBeGreaterThanOrEqual(0.001)
    expect(r).toBeGreaterThanOrEqual(0.002)
  })

  it('未配对的结尾 on：防御性不抛错，off 即 lastT', () => {
    const seg = buildGainSchedule([{ t: 0, on: true }], { volume: 0.4 })
    expect(seg.map((e) => e.type)).toEqual(['set', 'ramp', 'set', 'ramp'])
    expect(seg[3].time).toBe(0)
    expect(seg[3].value).toBeCloseTo(0.0001, 6)
  })

  it('空事件返回空曲线', () => {
    expect(buildGainSchedule([], { volume: 0.5 })).toEqual([])
  })
})
