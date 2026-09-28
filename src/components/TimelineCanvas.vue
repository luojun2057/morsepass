<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { TimelineRecord } from '@/composables/useKeyer'

const props = defineProps<{
  records: TimelineRecord[]
  running: boolean
}>()

/** 时间窗口：只渲染最近 10 秒，旧信号滚出视野，画布永不撑高 */
const WINDOW_MS = 10_000

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

  const now = performance.now()
  const t0 = now - WINDOW_MS

  // 每秒网格线
  ctx.strokeStyle = '#eceef1'
  ctx.lineWidth = 1
  ctx.font = '10px sans-serif'
  ctx.fillStyle = '#9aa1ab'
  for (let s = Math.ceil(t0 / 1000) * 1000; s <= now; s += 1000) {
    const x = ((s - t0) / WINDOW_MS) * cssW
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, cssH - 12)
    ctx.stroke()
    const secAgo = Math.round((now - s) / 1000)
    ctx.fillText(secAgo === 0 ? 'now' : `-${secAgo}s`, x + 3, cssH - 2)
  }

  // 信号条：dit 短 / dah 长，准确绿 / 超差红
  const midY = (cssH - 12) / 2
  for (const r of props.records) {
    const end = r.t + r.durationMs
    if (end < t0 || r.t > now) continue
    const x1 = ((r.t - t0) / WINDOW_MS) * cssW
    const x2 = ((Math.min(end, now) - t0) / WINDOW_MS) * cssW
    const h = r.sym === 'dit' ? 14 : 30
    ctx.fillStyle = r.accurate ? '#2e9e5b' : '#d64545'
    const w = Math.max(2, x2 - x1)
    ctx.fillRect(x1, midY - h / 2, w, h)
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

.tl-canvas {
  display: block;
  width: 100%;
  height: 120px;
}
</style>
