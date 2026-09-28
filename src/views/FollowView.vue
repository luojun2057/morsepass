<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { audio, useKeyer } from '@/composables/useKeyer'
import { useSettings } from '@/composables/useSettings'
import { usePlayback } from '@/composables/usePlayback'
import { compareText, type CompareResult } from '@/core/practice/compare'
import { toDisplayCase } from '@/core/morse/codec'
import MaterialPicker from '@/components/MaterialPicker.vue'
import ParamSlider from '@/components/ParamSlider.vue'
import ReportCard from '@/components/ReportCard.vue'
import TimelineCanvas from '@/components/TimelineCanvas.vue'
import ResultDiff from '@/components/ResultDiff.vue'

const settings = useSettings()
const materialText = ref('')
const liveArea = ref<HTMLElement | null>(null)
const countdown = ref(0)
const phase = ref<'idle' | 'countdown' | 'running'>('idle')

const playback = usePlayback('follow')

let countdownTimer: ReturnType<typeof setInterval> | null = null
let autoStopTimer: ReturnType<typeof setTimeout> | null = null

// 跟发判定：第 N 个解码字符对照原文第 N 个字符
const judgeIdx = { i: 0 }
const keyer = useKeyer('follow', {
  mode: 'follow',
  touchEl: () => liveArea.value,
  material: 'text',
  judgeChar: (ch) => {
    const expected = materialText.value.toUpperCase()[judgeIdx.i]
    judgeIdx.i++
    return ch !== '' && ch === expected
  },
})
const { running, records, snapshot, report, pendingMorse, timing } = keyer

watch(
  () => settings.volume,
  (v) => audio.setVolume(v),
)
watch(running, (v) => {
  document.body.classList.toggle('keying', v)
})

/** 实时比对：解码流 vs 原文 */
const liveResult = computed<CompareResult | null>(() => {
  if (!keyer.decoded.value) return null
  return compareText(materialText.value, keyer.decoded.value)
})

const decodedDisp = computed(() => {
  const s = toDisplayCase(keyer.decoded.value, settings.displayCase)
  return s.length > 160 ? s.slice(-160) : s
})

function begin(): void {
  if (!materialText.value.trim()) return
  phase.value = 'countdown'
  countdown.value = 5
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownTimer) {
        clearInterval(countdownTimer)
        countdownTimer = null
      }
      startRunning()
    }
  }, 1000)
}

function startRunning(): void {
  phase.value = 'running'
  judgeIdx.i = 0
  keyer.start()
  const { totalMs } = playback.play(materialText.value)
  // 播放结束 1.5s 后自动收卷（留出末尾字符的解码时间）
  autoStopTimer = setTimeout(
    () => {
      finish()
    },
    totalMs + 1500,
  )
}

function finish(): void {
  if (autoStopTimer) {
    clearTimeout(autoStopTimer)
    autoStopTimer = null
  }
  playback.stop()
  keyer.stop()
  phase.value = 'idle'
}

function cancelCountdown(): void {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  phase.value = 'idle'
  countdown.value = 0
}

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
  if (autoStopTimer) clearTimeout(autoStopTimer)
})
</script>

<template>
  <main class="page">
    <h2 class="page-title">跟发练习</h2>
    <p class="page-sub">
      5 秒倒计时后自动播放原文电码，<b>同时</b>用鼠标/按键同步跟发。系统实时比对你的发报解码与原文。
    </p>

    <MaterialPicker v-model="materialText" />

    <div class="grid-2" style="margin-top: 16px">
      <div class="card">
        <p class="card-title">播放设置</p>
        <ParamSlider v-model="timing.wpmChar" label="字符速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="timing.wpmEff" label="有效速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="settings.volume" label="音量" :min="0" :max="100" :step="5" unit="%" :scale="100" />
      </div>

      <div class="card">
        <p class="card-title">开始</p>
        <div class="row" style="justify-content: center; padding: 18px 0" data-testid="follow-cta">
          <template v-if="phase === 'idle'">
            <button class="btn btn-primary btn-big" data-testid="follow-start" @click="begin">开始跟发</button>
          </template>
          <template v-else-if="phase === 'countdown'">
            <span class="countdown" data-testid="countdown">{{ countdown }}</span>
            <button class="btn" @click="cancelCountdown">取消</button>
          </template>
          <template v-else>
            <button class="btn btn-danger btn-big" data-testid="follow-stop" @click="finish">结束</button>
          </template>
        </div>
        <div v-if="liveResult" class="badges" style="justify-content: center">
          <span class="badge">
            <span class="k">实时正确率</span>
            <span class="v" data-testid="follow-accuracy">
              {{ liveResult.accuracyPct == null ? '—' : `${liveResult.accuracyPct}%` }}
            </span>
          </span>
          <span class="badge">
            <span class="k">已发字符</span>
            <span class="v">{{ snapshot?.charsTotal ?? 0 }}</span>
          </span>
        </div>
      </div>
    </div>

    <div ref="liveArea" class="card" style="margin-top: 16px" data-testid="follow-live">
      <p class="card-title">实时跟发</p>
      <div class="pending-morse" data-testid="follow-pending">{{ pendingMorse || '&nbsp;' }}</div>
      <div class="decode-stream" data-testid="follow-decoded">{{ decodedDisp || '&nbsp;' }}</div>
      <TimelineCanvas :records="records" :running="running" />
      <div style="margin-top: 10px">
        <ResultDiff v-if="liveResult" :result="liveResult" :display-case="settings.displayCase" />
        <p v-else class="hint">开始跟发后此处显示实时比对</p>
      </div>
    </div>

    <div style="margin-top: 16px">
      <ReportCard :report="report" :display-case="settings.displayCase" />
    </div>
  </main>
</template>

<style scoped>
.page-title {
  margin: 0 0 4px;
  font-size: 20px;
}

.page-sub {
  margin: 0 0 16px;
  color: var(--text-2);
  font-size: 13px;
}

.countdown {
  font-size: 44px;
  font-weight: 800;
  color: var(--primary);
  font-variant-numeric: tabular-nums;
}
</style>
