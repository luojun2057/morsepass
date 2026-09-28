import { describe, expect, it } from 'vitest'
import {
  MORSE_TABLE,
  charToMorse,
  morseToChar,
  normalizeText,
  textToCharCodes,
  toDisplayCase,
} from '@/core/morse/codec'

describe('codec', () => {
  it('单字符编码（大小写不敏感）', () => {
    expect(charToMorse('a')).toBe('.-')
    expect(charToMorse('S')).toBe('...')
    expect(charToMorse('5')).toBe('.....')
    expect(charToMorse('?')).toBe('..--..')
  })

  it('未收录字符返回 undefined', () => {
    expect(charToMorse('#')).toBeUndefined()
    expect(charToMorse('')).toBeUndefined()
    expect(charToMorse('AB')).toBeUndefined()
  })

  it('全表编码回转（char → morse → char）', () => {
    for (const [ch, code] of Object.entries(MORSE_TABLE)) {
      expect(morseToChar(code)).toBe(ch)
      expect(charToMorse(ch)).toBe(code)
    }
  })

  it('textToCharCodes 跳过未收录字符并转大写', () => {
    expect(textToCharCodes('a1!')).toEqual([
      { char: 'A', morse: '.-' },
      { char: '1', morse: '.----' },
      { char: '!', morse: '-.-.--' },
    ])
    expect(textToCharCodes('#x')).toEqual([{ char: 'X', morse: '-..-' }])
    expect(textToCharCodes('')).toEqual([])
  })

  it('normalizeText 转大写并压缩空白', () => {
    expect(normalizeText('  cq   de  ba1aa ')).toBe('CQ DE BA1AA')
    expect(normalizeText('\tSOS\n')).toBe('SOS')
  })

  it('toDisplayCase 按偏好输出', () => {
    expect(toDisplayCase('ABC', 'lower')).toBe('abc')
    expect(toDisplayCase('abc', 'upper')).toBe('ABC')
  })
})
