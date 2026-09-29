/**
 * 自动键（iambic 双桨）状态机。
 *
 * 角色 =「虚拟的手」：接收物理桨按下/抬起事件，按 iambic 规则自动调度
 * 精确时序的 down/up 事件，驱动现有下游（音频包络 + 直键解码器），
 * 时间线/统计/比对/报告零改动复用。字符边界不在此处理——与真实 keyer
 * 一致，由操作员停顿（松桨不发）自然形成。
 *
 * 时序（Td = 1200 / WPM）：
 * - 点 = 1Td，划 = 3Td，元素间间隙 = 1Td
 * - 元素结束时刻读桨状态决定下一元素：
 *   双桨按住 → 相反元素（iambic 交替）；仅当前桨 → 重复；
 *   仅对方桨 → 对方；全松手 → Mode A 停止 / Mode B 补发记忆的元素
 *
 * Mode B 记忆（squeeze latch）：练习期间只要双桨同时按住过（挤压）即置位，
 * 全松手后若仍有元素刚结束，补发一个相反元素（消费即清）。典型差异：挤压
 * di-dah 后在划进行中松手——Mode A 发出 di-dah（A），Mode B 多发一点成
 * di-dah-dit（R）；快速触碰即松——Mode A 发 di（E），Mode B 发 di-dah（A）。
 *
 * 调度用链式 setTimeout（15WPM 点长 80ms、40WPM 点长 30ms，均远大于
 * 浏览器 timer 抖动 ~1-4ms，节奏统计在容差内不受影响）。
 */

export type PaddleEl = 'dit' | 'dah'
export type KeyerStyle = 'a' | 'b'

/** 元素持续时长：点 1Td / 划 3Td */
export function elDurationMs(el: PaddleEl, wpm: number): number {
  const td = 1200 / wpm
  return el === 'dit' ? td : 3 * td
}

/** 元素间间隙：1Td */
export function elGapMs(wpm: number): number {
  return 1200 / wpm
}

/**
 * 下一元素判定（纯函数，可单测）。
 * @param current 刚结束的元素
 * @param ditPressed 元素结束时刻点桨是否按住
 * @param dahPressed 元素结束时刻划桨是否按住
 * @param style iambic 行为模式
 * @param squeezed Mode B：期间发生过双桨挤压（A 模式恒为 false）
 */
export function nextElement(
  current: PaddleEl,
  ditPressed: boolean,
  dahPressed: boolean,
  style: KeyerStyle,
  squeezed: boolean,
): PaddleEl | null {
  if (ditPressed && dahPressed) return current === 'dit' ? 'dah' : 'dit'
  if (ditPressed) return 'dit'
  if (dahPressed) return 'dah'
  if (style === 'b' && squeezed) return current === 'dit' ? 'dah' : 'dit'
  return null
}

export interface AutoKeyerHandlers {
  /** 虚拟按下（下游：音频起音 + decoder.down） */
  onDown(nowMs: number): void
  /** 虚拟抬起（下游：音频消音 + decoder.up） */
  onUp(nowMs: number): void
}

export interface AutoKeyerOptions {
  /** 实时取当前速度（练习中调速立即对下一个元素生效） */
  getWpm: () => number
}

export class AutoKeyer {
  private readonly handlers: AutoKeyerHandlers
  private readonly getWpm: () => number

  private style: KeyerStyle = 'a'
  private running = false

  private ditDown = false
  private dahDown = false
  /** 当前正在发的元素；null = 空闲（含元素间间隙） */
  private current: PaddleEl | null = null
  /** Mode B：发生过双桨挤压（置位后保持到补发消费） */
  private squeezed = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor(handlers: AutoKeyerHandlers, options: AutoKeyerOptions) {
    this.handlers = handlers
    this.getWpm = options.getWpm
  }

  setStyle(style: KeyerStyle): void {
    this.style = style
  }

  /** 练习开始：复位并开始接收桨事件 */
  start(): void {
    this.clearTimer()
    this.ditDown = false
    this.dahDown = false
    this.current = null
    this.squeezed = false
    this.running = true
  }

  /**
   * 练习结束：停止调度并复位。
   * 不补发 onUp——若尚有元素进行中，残缺按压由 decoder.flush() 收尾、
   * 音频由 audio.silence() 消音（useKeyer.stop 的既有顺序）。
   */
  stop(): void {
    this.running = false
    this.clearTimer()
    this.ditDown = false
    this.dahDown = false
    this.current = null
    this.squeezed = false
  }

  onDitDown(now: number): void {
    if (!this.running) return
    this.ditDown = true
    this.onPaddleDown('dit', now)
  }

  onDitUp(): void {
    this.ditDown = false
  }

  onDahDown(now: number): void {
    if (!this.running) return
    this.dahDown = true
    this.onPaddleDown('dah', now)
  }

  onDahUp(): void {
    this.dahDown = false
  }

  private onPaddleDown(el: PaddleEl, now: number): void {
    if (this.ditDown && this.dahDown) this.squeezed = true
    if (this.current === null) {
      // 空闲（含间隙中）：立即开始发该元素，抢占未完成的间隙等待
      this.startElement(el, now)
    }
  }

  private startElement(el: PaddleEl, now: number): void {
    this.clearTimer()
    this.current = el
    this.handlers.onDown(now)
    this.timer = setTimeout(() => this.endElement(), elDurationMs(el, this.getWpm()))
  }

  private endElement(): void {
    this.clearTimer()
    if (this.current === null) return
    const finished = this.current
    this.current = null
    this.handlers.onUp(performance.now())

    const next = nextElement(finished, this.ditDown, this.dahDown, this.style, this.squeezed)
    if (
      next !== null &&
      !this.ditDown &&
      !this.dahDown &&
      this.style === 'b' &&
      this.squeezed
    ) {
      this.squeezed = false // B 补发消费
    }
    if (next !== null) {
      this.scheduleNext(next, !this.ditDown && !this.dahDown && this.style === 'b')
    }
  }

  /**
   * 排队下一个元素（经 1Td 间隙）。
   * @param extra 是否为 Mode B 松手补发——间隙中全松手时仍照发；
   *              常规元素在间隙中全松手则取消（Mode A 释放即停的精确语义）
   */
  private scheduleNext(next: PaddleEl, extra: boolean): void {
    this.timer = setTimeout(() => {
      if (!extra && this.style === 'a' && !this.ditDown && !this.dahDown) return
      this.startElement(next, performance.now())
    }, elGapMs(this.getWpm()))
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
