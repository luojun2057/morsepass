/**
 * 摩尔斯码编解码表与文本工具。
 * 编码使用 ITU 标准：'.' 表示点，'-' 表示划。
 */

export const MORSE_TABLE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....',
  '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
}

const REVERSE_TABLE: Record<string, string> = Object.fromEntries(
  Object.entries(MORSE_TABLE).map(([ch, code]) => [code, ch]),
)

/** 单字符 → 摩尔斯码（自动转大写，未收录返回 undefined） */
export function charToMorse(ch: string): string | undefined {
  if (ch.length !== 1) return undefined
  return MORSE_TABLE[ch.toUpperCase()]
}

/** 摩尔斯码 → 字符（未收录返回 undefined） */
export function morseToChar(code: string): string | undefined {
  return REVERSE_TABLE[code]
}

export interface CharCode {
  char: string
  morse: string
}

/** 规范化练习文本：转大写、压缩连续空白为单个空格、去首尾空白 */
export function normalizeText(text: string): string {
  return text.toUpperCase().replace(/\s+/g, ' ').trim()
}

/** 文本 → 逐字符编码序列，跳过未收录字符（空格不在此列，由上层处理分词） */
export function textToCharCodes(text: string): CharCode[] {
  const out: CharCode[] = []
  for (const raw of text) {
    const morse = charToMorse(raw)
    if (morse) out.push({ char: raw.toUpperCase(), morse })
  }
  return out
}

/** 将文本按单词切分（用于播放分词与比对），返回去空单词数组 */
export function splitWords(text: string): string[] {
  return normalizeText(text).split(' ').filter((w) => w.length > 0)
}

/** 按显示大小写偏好输出（摩尔斯本身不分大小写） */
export function toDisplayCase(text: string, displayCase: 'lower' | 'upper'): string {
  return displayCase === 'lower' ? text.toLowerCase() : text.toUpperCase()
}
