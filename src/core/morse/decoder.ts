/**
 * 直键（straight key）解码状态机。
 * 输入为 down/up 的毫秒时间戳（任意单调时钟，如 performance.now()），
 * 输出为解码字符、单词分隔与逐符号节奏记录。
 *
 * - 符号分类：按下时长 < 2Td 为点，否则为划
 * - 字符边界：抬起后间隙 ≥ 2Td 提交字符
 * - 单词边界：字符提交后仍无按下且间隙 ≥ 5Td 发出单词分隔
 * - 去抖：按下时长 < debounceMs 视为触点抖动丢弃；
 *   抬起后 debounceMs 内再次按下视为触点弹跳，合并回上一次按下
 */

import { morseToChar } from './codec'
import {
  charBoundaryMs,
  classifySymbol,
  isAccurate,
  wordBoundaryMs,
  type SymbolKind,
} from './timing'

export interface MorseDecoderEvents {
  /** 提交一个字符；未收录序列传空字符串 */
  onChar(char: string): void
  /** 单词分隔 */
  onWordSeparator(): void
  /** 当前未提交字符的临时符号串（用于实时显示） */
  onSymbolsChange(symbols: string): void
  /**
   * 一个符号按下结束（用于时间线与节奏统计）。
   * pressIndex 标识第几次按压：触点弹跳合并后会以同一 pressIndex 重发修正记录，
   * 消费方应按 pressIndex 覆盖旧记录（last write wins）。
   */
  onSymbol(sym: SymbolKind, durationMs: number, accurate: boolean, pressIndex: number): void
}

export interface DecoderOptions {
  wpm: number
  tolerancePct: number
  /** 触点去抖窗口，默认 5ms */
  debounceMs?: number
}

export class MorseDecoder {
  private readonly events: MorseDecoderEvents
  private wpm: number
  private tolerancePct: number
  private readonly debounceMs: number

  private symbols: string[] = []
  private pressStart: number | null = null
  private lastPressStart: number | null = null
  private lastUp = 0
  private charTimer: ReturnType<typeof setTimeout> | null = null
  private wordTimer: ReturnType<typeof setTimeout> | null = null
  /** 下一次按压的序号 */
  private pressSeq = 0
  /** 弹跳合并时待复用的按压序号（该按压尚未真正结束） */
  private pendingPressSeq: number | null = null

  constructor(events: MorseDecoderEvents, options: DecoderOptions) {
    this.events = events
    this.wpm = options.wpm
    this.tolerancePct = options.tolerancePct
    this.debounceMs = options.debounceMs ?? 5
  }

  /** 运行中调整参数（下一符号生效） */
  setTiming(wpm: number, tolerancePct: number): void {
    this.wpm = wpm
    this.tolerancePct = tolerancePct
  }

  get pendingMorse(): string {
    return this.symbols.join('')
  }

  down(ts: number): void {
    if (this.pressStart !== null) return
    // 触点弹跳：抬起后 debounce 窗口内再次按下，合并回上一次按下
    if (this.lastUp > 0 && ts - this.lastUp <= this.debounceMs && this.lastPressStart !== null) {
      this.symbols.pop()
      this.events.onSymbolsChange(this.symbols.join(''))
      this.clearTimers()
      this.pressStart = this.lastPressStart
      this.lastPressStart = null
      this.lastUp = 0
      // 该按压未真正结束：收回其序号，再次抬起时以同一序号重发修正记录
      this.pendingPressSeq = this.pressSeq - 1
      return
    }
    this.clearTimers()
    this.pendingPressSeq = null // 超出去抖窗口的新按压不再复用旧序号
    this.pressStart = ts
  }

  up(ts: number): void {
    if (this.pressStart === null) return
    const duration = ts - this.pressStart
    this.lastPressStart = this.pressStart
    this.pressStart = null
    this.lastUp = ts

    if (duration < this.debounceMs) return // 噪声，丢弃

    // 弹跳合并中的按压复用原序号（消费方按序号覆盖旧记录）
    const idx = this.pendingPressSeq !== null ? this.pendingPressSeq : this.pressSeq
    this.pendingPressSeq = null
    if (idx === this.pressSeq) this.pressSeq++

    const sym = classifySymbol(duration, this.wpm)
    const accurate = isAccurate(duration, sym, this.wpm, this.tolerancePct)
    this.symbols.push(sym === 'dit' ? '.' : '-')
    this.events.onSymbol(sym, duration, accurate, idx)
    this.events.onSymbolsChange(this.symbols.join(''))

    this.charTimer = setTimeout(() => {
      this.commitChar()
      this.charTimer = null
      this.wordTimer = setTimeout(() => {
        this.wordTimer = null
        this.events.onWordSeparator()
      }, Math.max(0, wordBoundaryMs(this.wpm) - charBoundaryMs(this.wpm)))
    }, charBoundaryMs(this.wpm))
  }

  /** 立即提交未决字符（练习结束时调用） */
  flush(): void {
    this.clearTimers()
    if (this.symbols.length > 0) this.commitChar()
    this.lastUp = 0
    this.lastPressStart = null
  }

  /** 清空全部状态，不发任何事件 */
  reset(): void {
    this.clearTimers()
    this.symbols = []
    this.pressStart = null
    this.lastPressStart = null
    this.lastUp = 0
  }

  private commitChar(): void {
    if (this.symbols.length === 0) return
    const code = this.symbols.join('')
    this.symbols = []
    this.events.onChar(morseToChar(code) ?? '')
    this.events.onSymbolsChange('')
  }

  private clearTimers(): void {
    if (this.charTimer !== null) {
      clearTimeout(this.charTimer)
      this.charTimer = null
    }
    if (this.wordTimer !== null) {
      clearTimeout(this.wordTimer)
      this.wordTimer = null
    }
  }
}
