import { describe, expect, it } from 'vitest'
import {
  KOCH_ORDER,
  activeChars,
  applySession,
  defaultProgress,
  evaluateSession,
  nextChar,
} from '@/core/practice/koch'

describe('koch', () => {
  it('初始课程始终至少 2 个字符', () => {
    expect(activeChars(defaultProgress())).toEqual(['K', 'M'])
  })

  it('解锁推进与下一字符', () => {
    const p = { unlocked: 2, history: [] }
    expect(nextChar(p)).toBe('R')
    expect(activeChars({ unlocked: 5, history: [] })).toEqual(['K', 'M', 'R', 'S', 'U'])
    expect(nextChar({ unlocked: KOCH_ORDER.length, history: [] })).toBeNull()
  })

  it('过关判定：字符量与正确率双门槛', () => {
    expect(evaluateSession(25, 90)).toBe(true) // 5 组 × 5 字符
    expect(evaluateSession(24, 95)).toBe(false) // 字符量不足
    expect(evaluateSession(25, 89.9)).toBe(false)
    expect(evaluateSession(30, 90.5)).toBe(true)
    expect(evaluateSession(9, 100, { minGroups: 2 })).toBe(false) // 差 1 个字符
    expect(evaluateSession(10, 100, { minGroups: 2 })).toBe(true)
    expect(evaluateSession(10, 89, { minGroups: 2 })).toBe(false)
  })

  it('过关后解锁新字符并记录历史', () => {
    const p = defaultProgress()
    const { progress, unlockedNew } = applySession(p, {
      date: '2026-09-28',
      accuracyPct: 92,
      groups: 5,
      passed: true,
    })
    expect(unlockedNew).toBe(true)
    expect(progress.unlocked).toBe(3)
    expect(progress.history).toHaveLength(1)
  })

  it('未过关不解锁', () => {
    const p = defaultProgress()
    const { progress, unlockedNew } = applySession(p, {
      date: '2026-09-28',
      accuracyPct: 70,
      groups: 5,
      passed: false,
    })
    expect(unlockedNew).toBe(false)
    expect(progress.unlocked).toBe(2)
  })

  it('全部解锁后不再增加', () => {
    const p = { unlocked: KOCH_ORDER.length, history: [] }
    const { progress } = applySession(p, {
      date: '2026-09-28',
      accuracyPct: 100,
      groups: 5,
      passed: true,
    })
    expect(progress.unlocked).toBe(KOCH_ORDER.length)
  })
})
