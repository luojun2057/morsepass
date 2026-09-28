<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { computeTimelineWindow } from '@/core/morse/timeline'
import type { TimelineRecord } from '@/composables/useKeyer'

const props = defineProps<{
  records: TimelineRecord[]
  running: boolean
}>()

/** 时间窗口宽度：窗口右端跟随最后一次发报（无输入即冻结），旧信号滚出视野 */
const WINDOW_MS = 10_000
/** 最后一个符号结束后的留白 */
const TAIL_MS = 1_500

const canvasRef = ref<HTMLCanvasElement | null>(null)
let raf = 0
let ro: ResizeObserver | null = null

function draw(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const cssW = canvas.clientWidth
  const cssH = canvas.clientHeight
  if (canvas.width !== cssW * dpr || canvas.height !== cssH * dpr) {
    canvas.width = Math.max(1, Math.floor(cssW * dpr))
    canvas.height = Math.max(1, Math.floor(cssH * dpr))
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  const labelH = 14
  const plotH = cssH - labelH

  // 空状态提示
  if (props.records.length === 0) {
    ctx.fillStyle = '#9aa1ab'
    ctx.font = '13px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('点击「开始练习」后，按住鼠标任意位置发报', cssW / 2, cssH / 2 - 6)
    ctx.textAlign = 'left'
    raf = requestAnimationFrame(draw)
    return
  }

  // 显示窗口：右端跟随最后一次符号结束，无新输入即冻结
  const win = computeTimelineWindow(props.records, WINDOW_MS, TAIL_MS)
  const span = Math.max(1, win.endMs - win.startMs)
  const x = (t: number): number => ((t - win.startMs) / span) * cssW

  // 每秒网格线（会话秒：从会话开始计）
  ctx.strokeStyle = '#eceef1'
  ctx.lineWidth = 1
  ctx.font = '10px sans-serif'
  ctx.fillStyle = '#9aa1ab'
  for (let s = Math.ceil(win.startMs / 1000) * 1000; s <= win.endMs; s += 1000) {
    const gx = x(s)
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, plotH)
    ctx.stroke()
    ctx.fillText(`${Math.round(s / 1000)}s`, gx + 3, cssH - 2)
  }

  // 按压时段色带：条宽 = 按压时长，绿 = 节奏在容差内，红 = 超差
  const bandH = Math.max(14, plotH * 0.55)
  const midY = plotH / 2
  for (const r of props.records) {
    const end = r.t + r.durationMs
    if (end < win.startMs || r.t > win.endMs) continue
    const x1 = Math.max(0, x(r.t))
    const x2 = Math.min(cssW, x(end))
    ctx.fillStyle = r.accurate ? '#2e9e5b' : '#d64545'
    ctx.fillRect(x1, midY - bandH / 2, Math.max(2, x2 - x1), bandH)
  }

  raf = requestAnimationFrame(draw)
}

onMounted(() => {
  raf = requestAnimationFrame(draw)
  ro = new ResizeObserver(() => {
    /* 尺寸变化由 draw 内部按 clientWidth 处理 */
  })
  if (canvasRef.value) ro.observe(canvasRef.value)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
})
</script>

<template>
  <div class="tl-wrap" :data-running="props.running">
    <canvas ref="canvasRef" class="tl-canvas" data-testid="timeline-canvas" />
  </div>
</template>

<style scoped>
.tl-wrap {
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.tl-wrap[data-running='true'] {
  border-color: var(--primary);
}

.tl-canvas {
  display: block;
  width: 100%;
  height: 120px;
}
</style>
