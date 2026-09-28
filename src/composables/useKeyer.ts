/**
 * 发报会话装配层：输入源 → 音频引擎 → 解码器 → 统计。
 * 一个视图一个会话实例；音频引擎为模块级单例。
 */

import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { AudioEngine } from '@/core/audio/engine'
import { MorseDecoder } from '@/core/morse/decoder'
import { deviationRatio } from '@/core/morse/timing'
import { toDisplayCase } from '@/core/morse/codec'
import {
  createKeyboardSource,
  createMouseSource,
  createTouchSource,
  type KeyInputSource,
} from '@/core/input/keying'
import { SessionStats, type SessionSnapshot, type SymbolRecord } from '@/core/practice/stats'
import { buildRecord, loadHistory, pushHistory } from '@/core/storage/persist'
import { usePageTiming, useSettings } from './useSettings'
import type { GlobalSettings, PracticeMode, TimingSettings } from '@/core/types'

/** 音频引擎单例 */
export const audio = new AudioEngine()

export interface TimelineRecord extends SymbolRecord {
  /** 距会话开始的毫秒数（时间线 x 轴） */
  t: number
}

export interface KeyerReport {
  snapshot: SessionSnapshot
  hints: string[]
  saved: boolean
}

export interface UseKeyerOptions {
  /** 历史记录归类的练习模式 */
  mode: Extract<PracticeMode, 'send' | 'follow'>
  /** 触屏发报面（可选） */
  touchEl?: () => HTMLElement | null
  /**
   * 自定义字符正误判定（跟发模式比对原文）。缺省用"该字符所有符号均节奏准确"。
   */
  judgeChar?: (ch: string) => boolean
  /** 素材类型标记（写入历史记录） */
  material?: string
  /** 不写入历史（如试键） */
  silent?: boolean
}

export function useKeyer(page: string, options: UseKeyerOptions) {
  const settings: GlobalSettings = useSettings()
  const timing: TimingSettings = usePageTiming(page)

  const running = ref(false)
  const pendingMorse = ref('')
  const decoded = ref('')
  const records = shallowRef<TimelineRecord[]>([])
  const snapshot = ref<SessionSnapshot | null>(null)
  const report = shallowRef<KeyerReport | null>(null)
  const history = shallowRef(loadHistory())

  const stats = new SessionStats()
  const decoder = new MorseDecoder(
    {
      onSymbol: (sym, durationMs, accurate) => {
        if (!running.value) return
        const now = performance.now()
        const rec: TimelineRecord = {
          sym,
          durationMs,
          accurate,
          deviation: deviationRatio(durationMs, sym, timing.wpmChar),
          t: now - sessionStart,
        }
        records.value = [...records.value, rec]
        stats.addSymbol(sym, durationMs, accurate, timing.wpmChar)
        if (!accurate) charClean = false
      },
      onChar: (ch) => {
        if (!running.value) return
        decoded.value += ch === '' ? '□' : ch
        const correct = options.judgeChar ? options.judgeChar(ch) : charClean && ch !== ''
        stats.addChar(ch, correct)
        charClean = true
        snapshot.value = stats.snapshot(performance.now())
      },
      onWordSeparator: () => {
        if (!running.value) return
        decoded.value += ' '
      },
      onSymbolsChange: (s) => {
        pendingMorse.value = s
      },
    },
    { wpm: timing.wpmChar, tolerancePct: timing.tolerancePct },
  )

  let sources: KeyInputSource[] = []
  let sessionStart = 0
  let charClean = true
  let pollTimer: ReturnType<typeof setInterval> | null = null

  function buildSources(): KeyInputSource[] {
    const handlers = {
      onDown: (now: number) => {
        audio.startTone()
        decoder.down(now)
      },
      onUp: (now: number) => {
        audio.stopTone()
        decoder.up(now)
      },
    }
    const list: KeyInputSource[] = []
    if (settings.input.mouseButton !== null) {
      list.push(createMouseSource(settings.input.mouseButton, handlers))
    }
    if (settings.input.key) {
      list.push(createKeyboardSource(settings.input.key, handlers))
    }
    const el = options.touchEl?.()
    if (el) list.push(createTouchSource(el, handlers))
    return list
  }

  function start(): void {
    if (running.value) return
    audio.ensure()
    audio.setTone(settings.toneHz)
    audio.setVolume(settings.volume)
    audio.setNoise(settings.noise.enabled, settings.noise.level)

    decoder.setTiming(timing.wpmChar, timing.tolerancePct)
    decoder.reset()
    stats.start(performance.now())
    sessionStart = performance.now()
    charClean = true
    records.value = []
    decoded.value = ''
    pendingMorse.value = ''
    report.value = null

    sources = buildSources()
    for (const s of sources) s.activate()

    pollTimer = setInterval(() => {
      snapshot.value = stats.snapshot(performance.now())
    }, 400)

    running.value = true
  }

  function stop(): void {
    if (!running.value) return
    running.value = false
    for (const s of sources) s.deactivate()
    sources = []
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    decoder.flush()
    audio.silence()

    stats.end(performance.now())
    const snap = stats.snapshot(performance.now())
    snapshot.value = snap
    const hints = stats.analyzeRhythm(timing.wpmChar)

    let saved = false
    if (!options.silent) {
      const record = buildRecord({
        mode: options.mode,
        wpmChar: timing.wpmChar,
        wpmEff: timing.wpmEff,
        toneHz: settings.toneHz,
        durationMs: snap.durationMs,
        charsTotal: snap.charsTotal,
        charsCorrect: snap.charsCorrect,
        accuracyPct: snap.accuracyPct,
        symbolAccuracyPct: snap.symbolAccuracyPct,
        weakChars: snap.weakChars,
        material: options.material,
      })
      const list = pushHistory(record)
      saved = list.length > 0 && list[0].id === record.id
      history.value = list
    }

    report.value = { snapshot: snap, hints, saved }
  }

  onBeforeUnmount(() => {
    if (running.value) stop()
  })

  const decodedDisplay = (): string => toDisplayCase(decoded.value, settings.displayCase)

  return {
    running,
    pendingMorse,
    decoded,
    decodedDisplay,
    records,
    snapshot,
    report,
    history,
    timing,
    settings,
    start,
    stop,
  }
}
