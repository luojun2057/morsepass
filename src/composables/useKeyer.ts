/**
 * 发报会话装配层：输入源 → 音频引擎 → 解码器 → 统计。
 * 一个视图一个会话实例；音频引擎为模块级单例。
 */

import { onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import { AudioEngine } from '@/core/audio/engine'
import { AutoKeyer } from '@/core/keyer/auto'
import { MorseDecoder } from '@/core/morse/decoder'
import { deviationRatio } from '@/core/morse/timing'
import { toDisplayCase } from '@/core/morse/codec'
import {
  createKeyboardSource,
  createMouseSource,
  createTouchSource,
  type KeyInputSource,
} from '@/core/input/keying'
import {
  SessionStats,
  overrideWithFinal,
  type FinalAccuracy,
  type SessionSnapshot,
  type SymbolRecord,
} from '@/core/practice/stats'
import { buildRecord, loadHistory, pushHistory } from '@/core/storage/persist'
import { analyzeRhythmIssues, type RhythmIssue } from '@/core/practice/rhythm'
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
  /** 节奏问题分类汇总（点/划/间隔各自太长太短），按次数降序 */
  rhythmIssues: RhythmIssue[]
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
  /** 素材类型标记（写入历史记录），可为静态串或随会话变化的取值函数 */
  material?: string | (() => string)
  /**
   * 对照模式结束时的最终正确率覆盖：全文比对（LCS）结果优先于逐字符判定。
   * 返回 null 表示不覆盖（如素材为空）。
   */
  finalize?: (decoded: string) => FinalAccuracy | null
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
  let autoKeyer: AutoKeyer | null = null
  let sessionStart = 0
  let charClean = true
  let pollTimer: ReturnType<typeof setInterval> | null = null

  /** 手动键下游：音频 + 解码（自动键的 AutoKeyer 复用同一对处理） */
  function keyHandlers() {
    return {
      onDown: (now: number) => {
        audio.startTone()
        decoder.down(now)
      },
      onUp: (now: number) => {
        audio.stopTone()
        decoder.up(now)
      },
    }
  }

  /** 自动键装配：物理桨（鼠标左=划/右=点 + 键盘双桨键）→ AutoKeyer 状态机 */
  function buildAutoKeyerSources(): KeyInputSource[] {
    autoKeyer = new AutoKeyer(keyHandlers(), { getWpm: () => timing.wpmChar })
    autoKeyer.setStyle(settings.input.keyerStyle)
    const paddle = (el: 'dit' | 'dah') => ({
      onDown: (now: number) => (el === 'dit' ? autoKeyer!.onDitDown(now) : autoKeyer!.onDahDown(now)),
      onUp: () => (el === 'dit' ? autoKeyer!.onDitUp() : autoKeyer!.onDahUp()),
    })
    // 鼠标双桨：默认左键=划、右键=点；reverse 后整体互换
    const ditButton: 0 | 2 = settings.input.paddleReverse ? 0 : 2
    const dahButton: 0 | 2 = settings.input.paddleReverse ? 2 : 0
    const list: KeyInputSource[] = [
      createMouseSource(ditButton, paddle('dit')),
      createMouseSource(dahButton, paddle('dah')),
    ]
    if (settings.input.paddleDitKey) {
      list.push(createKeyboardSource(settings.input.paddleDitKey, paddle('dit')))
    }
    if (settings.input.paddleDahKey) {
      list.push(createKeyboardSource(settings.input.paddleDahKey, paddle('dah')))
    }
    // 触屏双桨本轮不做（单点触摸无法区分两个桨）
    return list
  }

  function buildSources(): KeyInputSource[] {
    if (settings.input.keyerMode === 'auto') return buildAutoKeyerSources()
    const handlers = keyHandlers()
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

  // 练习中调速/容差即时生效（手动键解码阈值；自动键经 getWpm 实时读取）
  watch([() => timing.wpmChar, () => timing.tolerancePct], () => {
    decoder.setTiming(timing.wpmChar, timing.tolerancePct)
  })

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
    autoKeyer?.start()

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
    autoKeyer?.stop()
    autoKeyer = null
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    decoder.flush()
    audio.silence()

    stats.end(performance.now())
    let snap = stats.snapshot(performance.now())

    // 对照模式：全文比对结果覆盖逐字符统计（保留节奏统计）
    const fin = options.finalize?.(decoded.value) ?? null
    if (fin) snap = overrideWithFinal(snap, fin)

    snapshot.value = snap
    const hints = stats.analyzeRhythm(timing.wpmChar)

    let saved = false
    if (!options.silent) {
      const material =
        typeof options.material === 'function' ? options.material() : options.material
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
        material,
        keyerMode: settings.input.keyerMode,
      })
      const list = pushHistory(record)
      saved = list.length > 0 && list[0].id === record.id
      history.value = list
    }

    report.value = {
      snapshot: snap,
      hints,
      saved,
      rhythmIssues: analyzeRhythmIssues(records.value, timing.wpmChar, timing.tolerancePct),
    }
  }

  /** 清空实时解码流（不影响统计与历史） */
  function clearDecoded(): void {
    decoded.value = ''
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
    clearDecoded,
  }
}
