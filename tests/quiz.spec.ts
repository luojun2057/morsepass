import { describe, expect, it } from 'vitest'
import { generateQuizQuestion, QUIZ_POOLS } from '@/core/practice/quiz'
import { mulberry32 } from '@/core/practice/material'

describe('quiz 出题', () => {
  it('同种子出题可复现', () => {
    const a = generateQuizQuestion(mulberry32(42), QUIZ_POOLS.alnum, 4)
    const b = generateQuizQuestion(mulberry32(42), QUIZ_POOLS.alnum, 4)
    expect(a).toEqual(b)
  })

  it('选项含正确答案且下标正确', () => {
    for (let i = 0; i < 50; i++) {
      const q = generateQuizQuestion(mulberry32(i), QUIZ_POOLS.alnum, 4)
      expect(q).not.toBeNull()
      expect(q!.options).toHaveLength(4)
      expect(q!.answerIndex).toBeGreaterThanOrEqual(0)
      expect(q!.answerIndex).toBeLessThan(4)
      expect(q!.options[q!.answerIndex]).toBe(q!.target)
      // 选项无重复
      expect(new Set(q!.options).size).toBe(4)
    }
  })

  it('选项全部来自题池', () => {
    const q = generateQuizQuestion(mulberry32(7), QUIZ_POOLS.digits, 4)
    for (const opt of q!.options) {
      expect(QUIZ_POOLS.digits).toContain(opt)
    }
  })

  it('题池不足时选项数收缩到题池大小', () => {
    const small = ['A', 'B']
    const q = generateQuizQuestion(mulberry32(1), small, 4)
    expect(q!.options).toHaveLength(2)
    expect(q!.target).toBe(q!.options[q!.answerIndex])
  })

  it('空题池返回 null', () => {
    expect(generateQuizQuestion(mulberry32(1), [], 4)).toBeNull()
  })

  it('目标分布覆盖多个不同字符（非恒定出题）', () => {
    const targets = new Set<string>()
    for (let i = 0; i < 100; i++) {
      const q = generateQuizQuestion(mulberry32(1000 + i), QUIZ_POOLS.letters, 4)
      targets.add(q!.target)
    }
    expect(targets.size).toBeGreaterThan(20)
  })
})
