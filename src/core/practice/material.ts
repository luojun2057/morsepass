/**
 * 练习素材生成器：随机字符组 / 单词 / 呼号 / Q码缩写 / 混合 / QSO 模板。
 * 全部接受种子随机数生成器，保证测试可复现。
 */

import { normalizeText } from '@/core/morse/codec'

/** mulberry32 种子随机数生成器，返回 [0,1) 均匀分布 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** 随机 5 字符组：每组 groupLen 个字符，组间以空格分隔（播放时即单词间隔） */
export function generateCharGroups(
  rng: () => number,
  charSet: readonly string[],
  groups: number,
  groupLen = 5,
): string {
  const out: string[] = []
  for (let g = 0; g < groups; g++) {
    let s = ''
    for (let i = 0; i < groupLen; i++) s += pick(rng, charSet)
    out.push(s)
  }
  return out.join(' ')
}

/** 常用英文单词表（约 200 词，节选自通用高频词表） */
export const COMMON_WORDS: readonly string[] = [
  'THE', 'OF', 'AND', 'TO', 'IN', 'IS', 'YOU', 'THAT', 'IT', 'HE', 'WAS', 'FOR',
  'ON', 'ARE', 'AS', 'WITH', 'HIS', 'THEY', 'AT', 'BE', 'THIS', 'HAVE', 'FROM',
  'OR', 'ONE', 'HAD', 'BY', 'WORD', 'BUT', 'NOT', 'WHAT', 'ALL', 'WERE', 'WE',
  'WHEN', 'YOUR', 'CAN', 'SAID', 'THERE', 'USE', 'AN', 'EACH', 'WHICH', 'SHE',
  'DO', 'HOW', 'THEIR', 'IF', 'WILL', 'UP', 'OTHER', 'ABOUT', 'OUT', 'MANY',
  'THEN', 'THEM', 'THESE', 'SO', 'SOME', 'HER', 'WOULD', 'MAKE', 'LIKE', 'HIM',
  'INTO', 'TIME', 'HAS', 'LOOK', 'TWO', 'MORE', 'WRITE', 'GO', 'SEE', 'NUMBER',
  'NO', 'WAY', 'COULD', 'PEOPLE', 'MY', 'THAN', 'FIRST', 'WATER', 'BEEN', 'CALL',
  'WHO', 'ITS', 'NOW', 'FIND', 'LONG', 'DOWN', 'DAY', 'DID', 'GET', 'COME',
  'MADE', 'MAY', 'PART', 'OVER', 'NEW', 'SOUND', 'TAKE', 'ONLY', 'LITTLE',
  'WORK', 'KNOW', 'PLACE', 'YEAR', 'LIVE', 'ME', 'BACK', 'GIVE', 'MOST', 'VERY',
  'AFTER', 'THING', 'OUR', 'JUST', 'NAME', 'GOOD', 'MAN', 'THINK', 'SAY',
  'GREAT', 'WHERE', 'HELP', 'THROUGH', 'MUCH', 'BEFORE', 'LINE', 'RIGHT', 'TOO',
  'MEAN', 'OLD', 'ANY', 'SAME', 'TELL', 'BOY', 'FOLLOW', 'CAME', 'WANT', 'SHOW',
  'ALSO', 'AROUND', 'FORM', 'THREE', 'SMALL', 'SET', 'PUT', 'END', 'DOES',
  'ANOTHER', 'WELL', 'LARGE', 'MUST', 'BIG', 'EVEN', 'SUCH', 'BECAUSE', 'TURN',
  'HERE', 'WHY', 'ASK', 'WENT', 'MEN', 'READ', 'NEED', 'LAND', 'DIFFERENT',
  'HOME', 'US', 'MOVE', 'TRY', 'KIND', 'HAND', 'PICTURE', 'AGAIN', 'CHANGE',
  'OFF', 'PLAY', 'SPELL', 'AIR', 'AWAY', 'ANIMAL', 'HOUSE', 'POINT', 'PAGE',
  'LETTER', 'MOTHER', 'ANSWER', 'FOUND', 'STUDY', 'STILL', 'LEARN', 'SHOULD',
  'WORLD', 'HIGH', 'EVERY', 'NEAR', 'ADD', 'FOOD', 'BETWEEN', 'OWN', 'BELOW',
  'COUNTRY', 'PLANT', 'LAST', 'SCHOOL', 'FATHER', 'KEEP', 'TREE', 'NEVER',
  'START', 'CITY', 'EARTH', 'EYE', 'LIGHT', 'THOUGHT', 'HEAD', 'UNDER', 'STORY',
  'SAW', 'LEFT', 'FEW', 'WHILE', 'ALONG', 'MIGHT', 'CLOSE', 'SOMETHING', 'SEEM',
  'NEXT', 'HARD', 'OPEN', 'EXAMPLE', 'BEGIN', 'LIFE', 'ALWAYS', 'THOSE', 'BOTH',
  'PAPER', 'TOGETHER', 'GOT', 'GROUP', 'OFTEN', 'RUN',
]

