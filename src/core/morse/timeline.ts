/**
 * 播放时间线构建：把文本展开为精确的开关音事件与字符位置。
 * 纯函数，无 DOM/音频依赖，可单测。
 */

import { charToMorse, splitWords } from './codec'
import { spacing, symbolDurations } from './timing'

export interface ToneEvent {
  /** 相对时间轴起点（毫秒） */
  t: number
  on: boolean
}

export interface CharSpan {
  char: string
  morse: string
  /** 字符第一个符号的起始时刻（毫秒） */
  startMs: number
}

export interface Timeline {
  events: ToneEvent[]
  charSpans: CharSpan[]
  /** 总时长（毫秒，含结尾静音间隙） */
  totalMs: number
}

/**
 * 构建播放时间线：
 * - 字符内：符号按下（dit/dah）+ 1Td 间隔
 * - 字符间：spacing().interCharMs
 * - 单词间：spacing().wordMs
 */
export function buildTimeline(text: string, wpmChar: number, wpmEff?: number): Timeline {
  const sp = spacing(wpmChar, wpmEff)
  const events: ToneEvent[] = []
  const charSpans: CharSpan[] = []
  let t = 0

  const words = splitWords(text)
  words.forEach((word, wi) => {
    for (const raw of word) {
      const morse = charToMorse(raw)
      if (!morse) continue
      charSpans.push({ char: raw.toUpperCase(), morse, startMs: t })
      const durs = symbolDurations(morse, wpmChar)
      durs.forEach((dur, si) => {
        events.push({ t, on: true })
        t += dur
        events.push({ t, on: false })
        if (si < durs.length - 1) t += sp.intraMs
      })
      t += sp.interCharMs
    }
    // 单词间替换掉最后一个字符间间隙
    if (wi < words.length - 1) {
      t = t - sp.interCharMs + sp.wordMs
    }
  })

  return { events, charSpans, totalMs: t }
}
