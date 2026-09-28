import { describe, expect, it } from 'vitest'
import { buildTimeline, computeTimelineWindow } from '@/core/morse/timeline'

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

describe('computeTimelineWindow', () => {
  it('无记录：窗口 [0, tail]', () => {
    const w = computeTimelineWindow([], 10_000, 1_500)
    expect(w.startMs).toBe(0)
    expect(w.endMs).toBe(1_500)
  })

  it('少量输入：窗口从 0 起到最后符号结束 + 留白', () => {
    const w = computeTimelineWindow([{ t: 5000, durationMs: 100 }], 10_000, 1_500)
    expect(w.endMs).toBe(5100 + 1_500)
    expect(w.startMs).toBe(0)
  })

  it('输入超出窗口：右端跟随最后符号，左端裁剪', () => {
    const w = computeTimelineWindow([{ t: 50_000, durationMs: 100 }], 10_000, 1_500)
    expect(w.endMs).toBe(51_600)
    expect(w.startMs).toBe(41_600)
  })

  it('冻结语义：窗口只由记录决定，与当前时间无关（两次调用结果一致）', () => {
    const recs = [
      { t: 1000, durationMs: 80 },
      { t: 2000, durationMs: 240 },
    ]
    const w1 = computeTimelineWindow(recs, 10_000, 1_500)
    const w2 = computeTimelineWindow(recs, 10_000, 1_500)
    expect(w1).toEqual(w2)
    // 停止输入后窗口不再滚动：end 停在最后符号结束 + 留白
    expect(w1.endMs).toBe(2240 + 1_500)
  })

  it('窗口宽度 = windowMs（输入足够多时）', () => {
    const recs = [
      { t: 0, durationMs: 80 },
      { t: 20_000, durationMs: 80 },
    ]
    const w = computeTimelineWindow(recs, 10_000, 1_500)
    expect(w.endMs - w.startMs).toBe(10_000)
  })

  it('自定义 windowMs/tailMs 生效', () => {
    const w = computeTimelineWindow([{ t: 100, durationMs: 100 }], 5_000, 500)
    expect(w.endMs).toBe(700)
    expect(w.startMs).toBe(0)
  })
})
