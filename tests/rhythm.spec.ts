/**
 * 节奏问题分类汇总测试：点/划/间隔各自太长太短的统计。
 */
import { describe, expect, it } from 'vitest'
import { analyzeRhythmIssues, type RhythmSourceRecord } from '@/core/practice/rhythm'

/** 20WPM：Td=60ms，点 60，划 180，字符内间隔 60，字符间隔 180，单词间隔 420 */
const WPM = 20
const TOL = 20

function rec(sym: 'dit' | 'dah', start: number, durationMs: number): RhythmSourceRecord {
  return { sym, durationMs, t: start + durationMs }
}

describe('analyzeRhythmIssues', () => {
  it('全部在容差内：无问题', () => {
    // A = 点60 + 间60 + 划180（全部标准）
    const records = [rec('dit', 0, 60), rec('dah', 120, 180)]
    expect(analyzeRhythmIssues(records, WPM, TOL)).toEqual([])
  })

  it('点太短/点太长分别统计，含平均偏差', () => {
    const records = [
      rec('dit', 0, 30), // -50%
      rec('dit', 200, 36), // -40%
      rec('dit', 400, 100), // +66.7%
    ]
    const issues = analyzeRhythmIssues(records, WPM, TOL)
    const short = issues.find((i) => i.kind === 'ditShort')!
    const long = issues.find((i) => i.kind === 'ditLong')!
    expect(short.count).toBe(2)
    expect(short.avgDevPct).toBe(-45) // round((-50-40)/2)
    expect(long.count).toBe(1)
    expect(long.avgDevPct).toBe(67)
  })

  it('划太短/划太长', () => {
    // 两划之间留标准字符内间隔 180ms（dev=0 不干扰）
    const records = [rec('dah', 0, 120), rec('dah', 300, 300)]
    const issues = analyzeRhythmIssues(records, WPM, TOL)
    expect(issues.map((i) => i.kind).sort()).toEqual(['dahLong', 'dahShort'])
  })

  it('字符内间隔（<2Td，期望 1Td）太短/太长', () => {
    // 划结束 180 → 下一点开始 200：间隔 20ms（-66.7%）
    const records = [rec('dah', 0, 180), rec('dit', 200, 60)]
    const issues = analyzeRhythmIssues(records, WPM, TOL)
    const g = issues.find((i) => i.kind === 'elemGapShort')!
    expect(g.count).toBe(1)
    expect(g.avgDevPct).toBe(-67)
  })

  it('字符间隔（2Td~5Td，期望 3Td）太短', () => {
    // 字符间隔期望 180ms；实测 130ms（-27.8%）→ 这是「字母粘连」的典型信号
    const records = [rec('dit', 0, 60), rec('dah', 190, 180)]
    const issues = analyzeRhythmIssues(records, WPM, TOL)
    expect(issues.map((i) => i.kind)).toEqual(['charGapShort'])
    expect(issues[0].count).toBe(1)
    expect(issues[0].avgDevPct).toBe(-28)
  })

  it('单词间隔（≥5Td，期望 7Td）并入字符间隔统计', () => {
    // 期望 420ms；实测 840ms（+100%）
    const records = [rec('dit', 0, 60), rec('dit', 900, 60)]
    const issues = analyzeRhythmIssues(records, WPM, TOL)
    expect(issues.map((i) => i.kind)).toEqual(['charGapLong'])
    expect(issues[0].avgDevPct).toBe(100)
  })

  it('按出错次数降序排列', () => {
    const records = [
      rec('dit', 0, 30),
      rec('dit', 200, 30),
      rec('dit', 400, 30),
      rec('dah', 600, 300),
    ]
    const issues = analyzeRhythmIssues(records, WPM, TOL)
    expect(issues[0].kind).toBe('ditShort')
    expect(issues[0].count).toBe(3)
  })

  it('间隔为负（触点合并重发等异常）跳过', () => {
    // 下一点开始（150ms）早于上一点抬起（160ms），符号本身标准
    const records = [rec('dit', 100, 60), rec('dah', 150, 180)]
    expect(analyzeRhythmIssues(records, WPM, TOL)).toEqual([])
  })

  it('偏差恰好在容差边界（=20%）不算问题', () => {
    const records = [rec('dit', 0, 72)] // +20%
    expect(analyzeRhythmIssues(records, WPM, TOL)).toEqual([])
  })
})
