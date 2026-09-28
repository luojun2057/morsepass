<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { audio, useKeyer } from '@/composables/useKeyer'
import { useSettings } from '@/composables/useSettings'
import { toDisplayCase } from '@/core/morse/codec'
import ParamSlider from '@/components/ParamSlider.vue'
import TimelineCanvas from '@/components/TimelineCanvas.vue'
import ReportCard from '@/components/ReportCard.vue'
import HistoryList from '@/components/HistoryList.vue'

const settings = useSettings()
const liveArea = ref<HTMLElement | null>(null)

const keyer = useKeyer('send', { mode: 'send', touchEl: () => liveArea.value })
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
</script>

<template>
  <main class="page">
    <h2 class="page-title">发报节奏训练</h2>
    <p class="page-sub">
      点击「开始练习」后，<b>按住鼠标任意位置</b>（电键模拟点击）或按住配置的键盘按键即可发报：短按为点，长按为划。
    </p>

    <div class="grid-2">
      <div class="card">
        <p class="card-title">参数设置</p>
        <ParamSlider v-model="timing.wpmChar" label="速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="timing.tolerancePct" label="容差" :min="5" :max="50" unit="%" />
        <ParamSlider v-model="settings.volume" label="音量" :min="0" :max="100" unit="%" />

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
      </div>
    </div>

    <div ref="liveArea" class="card" style="margin-top: 16px" data-testid="live-area">
      <p class="card-title">实时发报</p>
      <div class="pending-morse" data-testid="pending-morse">{{ pendingMorse || '&nbsp;' }}</div>
      <div class="decode-stream" data-testid="decoded-stream">{{ decodedDisp || '&nbsp;' }}</div>
      <TimelineCanvas :records="records" :running="running" />
      <p class="hint" style="margin: 8px 0 0">
        时间线只显示最近 10 秒；<span style="color: var(--success)">绿</span> = 节奏在容差内，
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
</style>
