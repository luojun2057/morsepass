<script setup lang="ts">
import { computed } from 'vue'
import type { SessionRecord } from '@/core/types'

const props = withDefaults(
  defineProps<{
    records: SessionRecord[]
    limit?: number
  }>(),
  { limit: 5 },
)

const MODE_LABEL: Record<string, string> = {
  send: '发报',
  receive: '听抄',
  follow: '跟发',
  koch: 'Koch',
}

const list = computed(() => props.records.slice(0, props.limit))

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="card" data-testid="history-list">
    <p class="card-title">最近练习</p>
    <p v-if="list.length === 0" class="hint">暂无记录</p>
    <table v-else class="hist">
      <thead>
        <tr>
          <th>时间</th>
          <th>模式</th>
          <th>WPM</th>
          <th>正确率</th>
          <th>字符</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="r in list" :key="r.id">
          <td class="hint">{{ fmtDate(r.date) }}</td>
          <td>{{ MODE_LABEL[r.mode] ?? r.mode }}</td>
          <td>{{ r.wpmChar }}</td>
          <td :class="r.accuracyPct >= 90 ? 'good' : r.accuracyPct < 60 ? 'bad' : ''">{{ r.accuracyPct }}%</td>
          <td class="hint">{{ r.charsCorrect }}/{{ r.charsTotal }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.hist {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.hist th {
  text-align: left;
  color: var(--muted);
  font-weight: 500;
  padding: 4px 8px 4px 0;
  border-bottom: 1px solid var(--border);
}

.hist td {
  padding: 5px 8px 5px 0;
  border-bottom: 1px solid var(--bg);
  font-variant-numeric: tabular-nums;
}

.good {
  color: var(--success);
  font-weight: 600;
}

.bad {
  color: var(--danger);
  font-weight: 600;
}
</style>
