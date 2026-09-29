<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { audio, useKeyer } from '@/composables/useKeyer'
import { useSettings } from '@/composables/useSettings'
import { usePlayback } from '@/composables/usePlayback'
import { compareText } from '@/core/practice/compare'
import {
  KOCH_ORDER,
  activeChars,
  applySession,
  defaultProgress,
  evaluateSession,
  nextChar,
  type KochProgress,
} from '@/core/practice/koch'
import { loadJSON, saveJSON, StorageKeys } from '@/core/storage/persist'
import MaterialPicker from '@/components/MaterialPicker.vue'
import ParamSlider from '@/components/ParamSlider.vue'
import TimelineCanvas from '@/components/TimelineCanvas.vue'

const settings = useSettings()
const liveArea = ref<HTMLElement | null>(null)
const phase = ref<'idle' | 'running' | 'graded'>('idle')

const progress = ref<KochProgress>(loadJSON<KochProgress>(StorageKeys.koch, defaultProgress()))

const chars = computed(() => activeChars(progress.value))
const next = computed(() => nextChar(progress.value))

// 本课素材：字符组由外部字符集锁定生成
const materialText = ref('')
const userInput = ref('')
const unlockedTip = ref('')

const playback = usePlayback('koch')
const { timing } = playback

const judgeIdx = { i: 0 }
const keyer = useKeyer('koch', {
  mode: 'follow',
  silent: true, // Koch 有自己的进度记录，不写练习历史
  touchEl: () => liveArea.value,
  judgeChar: (ch) => {
    const expected = materialText.value.toUpperCase().replace(/ /g, '')[judgeIdx.i]
    judgeIdx.i++
    return ch !== '' && ch === expected
  },
})

watch(
  () => settings.volume,
  (v) => audio.setVolume(v),
)
watch(keyer.running, (v) => {
  document.body.classList.toggle('keying', v)
})

/** 自动评分定时器与会话序号（放弃/重开后旧定时器失效） */
let gradeTimer: ReturnType<typeof setTimeout> | null = null
let sessionSeq = 0

function cancelGradeTimer(): void {
  if (gradeTimer !== null) {
    clearTimeout(gradeTimer)
    gradeTimer = null
  }
}

onBeforeUnmount(() => {
  cancelGradeTimer()
})

/** 开始课程：生成 5 组 × 5 字符并播放（含倒计时 3s 缓冲） */
function startLesson(): void {
  if (phase.value === 'running') return
  const set = chars.value
  // 以当前字符集生成 5 组 5 字符
  const groups: string[] = []
  let seed = (Math.random() * 2 ** 31) | 0
  for (let g = 0; g < 5; g++) {
    let s = ''
    for (let i = 0; i < 5; i++) {
      seed = (seed * 1664525 + 1013904223) | 0
      s += set[Math.abs(seed) % set.length]
    }
    groups.push(s)
  }
  materialText.value = groups.join(' ')
  userInput.value = ''
  unlockedTip.value = ''
  phase.value = 'running'
  judgeIdx.i = 0

  keyer.start()
  const mySeq = ++sessionSeq
  const { totalMs } = playback.play(materialText.value)
  gradeTimer = setTimeout(() => {
    gradeTimer = null
    if (sessionSeq === mySeq) grade()
  }, totalMs + 800)
}

/** 中途结束：立即停止播放与发报并评分 */
function stopAndGrade(): void {
  if (phase.value !== 'running') return
  cancelGradeTimer()
  grade()
}

/** 放弃本轮：停止但不评分、不计入进度 */
function abortLesson(): void {
  if (phase.value !== 'running') return
  cancelGradeTimer()
  sessionSeq++ // 使旧定时器失效
  keyer.stop()
  playback.stop()
  phase.value = 'idle'
}

