/** 全局共享类型定义 */

export type PracticeMode = 'send' | 'receive' | 'follow' | 'koch'

/** 发报页模式：自由发报 / 对照文章发报 */
export type SendMode = 'free' | 'article'

export interface GlobalSettings {
  /** 输入源配置：鼠标（电键模拟点击）与键盘可同时启用 */
  input: {
    /** 电键模拟的鼠标键：0=左键 2=右键；null=禁用鼠标输入 */
    mouseButton: 0 | 2 | null
    /** 键盘按键 code（如 'Space'、'KeyJ'）；null=禁用键盘输入 */
    key: string | null
  }
  toneHz: number
  volume: number
  displayCase: 'lower' | 'upper'
  /** 发报页模式（默认自由发报） */
  sendMode: SendMode
  /** QRM 噪声开关与电平 */
  noise: { enabled: boolean; level: number }
}

export interface TimingSettings {
  /** 字符速度 WPM（点划基准速度） */
  wpmChar: number
  /** 有效速度 WPM（Farnsworth 间隔），<= wpmChar 时生效 */
  wpmEff: number
  /** 节奏容差百分比 0-50 */
  tolerancePct: number
}

export interface WeakChar {
  ch: string
  correct: number
  total: number
}

export interface SessionRecord {
  id: string
  date: string
  mode: PracticeMode
  wpmChar: number
  wpmEff: number
  toneHz: number
  durationMs: number
  charsTotal: number
  charsCorrect: number
  accuracyPct: number
  /** 节奏准确率（send/follow 有值，receive/koch 为 null） */
  symbolAccuracyPct: number | null
  weakChars: WeakChar[]
  /** 素材类型快照，如 'chars' | 'words' | 'text' */
  material?: string
}
