import { describe, expect, it } from 'vitest'
import { SessionStats } from '@/core/practice/stats'

describe('SessionStats', () => {
  it('整场累计正确率（非滑动窗口）', () => {
    const s = new SessionStats()
    s.start(0)
    // 8 对 2 错 → 整场 80%
    for (let i = 0; i < 8; i++) s.addChar('A', true)
    s.addChar('B', false)
    s.addChar('C', false)
    const snap = s.snapshot(10_000)
    expect(snap.charsTotal).toBe(10)
    expect(snap.charsCorrect).toBe(8)
    expect(snap.accuracyPct).toBe(80)
    expect(snap.durationMs).toBe(10_000)
  })

  it('近 10 符滑动窗口与整场符号准确率相互独立', () => {
    const s = new SessionStats()
    s.start(0)
    for (let i = 0; i < 8; i++) s.addSymbol('dit', 60, true, 20)
    for (let i = 0; i < 6; i++) s.addSymbol('dit', 100, false, 20)
    const snap = s.snapshot(1000)
    expect(snap.symbolAccuracyPct).toBeCloseTo((8 / 14) * 100, 1) // 整场 57.1
    expect(snap.rollingAccuracyPct).toBe(40) // 近 10 个 = 2 对 8 错
  })

  it('弱项字符：正确率 < 80% 的字符列出并按错误率排序', () => {
    const s = new SessionStats()
    s.start(0)
    for (let i = 0; i < 3; i++) s.addChar('E', i === 0) // E: 1/3 ≈ 33%
    for (let i = 0; i < 5; i++) s.addChar('T', true) // T: 100%
    s.addChar('A', false) // A: 0/1 = 0%
    s.addChar('A', false)
    const snap = s.snapshot(100)
    expect(snap.weakChars.map((w) => w.ch)).toEqual(['A', 'E'])
    expect(snap.weakChars[0]).toEqual({ ch: 'A', correct: 0, total: 2 })
  })

  it('实时速度按 5 字符=1 词折算', () => {
    const s = new SessionStats()
    s.start(0)
    for (let i = 0; i < 10; i++) s.addChar('E', true)
    const snap = s.snapshot(60_000) // 10 字符 / 60 秒
    expect(snap.liveWpm).toBe(2) // 2 词/分钟
  })

  it('addSymbol 记录相对偏差', () => {
    const s = new SessionStats()
    s.start(0)
    s.addSymbol('dah', 240, true, 20) // 期望 180，偏差 +33.3%
    const snap = s.snapshot(1)
    // 偏差不直接进快照，通过 analyzeRhythm 使用；此处只验证不抛错与计数
    expect(snap.symbolAccuracyPct).toBe(100)
  })

  it('analyzeRhythm 识别点偏短与节奏稳定', () => {
    const s = new SessionStats()
    s.start(0)
    for (let i = 0; i < 6; i++) s.addSymbol('dit', 35, false, 20) // 期望 60 → 偏短
    const hints = s.analyzeRhythm(20)
    expect(hints.some((h) => h.includes('点普遍偏短'))).toBe(true)

    const s2 = new SessionStats()
    s2.start(0)
    for (let i = 0; i < 6; i++) s2.addSymbol('dit', 60, true, 20)
    expect(s2.analyzeRhythm(20).some((h) => h.includes('节奏很稳'))).toBe(true)
  })

  it('end 后时长冻结，未开始时快照安全', () => {
    const s = new SessionStats()
    expect(s.snapshot()).toEqual({
      durationMs: 0,
      charsTotal: 0,
      charsCorrect: 0,
      accuracyPct: null,
      symbolAccuracyPct: null,
      rollingAccuracyPct: null,
      liveWpm: null,
      weakChars: [],
    })
    s.start(100)
    s.end(500)
    expect(s.snapshot(999_999).durationMs).toBe(400)
  })
})
