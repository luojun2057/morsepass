import { describe, expect, it } from 'vitest'
import {
  buildTimeline,
  compressIdleGaps,
  computeTimelineWindow,
  mapRealTime,
  timelineWindowMs,
} from '@/core/morse/timeline'

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

describe('compressIdleGaps（空闲间隙压缩）', () => {
  const rec = (t: number, durationMs: number) => ({ t, durationMs, sym: 'dit' as const })

  it('无空闲：映射为恒等', () => {
    const recs = [rec(100, 60), rec(220, 60), rec(340, 60)]
    const { mapped, compressed } = compressIdleGaps(recs)
    expect(mapped.map((r) => r.t)).toEqual([100, 220, 340])
    expect(compressed).toEqual([])
  })

  it('3s 内空闲不压缩', () => {
    const recs = [rec(100, 60), rec(3000, 60)] // 间隙 2840ms < 3000
    const { mapped, compressed } = compressIdleGaps(recs)
    expect(compressed).toEqual([])
    expect(mapped.map((r) => r.t)).toEqual([100, 3000])
  })

  it('超过 3s 空闲压缩为 600ms，后续记录整体前移', () => {
    // 点(60ms，抬起于 100) → 空闲 10040ms → 又一个点：压缩后间隙显示为 600ms
    const recs = [rec(100, 60), rec(10200, 60)]
    const { mapped, compressed } = compressIdleGaps(recs)
    expect(compressed).toEqual([{ from: 100, to: 10140 }])
    // 第一条不变；第二条前移 (10140-100-600) = 9440ms
    expect(mapped[0].t).toBe(100)
    expect(mapped[1].t).toBe(10200 - 9440)
    // 压缩后条间间隙 = keepMs
    expect(mapped[1].t - mapped[1].durationMs - mapped[0].t).toBe(600)
  })

  it('多次空闲压缩累加', () => {
    const recs = [rec(100, 60), rec(11_000, 60), rec(22_000, 60)]
    const { mapped, compressed } = compressIdleGaps(recs)
    expect(compressed.length).toBe(2)
    // 每次前移不同量，第二条与第三条都左移
    expect(mapped[1].t).toBeLessThan(11_000)
    expect(mapped[2].t).toBeLessThan(mapped[1].t + 11_000)
  })

  it('携带额外字段原样保留（sym/accurate 等）', () => {
    const recs = [{ t: 100, durationMs: 60, sym: 'dah' as const, accurate: true }]
    const { mapped } = compressIdleGaps(recs)
    expect(mapped[0]).toMatchObject({ t: 100, durationMs: 60, sym: 'dah', accurate: true })
  })
})

describe('mapRealTime（真实时间 → 显示时间）', () => {
  const compressed = [{ from: 1000, to: 5000 }]

  it('压缩区间内返回 null（网格线跳过）', () => {
    expect(mapRealTime(3000, compressed)).toBeNull()
  })

  it('区间前恒等，区间后减去压缩量', () => {
    expect(mapRealTime(500, compressed)).toBe(500)
    // 5000 之后映射：减去 (5000-1000-600)=3400
    expect(mapRealTime(6000, compressed)).toBe(6000 - 3400)
  })

  it('无压缩时恒等', () => {
    expect(mapRealTime(1234, [])).toBe(1234)
  })
})

describe('timelineWindowMs（窗口按点长自适应）', () => {
  it('20WPM：窗口 140Td=8.4s，尾部 25Td=1.5s', () => {
    expect(timelineWindowMs(20)).toEqual({ windowMs: 8400, tailMs: 1500 })
  })

  it('40WPM：窗口收窄到 4.2s → 画布分辨率翻倍，间隙像素占比恒定', () => {
    expect(timelineWindowMs(40)).toEqual({ windowMs: 4200, tailMs: 750 })
  })

  it('10WPM：窗口放宽到 16.8s', () => {
    expect(timelineWindowMs(10)).toEqual({ windowMs: 16800, tailMs: 3000 })
  })
})

describe('computeTimelineWindow', () => {
  it('无记录：窗口 [0, tail]', () => {
    const w = computeTimelineWindow([], 10_000, 1_500)
    expect(w.startMs).toBe(0)
    expect(w.endMs).toBe(1_500)
  })

  it('少量输入：窗口从 0 起到最后符号抬起时刻 + 留白（t 即抬起时刻）', () => {
    const w = computeTimelineWindow([{ t: 5000, durationMs: 100 }], 10_000, 1_500)
    expect(w.endMs).toBe(5000 + 1_500)
    expect(w.startMs).toBe(0)
  })

  it('输入超出窗口：右端跟随最后符号抬起，左端裁剪', () => {
    const w = computeTimelineWindow([{ t: 50_000, durationMs: 100 }], 10_000, 1_500)
    expect(w.endMs).toBe(51_500)
    expect(w.startMs).toBe(41_500)
  })

  it('冻结语义：窗口只由记录决定，与当前时间无关（两次调用结果一致）', () => {
    const recs = [
      { t: 1000, durationMs: 80 },
      { t: 2000, durationMs: 240 },
    ]
    const w1 = computeTimelineWindow(recs, 10_000, 1_500)
    const w2 = computeTimelineWindow(recs, 10_000, 1_500)
    expect(w1).toEqual(w2)
    // 停止输入后窗口不再滚动：end 停在最后符号抬起时刻 + 留白
    expect(w1.endMs).toBe(2000 + 1_500)
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
    expect(w.endMs).toBe(600)
    expect(w.startMs).toBe(0)
  })
})
