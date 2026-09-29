<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  compressIdleGaps,
  computeTimelineWindow,
  IDLE_COMPRESS_THRESHOLD_MS,
  mapRealTime,
  timelineWindowMs,
} from '@/core/morse/timeline'
import { ditMs } from '@/core/morse/timing'
import type { TimelineRecord } from '@/composables/useKeyer'

const props = defineProps<{
  records: TimelineRecord[]
  running: boolean
  /** 发报速度（WPM）：决定窗口宽度与字符间隙标记的判定阈值 */
  wpm?: number
}>()

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
  const wpm = props.wpm ?? 20

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

  // 显示窗口：按点长自适应（发越快分辨率越高），右端跟随最后一次抬起。
  // 长空闲（>3s）压缩为固定显示宽度——恢复发报后之前的节奏不滚出视野
  const { mapped, compressed } = compressIdleGaps(props.records)
  const { windowMs, tailMs } = timelineWindowMs(wpm)
  const win = computeTimelineWindow(mapped, windowMs, tailMs)
  const span = Math.max(1, win.endMs - win.startMs)
  const x = (t: number): number => ((t - win.startMs) / span) * cssW

  // 每秒网格线（会话真实秒，经压缩映射定位；落在压缩区间内跳过）
  ctx.strokeStyle = '#eceef1'
  ctx.lineWidth = 1
  ctx.font = '10px sans-serif'
  ctx.fillStyle = '#9aa1ab'
  for (let s = Math.ceil(win.startMs / 1000) * 1000; s <= win.endMs; s += 1000) {
    const mappedS = mapRealTime(s, compressed)
    if (mappedS === null) continue
    const gx = x(mappedS)
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, plotH)
    ctx.stroke()
    ctx.fillText(`${Math.round(s / 1000)}s`, gx + 3, cssH - 2)
  }

  const Td = ditMs(wpm)
  const bandH = Math.max(14, plotH * 0.55)
  const midY = plotH / 2
  const baseY = midY + bandH / 2 + 4

  // 字符间隙标记：相邻符号真实间隙 ≥ 2Td（字符边界阈值）且未被压缩时淡色标出
  // （≥3s 的空闲是「停顿」分隔，压缩显示，不作为字符间隙标记）
  ctx.fillStyle = '#FAEEDA'
  const recs = props.records
  for (let i = 1; i < recs.length; i++) {
    const gapStart = recs[i - 1].t
    const gapEnd = recs[i].t - recs[i].durationMs
    const gap = gapEnd - gapStart
    if (gap < 2 * Td || gap >= IDLE_COMPRESS_THRESHOLD_MS) continue
    const x1 = Math.max(0, x(mapRealTime(gapStart, compressed) ?? gapStart))
    const x2 = Math.min(cssW, x(mapRealTime(gapEnd, compressed) ?? gapEnd))
    if (x2 > x1) ctx.fillRect(x1, 0, x2 - x1, plotH)
  }

  // 抬起基线：key-up 电平线（CW Player 等 keying 波形画法，间隙有实体可读）
  ctx.strokeStyle = '#D3D1C7'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, baseY)
  ctx.lineTo(cssW, baseY)
  ctx.stroke()

  // 按压时段色带：条画在真实按压区间 [抬起−时长, 抬起]（压缩映射后），
  // 条间空白即真实间隙。绿 = 节奏在容差内，红 = 超差；最小宽 1px
  for (const r of mapped) {
    const start = r.t - r.durationMs
    if (r.t < win.startMs || start > win.endMs) continue
    const x1 = Math.max(0, x(start))
    const x2 = Math.min(cssW, x(r.t))
    ctx.fillStyle = r.accurate ? '#2e9e5b' : '#d64545'
    ctx.fillRect(x1, midY - bandH / 2, Math.max(1, x2 - x1), bandH)
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
