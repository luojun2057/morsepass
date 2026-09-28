import { describe, expect, it } from 'vitest'
import {
  COMMON_WORDS,
  HAM_ABBREVIATIONS,
  generateAbbreviations,
  generateCallsign,
  generateCharGroups,
  generateMaterial,
  generateWords,
  mulberry32,
} from '@/core/practice/material'

describe('material', () => {
  it('mulberry32 同种子序列一致', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a()]
    const seqB = [b(), b(), b()]
    expect(seqA).toEqual(seqB)
    expect(seqA.every((v) => v >= 0 && v < 1)).toBe(true)
  })

  it('字符组只使用给定字符集且组数正确', () => {
    const rng = mulberry32(7)
    const text = generateCharGroups(rng, ['K', 'M', 'R'], 6, 5)
    const groups = text.split(' ')
    expect(groups).toHaveLength(6)
    for (const g of groups) {
      expect(g).toHaveLength(5)
      for (const ch of g) expect(['K', 'M', 'R']).toContain(ch)
    }
  })

  it('单词生成全部来自词表', () => {
    const rng = mulberry32(11)
    const text = generateWords(rng, 20)
    const words = text.split(' ')
    expect(words).toHaveLength(20)
    for (const w of words) expect(COMMON_WORDS).toContain(w)
  })

  it('呼号格式为 前缀+数字+1~3位后缀', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 50; i++) {
      const call = generateCallsign(rng)
      expect(call).toMatch(/^[A-Z0-9]+\d[A-Z]{1,3}$/)
    }
  })

  it('缩写生成全部来自 Q码表', () => {
    const rng = mulberry32(5)
    const text = generateAbbreviations(rng, 15)
    for (const w of text.split(' ')) expect(HAM_ABBREVIATIONS).toContain(w)
  })

  it('generateMaterial 各类型可复现（同种子同输出）', () => {
    const opts = [
      { kind: 'chars' as const, charSet: ['K', 'M'], count: 4 },
      { kind: 'words' as const, count: 8 },
      { kind: 'callsigns' as const, count: 5 },
      { kind: 'abbreviations' as const, count: 6 },
      { kind: 'mixed' as const, count: 6 },
      { kind: 'text' as const, count: 1, text: 'CQ CQ DE BA1AA' },
    ]
    for (const o of opts) {
      const r1 = generateMaterial(mulberry32(99), o)
      const r2 = generateMaterial(mulberry32(99), o)
      expect(r1).toBe(r2)
      expect(r1.length).toBeGreaterThan(0)
    }
    expect(generateMaterial(mulberry32(1), { kind: 'text', count: 1, text: 'SOS' })).toBe('SOS')
  })

  it('generateMaterial count 下限保护', () => {
    const rng = mulberry32(2)
    expect(generateCharGroups(rng, ['E', 'T'], 0).split(' ')).toHaveLength(1)
  })
})
