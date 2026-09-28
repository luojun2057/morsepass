<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { audio, useKeyer } from '@/composables/useKeyer'
import { useSettings } from '@/composables/useSettings'
import {
  compareByWords,
  compareText,
  weakCharsFromCompare,
  type CompareResult,
  type WordCompareResult,
  type WordMatchMode,
} from '@/core/practice/compare'
import type { MaterialKind } from '@/core/practice/material'
import { toDisplayCase } from '@/core/morse/codec'
import MaterialPicker from '@/components/MaterialPicker.vue'
import ParamSlider from '@/components/ParamSlider.vue'
import ResultDiff from '@/components/ResultDiff.vue'
import TimelineCanvas from '@/components/TimelineCanvas.vue'
import ReportCard from '@/components/ReportCard.vue'
import HistoryList from '@/components/HistoryList.vue'

const settings = useSettings()
const liveArea = ref<HTMLElement | null>(null)
const materialText = ref('')
const materialKind = ref<MaterialKind>('text')

// 发报模式：自由发报 / 对照文章发报
const mode = computed({
  get: () => settings.sendMode ?? 'free',
  set: (v) => {
    settings.sendMode = v
  },
})

const keyer = useKeyer('send', {
  mode: 'send',
  touchEl: () => liveArea.value,
  material: () => (mode.value === 'article' ? 'article' : 'free'),
  // 对照模式结束时用全文比对（LCS）结果覆盖正确率
  finalize: (decoded) => {
    if (mode.value !== 'article' || !materialText.value.trim()) return null
    const r = compareText(materialText.value, decoded)
    if (r.total === 0) return null
    return {
      accuracyPct: r.accuracyPct ?? 0,
      charsTotal: r.total,
      charsCorrect: r.correct,
      weakChars: weakCharsFromCompare(r),
    }
  },
})
const { running, pendingMorse, records, snapshot, report, history, timing } = keyer

// 音调/音量即时生效
watch(
  () => settings.toneHz,
  (v) => audio.setTone(v),
)
watch(
  () => settings.volume,
  (v) => audio.setVolume(v),
)

// 练习中禁用文本选择
watch(running, (v) => {
  document.body.classList.toggle('keying', v)
})

const decodedDisp = computed(() => {
  const s = toDisplayCase(keyer.decoded.value, settings.displayCase)
  return s.length > 160 ? s.slice(-160) : s
})

// 对照模式：实时比对（LCS）与进度
const articleResult = computed<CompareResult | null>(() => {
  if (mode.value !== 'article' || !materialText.value.trim()) return null
  return compareText(materialText.value, keyer.decoded.value)
})

/**
 * 词级比对（按组验证）：
 * - 呼号/数字组/QSO 模板/字符组/单词/Q码 → strict，组内全等才算对
 * - 自由文本/英文文章 → fuzzy，按词相似度对齐，找连续匹配的大片
 */
const wordMode = computed<WordMatchMode>(() =>
  materialKind.value === 'text' || materialKind.value === 'article' ? 'fuzzy' : 'strict',
)
const wordResult = computed<WordCompareResult | null>(() => {
  if (mode.value !== 'article' || !materialText.value.trim()) return null
  return compareByWords(materialText.value, keyer.decoded.value, wordMode.value)
})
const sentCount = computed(() => keyer.decoded.value.length)
const totalCount = computed(() => materialText.value.length)
const progressPct = computed(() => {
  if (totalCount.value === 0 || sentCount.value === 0) return 0
  return Math.min(100, Math.round((sentCount.value / totalCount.value) * 100))
})
const finishedArticle = computed(
  () =>
    articleResult.value !== null &&
    sentCount.value >= totalCount.value &&
    totalCount.value > 0,
)

// 鼠标输入模式
const mouseMode = computed({
  get: () =>
    settings.input.mouseButton === null ? 'off' : settings.input.mouseButton === 0 ? 'left' : 'right',
  set: (v: string) => {
    settings.input.mouseButton = v === 'left' ? 0 : v === 'right' ? 2 : null
  },
})

