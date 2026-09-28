<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { audio } from '@/composables/useKeyer'
import { useSettings } from '@/composables/useSettings'
import { usePlayback } from '@/composables/usePlayback'
import { compareText, type CompareResult } from '@/core/practice/compare'
import { buildRecord, loadHistory, pushHistory } from '@/core/storage/persist'
import { splitWords } from '@/core/morse/codec'
import { toDisplayCase } from '@/core/morse/codec'
import MaterialPicker from '@/components/MaterialPicker.vue'
import ParamSlider from '@/components/ParamSlider.vue'
import ResultDiff from '@/components/ResultDiff.vue'
import HistoryList from '@/components/HistoryList.vue'

const settings = useSettings()
const materialText = ref('')
const userInput = ref('')

const playback = usePlayback('receive')
const { playing, elapsedMs, charSpans, totalMs, timing } = playback

const history = ref(loadHistory())

// 高亮当前播放字符
const activeIdx = computed(() => {
  if (!playing.value) return -1
  let idx = -1
  for (let i = 0; i < charSpans.value.length; i++) {
    if (charSpans.value[i].startMs <= elapsedMs.value) idx = i
    else break
  }
  return idx
})

const materialDisp = computed(() => toDisplayCase(materialText.value, settings.displayCase))

// 播放结束自动聚焦输入框
watch(playing, (v, old) => {
  if (old && !v && totalMs.value > 0) {
    inputRef.value?.focus()
  }
})
const inputRef = ref<HTMLTextAreaElement | null>(null)

function playMaterial(): void {
  if (playing.value) {
    playback.stop()
    return
  }
  if (!materialText.value.trim()) return
  audio.ensure()
  playback.play(materialText.value)
  setTimeout(() => inputRef.value?.focus(), 50)
}

// 实时比对
const result = computed<CompareResult>(() => compareText(materialText.value, userInput.value))
const missedCount = computed(() => result.value.items.filter((i) => i.kind === 'missed').length)
const extraCount = computed(() => result.value.extraCount)

// QRM 噪声
watch(
  () => [settings.noise.enabled, settings.noise.level] as const,
  ([on, lv]) => {
    if (audio.ready || on) audio.setNoise(on, lv)
  },
)

// 结束并保存
const savedTip = ref('')
function finishAndSave(): void {
  if (result.value.total === 0) return
  // 从比对结果聚合弱项字符
  const weak = new Map<string, { correct: number; total: number }>()
  for (const it of result.value.items) {
    if (it.kind === 'match' || it.kind === 'wrong' || it.kind === 'missed') {
      const ch = (it.expected ?? '').toUpperCase()
      if (!ch.trim()) continue
      const e = weak.get(ch) ?? { correct: 0, total: 0 }
      e.total++
      if (it.kind === 'match') e.correct++
      weak.set(ch, e)
    }
  }
  const record = buildRecord({
    mode: 'receive',
    wpmChar: timing.wpmChar,
    wpmEff: timing.wpmEff,
    toneHz: settings.toneHz,
    durationMs: totalMs.value,
    charsTotal: result.value.total,
    charsCorrect: result.value.correct,
    accuracyPct: result.value.accuracyPct ?? 0,
    symbolAccuracyPct: null,
    weakChars: [...weak.entries()]
      .map(([ch, e]) => ({ ch, ...e }))
      .filter((w) => w.correct / w.total < 0.8)
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 10),
    material: 'text',
  })
  history.value = pushHistory(record)
  savedTip.value = '已保存到练习历史'
  setTimeout(() => (savedTip.value = ''), 3000)
}

// 弱项加练：来自统计页
try {
  const weakText = sessionStorage.getItem('mp.weakPractice')
  if (weakText) {
    materialText.value = weakText
    sessionStorage.removeItem('mp.weakPractice')
  }
} catch {
  /* 忽略 */
}

const receiveHistory = computed(() => history.value.filter((r) => r.mode === 'receive'))
const wordCount = computed(() => splitWords(materialText.value).length)
</script>

<template>
  <main class="page">
    <h2 class="page-title">听抄练习</h2>
    <p class="page-sub">点击播放后凭听抄写，输入实时比对：<b style="color: var(--success)">绿=正确</b>、<b style="color: var(--muted)">-=漏抄</b>、<b style="color: var(--danger)">删除线=错字</b>、<b style="color: var(--warn)">[+N]=多余</b>。</p>

    <MaterialPicker v-model="materialText" />

    <div class="grid-2" style="margin-top: 16px">
      <div class="card">
        <p class="card-title">播放设置</p>
        <ParamSlider v-model="timing.wpmChar" label="字符速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="timing.wpmEff" label="有效速度" :min="5" :max="40" unit=" WPM" />
        <p class="hint" style="margin: 0 0 8px">有效速度低于字符速度即启用 Farnsworth 间隔（字符快、间隔慢）。</p>
        <ParamSlider v-model="settings.volume" label="音量" :min="0" :max="100" unit="%" />
        <div class="param-row">
          <label>QRM 噪声</label>
          <input v-model="settings.noise.enabled" type="checkbox" data-testid="noise-toggle" />
          <input v-if="settings.noise.enabled" v-model.number="settings.noise.level" type="range" min="0" max="40" step="1" style="flex: 1" />
          <span v-if="settings.noise.enabled" class="value">{{ Math.round(settings.noise.level * 100) }}%</span>
        </div>
        <div class="row" style="margin-top: 10px">
          <button class="btn btn-primary" data-testid="play-btn" @click="playMaterial">
            {{ playing ? '停止播放' : '播放摩尔斯码' }}
          </button>
          <span class="hint">共 {{ wordCount }} 词 · 预计 {{ Math.ceil(totalMs / 1000) }}s</span>
        </div>
      </div>

      <div class="card">
        <p class="card-title">素材预览</p>
        <p class="preview mono" data-testid="material-preview">
          <span
            v-for="(ch, i) in materialDisp"
            :key="i"
            :class="{ lit: i <= activeIdx && materialDisp[i] !== ' ' }"
            >{{ ch }}</span
          >
        </p>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <p class="card-title">听抄输入</p>
      <textarea
        ref="inputRef"
        v-model="userInput"
        rows="3"
        placeholder="播放开始后在这里输入你听到的内容…"
        data-testid="copy-input"
      ></textarea>
      <div class="badges" style="margin: 10px 0">
        <span class="badge">
          <span class="k">整场正确率</span>
          <span class="v" :class="(result.accuracyPct ?? 0) >= 90 ? 'good' : ''" data-testid="receive-accuracy">
            {{ result.accuracyPct == null ? '—' : `${result.accuracyPct}%` }}
          </span>
        </span>
        <span class="badge">
          <span class="k">漏抄</span>
          <span class="v">{{ missedCount }}</span>
        </span>
        <span class="badge">
          <span class="k">多余</span>
          <span class="v">{{ extraCount }}</span>
        </span>
        <button class="btn" style="margin-left: auto" :disabled="result.total === 0" @click="finishAndSave">
          结束并保存
        </button>
        <span v-if="savedTip" class="hint" style="color: var(--success)">{{ savedTip }}</span>
      </div>
      <ResultDiff :result="result" :display-case="settings.displayCase" />
    </div>

    <div style="margin-top: 16px">
      <HistoryList :records="receiveHistory" :limit="5" />
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

.preview {
  font-size: 18px;
  letter-spacing: 0.15em;
  word-break: break-all;
  line-height: 1.8;
  min-height: 60px;
  margin: 0;
}

.preview .lit {
  color: var(--primary);
  font-weight: 700;
}
</style>
