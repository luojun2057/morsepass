import { describe, expect, it } from 'vitest'
import {
  COMMON_WORDS,
  HAM_ABBREVIATIONS,
  buildQso,
  generateAbbreviations,
  generateCallsign,
  generateCharGroups,
  generateMaterial,
  generateWords,
  mulberry32,
  QSO_TEMPLATES,
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

  it('article 类型生成大段英文文章（词数下限 20）', () => {
    const text = generateMaterial(mulberry32(8), { kind: 'article', count: 40 })
    const words = text.split(' ')
    expect(words).toHaveLength(40)
    for (const w of words) expect(COMMON_WORDS).toContain(w)
    // 同种子复现
    expect(generateMaterial(mulberry32(8), { kind: 'article', count: 40 })).toBe(text)
    // 词数下限保护到 20
    const small = generateMaterial(mulberry32(9), { kind: 'article', count: 3 })
    expect(small.split(' ')).toHaveLength(20)
  })

  it('chars 模式支持自定义每组字符数（4 字一组数字）', () => {
    const text = generateMaterial(mulberry32(6), {
      kind: 'chars',
      charSet: '0123456789'.split(''),
      count: 6,
      groupLen: 4,
    })
    const groups = text.split(' ')
    expect(groups).toHaveLength(6)
    for (const g of groups) {
      expect(g).toHaveLength(4)
      expect(/^\d{4}$/.test(g)).toBe(true)
    }
  })
})

describe('QSO 模板', () => {
  it('各模板呼号自动大写去空格', () => {
    expect(buildQso('cq', ' ba1xx ', 'bg9ab')).toBe('CQ CQ CQ DE BA1XX BA1XX K')
    expect(buildQso('answer', 'BA1XX', 'BG9AB')).toBe('BG9AB DE BA1XX BG9AB DE BA1XX R K')
    expect(buildQso('report', 'BA1XX', 'BG9AB')).toBe('BG9AB DE BA1XX R UR RST 599 599 5NN K')
    expect(buildQso('qsl', 'BA1XX', 'BG9AB')).toBe('BG9AB DE BA1XX TNX FER QSO 73 ES CUL SK')
  })

  it('呼号缺省时使用占位呼号', () => {
    expect(buildQso('cq', '', '')).toBe('CQ CQ CQ DE BA1XXX BA1XXX K')
    expect(buildQso('info', '', 'BG9AB')).toContain('DE BA1XXX')
  })

  it('未知模板 id 返回 null，generateMaterial qso 路由可用', () => {
    expect(buildQso('nope', 'BA1XX', 'BG9AB')).toBeNull()
    expect(generateMaterial(mulberry32(1), { kind: 'qso', count: 1, qsoId: 'cq', callsign: 'BA1XX', peer: 'BG9AB' })).toBe(
      'CQ CQ CQ DE BA1XX BA1XX K',
    )
    expect(QSO_TEMPLATES.length).toBeGreaterThanOrEqual(5)
  })
})
