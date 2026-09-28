<script setup lang="ts">
import { computed, ref } from 'vue'
import ParamSlider from '@/components/ParamSlider.vue'
import { usePageTiming, useSettings } from '@/composables/useSettings'
import { textToMorse, morseToText } from '@/core/morse/convert'
import { buildTimeline } from '@/core/morse/timeline'
import { renderWav } from '@/core/audio/wav'

const tab = ref<'convert' | 'wav'>('convert')
const settings = useSettings()
const wavTiming = usePageTiming('tools')

/* ---------------- 码表互转 ---------------- */
const plainText = ref('')
const morseIn = ref('')
const morseOut = computed(() => textToMorse(plainText.value))
const textOut = computed(() => morseToText(morseIn.value))

const copyTip = ref('')
async function copy(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    copyTip.value = '已复制到剪贴板'
  } catch {
    copyTip.value = '复制失败，请手动选择文本'
  }
  setTimeout(() => (copyTip.value = ''), 2000)
}

/* ---------------- WAV 导出 ---------------- */
const wavText = ref('CQ CQ CQ DE MORSEPASS K')
const sampleRate = ref(44100)
const exporting = ref(false)

const wavInfo = computed(() => {
  const tl = buildTimeline(wavText.value, wavTiming.wpmChar, wavTiming.wpmEff)
  const bytes = 44 + Math.ceil(((tl.totalMs + 200) / 1000) * sampleRate.value) * 2
  return { seconds: Math.ceil(tl.totalMs / 1000), kb: Math.max(1, Math.round(bytes / 1024)) }
})

function exportWav(): void {
  const tl = buildTimeline(wavText.value, wavTiming.wpmChar, wavTiming.wpmEff)
  if (tl.events.length === 0) return
  const buf = renderWav(tl.events, {
    toneHz: settings.toneHz,
    volume: settings.volume,
    sampleRate: sampleRate.value,
  })
  const blob = new Blob([buf], { type: 'audio/wav' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `morsepass-${Date.now()}.wav`
  a.click()
  exporting.value = true
  setTimeout(() => {
    URL.revokeObjectURL(url)
    exporting.value = false
  }, 4000)
}
</script>

<template>
  <main class="page">
    <h2 class="page-title">工具箱</h2>
    <p class="page-sub">码表互转与 WAV 音频导出，练机/做卡/离线收听都方便。</p>

    <div class="tabs" style="margin-bottom: 14px">
      <button :class="{ on: tab === 'convert' }" data-testid="tab-convert" @click="tab = 'convert'">码表互转</button>
      <button :class="{ on: tab === 'wav' }" data-testid="tab-wav" @click="tab = 'wav'">WAV 导出</button>
    </div>

    <template v-if="tab === 'convert'">
      <div class="grid-2">
        <div class="card">
          <p class="card-title">文本 → 摩尔斯码</p>
          <textarea
            v-model="plainText"
            rows="3"
            placeholder="输入文本，如 SOS WEATHER BAD"
            data-testid="conv-text-in"
          ></textarea>
          <p class="mono conv-out" data-testid="conv-text-out">{{ morseOut || '—' }}</p>
          <div class="row">
            <button class="btn" :disabled="!morseOut" @click="copy(morseOut)">复制摩尔斯码</button>
            <span v-if="copyTip" class="hint" style="color: var(--success)">{{ copyTip }}</span>
          </div>
        </div>
        <div class="card">
          <p class="card-title">摩尔斯码 → 文本</p>
          <textarea
            v-model="morseIn"
            rows="3"
            placeholder="输入摩尔斯码，如 ... --- ...　（单词间用 / 分隔）"
            data-testid="conv-morse-in"
          ></textarea>
          <p class="mono conv-out" data-testid="conv-morse-out">{{ textOut || '—' }}</p>
          <div class="row">
            <button class="btn" :disabled="!textOut" @click="copy(textOut)">复制文本</button>
          </div>
        </div>
      </div>
      <p class="hint" style="margin-top: 10px">
        字符间以空格分隔、单词间以 " / " 分隔；兼容 · • — 等常见点划写法；未收录的码以 □ 占位。
      </p>
    </template>

    <template v-else>
      <div class="grid-2">
        <div class="card">
          <p class="card-title">导出内容</p>
          <textarea
            v-model="wavText"
            rows="4"
            placeholder="输入要导出的文本（大写字母/数字/空格）"
            data-testid="wav-text"
          ></textarea>
          <p class="hint" style="margin: 6px 0 12px">可在练习页生成素材后粘贴过来；导出的 WAV 可用于训练机、电台播放或制作练习音频。</p>
          <ParamSlider v-model="wavTiming.wpmChar" label="字符速度" :min="5" :max="40" unit=" WPM" />
          <ParamSlider v-model="wavTiming.wpmEff" label="有效速度" :min="5" :max="40" unit=" WPM" />
          <p class="hint" style="margin: 4px 0 0">有效速度低于字符速度即启用 Farnsworth 间隔。</p>
        </div>
        <div class="card">
          <p class="card-title">导出参数</p>
          <ParamSlider v-model="settings.toneHz" label="音调" :min="300" :max="1200" :step="10" unit=" Hz" />
          <ParamSlider v-model="settings.volume" label="音量" :min="0" :max="100" :step="5" unit="%" :scale="100" />
          <div class="param-row">
            <label>采样率</label>
            <select v-model.number="sampleRate" data-testid="wav-sample-rate" style="flex: 1">
              <option :value="8000">8000 Hz（体积最小）</option>
              <option :value="22050">22050 Hz（均衡）</option>
              <option :value="44100">44100 Hz（CD 音质）</option>
            </select>
          </div>
          <div class="row" style="margin-top: 12px">
            <button class="btn btn-primary" :disabled="wavInfo.seconds === 0" data-testid="wav-export" @click="exportWav">
              导出 WAV 文件
            </button>
            <span class="hint">
              时长约 {{ wavInfo.seconds }}s · 约 {{ wavInfo.kb }} KB（16bit 单声道 PCM）
            </span>
          </div>
          <p v-if="exporting" class="hint" style="color: var(--success); margin: 8px 0 0">已开始下载，请留意浏览器下载栏。</p>
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.conv-out {
  min-height: 44px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  letter-spacing: 0.08em;
  word-break: break-all;
  line-height: 1.7;
  margin: 10px 0;
}
</style>
