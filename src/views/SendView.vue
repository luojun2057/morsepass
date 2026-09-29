<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
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
import { buildMaterialSpans, type MaterialKind } from '@/core/practice/material'
import { toDisplayCase } from '@/core/morse/codec'
import MaterialPicker from '@/components/MaterialPicker.vue'
import ParamSlider from '@/components/ParamSlider.vue'
import ResultDiff from '@/components/ResultDiff.vue'
import TimelineCanvas from '@/components/TimelineCanvas.vue'
import ReportCard from '@/components/ReportCard.vue'
import HistoryList from '@/components/HistoryList.vue'

const settings = useSettings()
const practiceArea = ref<HTMLElement | null>(null)
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
  touchEl: () => practiceArea.value,
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

// ---- 素材跟随高亮：已发变色 + 当前位置下划线 + 自动滚动 ----
const materialSpans = computed(() => buildMaterialSpans(materialText.value, sentCount.value))
const curEl = ref<HTMLElement | null>(null)
const setCurEl = (el: unknown): void => {
  curEl.value = el instanceof HTMLElement ? el : null
}
watch(sentCount, async () => {
  await nextTick()
  curEl.value?.scrollIntoView({ block: 'nearest' })
})

// ---- 全屏练习（Fullscreen API）----
const isFs = ref(false)
function onFsChange(): void {
  isFs.value = document.fullscreenElement === practiceArea.value
}
document.addEventListener('fullscreenchange', onFsChange)
onUnmounted(() => document.removeEventListener('fullscreenchange', onFsChange))
function toggleFs(): void {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {})
  } else {
    practiceArea.value?.requestFullscreen().catch(() => {})
  }
}

// ---- 报告弹窗：结束练习后弹出，关闭后可查看历史 ----
const showReport = ref(false)
watch(report, (r) => {
  if (!r) return
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  showReport.value = true
})

// ---- 设置区：练习中折叠为摘要条 ----
const settingsOpen = ref(false)
const KIND_LABELS: Record<MaterialKind, string> = {
  chars: '字符组',
  digits: '数字组',
  words: '常用单词',
  callsigns: '呼号',
  abbreviations: 'Q 码缩写',
  mixed: '混合',
  text: '自由文本',
  qso: 'QSO 通联',
  article: '英文文章',
}
const settingsSummary = computed(
  () =>
    `${timing.wpmChar} WPM · 容差 ${timing.tolerancePct}% · 音量 ${Math.round(settings.volume * 100)}% · ` +
    (mode.value === 'article' ? `素材：${KIND_LABELS[materialKind.value]}` : '自由发报') +
    ` · ${isAuto.value ? '自动键' : '手动键'}`,
)

// ---- 键控模式与双桨绑定（自动键） ----
const isAuto = computed(() => settings.input.keyerMode === 'auto')
const keyerStyle = computed({
  get: () => settings.input.keyerStyle,
  set: (v) => {
    settings.input.keyerStyle = v
  },
})
const paddleDitMouse = computed(() => (settings.input.paddleReverse ? '鼠标左键' : '鼠标右键'))
const paddleDahMouse = computed(() => (settings.input.paddleReverse ? '鼠标右键' : '鼠标左键'))

// 鼠标输入模式（手动键）
const mouseMode = computed({
  get: () =>
    settings.input.mouseButton === null ? 'off' : settings.input.mouseButton === 0 ? 'left' : 'right',
  set: (v: string) => {
    settings.input.mouseButton = v === 'left' ? 0 : v === 'right' ? 2 : null
  },
})

