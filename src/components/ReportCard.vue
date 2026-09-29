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
        <span class="k">节奏准确率</span>
        <span class="v" :class="(snap.symbolAccuracyPct ?? 0) >= 90 ? 'good' : (snap.symbolAccuracyPct ?? 0) < 60 ? 'bad' : ''">
          {{ snap.symbolAccuracyPct == null ? '—' : `${snap.symbolAccuracyPct}%` }}
        </span>
      </span>
      <span class="badge">
        <span class="k">解码正确率</span>
        <span class="v">{{ snap.accuracyPct == null ? '—' : `${snap.accuracyPct}%` }}</span>
      </span>
      <span class="badge">
        <span class="k">字符</span>
        <span class="v">{{ snap.charsCorrect }}/{{ snap.charsTotal }}</span>
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
    <p class="hint" style="margin-top: 8px">
      节奏准确率 = 点划在容差内的比例（主指标）；解码正确率按字符计（字符内全部符号达标才算对），仅供严格参考。
    </p>
    <ul v-if="report.hints.length" class="hints">
      <li v-for="(h, i) in report.hints" :key="i">{{ h }}</li>
    </ul>
    <div v-if="report.rhythmIssues.length" class="rhythm" data-testid="rhythm-issues">
      <p class="rhythm-title">节奏问题汇总（按次数排序）</p>
      <table class="rhythm-table">
        <thead>
          <tr>
            <th>问题类型</th>
            <th>次数</th>
            <th>平均偏差</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="iss in report.rhythmIssues" :key="iss.kind">
            <td>{{ iss.label }}</td>
            <td class="num">{{ iss.count }}</td>
            <td class="num" :class="iss.avgDevPct > 0 ? 'long' : 'short'">
              {{ iss.avgDevPct > 0 ? '+' : '' }}{{ iss.avgDevPct }}%
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p v-else-if="snap.symbolAccuracyPct != null && snap.symbolAccuracyPct >= 100" class="hint all-good">
      节奏全部在容差内，可以尝试提高速度
    </p>
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

.rhythm {
  margin-top: 12px;
}

.rhythm-title {
  margin: 0 0 6px;
  font-size: 13px;
  color: var(--text-2);
}

.rhythm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.rhythm-table th,
.rhythm-table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}

.rhythm-table th {
  color: var(--text-3);
  font-weight: 400;
  font-size: 12px;
}

.rhythm-table .num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.rhythm-table .long {
  color: var(--danger);
}

.rhythm-table .short {
  color: var(--primary);
}

.all-good {
  margin-top: 12px;
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
