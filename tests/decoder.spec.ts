import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MorseDecoder, type MorseDecoderEvents } from '@/core/morse/decoder'

function makeCollector() {
  const events = {
    chars: [] as string[],
    wordSeps: 0,
    symbols: [] as { sym: 'dit' | 'dah'; durationMs: number; accurate: boolean }[],
    pending: [] as string[],
  }
  const handlers: MorseDecoderEvents = {
    onChar: (c) => events.chars.push(c),
    onWordSeparator: () => events.wordSeps++,
    onSymbol: (sym, durationMs, accurate, idx) => {
      // 按 pressIndex 覆盖存储（弹跳合并后重发修正记录 → last write wins）
      events.symbols[idx] = { sym, durationMs, accurate }
    },
    onSymbolsChange: (s) => events.pending.push(s),
  }
  return { events, handlers }
}

/**
 * 以 wpm=20（Td=60ms）发送一个字符（字符内间隔 1Td），返回最后一个符号的抬起时间戳。
 * 注意：合成时间戳与 vitest 假时钟相互独立，只用于计算按压/间隙时长。
 */
function sendChar(d: MorseDecoder, morse: string, t: number): number {
  let ts = t
  for (const c of morse) {
    const dur = c === '-' ? 180 : 60
    d.down(ts)
    d.up(ts + dur)
    ts += dur + 60
  }
  return ts - 60
}

/** 模拟 3Td 字符间隙的真实时间流逝：字符先提交，单词计时器保持挂起（还差 120ms） */
function charGap20(): void {
  vi.advanceTimersByTime(120) // 2Td → 字符提交
  vi.advanceTimersByTime(60) // 3Td 间隙剩余 60ms
}

/** 模拟 ≥5Td 单词间隙：字符提交后单词分隔触发 */
function wordGap20(): void {
  vi.advanceTimersByTime(120)
  vi.advanceTimersByTime(180)
}

describe('MorseDecoder', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('解码 SOS 并在词尾发出单词分隔', () => {
    const { events, handlers } = makeCollector()
    const d = new MorseDecoder(handlers, { wpm: 20, tolerancePct: 20 })

    let t = 0
    t = sendChar(d, '...', t) + 180
    charGap20()
    t = sendChar(d, '---', t) + 180
    charGap20()
    sendChar(d, '...', t)
    wordGap20()

    expect(events.chars).toEqual(['S', 'O', 'S'])
    expect(events.wordSeps).toBe(1)
    expect(events.symbols).toHaveLength(9)
    expect(events.symbols.every((s) => s.accurate)).toBe(true)
  })

  it('超差符号标记不准确', () => {
    const { events, handlers } = makeCollector()
    const d = new MorseDecoder(handlers, { wpm: 20, tolerancePct: 20 })
    d.down(0)
    d.up(100) // 期望点 60ms，偏差 66% 超容差
    expect(events.symbols[0].accurate).toBe(false)
    expect(events.symbols[0].sym).toBe('dit')
  })

  it('过短按压（噪声）被丢弃', () => {
    const { events, handlers } = makeCollector()
    const d = new MorseDecoder(handlers, { wpm: 20, tolerancePct: 20 })
    d.down(0)
    d.up(3) // < 5ms 去抖
    d.down(50)
    d.up(110)
    vi.advanceTimersByTime(120)
    expect(events.symbols).toHaveLength(1)
    expect(events.chars).toEqual(['E'])
  })

  it('触点弹跳：debounce 窗口内再次按下合并回上次按压', () => {
    const { events, handlers } = makeCollector()
    const d = new MorseDecoder(handlers, { wpm: 20, tolerancePct: 20 })
    d.down(0)
    d.up(60) // 一个点，临时符号 "."
    expect(events.pending[events.pending.length - 1]).toBe('.')
    d.down(63) // 3ms 后弹跳 → 收回临时符号
    expect(events.pending[events.pending.length - 1]).toBe('')
    d.up(124) // 合并后总时长 124ms ≥ 2Td → 划
    vi.advanceTimersByTime(120)
    expect(events.chars).toEqual(['T'])
    expect(events.symbols).toHaveLength(1)
    expect(events.symbols[0].sym).toBe('dah')
  })

  it('未收录序列提交空字符', () => {
    const { events, handlers } = makeCollector()
    const d = new MorseDecoder(handlers, { wpm: 20, tolerancePct: 20 })
    let t = 0
    t = sendChar(d, '..--', t) + 180
    charGap20() // 提交 ''（..-- 不在码表）
    sendChar(d, '.', t)
    charGap20() // 提交 E
    expect(events.chars).toEqual(['', 'E'])
  })

  it('flush 立即提交未决字符', () => {
    const { events, handlers } = makeCollector()
    const d = new MorseDecoder(handlers, { wpm: 20, tolerancePct: 20 })
    d.down(0)
    d.up(60)
    expect(events.chars).toHaveLength(0)
    d.flush()
    expect(events.chars).toEqual(['E'])
  })

  it('reset 清空状态不发事件', () => {
    const { events, handlers } = makeCollector()
    const d = new MorseDecoder(handlers, { wpm: 20, tolerancePct: 20 })
    d.down(0)
    d.up(60)
    d.reset()
    vi.advanceTimersByTime(1000)
    expect(events.chars).toHaveLength(0)
    expect(d.pendingMorse).toBe('')
  })

  it('setTiming 动态调整判定速度', () => {
    const { events, handlers } = makeCollector()
    const d = new MorseDecoder(handlers, { wpm: 20, tolerancePct: 20 })
    d.setTiming(10, 20) // Td=120，点期望 120ms
    d.down(0)
    d.up(100)
    expect(events.symbols[0].accurate).toBe(true)
    vi.advanceTimersByTime(240)
    expect(events.chars).toEqual(['E'])
  })
})
