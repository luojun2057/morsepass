<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { audio, useKeyer } from '@/composables/useKeyer'
import { usePlayback } from '@/composables/usePlayback'
import { useSettings } from '@/composables/useSettings'
import { generateQuizQuestion, QUIZ_POOLS, type QuizQuestion } from '@/core/practice/quiz'
import { compareText, weakCharsFromCompare, type CompareResult } from '@/core/practice/compare'
import { normalizeText, toDisplayCase } from '@/core/morse/codec'
import ResultDiff from '@/components/ResultDiff.vue'
import ParamSlider from '@/components/ParamSlider.vue'

const tab = ref<'quiz' | 'echo'>('quiz')
const settings = useSettings()
const poolKey = ref<keyof typeof QUIZ_POOLS>('alnum')
const pool = () => QUIZ_POOLS[poolKey.value]

/* ---------------- 听选 Quiz ---------------- */
const playback = usePlayback('challenge')
const { playing, timing } = playback

const question = ref<QuizQuestion | null>(null)
const answeredIndex = ref<number | null>(null)
const qCount = ref(0)
const qCorrect = ref(0)
const qWrong = ref(0)

function startQuiz(): void {
  qCount.value = 0
  qCorrect.value = 0
  qWrong.value = 0
  nextQuestion()
}

function nextQuestion(): void {
  question.value = generateQuizQuestion(Math.random, pool(), 4)
  answeredIndex.value = null
  if (question.value) playback.play(question.value.target)
}

function answer(i: number): void {
  if (!question.value || answeredIndex.value !== null) return
  answeredIndex.value = i
  qCount.value++
  if (i === question.value.answerIndex) qCorrect.value++
  else qWrong.value++
}

const disp = (s: string): string => toDisplayCase(s, settings.displayCase)

/* ---------------- Echo 回发 ---------------- */
const echoTarget = ref('')
const echoResult = ref<CompareResult | null>(null)
const graded = ref<boolean | null>(null)
const eCount = ref(0)
const eCorrect = ref(0)
let autoTimer: number | null = null

const keyer = useKeyer('challenge', {
  mode: 'follow',
  material: 'echo',
  finalize: (decoded) => {
    if (!echoTarget.value.trim()) return null
    const r = compareText(echoTarget.value, decoded)
    echoResult.value = r
    return {
      accuracyPct: r.accuracyPct ?? 0,
      charsTotal: r.total,
      charsCorrect: r.correct,
      weakChars: weakCharsFromCompare(r),
    }
  },
})

function pickEchoTarget(): string {
  const items = pool()
  if (poolKey.value === 'words') return items[Math.floor(Math.random() * items.length)]
  const len = 3 + Math.floor(Math.random() * 3)
  let s = ''
  for (let i = 0; i < len; i++) s += items[Math.floor(Math.random() * items.length)]
  return s
}

function startEcho(): void {
  eCount.value = 0
  eCorrect.value = 0
  nextEchoRound()
}

function nextEchoRound(): void {
  echoResult.value = null
  graded.value = null
  echoTarget.value = pickEchoTarget()
  keyer.clearDecoded()
  playback.play(echoTarget.value)
}

// 播放结束 → 自动进入收听复述阶段
watch(playing, (v, old) => {
  if (old && !v && tab.value === 'echo' && echoTarget.value && graded.value === null) {
    keyer.start()
    armAutoGrade()
  }
})

function armAutoGrade(): void {
  if (autoTimer !== null) clearTimeout(autoTimer)
  autoTimer = window.setTimeout(tryAutoGrade, 1200)
}

function tryAutoGrade(): void {
  autoTimer = null
  if (!keyer.running.value || graded.value !== null) return
  const want = normalizeText(echoTarget.value).replace(/ /g, '').length
  const got = keyer.decoded.value.replace(/ /g, '').length
  if (want > 0 && got >= want) gradeEcho()
}

// 每次新字符输入都重置自动评分倒计时
watch(keyer.decoded, () => {
  if (keyer.running.value) armAutoGrade()
})

