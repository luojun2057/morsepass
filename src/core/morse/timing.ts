/**
 * 时序计算：PARIS 标准与 Farnsworth 间隔。
 * - dit 时长 Td = 1200 / WPM (ms)
 * - dah = 3Td；字符内间隔 = 1Td；字符间 = 3Td；单词间 = 7Td
 * - Farnsworth：字符以字符速度发送，间隔拉长使有效速度降至 wpmEff。
 *   每个单词（PARIS=50 单位）的额外延时（dit 单位）extra = 50 × (wpmChar − wpmEff) / wpmEff，
 *   按标准间隔比例 12:7（4×字符间 + 1×单词间 = 19 单位）分配，保持 3:7 的听感比例。
 */

export function ditMs(wpm: number): number {
  return 1200 / wpm
}

export interface FarnsworthSpacing {
  /** 字符内符号间隔（恒为 1Td） */
  intraMs: number
  /** 字符间隔 */
  interCharMs: number
  /** 单词间隔 */
  wordMs: number
}

/** 计算 Farnsworth 间隔；wpmEff >= wpmChar 或非法时回落标准间隔 */
export function spacing(wpmChar: number, wpmEff?: number): FarnsworthSpacing {
  const Td = ditMs(wpmChar)
  const eff = wpmEff != null && wpmEff > 0 && wpmEff < wpmChar ? wpmEff : wpmChar
  if (eff >= wpmChar) return { intraMs: Td, interCharMs: 3 * Td, wordMs: 7 * Td }
  const extraDits = (50 * (wpmChar - eff)) / eff
  return {
    intraMs: Td,
    interCharMs: 3 * Td + (extraDits * Td * 3) / 19,
    wordMs: 7 * Td + (extraDits * Td * 7) / 19,
  }
}

/** 符号分类边界：时长 < 2Td 记为点，>= 2Td 记为划 */
export function classifySymbol(durationMs: number, wpm: number): 'dit' | 'dah' {
  return durationMs < 2 * ditMs(wpm) ? 'dit' : 'dah'
}

export type SymbolKind = 'dit' | 'dah'

/** 符号期望时长 */
export function symbolExpectedMs(sym: SymbolKind, wpm: number): number {
  return sym === 'dit' ? ditMs(wpm) : 3 * ditMs(wpm)
}

/** 节奏判定：|实测 − 期望| ≤ 期望 × 容差% */
export function isAccurate(durationMs: number, sym: SymbolKind, wpm: number, tolerancePct: number): boolean {
  const expected = symbolExpectedMs(sym, wpm)
  return Math.abs(durationMs - expected) <= (expected * tolerancePct) / 100
}

/** 实测对期望的偏差比例（-0.5 表示比期望短一半……返回带符号比例） */
export function deviationRatio(durationMs: number, sym: SymbolKind, wpm: number): number {
  return (durationMs - symbolExpectedMs(sym, wpm)) / symbolExpectedMs(sym, wpm)
}

/** 单个摩尔斯串中各符号的按下时长序列（用于播放调度） */
export function symbolDurations(morse: string, wpm: number): number[] {
  return [...morse].map((c) => (c === '-' ? 3 * ditMs(wpm) : ditMs(wpm)))
}

/** 解码阈值：按键间隙达到 charBoundaryMs 判定为字符边界 */
export function charBoundaryMs(wpm: number): number {
  return 2 * ditMs(wpm)
}

/** 解码阈值：字符后间隙达到 wordBoundaryMs 判定为单词边界 */
export function wordBoundaryMs(wpm: number): number {
  return 5 * ditMs(wpm)
}
