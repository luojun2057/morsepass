/**
 * 音频引擎：常驻振荡器 + 音量包络调度（Web Audio 正确姿势）。
 *
 * 延迟关键点：
 * - AudioContext 在首次用户手势时创建并 resume，之后常驻
 * - 振荡器启动一次后不停，发声/静音全部通过 GainNode 包络调度，
 *   杜绝"每次按键新建振荡器"的启动开销
 * - 发报路径：keydown → 立即 ramp up（约 4ms 起音），体感无延迟
 */

type AnyAudioContext = AudioContext & { webkitAudioContext?: typeof AudioContext }

export interface LatencyInfo {
  baseMs: number | null
  outputMs: number | null
  sampleRate: number | null
}

export interface EngineOptions {
  /** 测试注入用：自定义 AudioContext 工厂 */
  createContext?: () => AudioContext
}

export class AudioEngine {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  /** QSB 衰落节点（串在主 gain 之后） */
  private qsbGain: GainNode | null = null
  private noiseSrc: AudioBufferSourceNode | null = null
  private noiseGain: GainNode | null = null
  private noiseFilter: BiquadFilterNode | null = null
  private toneHz = 700
  private volume = 0.5
  private noiseLevel = 0.15
  private qsbEnabled = false
  private qsbLevel = 0.4
  private readonly createCtx?: () => AudioContext

