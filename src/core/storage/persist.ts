/**
 * localStorage 持久化适配层。
 * 全部读写带 try/catch（隐私模式/配额溢出安全），存储键统一加 mp. 前缀。
 */

import type { GlobalSettings, PracticeMode, SessionRecord, TimingSettings } from '../types'

export const StorageKeys = {
  settings: 'mp.settings',
  timing: 'mp.timing',
  history: 'mp.history',
  koch: 'mp.koch',
} as const

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    /* 忽略 */
  }
}

/** 全局设置 */
export function loadSettings(): Partial<GlobalSettings> {
  return loadJSON<Partial<GlobalSettings>>(StorageKeys.settings, {})
}

export function saveSettings(s: GlobalSettings): boolean {
  return saveJSON(StorageKeys.settings, s)
}

/** 各页时序参数（键为页面名：send/receive/follow/koch） */
export function loadTiming(page: string): Partial<TimingSettings> {
  const all = loadJSON<Record<string, Partial<TimingSettings>>>(StorageKeys.timing, {})
  return all[page] ?? {}
}

export function saveTiming(page: string, t: TimingSettings): boolean {
  const all = loadJSON<Record<string, Partial<TimingSettings>>>(StorageKeys.timing, {})
  all[page] = t
  return saveJSON(StorageKeys.timing, all)
}

export const HISTORY_CAP = 200

export function loadHistory(): SessionRecord[] {
  return loadJSON<SessionRecord[]>(StorageKeys.history, [])
}

/** 追加一条练习记录（新的在前），超上限截断；返回更新后的列表 */
export function pushHistory(record: SessionRecord, cap: number = HISTORY_CAP): SessionRecord[] {
  const list = [record, ...loadHistory()].slice(0, cap)
  saveJSON(StorageKeys.history, list)
  return list
}

export function clearHistory(): void {
  removeKey(StorageKeys.history)
}

export function makeRecordId(now = Date.now()): string {
  return `${now.toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

/** 便捷构造练习记录 */
export function buildRecord(params: {
  mode: PracticeMode
  wpmChar: number
  wpmEff: number
  toneHz: number
  durationMs: number
  charsTotal: number
  charsCorrect: number
  accuracyPct: number | null
  symbolAccuracyPct: number | null
  weakChars: SessionRecord['weakChars']
  material?: string
  keyerMode?: SessionRecord['keyerMode']
}): SessionRecord {
  return {
    id: makeRecordId(),
    date: new Date().toISOString(),
    ...params,
    accuracyPct: params.accuracyPct ?? 0,
  }
}