// 键盘按键捕获
const capturing = ref(false)
function captureKey(): void {
  capturing.value = true
  const handler = (e: KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (e.code !== 'Escape') settings.input.key = e.code
    capturing.value = false
    window.removeEventListener('keydown', handler, true)
  }
  window.addEventListener('keydown', handler, true)
}

const sendHistory = computed(() => history.value.filter((r) => r.mode === 'send'))

const dispWord = (s: string): string => toDisplayCase(s, settings.displayCase)
</script>

<template>
  <main class="page">
    <h2 class="page-title">发报节奏训练</h2>
    <p class="page-sub">
      点击「开始练习」后，<b>按住鼠标任意位置</b>（电键模拟点击）或按住配置的键盘按键即可发报：短按为点，长按为划。
    </p>

    <!-- 模式切换（练习中锁定） -->
    <div class="row" style="margin-bottom: 14px">
      <div class="tabs" data-testid="send-mode-tabs">
        <button
          :class="{ on: mode === 'free' }"
          :disabled="running"
          data-testid="mode-free"
          @click="mode = 'free'"
        >
          自由发报
        </button>
        <button
          :class="{ on: mode === 'article' }"
          :disabled="running"
          data-testid="mode-article"
          @click="mode = 'article'"
        >
          对照发报
        </button>
      </div>
      <span class="hint" style="margin-left: 10px">
        {{ mode === 'free' ? '随手发，练手感' : '照着下方文章发报，实时比对正误' }}
      </span>
    </div>

    <MaterialPicker
      v-if="mode === 'article'"
      v-model="materialText"
      v-model:kind="materialKind"
    />

    <div class="grid-2" style="margin-top: 16px">
      <div class="card">
        <p class="card-title">参数设置</p>
        <ParamSlider v-model="timing.wpmChar" label="速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="timing.tolerancePct" label="容差" :min="5" :max="50" unit="%" />
        <ParamSlider v-model="settings.volume" label="音量" :min="0" :max="100" :step="5" unit="%" :scale="100" />

        <div class="param-row">
          <label>音调</label>
          <input
            v-model.number="settings.toneHz"
            type="number"
            min="300"
            max="1200"
            step="10"
            style="flex: 1"
          />
          <span class="value">Hz</span>
        </div>

        <div class="param-row">
          <label>电键输入</label>
          <select v-model="mouseMode" style="flex: 1" data-testid="mouse-mode">
            <option value="left">鼠标左键（电键模拟）</option>
            <option value="right">鼠标右键</option>
            <option value="off">禁用鼠标</option>
          </select>
        </div>

        <div class="param-row">
          <label>键盘按键</label>
          <template v-if="capturing">
            <span style="flex: 1; color: var(--primary); font-weight: 600">请按下任意键…（Esc 取消）</span>
          </template>
          <template v-else>
            <span class="mono" style="flex: 1" data-testid="key-binding">
              {{ settings.input.key ?? '未设置' }}
            </span>
          </template>
          <button class="btn" @click="captureKey">设置按键</button>
          <button v-if="settings.input.key" class="btn" @click="settings.input.key = null">清除</button>
        </div>
        <p class="hint">电键转接器输出鼠标点击 → 选「鼠标左键」即可，光标位置不限。</p>
      </div>

      <div class="card">
        <p class="card-title">开始 / 结束</p>
        <div class="row" style="justify-content: center; padding: 18px 0">
          <button
            v-if="!running"
            class="btn btn-primary btn-big"
            data-testid="start-btn"
            @click="keyer.start()"
          >
            开始练习
          </button>
          <button v-else class="btn btn-danger btn-big" data-testid="stop-btn" @click="keyer.stop()">
            结束练习
          </button>
        </div>
        <div class="badges" style="justify-content: center">
          <span class="badge">
            <span class="k">整场正确率</span>
            <span class="v" data-testid="accuracy">{{
              snapshot?.accuracyPct == null ? '—' : `${snapshot.accuracyPct}%`
            }}</span>
          </span>
          <span class="badge">
            <span class="k">近 10 符</span>
            <span class="v">{{ snapshot?.rollingAccuracyPct == null ? '—' : `${snapshot.rollingAccuracyPct}%` }}</span>
          </span>
          <span class="badge">
            <span class="k">实时速度</span>
            <span class="v">{{ snapshot?.liveWpm == null ? '—' : snapshot.liveWpm }}</span>
          </span>
          <span class="badge">
            <span class="k">已发字符</span>
            <span class="v">{{ snapshot?.charsTotal ?? 0 }}</span>
          </span>
        </div>
        <template v-if="mode === 'article'">
          <div class="row" style="margin-top: 12px; justify-content: center">
            <span class="hint">
              进度 {{ sentCount }} / {{ totalCount || '—' }} 字符
              <b v-if="finishedArticle && running" style="color: var(--success)">· 已发完全文，可结束练习</b>
            </span>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: progressPct + '%' }" data-testid="article-progress" />
          </div>
        </template>
      </div>
    </div>

    <div v-if="mode === 'article' && articleResult" class="card" style="margin-top: 16px">
      <p class="card-title">
        实时比对
        <span class="hint" style="font-weight: 400; margin-left: 8px">
          {{ wordMode === 'strict' ? '按组验证：一组内全部正确该组才算对' : '文章模式：大片匹配，容忍中间的错漏' }}
        </span>
      </p>
      <div class="badges" style="margin-bottom: 10px">
        <span class="badge">
          <span class="k">{{ wordMode === 'strict' ? '组正确率' : '词正确率' }}</span>
          <span
            class="v"
            :class="(wordResult?.accuracyPct ?? 0) >= 90 ? 'good' : ''"
            data-testid="article-accuracy"
          >
            {{ wordResult?.accuracyPct == null ? '—' : `${wordResult.accuracyPct}%` }}
          </span>
        </span>
        <span class="badge">
          <span class="k">对</span>
          <span class="v" style="color: var(--success)">{{ wordResult?.correct ?? 0 }}</span>
        </span>
        <span class="badge">
          <span class="k">错</span>
          <span class="v" style="color: var(--danger)">{{ wordResult?.items.filter((i) => i.kind === 'wrong').length ?? 0 }}</span>
        </span>
        <span class="badge">
          <span class="k">漏发</span>
          <span class="v">{{ wordResult?.items.filter((i) => i.kind === 'missed').length ?? 0 }}</span>
        </span>
        <span class="badge">
          <span class="k">多余</span>
          <span class="v">{{ wordResult?.extraWords.length ?? 0 }}</span>
        </span>
      </div>

      <!-- 逐组结果 chips -->
      <div class="word-chips" data-testid="article-groups">
        <span
          v-for="(it, idx) in wordResult?.items ?? []"
          :key="idx"
          class="word-chip"
          :class="[it.kind, { block: it.kind === 'match' && it.block }]"
          :title="it.kind === 'wrong' && it.got ? `你发的是：${dispWord(it.got)}` : undefined"
        >
          <span class="wc-main">{{ dispWord(it.expected) }}</span>
          <span v-if="it.kind === 'wrong' && it.got" class="wc-got">{{ dispWord(it.got) }}</span>
        </span>
        <span
          v-for="(w, idx) in wordResult?.extraWords ?? []"
          :key="'e' + idx"
          class="word-chip extra"
          :title="`多发的内容：${dispWord(w)}`"
        >
          <span class="wc-main">{{ dispWord(w) }}</span>
        </span>
      </div>

      <p class="hint" style="margin: 10px 0 0">
        <span class="legend-dot ok" /> 组全对
        <span class="legend-dot bad" style="margin-left: 10px" /> 组错（小字为你发出的内容）
        <span class="legend-dot miss" style="margin-left: 10px" /> 漏发
        <span class="legend-dot extra" style="margin-left: 10px" /> 多余
        <template v-if="wordMode === 'fuzzy'">
          · 深色底 = 连续对上的<b>大片</b>
        </template>
      </p>

      <details style="margin-top: 10px">
        <summary class="hint" style="cursor: pointer">逐字符 diff（详细）</summary>
        <ResultDiff :result="articleResult" :display-case="settings.displayCase" />
      </details>
    </div>

    <div ref="liveArea" class="card" style="margin-top: 16px" data-testid="live-area">
      <div class="row">
        <p class="card-title">实时发报</p>
        <button
          v-if="keyer.decoded.value"
          class="btn"
          style="margin-left: auto; padding: 2px 12px"
          data-testid="clear-decoded"
          @click="keyer.clearDecoded()"
        >
          清空
        </button>
      </div>
      <div class="pending-morse" data-testid="pending-morse">{{ pendingMorse || '&nbsp;' }}</div>
      <div class="decode-stream" data-testid="decoded-stream">{{ decodedDisp || '&nbsp;' }}</div>
      <TimelineCanvas :records="records" :running="running" />
      <p class="hint" style="margin: 8px 0 0">
        时间线随最后一次发报定位，停止输入即冻结；
        <span style="color: var(--success)">绿</span> = 节奏在容差内，
        <span style="color: var(--danger)">红</span> = 超差。
      </p>
    </div>

    <div style="margin-top: 16px">
      <ReportCard :report="report" :display-case="settings.displayCase" />
    </div>

    <div style="margin-top: 16px">
      <HistoryList :records="sendHistory" :limit="5" />
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

