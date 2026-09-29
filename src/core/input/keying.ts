/**
 * 电键输入源抽象。
 *
 * 核心场景：用户的物理电键经转接器输出为"鼠标左键按下/抬起"，
 * 事件发生时光标可停在页面任意位置。因此鼠标源在练习会话内
 * 对整个 window 做 capture 级监听——任意非控件位置的按下/抬起都触发发报。
 *
 * 鼠标源监听 mousedown/mouseup 而非 pointer 事件：鼠标是单一 pointer，
 * Chromium 在多按钮同时按压时只派发一次 pointerdown（第二只按键仅有
 * mousedown），pointer 事件无法区分自动键的双桨。
 */

export interface KeyHandlers {
  onDown(nowMs: number): void
  onUp(nowMs: number): void
}

export interface KeyInputSource {
  readonly kind: 'mouse' | 'key' | 'touch'
  activate(): void
  deactivate(): void
}

/** 交互控件选择器：点击这些元素不触发发报（保证练习中 UI 仍可操作） */
const INTERACTIVE_SELECTOR = 'button, input, select, textarea, label, a, [data-no-key]'

function isInteractive(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(INTERACTIVE_SELECTOR) !== null
}

/**
 * 鼠标输入源（电键模拟鼠标点击，或自动键的桨）。
 * @param button 0=左键 2=右键
 */
export function createMouseSource(button: 0 | 2, handlers: KeyHandlers): KeyInputSource {
  let active = false
  let pressing = false

  const onDown = (e: Event): void => {
    if (!active || pressing) return
    const ev = e as MouseEvent
    if (ev.button !== button) return
    if (isInteractive(ev.target)) return
    ev.preventDefault() // 抑制文本选择/拖拽
    pressing = true
    handlers.onDown(performance.now())
  }
  const onUp = (e: Event): void => {
    if (!active || !pressing) return
    const ev = e as MouseEvent
    if (ev.button !== button) return
    // 抬起不检查目标元素：即使移到控件上方抬起也要结束按压
    pressing = false
    handlers.onUp(performance.now())
  }
  const onCtxMenu = (e: Event): void => {
    if (active && button === 2) e.preventDefault()
  }
  const release = (): void => {
    if (active && pressing) {
      pressing = false
      handlers.onUp(performance.now())
    }
  }

  return {
    kind: 'mouse',
    activate() {
      if (active) return
      active = true
      window.addEventListener('mousedown', onDown, true)
      window.addEventListener('mouseup', onUp, true)
      window.addEventListener('contextmenu', onCtxMenu, true)
      window.addEventListener('blur', release)
    },
    deactivate() {
      active = false
      release()
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mouseup', onUp, true)
      window.removeEventListener('contextmenu', onCtxMenu, true)
      window.removeEventListener('blur', release)
    },
  }
}

/** 键盘输入源（按住配置的按键发报），忽略长按自动重复 */
export function createKeyboardSource(code: string, handlers: KeyHandlers): KeyInputSource {
  let active = false
  let pressing = false

  const onDown = (e: KeyboardEvent): void => {
    if (!active || e.repeat || e.code !== code) return
    if (isInteractive(e.target)) return
    e.preventDefault()
    if (pressing) return
    pressing = true
    handlers.onDown(performance.now())
  }
  const onUp = (e: KeyboardEvent): void => {
    if (!active || e.code !== code) return
    if (!pressing) return
    pressing = false
    handlers.onUp(performance.now())
  }
  const release = (): void => {
    if (active && pressing) {
      pressing = false
      handlers.onUp(performance.now())
    }
  }

  return {
    kind: 'key',
    activate() {
      if (active) return
      active = true
      window.addEventListener('keydown', onDown, true)
      window.addEventListener('keyup', onUp, true)
      window.addEventListener('blur', release)
    },
    deactivate() {
      active = false
      release()
      window.removeEventListener('keydown', onDown, true)
      window.removeEventListener('keyup', onUp, true)
      window.removeEventListener('blur', release)
    },
  }
}

/** 触屏输入源：指定元素（通常为发报面）按住发报，配合 CSS touch-action:none */
export function createTouchSource(el: HTMLElement, handlers: KeyHandlers): KeyInputSource {
  let active = false
  let pressing = false

  const onDown = (e: PointerEvent): void => {
    if (!active || pressing) return
    if (isInteractive(e.target)) return
    e.preventDefault()
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* 部分浏览器可能抛错，忽略 */
    }
    pressing = true
    handlers.onDown(performance.now())
  }
  const onUp = (): void => {
    if (!active || !pressing) return
    pressing = false
    handlers.onUp(performance.now())
  }

  return {
    kind: 'touch',
    activate() {
      if (active) return
      active = true
      el.addEventListener('pointerdown', onDown)
      el.addEventListener('pointerup', onUp)
      el.addEventListener('pointercancel', onUp)
    },
    deactivate() {
      active = false
      if (pressing) {
        pressing = false
        handlers.onUp(performance.now())
      }
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    },
  }
}
