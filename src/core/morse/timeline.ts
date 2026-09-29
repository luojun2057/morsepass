/**
 * 播放时间线构建：把文本展开为精确的开关音事件与字符位置。
 * 纯函数，无 DOM/音频依赖，可单测。
 */

import { charToMorse, splitWords } from './codec'
import { spacing, symbolDurations, ditMs } from './timing'

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

/* ------------------------------------------------------------------ */
/* 空闲间隙压缩                                                          */
/* ------------------------------------------------------------------ */

/** 空闲超过该时长（无发报）视为「停顿」 */
export const IDLE_COMPRESS_THRESHOLD_MS = 3000
/** 压缩后保留的显示宽度（仍能看出停过，但不挤掉之前的节奏） */
export const IDLE_COMPRESS_KEEP_MS = 600

export interface CompressedInterval {
  /** 真实时间轴上的空闲区间 */
  from: number
  to: number
}

export interface CompressedTimeline<R> {
  /** 映射后的记录：t 已压缩为显示时间，其余字段原样 */
  mapped: R[]
  /** 被压缩的空闲区间（真实时间轴） */
  compressed: CompressedInterval[]
}

/**
 * 压缩长时间空闲：相邻符号间空隙超过 thresholdMs 时，
 * 显示上只保留 keepMs——恢复发报后之前的节奏仍留在视野内。
 * 纯函数，可单测。
 */
export function compressIdleGaps<R extends { t: number; durationMs: number }>(
  records: R[],
  thresholdMs: number = IDLE_COMPRESS_THRESHOLD_MS,
  keepMs: number = IDLE_COMPRESS_KEEP_MS,
): CompressedTimeline<R> {
  const mapped: R[] = []
  const compressed: CompressedInterval[] = []
  let shift = 0
  let prevUp: number | null = null
  for (const r of records) {
    const start = r.t - r.durationMs
    if (prevUp !== null) {
      const gap = start - prevUp
      if (gap > thresholdMs) {
        compressed.push({ from: prevUp, to: start })
        shift += gap - keepMs
      }
    }
    mapped.push({ ...r, t: r.t - shift })
    prevUp = r.t
  }
  return { mapped, compressed }
}

/**
 * 真实时间 → 显示时间映射；落在压缩区间内返回 null（网格线跳过）。
 */
export function mapRealTime(
  t: number,
  compressed: CompressedInterval[],
  keepMs: number = IDLE_COMPRESS_KEEP_MS,
): number | null {
  let shift = 0
  for (const g of compressed) {
    if (t >= g.from && t <= g.to) return null
    if (t > g.to) shift += g.to - g.from - keepMs
  }
  return t - shift
}

/* ------------------------------------------------------------------ */
/* 发报时间线显示窗口                                                    */
/* ------------------------------------------------------------------ */

export interface TimelineWindow {
  startMs: number
  endMs: number
}

/**
 * 发报时间线的显示窗口尺寸：按点长（Td）而非固定秒数取宽。
 * 发得越快窗口越窄 → 画布分辨率越高，点宽与间隙的像素占比恒定，
 * 任何速度下间隙都清晰可见（CW Player 等 keying 波形的通用做法）。
 */
export function timelineWindowMs(wpm: number): { windowMs: number; tailMs: number } {
  const td = ditMs(wpm)
  return { windowMs: Math.round(140 * td), tailMs: Math.round(25 * td) }
}

/**
 * 计算发报时间线的显示窗口（纯函数，不依赖当前时钟）。
 *
 * 记录的 t 为符号「抬起时刻」（按压结束），即最后事件：
 * 窗口右端 = 最后一个符号的抬起时刻 + 留白：
 * - 有新输入时右端随之推进（视觉上滚动）；
 * - 停止输入后右端不再移动（窗口冻结，已发内容保持在视野内）。
 * 左端 = max(0, 右端 - windowMs)。
 */
export function computeTimelineWindow(
  records: { t: number; durationMs: number }[],
  windowMs: number = 10_000,
  tailMs: number = 1_500,
): TimelineWindow {
  let lastEnd = 0
  for (const r of records) {
    if (r.t > lastEnd) lastEnd = r.t
  }
  const endMs = lastEnd + tailMs
  return { startMs: Math.max(0, endMs - windowMs), endMs }
}