/** 播放结束后自动评分（含 800ms 解码缓冲） */
function grade(): void {
  if (phase.value !== 'running') return
  keyer.stop()
  playback.stop()
  // 只按字母数字评分（忽略空格）
  const refText = materialText.value.replace(/ /g, '')
  const gotText = keyer.decoded.value.replace(/ /g, '')
  const cmp = compareText(refText, gotText)
  const accuracy = cmp.accuracyPct ?? 0
  const passed = evaluateSession(cmp.total, accuracy)
  const before = progress.value.unlocked
  const { progress: p, unlockedNew } = applySession(progress.value, {
    date: new Date().toISOString(),
    accuracyPct: Math.round(accuracy * 10) / 10,
    groups: 5,
    passed,
  })
  progress.value = p
  saveJSON(StorageKeys.koch, p)
  unlockedTip.value = unlockedNew
    ? `🎉 过关！解锁新字符「${KOCH_ORDER[before]}」`
    : passed
      ? '✅ 达标（已全部解锁，保持手感）'
      : `本次正确率 ${accuracy}%，未达 90% 过关线，再练一轮`
  phase.value = 'graded'
}
</script>

<template>
  <main class="page">
    <h2 class="page-title">Koch 课程</h2>
    <p class="card-title" style="margin-bottom: 4px">
      从 2 个字符起步，一次课程 5 组 × 5 字符，正确率 ≥ 90% 解锁下一个字符——不必刻意背码表，听熟为止。
    </p>

    <div class="card">
      <p class="card-title">课程进度 · 已解锁 {{ progress.unlocked }} / {{ KOCH_ORDER.length }}</p>
      <div class="chips">
        <span
          v-for="(c, i) in KOCH_ORDER"
          :key="c + i"
          class="chip"
          :class="{ active: i < progress.unlocked, next: i === progress.unlocked }"
          :title="i < progress.unlocked ? '已解锁' : i === progress.unlocked ? '下一课' : '未解锁'"
        >{{ c }}</span>
      </div>
      <p v-if="next" class="hint" style="margin: 10px 0 0">
        下一课将加入：<b class="mono">{{ next }}</b> ｜ 当前进度历史最近一次：
        {{ progress.history.length ? `${progress.history[progress.history.length - 1].accuracyPct}%` : '—' }}
      </p>
    </div>

    <div style="margin-top: 16px">
      <MaterialPicker v-model="materialText" :locked-char-set="chars" />
    </div>

    <div class="grid-2" style="margin-top: 16px">
      <div class="card">
        <p class="card-title">课程设置</p>
        <ParamSlider v-model="timing.wpmChar" label="字符速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="timing.wpmEff" label="有效速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="settings.volume" label="音量" :min="0" :max="100" :step="5" unit="%" :scale="100" />
      </div>
      <div class="card">
        <p class="card-title">开始课程</p>
        <div class="row" style="justify-content: center; padding: 14px 0; gap: 10px">
          <button
            v-if="phase !== 'running'"
            class="btn btn-primary btn-big"
            data-testid="koch-start"
            @click="startLesson"
          >
            开始本课（听抄）
          </button>
          <template v-else>
            <button class="btn btn-danger btn-big" data-testid="koch-stop" @click="stopAndGrade">
              结束并评分
            </button>
            <button class="btn" data-testid="koch-abort" @click="abortLesson">放弃本轮</button>
          </template>
        </div>
        <p class="hint" style="text-align: center; margin: 0">
          播放结束自动评分，也可随时「结束并评分」提前收卷。可以边听边在下方案件区跟发（可选）。
        </p>
      </div>
    </div>

    <div ref="liveArea" class="card" style="margin-top: 16px" data-testid="koch-live">
      <p class="card-title">跟发区（可选，边听边发）</p>
      <div class="decode-stream mono" data-testid="koch-decoded">
        {{ keyer.decodedDisplay() || '&nbsp;' }}
      </div>
      <TimelineCanvas :records="keyer.records.value" :running="keyer.running.value" :wpm="keyer.timing.wpmChar" />
    </div>

    <div v-if="phase === 'graded'" class="card" style="margin-top: 16px" data-testid="koch-result">
      <p class="card-title">课程结果</p>
      <p style="font-size: 16px; font-weight: 700; margin: 0 0 8px">{{ unlockedTip }}</p>
      <p class="hint" style="margin: 0">本课素材：{{ materialText }}</p>
    </div>
  </main>
</template>

<style scoped>
.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
</style>