function gradeEcho(): void {
  if (autoTimer !== null) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
  if (!keyer.running.value || graded.value !== null) return
  keyer.stop() // finalize 内回写 echoResult
  const r = echoResult.value
  const perfect = r !== null && r.total > 0 && r.correct === r.total && r.extraCount === 0
  graded.value = perfect
  eCount.value++
  if (perfect) eCorrect.value++
}

/* ---------------- 信道条件（QRM / QSB） ---------------- */
watch(
  () => [settings.qsb.enabled, settings.qsb.level] as const,
  ([on, lv]) => {
    if (audio.ready || on) audio.setQsb(on, lv)
  },
)

function onQsbLevel(e: Event): void {
  settings.qsb.level = Number((e.target as HTMLInputElement).value) / 100
}

onBeforeUnmount(() => {
  if (autoTimer !== null) clearTimeout(autoTimer)
})
</script>

<template>
  <main class="page">
    <h2 class="page-title">挑战</h2>
    <p class="page-sub">听选测验与 Echo 回发，检验你的真功夫。</p>

    <div class="tabs" style="margin-bottom: 14px">
      <button :class="{ on: tab === 'quiz' }" data-testid="tab-quiz" @click="tab = 'quiz'">听选 Quiz</button>
      <button :class="{ on: tab === 'echo' }" data-testid="tab-echo" @click="tab = 'echo'">Echo 回发</button>
    </div>

    <!-- Quiz -->
    <template v-if="tab === 'quiz'">
      <div class="card">
        <p class="card-title">听选测验</p>
        <div class="row" style="margin-bottom: 12px; flex-wrap: wrap">
          <label class="inline">
            题库
            <select v-model="poolKey" data-testid="quiz-pool">
              <option value="alnum">字母 + 数字</option>
              <option value="letters">仅字母</option>
              <option value="digits">仅数字</option>
              <option value="words">单词与缩写</option>
            </select>
          </label>
          <button class="btn btn-primary" data-testid="quiz-start" @click="startQuiz">开始测验</button>
          <span class="hint" data-testid="quiz-score">已答 {{ qCount }} · 对 {{ qCorrect }} · 错 {{ qWrong }}</span>
        </div>
        <ParamSlider v-model="timing.wpmChar" label="字符速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="timing.wpmEff" label="有效速度" :min="5" :max="40" unit=" WPM" />

        <div v-if="question" class="quiz-options">
          <button
            v-for="(opt, i) in question.options"
            :key="i"
            class="quiz-opt"
            :class="{
              correct: answeredIndex !== null && i === question.answerIndex,
              wrong: answeredIndex === i && i !== question.answerIndex,
            }"
            :data-correct="i === question.answerIndex ? 'true' : 'false'"
            :data-testid="`quiz-option-${i}`"
            :disabled="answeredIndex !== null"
            @click="answer(i)"
          >
            {{ disp(opt) }}
          </button>
        </div>
        <p v-else class="hint">点击「开始测验」后播放摩尔斯码，从四个选项中选出你听到的内容。</p>

        <div v-if="question && answeredIndex !== null" class="row" style="margin-top: 12px">
          <span
            class="hint"
            :style="answeredIndex === question.answerIndex ? 'color: var(--success)' : 'color: var(--danger)'"
          >
            {{ answeredIndex === question.answerIndex ? '✓ 答对了' : `✗ 正确答案是 ${disp(question.target)}` }}
          </span>
          <button class="btn btn-primary" data-testid="quiz-next" @click="nextQuestion">下一题</button>
        </div>
      </div>
    </template>

    <!-- Echo -->
    <template v-else>
      <div class="card">
        <p class="card-title">Echo 回发（Morserino 风格）</p>
        <p class="hint" style="margin: 0 0 12px">
          播放一段摩尔斯码 → 你用按键复述发回 → 字符数凑齐后 1.2 秒自动评分（也可手动评分）。
        </p>
        <div class="row" style="margin-bottom: 12px; flex-wrap: wrap">
          <label class="inline">
            题库
            <select v-model="poolKey" data-testid="echo-pool">
              <option value="alnum">字母 + 数字</option>
              <option value="letters">仅字母</option>
              <option value="digits">仅数字</option>
              <option value="words">单词与缩写</option>
            </select>
          </label>
          <button v-if="graded === null && !keyer.running.value" class="btn btn-primary" data-testid="echo-start" @click="startEcho">
            开始 Echo
          </button>
          <button v-if="keyer.running.value" class="btn" data-testid="echo-grade" @click="gradeEcho">完成本轮</button>
          <button v-if="graded !== null" class="btn btn-primary" data-testid="echo-next" @click="nextEchoRound">下一轮</button>
          <span class="hint" data-testid="echo-score">本轮 {{ eCount }} · 复述正确 {{ eCorrect }}</span>
        </div>
        <ParamSlider v-model="timing.wpmChar" label="字符速度" :min="5" :max="40" unit=" WPM" />
        <ParamSlider v-model="timing.wpmEff" label="有效速度" :min="5" :max="40" unit=" WPM" />

        <div v-if="keyer.running.value" class="hint echo-waiting" data-testid="echo-running">
          ● 复述进行中：用鼠标左键 / 已配置的按键发回你听到的内容
        </div>
        <p class="mono echo-decoded" data-testid="echo-decoded">{{ keyer.decodedDisplay() || '…' }}</p>

        <div v-if="graded !== null && echoResult" class="echo-feedback" data-testid="echo-feedback">
          <p :style="graded ? 'color: var(--success)' : 'color: var(--danger)'" style="font-weight: 600">
            {{ graded ? '✓ 复述完全正确' : '✗ 还不准确，对照下面的差异看看' }}
          </p>
          <ResultDiff :result="echoResult" :display-case="settings.displayCase" />
        </div>
      </div>
    </template>

    <!-- 信道条件 -->
    <div class="card" style="margin-top: 16px">
      <p class="card-title">信道条件（可选干扰）</p>
      <div class="row" style="flex-wrap: wrap; gap: 12px">
        <label class="inline">
          QRM 噪声
          <input v-model="settings.noise.enabled" type="checkbox" data-testid="noise-toggle" />
          <input v-if="settings.noise.enabled" v-model.number="settings.noise.level" type="range" min="0" max="40" step="1" style="flex: 1" />
          <span v-if="settings.noise.enabled" class="value">{{ Math.round(settings.noise.level * 100) }}%</span>
        </label>
        <label class="inline">
          QSB 衰落
          <input v-model="settings.qsb.enabled" type="checkbox" data-testid="qsb-toggle" />
          <input v-if="settings.qsb.enabled" type="range" min="0" max="100" step="10" :value="settings.qsb.level * 100" style="flex: 1" @input="onQsbLevel" />
          <span v-if="settings.qsb.enabled" class="value">{{ Math.round(settings.qsb.level * 100) }}%</span>
        </label>
      </div>
      <p class="hint" style="margin: 6px 0 0">QSB 模拟信号衰落，在播放链路上随机起伏音量；对练习页同样生效。</p>
    </div>
  </main>
</template>

<style scoped>
.inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
}

.quiz-options {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-top: 6px;
}

.quiz-opt {
  font-size: 26px;
  font-weight: 700;
  padding: 18px 8px;
  border: 1.5px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.quiz-opt:hover:not(:disabled) {
  border-color: var(--primary);
}

.quiz-opt.correct {
  border-color: var(--success);
  background: color-mix(in srgb, var(--success) 12%, var(--card));
}

.quiz-opt.wrong {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 10%, var(--card));
}

.echo-waiting {
  color: var(--primary);
  font-weight: 600;
}

.echo-decoded {
  min-height: 44px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 16px;
  word-break: break-all;
  line-height: 1.7;
  margin: 10px 0;
}

.echo-feedback {
  border-top: 1px dashed var(--border);
  padding-top: 10px;
}

@media (max-width: 560px) {
  .quiz-options {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
