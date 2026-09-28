/**
 * Koch 方法：从少量字符起步，练稳（默认 ≥90%）后解锁新字符。
 * 字符序采用 LCWO 通用 Koch 序列。
 */

/** LCWO Koch 字符序（40 个） */
export const KOCH_ORDER: string[] = [
  'K', 'M', 'R', 'S', 'U', 'A', 'P', 'T', 'L', 'O', 'W', 'I',
  '.', 'N', 'J', 'E', 'F', '0', 'Y', ',', 'V', 'G', '5', '/',
  'Q', '9', 'Z', 'H', '3', '8', 'B', '?', '4', '2', '7', 'C',
  '1', 'D', '6', 'X',
]

export interface KochSessionRecord {
  date: string
  accuracyPct: number
  groups: number
  passed: boolean
}

export interface KochProgress {
  /** 当前已解锁字符数（最少 2） */
  unlocked: number
  history: KochSessionRecord[]
}

export function defaultProgress(): KochProgress {
  return { unlocked: 2, history: [] }
}

/** 当前课程生效字符集（始终至少前 2 个） */
export function activeChars(progress: KochProgress): string[] {
  const n = Math.max(2, Math.min(progress.unlocked, KOCH_ORDER.length))
  return KOCH_ORDER.slice(0, n)
}

/** 下一个待解锁字符（全部解锁时返回 null） */
export function nextChar(progress: KochProgress): string | null {
  const idx = Math.max(2, Math.min(progress.unlocked, KOCH_ORDER.length))
  return idx < KOCH_ORDER.length ? KOCH_ORDER[idx] : null
}

export interface KochPassOptions {
  /** 过关正确率，默认 90 */
  minAccuracyPct?: number
  /** 一次课程最少组数（每组 5 字符），默认 5 */
  minGroups?: number
}

/** 判定一次课程是否过关：字符量达标且整场正确率 ≥ 阈值 */
export function evaluateSession(
  charsTotal: number,
  accuracyPct: number,
  opts: KochPassOptions = {},
): boolean {
  const minAccuracy = opts.minAccuracyPct ?? 90
  const minGroups = opts.minGroups ?? 5
  return charsTotal >= minGroups * 5 && accuracyPct >= minAccuracy
}

/**
 * 应用一次课程结果。过关且还有未解锁字符时 unlocked+1。
 * 返回新进度与是否发生了解锁。
 */
export function applySession(
  progress: KochProgress,
  record: KochSessionRecord,
): { progress: KochProgress; unlockedNew: boolean } {
  const history = [...progress.history, record].slice(-100)
  const canUnlock =
    record.passed && progress.unlocked < KOCH_ORDER.length
  return {
    progress: { unlocked: canUnlock ? progress.unlocked + 1 : progress.unlocked, history },
    unlockedNew: canUnlock,
  }
}
