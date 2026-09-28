/**
 * 播放组合式：把文本时间线交给音频引擎调度，跟踪播放进度用于高亮。
 */

import { onBeforeUnmount, ref, shallowRef } from 'vue'
import { audio } from '@/composables/useKeyer'
import { buildTimeline, type CharSpan, type ToneEvent } from '@/core/morse/timeline'
import { usePageTiming, useSettings } from './useSettings'
import type { TimingSettings } from '@/core/types'

export function usePlayback(page: string) {
  const settings = useSettings()
  const timing: TimingSettings = usePageTiming(page)

  const playing = ref(false)
  const elapsedMs = ref(0)
  const totalMs = ref(0)
  const charSpans = shallowRef<CharSpan[]>([])
  const sourceText = ref('')

  let raf = 0
  let startCtxMs = 0
  let finished = true

  function tick(): void {
    elapsedMs.value = Math.max(0, audio.nowMs() - startCtxMs)
    if (elapsedMs.value >= totalMs.value && !finished) {
      finished = true
      playing.value = false
      return
    }
    raf = requestAnimationFrame(tick)
  }

  /** 播放文本；返回时间线（含总时长与事件，供跟发模式同步发报用） */
  function play(text: string): { events: ToneEvent[]; totalMs: number } {
    audio.ensure()
    audio.setTone(settings.toneHz)
    audio.setVolume(settings.volume)
    audio.setNoise(settings.noise.enabled, settings.noise.level)
    const tl = buildTimeline(text, timing.wpmChar, timing.wpmEff)
    sourceText.value = text
    charSpans.value = tl.charSpans
    totalMs.value = tl.totalMs
    elapsedMs.value = 0
    finished = tl.totalMs === 0
    if (finished) {
      playing.value = false
      return { events: [], totalMs: 0 }
    }
    startCtxMs = audio.scheduleTones(tl.events, 0)
    playing.value = true
    raf = requestAnimationFrame(tick)
    return { events: tl.events, totalMs: tl.totalMs }
  }

  /** 停止并清除未完成的排程 */
  function stop(): void {
    cancelAnimationFrame(raf)
    audio.silence()
    playing.value = false
    finished = true
  }

  /** 当前播放到的字符下标（用于高亮），未播放返回 -1 */
  function activeCharIndex(): number {
    if (!playing.value) return -1
    const spans = charSpans.value
    let idx = -1
    for (let i = 0; i < spans.length; i++) {
      if (spans[i].startMs <= elapsedMs.value) idx = i
      else break
    }
    return idx
  }

  onBeforeUnmount(() => stop())

  return { playing, elapsedMs, totalMs, charSpans, sourceText, play, stop, activeCharIndex, timing }
}
