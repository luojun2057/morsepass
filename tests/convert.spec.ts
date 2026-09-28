import { describe, expect, it } from 'vitest'
import { textToMorse, morseToText, normalizeMorseCode, UNKNOWN_CHAR } from '@/core/morse/convert'
import { MORSE_TABLE, normalizeText } from '@/core/morse/codec'

describe('convert 码表互转', () => {
  it('基础编码：SOS', () => {
    expect(textToMorse('SOS')).toBe('... --- ...')
  })

  it('多词文本用 " / " 分隔单词', () => {
    expect(textToMorse('HI THERE')).toBe('.... .. / - .... . .-. .')
  })

  it('小写与多余空白自动规范化', () => {
    expect(textToMorse('  sos   wea ther ')).toBe('... --- ... / .-- . .- / - .... . .-.')
  })

  it('基础解码', () => {
    expect(morseToText('.... .. / - .... . .-. .')).toBe('HI THERE')
  })

  it('未收录码以 □ 占位', () => {
    expect(morseToText('........ --- ...')).toBe(`${UNKNOWN_CHAR}OS`)
  })

  it('兼容全角点/中点/长划等点划写法', () => {
    expect(normalizeMorseCode('··· −−−')).toBe('... ---')
    expect(morseToText('··· −−−')).toBe('SO')
  })

  it('文本→摩尔斯→文本 往返一致', () => {
    const samples = [
      'SOS',
      'CQ CQ DE BA1XYZ K',
      'THE QUICK BROWN FOX JUMPS OVER THE LAZY DOG 0123456789',
      "WHAT? HELLOWORLD, IT'S - OK!",
    ]
    for (const s of samples) {
      expect(morseToText(textToMorse(s))).toBe(normalizeText(s))
    }
  })

  it('全部码表字符均可在码表互转中往返', () => {
    for (const [ch, morse] of Object.entries(MORSE_TABLE)) {
      expect(textToMorse(ch)).toBe(morse)
      expect(morseToText(morse)).toBe(ch)
    }
  })

  it('空输入返回空串', () => {
    expect(textToMorse('')).toBe('')
    expect(textToMorse('   ')).toBe('')
    expect(morseToText('')).toBe('')
  })

  it('未收录字符被跳过（如中文）', () => {
    expect(textToMorse('SOS 你好')).toBe('... --- ...')
  })
})