/** 业余无线电常用缩写 / Q 码（约 100 条） */
export const HAM_ABBREVIATIONS: readonly string[] = [
  'CQ', 'DE', 'K', 'KN', 'AR', 'SK', 'BT', 'R', 'QTH', 'QRA', 'QRB', 'QRG',
  'QRK', 'QRL', 'QRM', 'QRN', 'QRQ', 'QRS', 'QRT', 'QRZ', 'QSB', 'QSD', 'QSL',
  'QSO', 'QSY', 'QSZ', 'QTC', 'GM', 'GE', 'GN', 'GD', 'OK', 'RIG', 'ANT', 'WX',
  'HR', 'ES', 'UR', 'MY', 'TNX', 'PSE', 'CUL', '73', '88', 'BCNU', 'HPE',
  'CUAGN', 'RPT', 'FER', 'MSG', 'OM', 'YL', 'XYL', 'HAM', 'NET', 'FB', 'RST',
  '599', '5NN', 'AGN', 'ABT', 'ADR', 'BK', 'B4', 'CL', 'CPY', 'DR', 'DX', 'GA',
  'GE', 'GND', 'GUD', 'HI', 'HV', 'HW', 'NG', 'NIL', 'NR', 'NW', 'OB', 'OC',
  'OD', 'OF', 'OT', 'PWR', 'RCVR', 'REF', 'RF', 'SKED', 'SRI', 'SSB', 'TFC',
  'TKS', 'TMW', 'TU', 'TX', 'U', 'VY', 'WID', 'WKD', 'WPM', 'XCVR', 'XMAS',
  'SASE', 'SED', 'SIG', 'STL', 'MILS', 'LID', 'ERR', 'EL', 'BCI', 'ANTI',
]

/** 真实风格呼号前缀（含中国业余电台常用前缀 BA/BD/BG/BH/BJ/BS） */
export const CALLSIGN_PREFIXES: readonly string[] = [
  'JA', 'JE', 'W', 'K', 'N', 'KA', 'G', 'M', 'GM', 'DL', 'F', 'I', 'EA',
  'VK', 'ZL', 'PY', 'UA', 'UA9', 'UR', 'OK', 'SP', 'ON', 'OZ', 'SM', 'LA',
  'OH', 'PA', 'HB', 'CE', 'LU', 'BA', 'BD', 'BG', 'BH', 'BJ', 'BS',
  '9V1', 'HL', 'HS', 'VU', '4X', '5B', 'SV', 'YO', 'HA', 'LZ', 'ZS',
]

const SUFFIX_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** 生成一个呼号：前缀 + 数字 + 1~3 位后缀字母 */
export function generateCallsign(rng: () => number): string {
  const prefix = pick(rng, CALLSIGN_PREFIXES)
  const digit = Math.floor(rng() * 10)
  const suffixLen = 1 + Math.floor(rng() * 3)
  let suffix = ''
  for (let i = 0; i < suffixLen; i++) suffix += SUFFIX_LETTERS[Math.floor(rng() * 26)]
  return `${prefix}${digit}${suffix}`
}

export function generateCallsigns(rng: () => number, count: number): string {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(generateCallsign(rng))
  return out.join(' ')
}

export function generateWords(rng: () => number, count: number, list: readonly string[] = COMMON_WORDS): string {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(pick(rng, list))
  return out.join(' ')
}

export function generateAbbreviations(rng: () => number, count: number, list: readonly string[] = HAM_ABBREVIATIONS): string {
  const out: string[] = []
  for (let i = 0; i < count; i++) out.push(pick(rng, list))
  return out.join(' ')
}

export type MaterialKind = 'chars' | 'digits' | 'words' | 'callsigns' | 'abbreviations' | 'mixed' | 'text' | 'qso' | 'article'

