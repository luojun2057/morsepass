/**
 * 检验：绿/红判定标准 —— 容差内即绿（|实测−期望| ≤ 期望×容差%），按设定 WPM 计算。
 *
 * 用户实验设计：设定 20 WPM（判定基准），用自动键以 21/22/23/24 WPM 的节奏发，
 * 观察绿红。本测试用 MorseDecoder + AutoKeyer 精确复现。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MorseDecoder } from '@/core/morse/decoder'
import { AutoKeyer, elDurationMs } from '@/core/keyer/auto'
import { ditMs, isAccurate } from '@/core/morse/timing'

interface Sym {
  sym: 'dit' | 'dah'
  durationMs: number
  accurate: boolean
}

function makeDecoder(wpm: number, tol: number) {
  const syms: Sym[] = []
  const d = new MorseDecoder(
    {
      onChar: () => {},
      onWordSeparator: () => {},
      onSymbolsChange: () => {},
      onSymbol: (sym, durationMs, accurate) => syms.push({ sym, durationMs, accurate }),
    },
    { wpm, tolerancePct: tol },
  )
  return { d, syms }
}

describe('实验 1：设定 20 WPM，手动模拟 21~24 WPM 节奏（判定基准 = 设定值）', () => {
  const cases = [21, 22, 23, 24, 25]
  for (const wpm of cases) {
    it(`${wpm} WPM 节奏 vs 20 WPM 判定（Td=${ditMs(wpm).toFixed(1)}ms）`, () => {
      const tol = 25
      const Td = 1200 / wpm
      const { d, syms } = makeDecoder(20, tol)
      // 发 5 组 "di-dah"（A），节奏严格按 wpm：dit=Td, gap=Td, dah=3Td, 字符间隔 3Td
      let t = 0
      for (let i = 0; i < 5; i++) {
        d.down(t)
        d.up(t + Td) // dit
        t += Td + Td // 元素间隙 1Td
        d.down(t)
        d.up(t + 3 * Td) // dah
        t += 3 * Td + 3 * ditMs(20) // 字符间隔 3Td(设定)
      }
      const allGreen = syms.every((s) => s.accurate)
      const devs = syms.map((s) => ((s.durationMs - elDurationMs(s.sym, 20)) / elDurationMs(s.sym, 20)) * 100)
      console.log(
        `${wpm} WPM: ${syms.filter((s) => s.accurate).length}/${syms.length} 绿，偏差 ${devs[0].toFixed(1)}%`,
      )
      expect(allGreen).toBe(true) // 25% 容差下 21~25 WPM 均应在容差内
    })
  }

  it('边界定位：偏差恰好 ±25% 时变色（20 WPM → 快于 25 WPM 或慢于 16 WPM 开始变红）', () => {
    // 快侧：26 WPM（Td=46.15，偏差 −23.1%... 实际 = (48−60)/60 = −20%？算：1200/26=46.15，(46.15−60)/60=−23.1%）→ 绿
    expect(isAccurate(1200 / 26, 'dit', 20, 25)).toBe(true)
    expect(isAccurate(1200 / 25, 'dit', 20, 25)).toBe(true) // −20% 恰在容差边界
    expect(isAccurate(1200 / 27, 'dit', 20, 25)).toBe(false) // −25.9% 超差
    // 慢侧：16 WPM（75ms，+25% 恰在边界）→ 绿；15.5 WPM → 红
    expect(isAccurate(1200 / 16, 'dit', 20, 25)).toBe(true)
    expect(isAccurate(1200 / 15, 'dit', 20, 25)).toBe(false)
  })
})

describe('实验 2：自动键 @20 WPM 发码，符号应全绿', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function autoKeySession(wpm: number, hold: 'dit' | 'dah', count: number) {
    const { d, syms } = makeDecoder(wpm, 25)
    const k = new AutoKeyer(
      {
        onDown: (now) => d.down(now),
        onUp: (now) => d.up(now),
      },
      { getWpm: () => wpm },
    )
    k.start()
    if (hold === 'dit') {
      k.onDitDown(performance.now())
      // 按住足够长时间让 count 个点发完（点+间隙循环 = 2Td/个）
      vi.advanceTimersByTime((2 * 1200) / wpm * count + 50)
      k.onDitUp()
    } else {
      k.onDahDown(performance.now())
      vi.advanceTimersByTime((4 * 1200) / wpm * count + 50)
      k.onDahUp()
    }
    vi.advanceTimersByTime(100)
    k.stop()
    return syms
  }

  it('自动键连发点 @20 WPM：全部绿', () => {
    const syms = autoKeySession(20, 'dit', 6)
    expect(syms.length).toBeGreaterThanOrEqual(6)
    const bad = syms.filter((s) => !s.accurate)
    console.log('dit:', syms.map((s) => `${s.durationMs.toFixed(1)}ms${s.accurate ? '绿' : '红'}`).join(' '))
    expect(bad).toEqual([])
  })

  it('自动键连发划 @20 WPM：全部绿', () => {
    const syms = autoKeySession(20, 'dah', 5)
    const bad = syms.filter((s) => !s.accurate)
    console.log('dah:', syms.map((s) => `${s.durationMs.toFixed(1)}ms${s.accurate ? '绿' : '红'}`).join(' '))
    expect(bad).toEqual([])
  })

  it('自动键连发点 @30 WPM（更快）：仍应全绿（keyer 与判定用同一 wpm）', () => {
    const syms = autoKeySession(30, 'dit', 8)
    const bad = syms.filter((s) => !s.accurate)
    console.log('30wpm dit:', syms.map((s) => `${s.durationMs.toFixed(1)}ms${s.accurate ? '绿' : '红'}`).join(' '))
    expect(bad).toEqual([])
  })
})

describe('实验 3：字符正确率的级联效应（疑似「不到 30%」的真实来源）', () => {
  it('符号 80% 绿时，3 符号字符的正确率只有约 51%', () => {
    // 字符正确 = 该字符所有符号均绿。p_char = p_sym^n
    const pSym = 0.8
    expect(pSym ** 3).toBeLessThan(0.52) // 0.512
    const pSym2 = 0.7
    expect(pSym2 ** 3).toBeLessThan(0.35) // 0.343 ≈ 用户看到的「不到 30%」
  })
})
