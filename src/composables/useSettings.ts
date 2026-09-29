/**
 * 全局设置（单例响应式 + 自动持久化）。
 */

import { reactive, watch } from 'vue'
import type { GlobalSettings, TimingSettings } from '@/core/types'
import { loadSettings, loadTiming, saveSettings, saveTiming } from '@/core/storage/persist'

export const DEFAULT_SETTINGS: GlobalSettings = {
  input: {
    mouseButton: 0,
    key: null,
    keyerMode: 'manual',
    paddleDitKey: null,
    paddleDahKey: null,
    paddleReverse: false,
    keyerStyle: 'a',
  },
  toneHz: 700,
  volume: 0.5,
  displayCase: 'lower',
  sendMode: 'free',
  noise: { enabled: false, level: 0.15 },
  qsb: { enabled: false, level: 0.4 },
}

export const DEFAULT_TIMING: TimingSettings = {
  wpmChar: 15,
  wpmEff: 12,
  tolerancePct: 25,
}

const settings = reactive<GlobalSettings>({
  ...DEFAULT_SETTINGS,
  ...loadSettings(),
  input: { ...DEFAULT_SETTINGS.input, ...(loadSettings().input ?? {}) },
  noise: { ...DEFAULT_SETTINGS.noise, ...(loadSettings().noise ?? {}) },
  qsb: { ...DEFAULT_SETTINGS.qsb, ...(loadSettings().qsb ?? {}) },
})

watch(
  settings,
  (s) => {
    saveSettings(JSON.parse(JSON.stringify(s)))
  },
  { deep: true },
)

export function useSettings(): GlobalSettings {
  return settings
}

/** 每页独立的时序参数（wpm/容差），同样自动持久化 */
const timingCache = new Map<string, TimingSettings>()

export function usePageTiming(page: string): TimingSettings {
  let t = timingCache.get(page)
  if (!t) {
    t = reactive<TimingSettings>({ ...DEFAULT_TIMING, ...loadTiming(page) })
    watch(
      t,
      (v) => {
        saveTiming(page, JSON.parse(JSON.stringify(v)))
      },
      { deep: true },
    )
    timingCache.set(page, t)
  }
  return t
}
