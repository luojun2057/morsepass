/**
 * 练习素材生成器：随机字符组 / 单词 / 呼号 / Q码缩写 / 混合。
 * 全部接受种子随机数生成器，保证测试可复现。
 */

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

export type MaterialKind = 'chars' | 'words' | 'callsigns' | 'abbreviations' | 'mixed' | 'text'

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
}

export function generateMaterial(rng: () => number, opts: MaterialOptions): string {
  const count = Math.max(1, opts.count)
  switch (opts.kind) {
    case 'text':
      return opts.text ?? ''
    case 'chars':
      return generateCharGroups(rng, opts.charSet ?? ['E', 'T', 'A', 'N'], count, opts.groupLen ?? 5)
    case 'words':
      return generateWords(rng, count)
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
