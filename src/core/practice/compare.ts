/**
 * 听抄/跟发比对：基于最长公共子序列（LCS）的字符对齐。
 * 比较前双方统一转大写；空格参与比较。
 */

import { splitWords } from '../morse/codec'
import type { WeakChar } from '../types'

export type DiffKind = 'match' | 'wrong' | 'missed' | 'extra'

export interface DiffItem {
  kind: DiffKind
  /** match/wrong/missed：参考文本字符；extra：无 */
  expected?: string
  /** match/wrong/extra：用户输入字符（extra 为该组多余串） */
  got?: string
  /** 参考文本下标（extra 无） */
  refIdx?: number
  /** extra 组的连续多余字符数 */
  count?: number
}

export interface CompareResult {
  items: DiffItem[]
  correct: number
  /** 参考文本总字符数（空格计入） */
  total: number
  extraCount: number
  /** correct / total，total 为 0 时返回 null */
  accuracyPct: number | null
}

interface LcsCell {
  len: number
}

/**
 * 比对参考文本与用户输入。
 * 对齐策略：LCS 保留最大匹配；非匹配区段中删/插两两配对为 wrong（错字），
 * 剩余删除为 missed（漏抄）、剩余插入按连续段合并为 extra（多余）。
 */
export function compareText(reference: string, input: string): CompareResult {
  const ref = reference.toUpperCase()
  const got = input.toUpperCase()
  const n = ref.length
  const m = got.length

  // LCS 动态规划
  const dp: LcsCell[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => ({ len: 0 })),
  )
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j].len =
        ref[i - 1] === got[j - 1]
          ? dp[i - 1][j - 1].len + 1
          : Math.max(dp[i - 1][j].len, dp[i][j - 1].len)
    }
  }

  // 回溯得到对齐路径（ref 下标与 got 下标的配对关系）
  type Pair = { i: number; j: number } | { del: number } | { ins: number }
  const path: Pair[] = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (ref[i - 1] === got[j - 1]) {
      path.push({ i: i - 1, j: j - 1 })
      i--
      j--
    } else if (dp[i - 1][j].len >= dp[i][j - 1].len) {
      path.push({ del: i - 1 })
      i--
    } else {
      path.push({ ins: j - 1 })
      j--
    }
  }
  while (i > 0) {
    path.push({ del: i - 1 })
    i--
  }
  while (j > 0) {
    path.push({ ins: j - 1 })
    j--
  }
  path.reverse()

  // 合并为展示项
  const items: DiffItem[] = []
  let correct = 0
  let extraCount = 0

  let k = 0
  while (k < path.length) {
    const p = path[k]
    if ('i' in p) {
      items.push({ kind: 'match', expected: ref[p.i], got: got[p.j], refIdx: p.i })
      correct++
      k++
      continue
    }
    // 收集一段连续的非匹配区
    const dels: number[] = []
    const ins: number[] = []
    while (k < path.length && !('i' in path[k])) {
      const q = path[k]
      if ('del' in q) dels.push(q.del)
      else if ('ins' in q) ins.push(q.ins)
      k++
    }
    // 删/插两两配对 → 错字
    const pairCount = Math.min(dels.length, ins.length)
    for (let x = 0; x < pairCount; x++) {
      items.push({
        kind: 'wrong',
        expected: ref[dels[x]],
        got: got[ins[x]],
        refIdx: dels[x],
      })
    }
    // 剩余删除 → 漏抄
    for (let x = pairCount; x < dels.length; x++) {
      items.push({ kind: 'missed', expected: ref[dels[x]], refIdx: dels[x] })
    }
    // 剩余插入 → 连续段合并为一个 extra
    if (ins.length > pairCount) {
      const extras = ins.slice(pairCount)
      const merged: string[] = []
      for (const idx of extras) merged.push(got[idx])
      items.push({ kind: 'extra', got: merged.join(''), count: merged.length })
      extraCount += merged.length
    }
  }

  return {
    items,
    correct,
    total: n,
    extraCount,
    accuracyPct: n === 0 ? null : Math.round((correct / n) * 1000) / 10,
  }
}

/**
 * 从比对结果聚合弱项字符（正确率 < 80%，按错误率降序，最多 10 个）。
 * 空格与空白字符不计入。
 */
export function weakCharsFromCompare(result: CompareResult): WeakChar[] {
  const map = new Map<string, { correct: number; total: number }>()
  for (const it of result.items) {
    if (it.kind !== 'match' && it.kind !== 'wrong' && it.kind !== 'missed') continue
    const ch = (it.expected ?? '').toUpperCase()
    if (!ch.trim()) continue
    const e = map.get(ch) ?? { correct: 0, total: 0 }
    e.total++
    if (it.kind === 'match') e.correct++
    map.set(ch, e)
  }
  return [...map.entries()]
    .map(([ch, e]) => ({ ch, correct: e.correct, total: e.total }))
    .filter((w) => w.correct / w.total < 0.8)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, 10)
}

/* ------------------------------------------------------------------ */
/* 词级比对：按组验证 / 文章大块匹配                                       */
/* ------------------------------------------------------------------ */

