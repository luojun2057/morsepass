import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AutoKeyer, elDurationMs, elGapMs, nextElement } from '@/core/keyer/auto'

/**
 * 自动键状态机测试。10 WPM 基准：Td = 120ms → 点 120、划 360、间隙 120。
 * fake timers 同时接管 setTimeout 与 performance.now（endElement/gap 回调的时间戳）。
 */

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
})

afterEach(() => {
  vi.useRealTimers()
})

interface Ev {
  type: 'down' | 'up'
  t: number
}

function make(wpm = 10) {
  let wpmV = wpm
  const events: Ev[] = []
  const k = new AutoKeyer(
    {
      onDown: (t) => events.push({ type: 'down', t }),
      onUp: (t) => events.push({ type: 'up', t }),
    },
    { getWpm: () => wpmV },
  )
  k.start()
  return { k, events, setWpm: (v: number) => (wpmV = v) }
}

/** down/up 成对事件 → 每个元素的虚拟时长 */
function durations(events: Ev[]): number[] {
  const out: number[] = []
  for (let i = 0; i + 1 < events.length; i += 2) {
    expect(events[i].type).toBe('down')
    expect(events[i + 1].type).toBe('up')
    out.push(events[i + 1].t - events[i].t)
  }
  return out
}

describe('时序基准', () => {
  it('10WPM：点 120ms / 划 360ms / 间隙 120ms', () => {
    expect(elDurationMs('dit', 10)).toBeCloseTo(120)
    expect(elDurationMs('dah', 10)).toBeCloseTo(360)
    expect(elGapMs(10)).toBeCloseTo(120)
  })
})

describe('nextElement 元素结束判定', () => {
  it('双桨按住：iambic 交替发相反元素', () => {
    expect(nextElement('dit', true, true, 'a', false)).toBe('dah')
    expect(nextElement('dah', true, true, 'a', false)).toBe('dit')
  })

  it('仅当前桨按住：重复该元素', () => {
    expect(nextElement('dit', true, false, 'a', false)).toBe('dit')
    expect(nextElement('dah', false, true, 'a', false)).toBe('dah')
  })

  it('仅对方桨按住：切换到对方元素', () => {
    expect(nextElement('dit', false, true, 'a', false)).toBe('dah')
    expect(nextElement('dah', true, false, 'a', false)).toBe('dit')
  })

  it('全松手：Mode A 停止（即使发生过挤压）', () => {
    expect(nextElement('dit', false, false, 'a', true)).toBeNull()
  })

  it('全松手：Mode B 发生过挤压 → 补发相反元素', () => {
    expect(nextElement('dit', false, false, 'b', true)).toBe('dah')
    expect(nextElement('dah', false, false, 'b', true)).toBe('dit')
  })

  it('全松手：Mode B 无挤压 → 停止', () => {
    expect(nextElement('dit', false, false, 'b', false)).toBeNull()
  })
})

