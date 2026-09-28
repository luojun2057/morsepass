import { describe, expect, it } from 'vitest'
import { compareText, weakCharsFromCompare } from '@/core/practice/compare'

describe('compareText', () => {
  it('完全正确', () => {
    const r = compareText('PARIS', 'paris') // 大小写归一
    expect(r.correct).toBe(5)
    expect(r.total).toBe(5)
    expect(r.accuracyPct).toBe(100)
    expect(r.extraCount).toBe(0)
    expect(r.items.every((i) => i.kind === 'match')).toBe(true)
  })

  it('漏抄', () => {
    const r = compareText('PARIS', 'PARS')
    expect(r.correct).toBe(4)
    expect(r.accuracyPct).toBe(80)
    const missed = r.items.filter((i) => i.kind === 'missed')
    expect(missed).toHaveLength(1)
    expect(missed[0].expected).toBe('I')
  })

  it('多余输入合并为 extra 组', () => {
    const r = compareText('PAR', 'PARXYZ')
    expect(r.correct).toBe(3)
    expect(r.accuracyPct).toBe(100)
    expect(r.extraCount).toBe(3)
    const extras = r.items.filter((i) => i.kind === 'extra')
    expect(extras).toHaveLength(1)
    expect(extras[0].count).toBe(3)
    expect(extras[0].got).toBe('XYZ')
  })

  it('错字（替换）', () => {
    const r = compareText('PARIS', 'PQIS')
    const kinds = r.items.map((i) => i.kind)
    expect(kinds).toContain('wrong')
    expect(kinds).toContain('missed')
    expect(r.correct).toBe(3) // P I S 匹配
    expect(r.accuracyPct).toBe(60)
  })

  it('空输入全为漏抄', () => {
    const r = compareText('E', '')
    expect(r.accuracyPct).toBe(0)
    expect(r.items[0].kind).toBe('missed')
  })

  it('空参考文本返回 null 正确率', () => {
    const r = compareText('', 'ABC')
    expect(r.accuracyPct).toBeNull()
    expect(r.extraCount).toBe(3)
  })

  it('空格参与比对', () => {
    const r = compareText('AB C', 'ABC')
    expect(r.accuracyPct).toBe(75) // 4 个参考字符，漏 1 个空格
    expect(r.items.some((i) => i.kind === 'missed' && i.expected === ' ')).toBe(true)
  })

  it('混合情形：全对但有多余输入', () => {
    const r = compareText('CQ DE K', 'CQ DE KN X')
    expect(r.correct).toBe(7)
    expect(r.accuracyPct).toBe(100)
    expect(r.extraCount).toBe(3)
  })
})

describe('weakCharsFromCompare', () => {
  it('正确率 <80% 的字符进入弱项，空格不计', () => {
    // 'AABBC' vs 'AACCC'：A 全对；两个 B 全错（LCS 把 got 的末位 C 与 ref 的 C 配对成功，
    // 中间的 C C 均与 B 配成错字）→ 仅 B 进入弱项
    const r = compareText('AABBC', 'AACCC')
    expect(weakCharsFromCompare(r)).toEqual([{ ch: 'B', correct: 0, total: 2 }])
  })

  it('空格与空白字符不计入弱项', () => {
    const r = compareText('A B', 'A') // 漏 B 和空格
    const weak = weakCharsFromCompare(r)
    expect(weak.find((w) => w.ch === ' ')).toBeUndefined()
    expect(weak.find((w) => w.ch === 'B')).toBeDefined()
  })

  it('全部正确返回空数组', () => {
    const r = compareText('PARIS', 'paris')
    expect(weakCharsFromCompare(r)).toEqual([])
  })
})