/** QSO 通联模板：callsign=本台呼号，peer=对方呼号 */
export interface QsoTemplate {
  id: string
  name: string
  build: (callsign: string, peer: string) => string
}

const FALLBACK_SELF = 'BA1XXX'
const FALLBACK_PEER = 'BA9ZZZ'

export const QSO_TEMPLATES: readonly QsoTemplate[] = [
  {
    id: 'cq',
    name: 'CQ 呼叫',
    build: (c) => `CQ CQ CQ DE ${c} ${c} K`,
  },
  {
    id: 'answer',
    name: '回应呼叫',
    build: (c, p) => `${p} DE ${c} ${p} DE ${c} R K`,
  },
  {
    id: 'report',
    name: '信号报告',
    build: (c, p) => `${p} DE ${c} R UR RST 599 599 5NN K`,
  },
  {
    id: 'info',
    name: '设备与天气',
    build: (c, p) => `${p} DE ${c} RIG K3 ANT DP ES WX SUNNY HW? K`,
  },
  {
    id: 'qsl',
    name: '致谢结束',
    build: (c, p) => `${p} DE ${c} TNX FER QSO 73 ES CUL SK`,
  },
]

/** 按 id 构建 QSO 模板文本（呼号缺省时使用占位呼号） */
export function buildQso(id: string, callsign: string, peer: string): string | null {
  const tpl = QSO_TEMPLATES.find((t) => t.id === id)
  if (!tpl) return null
  const self = normalizeText(callsign).replace(/\s+/g, '') || FALLBACK_SELF
  const other = normalizeText(peer).replace(/\s+/g, '') || FALLBACK_PEER
  return tpl.build(self, other)
}

export interface MaterialOptions {
  kind: MaterialKind
  /** chars 模式的字符集 */
  charSet?: readonly string[]
  /** 生成单词/字符组/呼号的数量（chars 模式为组数） */
  count: number
  /** 自由文本（kind='text' 时使用，优先级最高） */
  text?: string
  /** chars 模式每组字符数，默认 5 */
  groupLen?: number
  /** qso 模式：模板 id / 本台呼号 / 对方呼号 */
  qsoId?: string
  callsign?: string
  peer?: string
}

export function generateMaterial(rng: () => number, opts: MaterialOptions): string {
  const count = Math.max(1, opts.count)
  switch (opts.kind) {
    case 'text':
      return opts.text ?? ''
    case 'qso':
      return buildQso(opts.qsoId ?? 'cq', opts.callsign ?? '', opts.peer ?? '') ?? ''
    case 'chars':
      return generateCharGroups(rng, opts.charSet ?? ['E', 'T', 'A', 'N'], count, opts.groupLen ?? 5)
    case 'digits':
      // 4 字一组数字（默认），可用 groupLen 调整
      return generateCharGroups(rng, opts.charSet ?? '0123456789'.split(''), count, opts.groupLen ?? 4)
    case 'words':
      return generateWords(rng, count)
    case 'article':
      // 大段英文文章：默认 80 词，适合词级对齐训练
      return generateWords(rng, Math.max(20, count))
    case 'callsigns':
      return generateCallsigns(rng, count)
    case 'abbreviations':
      return generateAbbreviations(rng, count)
    case 'mixed': {
      const words = generateWords(rng, Math.ceil(count / 2))
      const calls = generateCallsigns(rng, Math.max(1, Math.floor(count / 3)))
      const abbrs = generateAbbreviations(rng, Math.max(1, Math.floor(count / 4)))
      return [words, calls, abbrs]
        .join(' ')
        .split(' ')
        .sort(() => rng() - 0.5)
        .join(' ')
    }
  }
}

/** 素材跟随高亮：按已发字符数把素材切成 已发/当前/未发 三态片段（相邻同态合并） */
export type MaterialSpanState = 'sent' | 'cur' | 'rest'

export interface MaterialSpan {
  text: string
  state: MaterialSpanState
}

export function buildMaterialSpans(material: string, sentCount: number): MaterialSpan[] {
  const sent = Math.max(0, Math.min(sentCount, material.length))
  const spans: MaterialSpan[] = []
  const push = (state: MaterialSpanState, from: number, to: number): void => {
    if (to <= from) return
    const text = material.slice(from, to)
    if (!text) return
    const last = spans[spans.length - 1]
    if (last && last.state === state) last.text += text
    else spans.push({ text, state })
  }
  push('sent', 0, sent)
  push('cur', sent, sent + 1)
  push('rest', sent + 1, material.length)
  return spans
}
