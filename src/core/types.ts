/** 全局共享类型定义 */

export type PracticeMode = 'send' | 'receive' | 'follow' | 'koch'

/** 发报页模式：自由发报 / 对照文章发报 */
export type SendMode = 'free' | 'article'

/** 键控模式：手动键（直键，按多久发多久）或自动键（双桨 iambic，按住自动重复） */
export type KeyerMode = 'manual' | 'auto'

/** 自动键 iambic 行为：A=松手即停；B=记忆多发一个相反元素 */
export type KeyerStyle = 'a' | 'b'

export interface GlobalSettings {
  /** 输入源配置：鼠标（电键模拟点击）与键盘可同时启用 */
  input: {
    /** 电键模拟的鼠标键：0=左键 2=右键；null=禁用鼠标输入（手动键用） */
    mouseButton: 0 | 2 | null
    /** 键盘按键 code（如 'Space'、'KeyJ'）；null=禁用键盘输入（手动键用） */
    key: string | null
    /** 键控模式（默认手动键） */
    keyerMode: KeyerMode
    /** 自动键「点桨」键盘绑定 code；null=未绑定 */
    paddleDitKey: string | null
    /** 自动键「划桨」键盘绑定 code；null=未绑定 */
    paddleDahKey: string | null
    /** 自动键点划互换：交换物理输入到桨的映射（鼠标与键盘同时换） */
    paddleReverse: boolean
    /** 自动键 iambic 行为（默认 Mode A） */
    keyerStyle: KeyerStyle
  }
  toneHz: number
  volume: number
  displayCase: 'lower' | 'upper'
  /** 发报页模式（默认自由发报） */
  sendMode: SendMode
  /** QRM 噪声开关与电平 */
  noise: { enabled: boolean; level: number }
  /** QSB 衰落开关与深度（0-1，播放链路音量随机起伏） */
  qsb: { enabled: boolean; level: number }
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
  /** 键控模式快照（自动键功能上线前的旧记录无此字段） */
  keyerMode?: KeyerMode
}
