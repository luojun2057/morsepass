<script setup lang="ts">
import { computed } from 'vue'
import type { KeyerReport } from '@/composables/useKeyer'
import { toDisplayCase } from '@/core/morse/codec'

const props = defineProps<{
  report: KeyerReport | null
  displayCase?: 'lower' | 'upper'
}>()

const snap = computed(() => props.report?.snapshot ?? null)

const weakList = computed(() => {
  const list = snap.value?.weakChars ?? []
  return list.slice(0, 10).map((w) => `${toDisplayCase(w.ch, props.displayCase ?? 'lower')} ${w.correct}/${w.total}`)
})
</script>

<template>
  <div v-if="report && snap" class="card" data-testid="report-card">
    <p class="card-title">本场报告</p>
    <div class="badges">
      <span class="badge">
        <span class="k">整场正确率</span>
        <span class="v" :class="(snap.accuracyPct ?? 0) >= 90 ? 'good' : (snap.accuracyPct ?? 0) < 60 ? 'bad' : ''">
          {{ snap.accuracyPct == null ? '—' : `${snap.accuracyPct}%` }}
        </span>
      </span>
      <span class="badge">
        <span class="k">字符</span>
        <span class="v">{{ snap.charsCorrect }}/{{ snap.charsTotal }}</span>
      </span>
      <span class="badge">
        <span class="k">节奏准确率</span>
        <span class="v">{{ snap.symbolAccuracyPct == null ? '—' : `${snap.symbolAccuracyPct}%` }}</span>
      </span>
      <span class="badge">
        <span class="k">用时</span>
        <span class="v">{{ Math.round(snap.durationMs / 1000) }}s</span>
      </span>
      <span class="badge">
        <span class="k">有效速度</span>
        <span class="v">{{ snap.liveWpm == null ? '—' : snap.liveWpm }}</span>
      </span>
    </div>
    <ul v-if="report.hints.length" class="hints">
      <li v-for="(h, i) in report.hints" :key="i">{{ h }}</li>
    </ul>
    <p v-if="weakList.length" class="weak">
      弱项字符：<span v-for="w in weakList" :key="w" class="chip small">{{ w }}</span>
    </p>
    <p class="hint">{{ report.saved ? '已保存到练习历史' : '本次未保存（试键模式）' }}</p>
  </div>
</template>

<style scoped>
.hints {
  margin: 12px 0 0;
  padding-left: 18px;
  color: var(--text-2);
  font-size: 13px;
}

.hints li {
  margin: 2px 0;
}

.weak {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--text-2);
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.chip.small {
  width: auto;
  height: 24px;
  padding: 0 8px;
  font-size: 12px;
  border-color: var(--danger);
  color: var(--danger);
  background: var(--danger-weak);
}
</style>
