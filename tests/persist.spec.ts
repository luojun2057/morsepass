import { beforeEach, describe, expect, it } from 'vitest'
import {
  HISTORY_CAP,
  StorageKeys,
  buildRecord,
  loadHistory,
  loadJSON,
  loadSettings,
  loadTiming,
  pushHistory,
  saveJSON,
  saveTiming,
} from '@/core/storage/persist'

describe('persist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saveJSON / loadJSON 往返', () => {
    expect(saveJSON('mp.t', { a: 1, b: ['x'] })).toBe(true)
    expect(loadJSON('mp.t', null)).toEqual({ a: 1, b: ['x'] })
  })

  it('缺失键返回 fallback', () => {
    expect(loadJSON('mp.missing', 'fb')).toBe('fb')
  })

  it('损坏的 JSON 返回 fallback 而不抛错', () => {
    localStorage.setItem('mp.bad', '{oops')
    expect(loadJSON('mp.bad', 'fb')).toBe('fb')
  })

  it('pushHistory 新记录在前并按上限截断', () => {
    for (let i = 0; i < HISTORY_CAP + 5; i++) {
      pushHistory(buildRecord({
        mode: 'send',
        wpmChar: 20,
        wpmEff: 20,
        toneHz: 700,
        durationMs: i,
        charsTotal: i,
        charsCorrect: i,
        accuracyPct: 100,
        symbolAccuracyPct: null,
        weakChars: [],
      }))
    }
    const list = loadHistory()
    expect(list).toHaveLength(HISTORY_CAP)
    expect(list[0].durationMs).toBe(HISTORY_CAP + 4) // 最新在前
    expect(list[HISTORY_CAP - 1].durationMs).toBe(5) // 最旧保留 = 204-199
  })

  it('settings / timing 读写', () => {
    expect(loadSettings()).toEqual({})
    saveJSON(StorageKeys.settings, { toneHz: 600 })
    expect(loadSettings()).toEqual({ toneHz: 600 })

    saveTiming('send', { wpmChar: 22, wpmEff: 15, tolerancePct: 25 })
    expect(loadTiming('send')).toEqual({ wpmChar: 22, wpmEff: 15, tolerancePct: 25 })
    expect(loadTiming('receive')).toEqual({})
  })

  it('buildRecord 填充 id 与日期', () => {
    const rec = buildRecord({
      mode: 'receive',
      wpmChar: 18,
      wpmEff: 12,
      toneHz: 700,
      durationMs: 1000,
      charsTotal: 5,
      charsCorrect: 4,
      accuracyPct: 80,
      symbolAccuracyPct: null,
      weakChars: [],
    })
    expect(rec.id).toBeTruthy()
    expect(rec.date).toBeTruthy()
    expect(new Date(rec.date).getTime()).not.toBeNaN()
  })
})
