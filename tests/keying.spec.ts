import { describe, expect, it } from 'vitest'
import {
  createKeyboardSource,
  createMouseSource,
} from '@/core/input/keying'

function fire(type: string, target: EventTarget, init: EventInit & { button?: number; code?: string; repeat?: boolean } = {}): void {
  let ev: Event
  if (type.startsWith('key')) {
    ev = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })
  } else {
    ev = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  }
  target.dispatchEvent(ev)
}

describe('createMouseSource（电键模拟鼠标点击）', () => {
  it('页面任意位置按下/抬起触发发报', () => {
    const calls: string[] = []
    const src = createMouseSource(0, {
      onDown: () => calls.push('down'),
      onUp: () => calls.push('up'),
    })
    src.activate()
    fire('pointerdown', document.body, { button: 0 })
    fire('pointerup', document.body, { button: 0 })
    src.deactivate()
    expect(calls).toEqual(['down', 'up'])
  })

  it('点击按钮等交互控件不误触发', () => {
    const calls: string[] = []
    const src = createMouseSource(0, {
      onDown: () => calls.push('down'),
      onUp: () => calls.push('up'),
    })
    const btn = document.createElement('button')
    document.body.appendChild(btn)
    src.activate()
    fire('pointerdown', btn, { button: 0 })
    fire('pointerup', btn, { button: 0 })
    src.deactivate()
    expect(calls).toEqual([])
  })

  it('配置为左键时右键不触发', () => {
    const calls: string[] = []
    const src = createMouseSource(0, {
      onDown: () => calls.push('down'),
      onUp: () => calls.push('up'),
    })
    src.activate()
    fire('pointerdown', document.body, { button: 2 })
    fire('pointerup', document.body, { button: 2 })
    src.deactivate()
    expect(calls).toEqual([])
  })

  it('重复按下不重复触发 down，未按下时 up 忽略', () => {
    const calls: string[] = []
    const src = createMouseSource(0, {
      onDown: () => calls.push('down'),
      onUp: () => calls.push('up'),
    })
    src.activate()
    fire('pointerdown', document.body, { button: 0 })
    fire('pointerdown', document.body, { button: 0 })
    fire('pointerup', document.body, { button: 0 })
    fire('pointerup', document.body, { button: 0 })
    src.deactivate()
    expect(calls).toEqual(['down', 'up'])
  })

  it('失焦自动抬起；deactivate 后不再监听', () => {
    const calls: string[] = []
    const src = createMouseSource(0, {
      onDown: () => calls.push('down'),
      onUp: () => calls.push('up'),
    })
    src.activate()
    fire('pointerdown', document.body, { button: 0 })
    window.dispatchEvent(new Event('blur'))
    expect(calls).toEqual(['down', 'up']) // 失焦强制抬起
    // 源仍处于激活态，重新按下正常触发
    fire('pointerdown', document.body, { button: 0 })
    fire('pointerup', document.body, { button: 0 })
    expect(calls).toEqual(['down', 'up', 'down', 'up'])
    // deactivate 后彻底静默
    src.deactivate()
    fire('pointerdown', document.body, { button: 0 })
    fire('pointerup', document.body, { button: 0 })
    expect(calls).toEqual(['down', 'up', 'down', 'up'])
  })
})

describe('createKeyboardSource', () => {
  it('按住配置键触发，抬起结束', () => {
    const calls: string[] = []
    const src = createKeyboardSource('KeyJ', {
      onDown: () => calls.push('down'),
      onUp: () => calls.push('up'),
    })
    src.activate()
    fire('keydown', document.body, { code: 'KeyJ' })
    fire('keyup', document.body, { code: 'KeyJ' })
    src.deactivate()
    expect(calls).toEqual(['down', 'up'])
  })

  it('长按自动重复不触发', () => {
    const calls: string[] = []
    const src = createKeyboardSource('KeyJ', {
      onDown: () => calls.push('down'),
      onUp: () => calls.push('up'),
    })
    src.activate()
    fire('keydown', document.body, { code: 'KeyJ' })
    fire('keydown', document.body, { code: 'KeyJ', repeat: true })
    fire('keyup', document.body, { code: 'KeyJ' })
    src.deactivate()
    expect(calls).toEqual(['down', 'up'])
  })

  it('其他按键不触发', () => {
    const calls: string[] = []
    const src = createKeyboardSource('KeyJ', {
      onDown: () => calls.push('down'),
      onUp: () => calls.push('up'),
    })
    src.activate()
    fire('keydown', document.body, { code: 'Space' })
    fire('keyup', document.body, { code: 'Space' })
    src.deactivate()
    expect(calls).toEqual([])
  })
})
