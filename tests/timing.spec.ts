import { describe, expect, it } from 'vitest'
import {
  charBoundaryMs,
  classifySymbol,
  ditMs,
  isAccurate,
  spacing,
  symbolDurations,
  wordBoundaryMs,
} from '@/core/morse/timing'

describe('timing', () => {
  it('ditMs 符合 PARIS 标准', () => {
    expect(ditMs(20)).toBe(60)
    expect(ditMs(15)).toBe(80)
    expect(ditMs(10)).toBe(120)
  })

  it('标准间隔（无 Farnsworth）为 1/3/7 Td', () => {
    expect(spacing(20, 20)).toEqual({ intraMs: 60, interCharMs: 180, wordMs: 420 })
    expect(spacing(20)).toEqual({ intraMs: 60, interCharMs: 180, wordMs: 420 })
  })

  it('Farnsworth：PARIS 整词时长符合有效速度', () => {
    // c=20, s=10：PARIS（50 单位）应占 6 秒
    const sp = spacing(20, 10)
    const lettersMs = 31 * 60 // PARIS 字符本体 31 单位
    const total = lettersMs + 4 * sp.interCharMs + sp.wordMs
    expect(Math.abs(total - 6000)).toBeLessThan(1)
    // 间隔比例保持 3:7
    const stdInter = 3 * 60
    const stdWord = 7 * 60
    expect((sp.interCharMs - stdInter) / (sp.wordMs - stdWord)).toBeCloseTo(3 / 7, 5)
  })

  it('Farnsworth：有效速度不低于字符速度时回落标准间隔', () => {
    expect(spacing(20, 25)).toEqual(spacing(20, 20))
  })

  it('符号分类边界 2Td', () => {
    expect(classifySymbol(119, 20)).toBe('dit')
    expect(classifySymbol(121, 20)).toBe('dah')
    expect(classifySymbol(60, 20)).toBe('dit')
    expect(classifySymbol(180, 20)).toBe('dah')
  })

  it('节奏判定容差', () => {
    expect(isAccurate(60, 'dit', 20, 20)).toBe(true)
    expect(isAccurate(48, 'dit', 20, 20)).toBe(true) // 恰好 -20%
    expect(isAccurate(47, 'dit', 20, 20)).toBe(false)
    expect(isAccurate(72, 'dit', 20, 20)).toBe(true) // 恰好 +20%
    expect(isAccurate(73, 'dit', 20, 20)).toBe(false)
    expect(isAccurate(180, 'dah', 20, 25)).toBe(true)
  })

  it('symbolDurations 输出各符号按下时长', () => {
    expect(symbolDurations('.--', 20)).toEqual([60, 180, 180])
  })

  it('解码阈值', () => {
    expect(charBoundaryMs(20)).toBe(120)
    expect(wordBoundaryMs(20)).toBe(300)
  })
})
