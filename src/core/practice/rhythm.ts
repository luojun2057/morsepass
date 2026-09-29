/**
 * 节奏问题分类汇总（报告用）。
 * 从符号记录（含时间戳）中统计六类常见问题：
 * 点太短/点太长/划太短/划太长 + 间隔维度（字符内间隔、字符间隔）各自太短/太长。
 * 纯函数，可单测。
 */

import { ditMs, type SymbolKind } from '../morse/timing'

export type RhythmIssueKind =
  | 'ditShort'
  | 'ditLong'
  | 'dahShort'
  | 'dahLong'
  | 'elemGapShort'
  | 'elemGapLong'
  | 'charGapShort'
  | 'charGapLong'

export const ISSUE_LABELS: Record<RhythmIssueKind, string> = {
  ditShort: '点太短',
  ditLong: '点太长',
  dahShort: '划太短',
  dahLong: '划太长',
  elemGapShort: '字符内间隔太短',
  elemGapLong: '字符内间隔太长',
  charGapShort: '字符间隔太短',
  charGapLong: '字符间隔太长',
}

export interface RhythmIssue {
  kind: RhythmIssueKind
  label: string
  /** 出错次数 */
  count: number
  /** 该类平均偏差（相对期望时长的百分比，正=偏长，负=偏短） */
  avgDevPct: number
}

/** 输入记录：符号 + 抬起时刻（时间线记录即满足） */
export interface RhythmSourceRecord {
  sym: SymbolKind
  durationMs: number
  /** 符号抬起时刻（距会话开始毫秒） */
  t: number
}

/**
 * 汇总节奏问题。
 * - 符号：|实测 − 期望| > 期望×容差% 判为太长/太短
 * - 间隔：抬起到下次按下，< 2Td 视为字符内间隔（期望 1Td），
 *   否则视为字符/单词间隔（期望 3Td，≥5Td 的单词间隔并入统计）
 * - 返回按出错次数降序的非空问题列表
 */
export function analyzeRhythmIssues(
  records: RhythmSourceRecord[],
  wpm: number,
  tolerancePct: number,
): RhythmIssue[] {
  const td = ditMs(wpm)
  const tol = tolerancePct / 100
  const acc = new Map<RhythmIssueKind, number[]>() // kind -> 偏差比例列表

  const bump = (kind: RhythmIssueKind, devRatio: number): void => {
    const list = acc.get(kind) ?? []
    list.push(devRatio)
    acc.set(kind, list)
  }

  for (const r of records) {
    const expected = r.sym === 'dit' ? td : 3 * td
    const dev = (r.durationMs - expected) / expected
    if (dev > tol) bump(r.sym === 'dit' ? 'ditLong' : 'dahLong', dev)
    else if (dev < -tol) bump(r.sym === 'dit' ? 'ditShort' : 'dahShort', dev)
  }

  for (let i = 1; i < records.length; i++) {
    const gap = records[i].t - records[i].durationMs - records[i - 1].t
    if (gap <= 0) continue // 异常（触点合并重发等），跳过
    const expected = gap < 2 * td ? td : gap < 5 * td ? 3 * td : 7 * td
    const dev = (gap - expected) / expected
    const isElem = gap < 2 * td
    if (dev > tol) bump(isElem ? 'elemGapLong' : 'charGapLong', dev)
    else if (dev < -tol) bump(isElem ? 'elemGapShort' : 'charGapShort', dev)
  }

  const out: RhythmIssue[] = []
  for (const [kind, devs] of acc) {
    const avg = devs.reduce((a, b) => a + b, 0) / devs.length
    out.push({
      kind,
      label: ISSUE_LABELS[kind],
      count: devs.length,
      avgDevPct: Math.round(avg * 100),
    })
  }
  return out.sort((a, b) => b.count - a.count)
}