describe('AutoKeyer 状态机（10WPM）', () => {
  it('按住点桨：连发点，1Td 元素 + 1Td 间隙循环，松手后完成当前元素停止', () => {
    const { k, events } = make()
    k.onDitDown(0)
    vi.advanceTimersByTime(500) // dit 0-120、dit 240-360、dit 480 起进行中
    expect(events.map((e) => e.type)).toEqual(['down', 'up', 'down', 'up', 'down'])
    expect(events.map((e) => e.t)).toEqual([0, 120, 240, 360, 480])
    k.onDitUp()
    vi.advanceTimersByTime(120) // 元素 480-600 完成
    expect(durations(events)).toEqual([120, 120, 120])
    vi.advanceTimersByTime(1000)
    expect(events).toHaveLength(6) // 不再多发
  })

  it('按住划桨：连发划（3Td），元素间隙 1Td', () => {
    const { k, events } = make()
    k.onDahDown(0)
    vi.advanceTimersByTime(970) // dah 0-360、dah 480-840、dah 960 起进行中
    k.onDahUp()
    vi.advanceTimersByTime(400)
    expect(durations(events)).toEqual([360, 360, 360])
    expect(events[2].t - events[1].t).toBeCloseTo(120)
  })

  it('双桨挤压：iambic 交替 点-划-点-划', () => {
    const { k, events } = make()
    k.onDitDown(0)
    k.onDahDown(10)
    vi.advanceTimersByTime(1000) // dit 0-120、dah 240-600、dit 720-840、dah 960 起进行中
    expect(events.map((e) => e.type)).toEqual(['down', 'up', 'down', 'up', 'down', 'up', 'down'])
    expect(durations(events.slice(0, 6))).toEqual([120, 360, 120])
    k.onDitUp()
    k.onDahUp()
    vi.advanceTimersByTime(500) // 划 960-1320 完成后停止
    expect(events).toHaveLength(8)
    expect(durations(events)).toEqual([120, 360, 120, 360])
  })

  it('Mode A：间隙中松手 → 取消已排队的下一元素（释放即停）', () => {
    const { k, events } = make()
    k.onDitDown(0)
    vi.advanceTimersByTime(150) // 元素 0-120 完成，处于间隙，240 已排队
    k.onDitUp()
    vi.advanceTimersByTime(1000)
    expect(durations(events)).toEqual([120])
  })

  it('Mode B：挤压后在划进行中松手 → 补发一点（di-dah-dit = R）', () => {
    const { k, events } = make()
    k.setStyle('b')
    k.onDitDown(0)
    k.onDahDown(10) // 挤压置位
    vi.advanceTimersByTime(500) // dit 0-120、dah 240-600 进行中
    k.onDitUp()
    k.onDahUp()
    vi.advanceTimersByTime(500) // 划完成 → 补发 dit 720-840
    expect(durations(events)).toEqual([120, 360, 120])
  })

  it('Mode A 同操作：挤压后松手 → 只发 di-dah（= A）', () => {
    const { k, events } = make()
    k.onDitDown(0)
    k.onDahDown(10)
    vi.advanceTimersByTime(500)
    k.onDitUp()
    k.onDahUp()
    vi.advanceTimersByTime(500)
    expect(durations(events)).toEqual([120, 360])
  })

  it('Mode B：点元素内快速触碰划桨后全松 → 补发划（di-dah = A）', () => {
    const { k, events } = make()
    k.setStyle('b')
    k.onDitDown(0)
    k.onDahDown(10)
    k.onDahUp()
    k.onDitUp()
    vi.advanceTimersByTime(600)
    expect(durations(events)).toEqual([120, 360])
  })

  it('Mode B：单桨点按松手（无挤压）→ 不补发（E 正常）', () => {
    const { k, events } = make()
    k.setStyle('b')
    k.onDitDown(0)
    k.onDitUp()
    vi.advanceTimersByTime(600)
    expect(durations(events)).toEqual([120])
  })

  it('练习中调速：下一元素按新速度发（10→20 WPM，点 120→60ms）', () => {
    const { k, events, setWpm } = make(10)
    k.onDitDown(0)
    vi.advanceTimersByTime(130) // 元素 0-120 完成（10WPM）
    setWpm(20)
    k.onDitUp()
    vi.advanceTimersByTime(300) // 间隙中松手：Mode A 取消排队元素（fake now = 430）
    k.onDitDown(performance.now()) // fake now = 430
    vi.advanceTimersByTime(100) // 新点按 20WPM 应为 60ms（430-490）
    expect(durations(events)).toEqual([120, 60])
  })

  it('stop 中断：元素进行中停止，不补发 up、不再产生事件', () => {
    const { k, events } = make()
    k.onDitDown(0)
    vi.advanceTimersByTime(60)
    k.stop()
    vi.advanceTimersByTime(1000)
    expect(events).toEqual([{ type: 'down', t: 0 }])
  })

  it('停止后忽略桨输入', () => {
    const { k, events } = make()
    k.stop()
    k.onDitDown(0)
    k.onDahDown(10)
    vi.advanceTimersByTime(600)
    expect(events).toEqual([])
  })
})
