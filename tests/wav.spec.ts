import { describe, expect, it } from 'vitest'
import { renderWav } from '@/core/audio/wav'
import { buildTimeline } from '@/core/morse/timeline'

/** 解析 WAV 头部的便捷函数 */
function parseHeader(buf: ArrayBuffer) {
  const view = new DataView(buf)
  const ascii = (offset: number, len: number): string => {
    let s = ''
    for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i))
    return s
  }
  return {
    riff: ascii(0, 4),
    wave: ascii(8, 4),
    fmt: ascii(12, 4),
    fmtSize: view.getUint32(16, true),
    audioFormat: view.getUint16(20, true),
    channels: view.getUint16(22, true),
    sampleRate: view.getUint32(24, true),
    byteRate: view.getUint32(28, true),
    blockAlign: view.getUint16(32, true),
    bitsPerSample: view.getUint16(34, true),
    data: ascii(36, 4),
    dataSize: view.getUint32(40, true),
  }
}

describe('wav 导出', () => {
  it('头部字段：RIFF/WAVE/PCM/单声道/16bit', () => {
    const buf = renderWav(
      [
        { t: 0, on: true },
        { t: 60, on: false },
      ],
      { toneHz: 700, volume: 0.5, sampleRate: 8000 },
    )
    const h = parseHeader(buf)
    expect(h.riff).toBe('RIFF')
    expect(h.wave).toBe('WAVE')
    expect(h.fmt).toBe('fmt ')
    expect(h.fmtSize).toBe(16)
    expect(h.audioFormat).toBe(1)
    expect(h.channels).toBe(1)
    expect(h.bitsPerSample).toBe(16)
    expect(h.data).toBe('data')
  })

  it('数据长度与采样率匹配（含结尾静音）', () => {
    // E 在 20WPM：dit=60ms；最后一个事件 t=60ms（消音），加尾静音 200 → 260ms
    const tl = buildTimeline('E', 20, 20)
    const lastT = tl.events[tl.events.length - 1].t
    const buf = renderWav(tl.events, { toneHz: 700, volume: 0.5, sampleRate: 8000, tailMs: 200 })
    const h = parseHeader(buf)
    const numSamples = Math.ceil(((lastT + 200) / 1000) * 8000)
    expect(h.sampleRate).toBe(8000)
    expect(h.byteRate).toBe(16000)
    expect(h.blockAlign).toBe(2)
    expect(h.dataSize).toBe(numSamples * 2)
    expect(buf.byteLength).toBe(44 + numSamples * 2)
    expect(viewRiffSize(buf)).toBe(36 + numSamples * 2)
  })

  it('有声段非零、尾部静音段为零', () => {
    const tl = buildTimeline('E', 20, 20) // 单个 dit：0-60ms 发声
    const sampleRate = 8000
    const buf = renderWav(tl.events, { toneHz: 700, volume: 0.5, sampleRate, tailMs: 300 })
    const view = new DataView(buf)
    const numSamples = (buf.byteLength - 44) / 2
    expect(numSamples).toBe(Math.ceil((0.36 * sampleRate))) // (60+300)ms
    const sampleAt = (i: number): number => view.getInt16(44 + i * 2, true) / 32768
    // 发声段（0-60ms）应有明显振幅
    let peak = 0
    for (let i = 0; i < 60; i++) peak = Math.max(peak, Math.abs(sampleAt(i)))
    expect(peak).toBeGreaterThan(0.3)
    // 消音斜坡之后（100ms 起）到文件尾应为 0
    for (let i = Math.floor(0.1 * sampleRate); i < numSamples; i++) {
      expect(Math.abs(sampleAt(i))).toBeLessThan(1e-6)
    }
  })

  it('volume=0 时全程静音', () => {
    const tl = buildTimeline('ET', 20, 20)
    const buf = renderWav(tl.events, { toneHz: 700, volume: 0, sampleRate: 8000 })
    const view = new DataView(buf)
    let peak = 0
    for (let i = 0; i < view.byteLength - 44; i += 2) {
      peak = Math.max(peak, Math.abs(view.getInt16(44 + i, true)))
    }
    expect(peak).toBe(0)
  })

  it('空事件也能产出合法 WAV（至少 1 个采样）', () => {
    const buf = renderWav([], { toneHz: 700, volume: 0.5, sampleRate: 8000 })
    const h = parseHeader(buf)
    expect(h.dataSize).toBeGreaterThanOrEqual(2)
    expect(buf.byteLength).toBe(44 + h.dataSize)
  })
})

function viewRiffSize(buf: ArrayBuffer): number {
  return new DataView(buf).getUint32(4, true)
}
