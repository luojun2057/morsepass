/**
 * 码表互转器：文本 ↔ 摩尔斯码字符串（纯函数）。
 * 约定：字符之间以单个空格分隔，单词之间以 " / " 分隔（业界通用写法）。
 */

import { charToMorse, morseToChar, normalizeText } from './codec'

/** 反向转换时未收录码的占位符 */
export const UNKNOWN_CHAR = '□'

/** 归一化用户输入的点划符号：兼容全角点/中点/长划等常见写法 */
export function normalizeMorseCode(code: string): string {
  return code
    .replace(/[·•･‧]/g, '.')
    .replace(/[—–―ー−]/g, '-')
}

/**
 * 文本 → 摩尔斯码。
 * 未收录字符跳过；空格作为单词分隔输出 " / "。
 */
export function textToMorse(text: string): string {
  const words = normalizeText(text).split(' ').filter((w) => w.length > 0)
  const out: string[] = []
  for (const word of words) {
    const letters: string[] = []
    for (const raw of word) {
      const morse = charToMorse(raw)
      if (morse) letters.push(morse)
    }
    if (letters.length > 0) out.push(letters.join(' '))
  }
  return out.join(' / ')
}

/**
 * 摩尔斯码 → 文本。
 * " / "（或单独一行）作为单词分隔；未收录码以 □ 占位。
 */
export function morseToText(code: string): string {
  const norm = normalizeMorseCode(code).replace(/\n/g, ' / ')
  const words = norm.split(/\s*\/\s*/)
  const out: string[] = []
  for (const word of words) {
    const letters = word.trim().split(/\s+/).filter((l) => l.length > 0)
    if (letters.length === 0) continue
    out.push(letters.map((l) => morseToChar(l) ?? UNKNOWN_CHAR).join(''))
  }
  return out.join(' ')
}
