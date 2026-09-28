/**
 * WAV 导出：把时间线事件渲染为 16bit 单声道 PCM WAV（纯函数，可单测）。
 * 包络与实时播放一致：起音 4ms、消音 5ms 线性斜坡，避免爆音。
 */

import type { ToneEvent } from '@/core/morse/timeline'

export interface WavOptions {
  toneHz: number
  /** 0-1 */
  volume: number
  /** 采样率，默认 44100 */
  sampleRate?: number
  /** 结尾静音毫秒，默认 200 */
  tailMs?: number
}

const ATTACK_SEC = 0.004
const RELEASE_SEC = 0.005

/**
 * 渲染 WAV：events 为相对毫秒时间轴的开关音事件（与 buildTimeline 输出同构）。
 * 返回完整 WAV 文件字节（44 字节头 + PCM 数据）。
 */
export function renderWav(events: ToneEvent[], opts: WavOptions): ArrayBuffer {
  const sampleRate = opts.sampleRate ?? 44100
  const tailMs = opts.tailMs ?? 200
  const volume = Math.min(1, Math.max(0, opts.volume))

  const lastT = events.length > 0 ? events[events.length - 1].t : 0
  const durationSec = (lastT + tailMs) / 1000
  const numSamples = Math.max(1, Math.ceil(durationSec * sampleRate))

  // 包络：逐事件填充，取各段包络的最大值（重叠段取响者）
  const env = new Float32Array(numSamples)
  const attackS = Math.max(1, ATTACK_SEC * sampleRate)
  const releaseS = Math.max(1, RELEASE_SEC * sampleRate)

  let i = 0
  while (i < events.length) {
    if (!events[i].on) {
      i++
      continue
    }
    const startMs = events[i].t
    let endMs = lastT
    if (i + 1 < events.length && !events[i + 1].on) {
      endMs = events[i + 1].t
      i += 2
    } else {
      i++
    }
    const s0 = Math.min(numSamples - 1, Math.max(0, Math.floor((startMs / 1000) * sampleRate)))
    const s1 = Math.min(numSamples - 1, Math.max(0, Math.ceil((endMs / 1000) * sampleRate)))
    for (let s = s0; s < s1; s++) {
      const a = Math.min(1, (s - s0) / attackS)
      const b = Math.min(1, (s1 - s) / releaseS)
      const e = Math.min(a, b)
      if (e > env[s]) env[s] = e
    }
  }

  // 合成正弦采样
  const omega = (2 * Math.PI * opts.toneHz) / sampleRate
  const dataBytes = numSamples * 2
  const buffer = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buffer)

  writeWavHeader(view, numSamples, sampleRate)

  for (let s = 0; s < numSamples; s++) {
    const amplitude = Math.sin(omega * s) * volume * env[s]
    const clamped = Math.max(-1, Math.min(1, amplitude))
    view.setInt16(44 + s * 2, Math.round(clamped * 32767), true)
  }

  return buffer
}

/** 写入 44 字节标准 PCM WAV 头（RIFF/WAVE/fmt /data） */
function writeWavHeader(view: DataView, numSamples: number, sampleRate: number): void {
  const dataBytes = numSamples * 2
  const writeAscii = (offset: number, text: string): void => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt 块长度
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // 单声道
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byteRate = sr * blockAlign
  view.setUint16(32, 2, true) // blockAlign = 2 字节（16bit 单声道）
  view.setUint16(34, 16, true) // 位深
  writeAscii(36, 'data')
  view.setUint32(40, dataBytes, true)
}
