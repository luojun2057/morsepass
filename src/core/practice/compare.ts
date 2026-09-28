/**
 * 听抄/跟发比对：基于最长公共子序列（LCS）的字符对齐。
 * 比较前双方统一转大写；空格参与比较。
 */

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