  constructor(options: EngineOptions = {}) {
    this.createCtx = options.createContext
  }

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running'
  }

  /** 在用户手势中调用：创建/恢复上下文并启动常驻振荡器 */
  ensure(): AudioContext {
    if (!this.ctx) {
      const Ctor = this.createCtx ?? defaultContextFactory()
      this.ctx = Ctor()
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = this.toneHz
      const gain = this.ctx.createGain()
      gain.gain.value = 0
      const qsbGain = this.ctx.createGain()
      qsbGain.gain.value = 1
      osc.connect(gain)
      gain.connect(qsbGain)
      qsbGain.connect(this.ctx.destination)
      osc.start()
      this.osc = osc
      this.gain = gain
      this.qsbGain = qsbGain
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
    return this.ctx
  }

  /** 恢复挂起的上下文（返回是否已 running） */
  async resumeIfNeeded(): Promise<boolean> {
    if (!this.ctx) return false
    if (this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume()
      } catch {
        /* 用户手势不足等场景，忽略 */
      }
    }
    return this.ctx.state === 'running'
  }

  setTone(hz: number): void {
    const clamped = Math.min(1200, Math.max(300, Math.round(hz)))
    this.toneHz = clamped
    if (this.osc) this.osc.frequency.value = clamped
    if (this.noiseFilter) this.noiseFilter.frequency.value = clamped
  }

  setVolume(v: number): void {
    this.volume = Math.min(1, Math.max(0, v))
  }

  /** QSB 衰落配置（播放链路生效；发报按键不受影响） */
  setQsb(enabled: boolean, level = 0.4): void {
    this.qsbEnabled = enabled
    this.qsbLevel = Math.min(1, Math.max(0, level))
    if (this.qsbGain && this.ctx) {
      const g = this.qsbGain.gain
      const t = this.ctx.currentTime
      g.cancelScheduledValues(t)
      g.setValueAtTime(1, t)
    }
  }

  /** 发报按下：立即起音 */
  startTone(): void {
    if (!this.gain || !this.ctx) return
    const g = this.gain.gain
    const t = this.ctx.currentTime + 0.001
    g.cancelScheduledValues(t)
    g.setValueAtTime(Math.min(0.0001, g.value), t)
    g.linearRampToValueAtTime(this.volume, t + 0.004)
  }

  /** 发报抬起：立即消音 */
  stopTone(): void {
    if (!this.gain || !this.ctx) return
    const g = this.gain.gain
    const t = this.ctx.currentTime + 0.001
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(0.0001, t + 0.005)
  }

  /**
   * 批量调度播放包络（听抄/跟发）。
   * events 为相对毫秒时间轴；offsetMs 为相对当前的起始延迟。
   * 返回排程的绝对开始时刻（ctx.currentTime 基准，毫秒）。
   */
  scheduleTones(events: { t: number; on: boolean }[], offsetMs = 0): number {
    if (!this.gain || !this.ctx) return 0
    const g = this.gain.gain
    const t0 = this.ctx.currentTime + offsetMs / 1000 + 0.02
    g.cancelScheduledValues(t0)
    g.setValueAtTime(0.0001, t0)
    for (const ev of events) {
      const abs = t0 + ev.t / 1000
      if (ev.on) {
        g.setValueAtTime(0.0001, abs)
        g.linearRampToValueAtTime(this.volume, abs + 0.004)
      } else {
        g.linearRampToValueAtTime(0.0001, abs + 0.002)
      }
    }
    this.scheduleQsb(events, t0)
    return t0 * 1000
  }

  /** QSB：在 qsbGain 上排程随机慢速起伏（分段线性随机走），模拟信号衰落 */
  private scheduleQsb(events: { t: number; on: boolean }[], t0: number): void {
    if (!this.qsbGain || !this.ctx) return
    const qg = this.qsbGain.gain
    qg.cancelScheduledValues(t0)
    qg.setValueAtTime(1, t0)
    if (!this.qsbEnabled || this.qsbLevel <= 0) return
    const durationMs = events.length > 0 ? events[events.length - 1].t : 0
    const segSec = 0.45
    let t = t0
    const end = t0 + durationMs / 1000
    while (t < end) {
      t += segSec
      const depth = Math.pow(Math.random(), 1.5) * this.qsbLevel
      qg.linearRampToValueAtTime(Math.max(0.05, 1 - depth), Math.min(t, end))
    }
  }

  /** 停止一切已排程/正在进行的发声 */
  silence(): void {
    if (!this.gain || !this.ctx) return
    const g = this.gain.gain
    const t = this.ctx.currentTime
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(0.0001, t + 0.01)
    if (this.qsbGain) {
      const qg = this.qsbGain.gain
      qg.cancelScheduledValues(t)
      qg.setValueAtTime(1, t)
    }
  }

  /** QRM 噪声（白噪声 → 中心频率带通 → 电平） */
  setNoise(enabled: boolean, level = 0.15): void {
    this.noiseLevel = Math.min(0.5, Math.max(0, level))
    if (!this.ctx) return
    if (enabled && !this.noiseSrc) {
      const len = Math.floor(this.ctx.sampleRate * 2)
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      src.loop = true
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = this.toneHz
      filter.Q.value = 6
      const ng = this.ctx.createGain()
      ng.gain.value = this.noiseLevel
      src.connect(filter)
      filter.connect(ng)
      ng.connect(this.ctx.destination)
      src.start()
      this.noiseSrc = src
      this.noiseGain = ng
      this.noiseFilter = filter
    } else if (!enabled && this.noiseSrc) {
      try {
        this.noiseSrc.stop()
      } catch {
        /* 已停止 */
      }
      this.noiseSrc.disconnect()
      this.noiseSrc = null
      this.noiseGain = null
      this.noiseFilter = null
    } else if (enabled && this.noiseGain) {
      this.noiseGain.gain.value = this.noiseLevel
    }
  }

  /** 当前 AudioContext 时钟（毫秒）；未初始化返回 0 */
  nowMs(): number {
    return this.ctx ? this.ctx.currentTime * 1000 : 0
  }

  /** 延迟诊断数据 */
  latency(): LatencyInfo {
    if (!this.ctx) return { baseMs: null, outputMs: null, sampleRate: null }
    const ctx = this.ctx as AudioContext & { outputLatency?: number }
    return {
      baseMs: ctx.baseLatency != null ? Math.round(ctx.baseLatency * 1000) : null,
      outputMs: ctx.outputLatency != null ? Math.round(ctx.outputLatency * 1000) : null,
      sampleRate: ctx.sampleRate ?? null,
    }
  }

  dispose(): void {
    this.setNoise(false)
    try {
      this.osc?.stop()
    } catch {
      /* 已停止 */
    }
    void this.ctx?.close()
    this.ctx = null
    this.osc = null
    this.gain = null
    this.qsbGain = null
  }
}

function defaultContextFactory(): () => AudioContext {
  return () => {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
    const Ctor = w.AudioContext ?? w.webkitAudioContext
    if (!Ctor) throw new Error('当前浏览器不支持 Web Audio API')
    return new Ctor()
  }
}

export type { AnyAudioContext }
