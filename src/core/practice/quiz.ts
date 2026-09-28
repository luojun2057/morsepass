/**
 * 听选测验（Quiz）出题逻辑：从字符/单词池中出题并生成干扰选项。
 * 纯函数 + 种子随机，可复现、可单测。
 */

export interface QuizQuestion {
  /** 正确答案 */
  target: string
  /** 选项（含正确答案，已打乱） */
  options: string[]
  /** 正确选项下标 */
  answerIndex: number
}

/** 从池中出题：1 个正确项 + 最多 optionCount-1 个不重复干扰项 */
export function generateQuizQuestion(
  rng: () => number,
  pool: readonly string[],
  optionCount = 4,
): QuizQuestion | null {
  if (pool.length === 0) return null
  const target = pool[Math.floor(rng() * pool.length)]

  // Fisher-Yates 洗牌取干扰项
  const rest = pool.filter((p) => p !== target)
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j], rest[i]]
  }
  const nDistractors = Math.min(optionCount - 1, rest.length)
  const options = [target, ...rest.slice(0, nDistractors)]

  // 选项打乱
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return { target, options, answerIndex: options.indexOf(target) }
}

/** 常用题目池 */
export const QUIZ_POOLS: Record<string, readonly string[]> = {
  letters: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  digits: '0123456789'.split(''),
  alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split(''),
  words: ['CQ', 'DE', 'QTH', 'RST', '599', 'QRZ', 'QSL', 'TNX', '73', 'SK', 'OM', 'FB'],
}