/** 两串的 LCS 长度（滚动数组，O(lenA·lenB)） */
export function lcsLength(a: string, b: string): number {
  const m = b.length
  if (m === 0 || a.length === 0) return 0
  let prev = new Array<number>(m + 1).fill(0)
  let curr = new Array<number>(m + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= m; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1])
    }
    ;[prev, curr] = [curr, prev]
    curr.fill(0)
  }
  return prev[m]
}

/** 词比对模式：strict=组内全等才算对（呼号/通联/数字组）；fuzzy=词内允许小错（文章） */
export type WordMatchMode = 'strict' | 'fuzzy'

/** fuzzy 模式的词相似度阈值（字符 LCS / 较长词长度） */
export const FUZZY_THRESHOLD = 0.6

export interface WordDiffItem {
  kind: 'match' | 'wrong' | 'missed'
  expected: string
  /** 用户发出的词（match 时与 expected 相同；missed 为 null） */
  got: string | null
  /** 组内字符相似度 0-1 */
  similarity: number
  /** 属于连续 ≥2 词的匹配块（文章"大片对得上"的高亮依据） */
  block: boolean
}

export interface WordCompareResult {
  items: WordDiffItem[]
  /** 用户多发出来的词（按出现顺序） */
  extraWords: string[]
  /** 参考词总数 */
  total: number
  /** 全等匹配词数 */
  correct: number
  accuracyPct: number | null
}

/**
 * 词级比对：以"组/词"为单位对齐。
 * - strict：词全等才可配对，配不上的 expected/got 按 gap 顺序两两配成 wrong；
 * - fuzzy：词相似度 ≥ FUZZY_THRESHOLD 即可配对（词内允许少量错漏），
 *   用于长文章容忍中间的错漏，呈现连续匹配的大块。
 * 对齐策略为词级 LCS（保最大匹配数），gap 内 del/ins 两两配对为 wrong。
 */
export function compareByWords(
  reference: string,
  input: string,
  mode: WordMatchMode = 'strict',
): WordCompareResult {
  const expected = splitWords(reference)
  const gotWords = splitWords(input)
  const n = expected.length
  const m = gotWords.length

  const simCache = new Map<string, number>()
  const sim = (a: string, b: string): number => {
    const key = `${a}\u0000${b}`
    let v = simCache.get(key)
    if (v === undefined) {
      v = lcsLength(a, b) / Math.max(a.length, b.length)
      simCache.set(key, v)
    }
    return v
  }

  const canMatch = (a: string, b: string): boolean =>
    a === b || (mode === 'fuzzy' && sim(a, b) >= FUZZY_THRESHOLD)

  // 词级 LCS
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = canMatch(expected[i - 1], gotWords[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }

  // 回溯：pairs（配对下标）+ gaps
  type Pair = { i: number; j: number }
  type Gap = { dels: number[]; ins: number[] }
  const seq: (Pair | Gap)[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && canMatch(expected[i - 1], gotWords[j - 1]) && dp[i][j] === dp[i - 1][j - 1] + 1) {
      seq.push({ i: i - 1, j: j - 1 })
      i--
      j--
    } else if (i > 0 && (j === 0 || dp[i - 1][j] >= dp[i][j - 1])) {
      const last = seq[seq.length - 1]
      if (last && 'dels' in last) last.dels.unshift(i - 1)
      else seq.push({ dels: [i - 1], ins: [] })
      i--
    } else {
      const last = seq[seq.length - 1]
      if (last && 'dels' in last) last.ins.unshift(j - 1)
      else seq.push({ dels: [], ins: [j - 1] })
      j--
    }
  }
  seq.reverse()

  // 展开为 items；gap 内 del/ins 顺序配对为 wrong
  const raw: WordDiffItem[] = []
  const extraWords: string[] = []
  let correct = 0
  for (const node of seq) {
    if ('i' in node) {
      raw.push({ kind: 'match', expected: expected[node.i], got: gotWords[node.j], similarity: 1, block: false })
      correct++
      continue
    }
    const { dels, ins } = node
    const pairCount = Math.min(dels.length, ins.length)
    for (let x = 0; x < pairCount; x++) {
      raw.push({
        kind: 'wrong',
        expected: expected[dels[x]],
        got: gotWords[ins[x]],
        similarity: Math.round(sim(expected[dels[x]], gotWords[ins[x]]) * 100) / 100,
        block: false,
      })
    }
    for (let x = pairCount; x < dels.length; x++) {
      raw.push({ kind: 'missed', expected: expected[dels[x]], got: null, similarity: 0, block: false })
    }
    for (let x = pairCount; x < ins.length; x++) {
      extraWords.push(gotWords[ins[x]])
    }
  }

  // 连续 ≥2 个 match 标记为匹配块（"大片对得上"）
  const items = raw
  let run = 0
  for (let k = 0; k <= items.length; k++) {
    if (k < items.length && items[k].kind === 'match') {
      run++
    } else {
      if (run >= 2) {
        for (let x = k - run; x < k; x++) items[x].block = true
      }
      run = 0
    }
  }

  return {
    items,
    extraWords,
    total: n,
    correct,
    accuracyPct: n === 0 ? null : Math.round((correct / n) * 1000) / 10,
  }
}