// 键盘按键捕获（手动键单键 / 自动键点桨、划桨）
type CaptureTarget = 'key' | 'dit' | 'dah'
const capturing = ref<CaptureTarget | null>(null)
function captureKey(target: CaptureTarget): void {
  capturing.value = target
  const handler = (e: KeyboardEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    if (e.code !== 'Escape') {
      if (target === 'key') settings.input.key = e.code
      else if (target === 'dit') settings.input.paddleDitKey = e.code
      else settings.input.paddleDahKey = e.code
    }
    capturing.value = null
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
      点击「开始练习」后即可发报：<b>手动键</b>按住鼠标任意位置（电键模拟点击）或配置的按键，短按为点、长按为划；
      <b>自动键</b>用两个桨（默认左键=划、右键=点），按住自动重复，双桨同按交替发点划。
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
        {{ mode === 'free' ? '随手发，练手感' : '照着素材发报，实时比对正误' }}
      </span>
    </div>

    <!-- ==================== 设置区 ==================== -->
    <template v-if="!running">
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
            <label>键控模式</label>
            <div class="tabs" style="flex: 1" data-testid="keyer-mode-tabs">
              <button
                :class="{ on: settings.input.keyerMode === 'manual' }"
                :disabled="running"
                data-testid="keyer-manual"
                @click="settings.input.keyerMode = 'manual'"
              >
                手动键
              </button>
              <button
                :class="{ on: settings.input.keyerMode === 'auto' }"
                :disabled="running"
                data-testid="keyer-auto"
                @click="settings.input.keyerMode = 'auto'"
              >
                自动键
              </button>
            </div>
          </div>

          <template v-if="settings.input.keyerMode === 'manual'">
            <div class="param-row">
              <label>鼠标输入</label>
              <select v-model="mouseMode" style="flex: 1" data-testid="mouse-mode">
                <option value="left">鼠标左键（电键模拟）</option>
                <option value="right">鼠标右键</option>
                <option value="off">禁用鼠标</option>
              </select>
            </div>

            <div class="param-row">
              <label>键盘按键</label>
              <template v-if="capturing === 'key'">
                <span style="flex: 1; color: var(--primary); font-weight: 600">请按下任意键…（Esc 取消）</span>
              </template>
              <template v-else>
                <span class="mono" style="flex: 1" data-testid="key-binding">
                  {{ settings.input.key ?? '未设置' }}
                </span>
              </template>
              <button class="btn" @click="captureKey('key')">设置按键</button>
              <button v-if="settings.input.key" class="btn" @click="settings.input.key = null">清除</button>
            </div>
            <p class="hint">电键转接器输出鼠标点击 → 选「鼠标左键」即可，光标位置不限。</p>
          </template>

          <template v-else>
            <div class="param-row">
              <label>点桨</label>
              <span class="mono" style="width: 88px" data-testid="dit-mouse-label">{{ paddleDitMouse }}</span>
              <template v-if="capturing === 'dit'">
                <span style="flex: 1; color: var(--primary); font-weight: 600">按下任意键…</span>
              </template>
              <template v-else>
                <span class="mono" style="flex: 1" data-testid="dit-key-binding">
                  {{ settings.input.paddleDitKey ?? '键盘未设置' }}
                </span>
              </template>
              <button class="btn" @click="captureKey('dit')">设置按键</button>
              <button v-if="settings.input.paddleDitKey" class="btn" @click="settings.input.paddleDitKey = null">清除</button>
            </div>

            <div class="param-row">
              <label>划桨</label>
              <span class="mono" style="width: 88px" data-testid="dah-mouse-label">{{ paddleDahMouse }}</span>
              <template v-if="capturing === 'dah'">
                <span style="flex: 1; color: var(--primary); font-weight: 600">按下任意键…</span>
              </template>
              <template v-else>
                <span class="mono" style="flex: 1" data-testid="dah-key-binding">
                  {{ settings.input.paddleDahKey ?? '键盘未设置' }}
                </span>
              </template>
              <button class="btn" @click="captureKey('dah')">设置按键</button>
              <button v-if="settings.input.paddleDahKey" class="btn" @click="settings.input.paddleDahKey = null">清除</button>
            </div>

            <div class="param-row">
              <label>点划互换</label>
              <button
                class="btn"
                :class="{ 'btn-primary': settings.input.paddleReverse }"
                style="flex: 1"
                data-testid="paddle-reverse"
                @click="settings.input.paddleReverse = !settings.input.paddleReverse"
              >
                ⇄ {{ settings.input.paddleReverse ? '已互换（点=左键 划=右键）' : '正常（点=右键 划=左键）' }}
              </button>
            </div>

            <div class="param-row">
              <label>iambic 模式</label>
              <select v-model="keyerStyle" style="flex: 1" data-testid="keyer-style">
                <option value="a">Mode A —— 松手即停（推荐）</option>
                <option value="b">Mode B —— 松手后多发一个记忆元素</option>
              </select>
            </div>
            <p class="hint">按住桨自动重复（点=右键、划=左键）；双桨同按交替发点划（iambic）。速度跟随「速度」滑块。</p>
          </template>
        </div>

        <div class="card">
          <p class="card-title">开始练习</p>
          <div class="row" style="justify-content: center; padding: 26px 0">
            <button class="btn btn-primary btn-big" data-testid="start-btn" @click="keyer.start()">
              开始练习
            </button>
          </div>
          <p class="hint" style="text-align: center">
            开始后进入<b>练习关注区</b>：素材与发报状态左右分栏同屏显示，可一键全屏。
          </p>
        </div>
      </div>
    </template>

    <!-- 练习中：设置区折叠为摘要条 -->
    <template v-else>
      <div class="settings-bar" @click="settingsOpen = !settingsOpen">
        <span class="gear">⚙</span>
        <span class="sum">设置已折叠 —— <b>{{ settingsSummary }}</b>（点此展开修改）</span>
        <span class="fold">{{ settingsOpen ? '收起 ▴' : '展开 ▾' }}</span>
      </div>
      <div v-if="settingsOpen" class="card" style="margin-top: 12px">
        <p class="card-title">练习中调整（立即生效）</p>
        <ParamSlider v-model="timing.wpmChar" label="速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="timing.tolerancePct" label="容差" :min="5" :max="50" unit="%" />
        <ParamSlider v-model="settings.volume" label="音量" :min="0" :max="100" :step="5" unit="%" :scale="100" />
        <p v-if="mode === 'article'" class="hint" style="margin: 0">
          素材：{{ materialText || '（空）' }} —— 练习中不可更换，结束练习后可修改。
        </p>
      </div>
    </template>

    <!-- ==================== 功能区（练习关注区） ==================== -->
    <div
      v-if="running"
      ref="practiceArea"
      class="practice-area"
      data-testid="live-area"
    >
      <div class="practice-head">
        <span class="hint">
          练习关注区 ·
          {{ isAuto ? `自动键：${paddleDahMouse}发划、${paddleDitMouse}发点（按住自动重复）` : '按住鼠标任意位置发报' }}
        </span>
        <button class="btn fs-btn" @click="toggleFs">
          {{ isFs ? '✕ 退出全屏' : '⛶ 全屏练习' }}
        </button>
        <button class="btn btn-danger" data-testid="stop-btn" @click="keyer.stop()">结束练习</button>
      </div>

      <!-- 对照模式：左素材 / 右发报现状 -->
      <div v-if="mode === 'article'" class="split">
        <div class="pane">
          <div class="card material-card">
            <div class="row" style="margin-bottom: 8px">
              <p class="card-title" style="margin: 0">素材</p>
              <span class="kind-chip">{{ KIND_LABELS[materialKind] }}</span>
              <span class="hint" style="margin-left: auto">已发高亮 · 自动跟随</span>
            </div>
            <div class="material-follow">
              <span
                v-for="(sp, i) in materialSpans"
                :key="i"
                :class="sp.state"
                :ref="sp.state === 'cur' ? setCurEl : undefined"
                >{{ sp.text }}</span
              >
              <span v-if="!materialSpans.length" class="hint">素材为空，请结束练习后在设置区填写。</span>
            </div>
            <div class="row" style="margin-top: 8px">
              <span class="hint">进度 {{ sentCount }} / {{ totalCount || '—' }} 字符</span>
              <b v-if="finishedArticle" style="color: var(--success); font-size: 12.5px">已发完全文，可结束练习</b>
            </div>
            <div class="progress-track">
              <div class="progress-fill" :style="{ width: progressPct + '%' }" data-testid="article-progress" />
            </div>
          </div>
        </div>

        <div class="pane">
          <div class="card">
            <div class="row">
              <p class="card-title" style="margin: 0">实时发报</p>
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
            <TimelineCanvas :records="records" :running="running" :wpm="timing.wpmChar" />
            <div class="badges" style="margin-top: 10px">
              <span class="badge">
                <span class="k">节奏准确率</span>
                <span
                  class="v"
                  :class="(snapshot?.symbolAccuracyPct ?? 0) >= 90 ? 'good' : ''"
                  data-testid="accuracy"
                  >{{
                    snapshot?.symbolAccuracyPct == null ? '—' : `${snapshot.symbolAccuracyPct}%`
                  }}</span
                >
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
          </div>

          <div v-if="articleResult" class="card">
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
        </div>
      </div>

      <!-- 自由模式：单栏居中放大 -->
      <div v-else class="split single">
        <div class="card">
          <div class="row">
            <p class="card-title" style="margin: 0">实时发报</p>
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
          <div class="pending-morse big" data-testid="pending-morse">{{ pendingMorse || '&nbsp;' }}</div>
          <div class="decode-stream big" data-testid="decoded-stream">{{ decodedDisp || '&nbsp;' }}</div>
          <TimelineCanvas :records="records" :running="running" :wpm="timing.wpmChar" />
          <div class="badges center">
            <span class="badge">
              <span class="k">节奏准确率</span>
              <span
                class="v"
                :class="(snapshot?.symbolAccuracyPct ?? 0) >= 90 ? 'good' : ''"
                data-testid="accuracy"
                >{{ snapshot?.symbolAccuracyPct == null ? '—' : `${snapshot.symbolAccuracyPct}%` }}</span
              >
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
          <p class="hint" style="margin: 8px 0 0; text-align: center">
            时间线随最后一次发报定位，停止输入即冻结；
            <span style="color: var(--success)">绿</span> = 节奏在容差内，
            <span style="color: var(--danger)">红</span> = 超差。
          </p>
        </div>
      </div>
    </div>

    <!-- ==================== 报告弹窗 ==================== -->
    <div v-if="showReport && report" class="modal-overlay" @click.self="showReport = false">
      <div class="modal-box">
        <div class="modal-head">
          <b>本场报告</b>
          <button class="btn" style="padding: 2px 12px" @click="showReport = false">关闭</button>
        </div>
        <ReportCard :report="report" :display-case="settings.displayCase" />
      </div>
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

/* ---- 设置区摘要条（练习中） ---- */
.settings-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 9px 16px;
  cursor: pointer;
  font-size: 13px;
  user-select: none;
}

.settings-bar:hover {
  border-color: color-mix(in srgb, var(--primary) 55%, var(--border));
}

.settings-bar .sum {
  color: var(--text-2);
}

.settings-bar .sum b {
  color: var(--text);
  font-weight: 500;
}

.settings-bar .gear,
.settings-bar .fold {
  color: var(--muted);
}

.settings-bar .fold {
  margin-left: auto;
}

/* ---- 功能区（练习关注区） ---- */
.practice-area {
  margin-top: 14px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.practice-area:fullscreen {
  background: var(--bg);
  border: none;
  border-radius: 0;
  padding: 14px 20px 20px;
  overflow: auto;
}

.practice-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}

.practice-area:fullscreen .practice-head {
  position: sticky;
  top: -14px;
  margin: -14px -20px 0;
  padding: 10px 20px;
  background: var(--bg);
  z-index: 5;
}

.practice-head .fs-btn {
  margin-left: auto;
  padding: 4px 14px;
}

.split {
  display: grid;
  grid-template-columns: minmax(0, 38fr) minmax(0, 62fr);
  gap: 14px;
  padding: 14px 16px 16px;
}

.split.single {
  grid-template-columns: minmax(0, 1fr);
}

.split.single > .card {
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
}

.pane {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.badges.center {
  justify-content: center;
}

/* ---- 素材卡：跟随高亮 ---- */
.material-card {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.kind-chip {
  font-size: 11px;
  background: var(--primary-weak);
  color: var(--primary);
  border-radius: 99px;
  padding: 1px 10px;
  white-space: nowrap;
}

.material-follow {
  font-family: var(--font-mono, monospace);
  font-size: 20px;
  line-height: 1.9;
  letter-spacing: 0.04em;
  word-break: break-word;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 14px;
  overflow: auto;
  max-height: 320px;
  flex: 1;
}

.material-follow .sent {
  color: var(--primary);
}

.material-follow .cur {
  border-bottom: 2px solid var(--warn);
}

.material-follow .rest {
  color: var(--text);
}

.practice-area:fullscreen .material-follow {
  font-size: 26px;
  max-height: none;
}

/* ---- 解码流 / pending（自由模式放大） ---- */
.decode-stream.big {
  font-size: 32px;
}

.pending-morse.big {
  font-size: 20px;
}

.practice-area:fullscreen .decode-stream.big {
  font-size: 40px;
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

/* ---- 报告弹窗 ---- */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgb(31 35 41 / 35%);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 8vh 16px 16px;
}

.modal-box {
  width: min(560px, 100%);
  background: var(--bg);
  border-radius: 12px;
  padding: 14px 16px 16px;
  box-shadow: 0 8px 30px rgb(31 35 41 / 18%);
}

.modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
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
