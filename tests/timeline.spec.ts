import { describe, expect, it } from 'vitest'
import { buildTimeline } from '@/core/morse/timeline'

describe('buildTimeline', () => {
  it('标准时序：ET 同词内字符间隙', () => {
    const tl = buildTimeline('ET', 20, 20)
    // E=.: on 0-60；字符间 180；T=-: on 240-420；再 +180 收尾
    expect(tl.events).toEqual([
      { t: 0, on: true },
      { t: 60, on: false },
      { t: 240, on: true },
      { t: 420, on: false },
    ])
    expect(tl.charSpans.map((c) => c.char)).toEqual(['E', 'T'])
    expect(tl.charSpans[1].startMs).toBe(240)
    expect(tl.totalMs).toBe(600)
  })

  it('多个连续字符含字符内间隔', () => {
    const tl = buildTimeline('K', 20, 20)
    // K=-.-: on 0-180, intra 60, on 240-300, intra 60, on 360-540
    expect(tl.events).toEqual([
      { t: 0, on: true },
      { t: 180, on: false },
      { t: 240, on: true },
      { t: 300, on: false },
      { t: 360, on: true },
      { t: 540, on: false },
    ])
    expect(tl.totalMs).toBe(720) // + 字符间 180
  })

  it('单词间使用 wordMs 而非 interCharMs', () => {
    const sp = { inter: 180, word: 420 }
    const tl = buildTimeline('E E', 20, 20)
    // E: on 0-60, inter 180 → E: on 240-300, inter 180 → total 480+?
    // 两个词：词2开始 = 60 + word 420 = 480；结束 = 480 + 60 + inter 180 = 720
    expect(tl.events[2]).toEqual({ t: 480, on: true })
    expect(tl.totalMs).toBe(480 + 60 + sp.inter)
    expect(tl.totalMs).toBe(720)
    expect(tl.events.every((e) => e.t !== 240)).toBe(true) // 不再是字符间隙
  })

  it('Farnsworth 间隔拉长', () => {
    const tl = buildTimeline('E T', 20, 10)
    const gap = tl.charSpans[1].startMs - 60
    expect(gap).toBeGreaterThan(180) // 明显大于标准字符间
    // 整词时长仍符合有效速度约束（见 timing.spec 的 PARIS 验证）
  })

  it('未收录字符跳过', () => {
    const tl = buildTimeline('E#T', 20, 20)
    expect(tl.charSpans.map((c) => c.char)).toEqual(['E', 'T'])
  })

  it('空文本安全', () => {
    const tl = buildTimeline('  ', 20, 20)
    expect(tl.events).toEqual([])
    expect(tl.charSpans).toEqual([])
    expect(tl.totalMs).toBe(0)
  })
})