.progress-track {
  margin-top: 8px;
  height: 8px;
  border-radius: 4px;
  background: var(--bg);
  border: 1px solid var(--border);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--primary);
  transition: width 0.3s;
}

/* ---- 逐组验证 chips ---- */
.word-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.word-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  font-family: var(--mono, monospace);
  font-size: 13px;
  line-height: 1;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg);
}

.word-chip .wc-got {
  font-size: 11px;
  opacity: 0.75;
}

.word-chip.match {
  border-color: color-mix(in srgb, var(--success) 55%, var(--border));
  background: color-mix(in srgb, var(--success) 10%, var(--bg));
  color: var(--success);
  font-weight: 600;
}

.word-chip.match.block {
  background: color-mix(in srgb, var(--success) 22%, var(--bg));
  box-shadow: inset 0 -2px 0 var(--success);
}

.word-chip.wrong {
  border-color: color-mix(in srgb, var(--danger) 55%, var(--border));
  background: color-mix(in srgb, var(--danger) 8%, var(--bg));
}

.word-chip.wrong .wc-main {
  text-decoration: line-through;
  opacity: 0.7;
}

.word-chip.wrong .wc-got {
  color: var(--danger);
  font-weight: 700;
  opacity: 1;
}

.word-chip.missed {
  border-style: dashed;
  color: var(--muted);
  background: transparent;
}

.word-chip.extra {
  border-color: color-mix(in srgb, var(--warn) 60%, var(--border));
  background: color-mix(in srgb, var(--warn) 10%, var(--bg));
  color: var(--warn);
}

.legend-dot {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 3px;
  vertical-align: middle;
  margin-right: 3px;
  border: 1px solid var(--border);
}

.legend-dot.ok {
  background: color-mix(in srgb, var(--success) 22%, var(--bg));
  border-color: var(--success);
}

.legend-dot.bad {
  background: color-mix(in srgb, var(--danger) 12%, var(--bg));
  border-color: var(--danger);
}

.legend-dot.miss {
  background: transparent;
  border-style: dashed;
}

.legend-dot.extra {
  background: color-mix(in srgb, var(--warn) 15%, var(--bg));
  border-color: var(--warn);
}
</style>
