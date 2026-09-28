import { describe, expect, it } from 'vitest'
import {
  compareByWords,
  compareText,
  lcsLength,
  weakCharsFromCompare,
} from '@/core/practice/compare'

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

describe('compareByWords 词级比对', () => {
  it('strict 呼号按组验证：错一组只标记该组', () => {
    const r = compareByWords('BG9ABC BG9XYZ BA1AA', 'bg9abc bg9abd ba1aa', 'strict')
    expect(r.items.map((i) => i.kind)).toEqual(['match', 'wrong', 'match'])
    expect(r.correct).toBe(2)
    expect(r.total).toBe(3)
    expect(r.accuracyPct).toBe(66.7)
    expect(r.items[1].got).toBe('BG9ABD')
    expect(r.items[1].similarity).toBeLessThan(1)
  })

  it('strict 漏发连续多组各标记 missed，不影响前后组', () => {
    const r = compareByWords('AAA BBB CCC DDD EEE', 'aaa bbb eee', 'strict')
    expect(r.items.map((i) => i.kind)).toEqual(['match', 'match', 'missed', 'missed', 'match'])
    expect(r.items[2].expected).toBe('CCC')
    expect(r.items[3].expected).toBe('DDD')
    expect(r.correct).toBe(3)
    expect(r.extraWords).toHaveLength(0)
  })

  it('strict 多发的组进入 extraWords', () => {
    const r = compareByWords('AA CC', 'aa xx cc', 'strict')
    expect(r.items.map((i) => i.kind)).toEqual(['match', 'match'])
    expect(r.extraWords).toEqual(['XX'])
  })

  it('strict 词内小错不算对（全等才匹配）', () => {
    const r = compareByWords('HELLO', 'HELO', 'strict')
    expect(r.items[0].kind).toBe('wrong')
    expect(r.correct).toBe(0)
  })

  it('fuzzy 文章模式：词内小错仍可配对，连续对上标为大块', () => {
    const r = compareByWords('THE QUICK BROWN FOX JUMPS', 'the quick brwon fox jumps', 'fuzzy')
    expect(r.items.map((i) => i.kind)).toEqual(['match', 'match', 'match', 'match', 'match'])
    expect(r.correct).toBe(5)
    expect(r.items.every((i) => i.block)).toBe(true) // 5 词连续 → 全部大块
  })

  it('fuzzy 大块只标连续 ≥2 的匹配段', () => {
    const r = compareByWords('AAA BBB CCC DDD EEE', 'aaa bbb ccc eee', 'fuzzy')
    expect(r.items.map((i) => i.kind)).toEqual(['match', 'match', 'match', 'missed', 'match'])
    expect(r.items[0].block).toBe(true)
    expect(r.items[1].block).toBe(true)
    expect(r.items[2].block).toBe(true)
    expect(r.items[4].block).toBe(false) // 孤立单词匹配不算大块
  })

  it('fuzzy 相似度阈值边界', () => {
    // sim(ABC,ABX) = 2/3 ≈ 0.67 ≥ 0.6 → 配对
    const a = compareByWords('ABC', 'abx', 'fuzzy')
    expect(a.items[0].kind).toBe('match')
    // sim(AB,AX) = 1/2 = 0.5 < 0.6 → 不配对，成 wrong
    const b = compareByWords('AB', 'ax', 'fuzzy')
    expect(b.items[0].kind).toBe('wrong')
  })

  it('空输入返回 total=0 且正确率为 null', () => {
    const r = compareByWords('', '', 'strict')
    expect(r.total).toBe(0)
    expect(r.accuracyPct).toBeNull()
    expect(r.items).toHaveLength(0)
  })

  it('lcsLength 基本性质', () => {
    expect(lcsLength('BROWN', 'BRWON')).toBe(4)
    expect(lcsLength('ABC', 'ABC')).toBe(3)
    expect(lcsLength('ABC', 'XYZ')).toBe(0)
    expect(lcsLength('', 'ABC')).toBe(0)
  })
})
