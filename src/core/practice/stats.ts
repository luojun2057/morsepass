/**
 * 单次练习会话统计。
 * - 整场累计正确率（主指标）：全程累计，而非滑动窗口
 * - 近 N 符实时正确率（辅指标）：默认近 10 个符号
 * - 弱项字符：按字符累计正误
 * - 节奏错误分析：点/划平均偏差
 */

import type { WeakChar } from '../types'
import { deviationRatio, ditMs, type SymbolKind } from '../morse/timing'

export interface SymbolRecord {
  sym: SymbolKind
  durationMs: number
  accurate: boolean
  /** 实测相对期望的带符号偏差比例 */
  deviation: number
}

export interface CharOutcome {
  ch: string
  correct: boolean
}

export interface SessionSnapshot {
  durationMs: number
  charsTotal: number
  charsCorrect: number
  /** 整场累计字符正确率 %（无字符时 null） */
  accuracyPct: number | null
  /** 整场符号节奏准确率 %（无符号时 null） */
  symbolAccuracyPct: number | null
  /** 近 rollingWindow 个符号的正确率 %（不足时按已有数量算） */
  rollingAccuracyPct: number | null
  /** 实时有效速度（近 windowMs 毫秒内的字符折算 WPM，5 字符=1 词） */
  liveWpm: number | null
  weakChars: WeakChar[]
}

const ROLLING_WINDOW = 10

export class SessionStats {
  private symbols: SymbolRecord[] = []
  private chars: CharOutcome[] = []
  private startTs = 0
  private endTs = 0
  private started = false
  private ended = false

  start(nowMs: number): void {
    this.reset()
    this.started = true
    this.startTs = nowMs
  }

  end(nowMs: number): void {
    if (this.started && !this.ended) {
      this.ended = true
      this.endTs = nowMs
    }
  }

  reset(): void {
    this.symbols = []
    this.chars = []
    this.startTs = 0
    this.endTs = 0
    this.started = false
    this.ended = false
  }

  get running(): boolean {
    return this.started && !this.ended
  }

  /** 记录一个符号；wpm 用于计算相对期望的偏差比例 */
  addSymbol(sym: SymbolKind, durationMs: number, accurate: boolean, wpm: number): void {
    this.symbols.push({
      sym,
      durationMs,
      accurate,
      deviation: deviationRatio(durationMs, sym, wpm),
    })
  }

  /** 直接注入已算好偏差的符号记录 */
  addSymbolRecord(rec: SymbolRecord): void {
    this.symbols.push(rec)
  }

  addChar(ch: string, correct: boolean): void {
    if (!ch) return
    this.chars.push({ ch, correct })
  }

  snapshot(nowMs: number = Date.now()): SessionSnapshot {
    if (!this.started) {
      return {
        durationMs: 0,
        charsTotal: 0,
        charsCorrect: 0,
        accuracyPct: null,
        symbolAccuracyPct: null,
        rollingAccuracyPct: null,
        liveWpm: null,
        weakChars: [],
      }
    }
    // 已结束时冻结为结束时刻；进行中用传入的当前时间
    const refTs = this.ended ? this.endTs : nowMs
    const durationMs = Math.max(0, refTs - this.startTs)
    const charsTotal = this.chars.length
    const charsCorrect = this.chars.filter((c) => c.correct).length

    // 整场符号准确率
    let symbolAccuracyPct: number | null = null
    if (this.symbols.length > 0) {
      const ok = this.symbols.filter((s) => s.accurate).length
      symbolAccuracyPct = round1((ok / this.symbols.length) * 100)
    }

    // 近 N 符滑动窗口
    let rollingAccuracyPct: number | null = null
    if (this.symbols.length > 0) {
      const win = this.symbols.slice(-ROLLING_WINDOW)
      const ok = win.filter((s) => s.accurate).length
      rollingAccuracyPct = round1((ok / win.length) * 100)
    }

    // 实时速度：近 10s 内提交的字符数（快照时以 endTs 或当前时间为基准，
    // 字符不带时间戳，按总时长平均折算）
    let liveWpm: number | null = null
    if (charsTotal > 0 && durationMs > 0) {
      liveWpm = round1(charsTotal / 5 / (durationMs / 60_000))
    }

    // 弱项字符：正确率 < 80% 的字符按错误率降序
    const byChar = new Map<string, { correct: number; total: number }>()
    for (const c of this.chars) {
      const e = byChar.get(c.ch) ?? { correct: 0, total: 0 }
      e.total++
      if (c.correct) e.correct++
      byChar.set(c.ch, e)
    }
    const weakChars: WeakChar[] = [...byChar.entries()]
      .map(([ch, e]) => ({ ch, correct: e.correct, total: e.total }))
      .filter((e) => e.correct / e.total < 0.8)
      .sort((a, b) => a.correct / a.total - b.correct / b.total)

    return {
      durationMs,
      charsTotal,
      charsCorrect,
      accuracyPct: charsTotal === 0 ? null : round1((charsCorrect / charsTotal) * 100),
      symbolAccuracyPct,
      rollingAccuracyPct,
      liveWpm,
      weakChars,
    }
  }

  /**
   * 节奏错误分析：基于符号记录给出中文提示。
   * 偏差按设定 WPM 归一（记录里存的是绝对偏差比例，由调用方按 wpm 换算）。
   */
  analyzeRhythm(wpm: number): string[] {
    const hints: string[] = []
    if (this.symbols.length < 4) return hints

    const dits = this.symbols.filter((s) => s.sym === 'dit')
    const dahs = this.symbols.filter((s) => s.sym === 'dah')
    const ratio = (arr: SymbolRecord[]) =>
      arr.reduce((acc, s) => acc + s.durationMs / (s.sym === 'dit' ? ditMs(wpm) : 3 * ditMs(wpm)), 0) / arr.length

    if (dits.length >= 2) {
      const r = ratio(dits)
      if (r < 0.9) hints.push('点普遍偏短，抬键前数一下节奏')
      else if (r > 1.1) hints.push('点普遍偏长，注意快速抬键')
    }
    if (dahs.length >= 2) {
      const r = ratio(dahs)
      if (r < 0.9) hints.push('划普遍偏短，划应保持三个点的长度')
      else if (r > 1.1) hints.push('划普遍偏长，划不要拖太久')
    }
    const acc = this.symbols.filter((s) => s.accurate).length / this.symbols.length
    if (acc >= 0.95) hints.push('节奏很稳，可以尝试提高速度')
    return hints
  }
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}
