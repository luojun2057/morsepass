<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { clearHistory, loadHistory } from '@/core/storage/persist'
import type { SessionRecord, WeakChar } from '@/core/types'

const router = useRouter()
const records = ref<SessionRecord[]>(loadHistory())

const MODE_LABEL: Record<string, string> = {
  send: '发报',
  receive: '听抄',
  follow: '跟发',
  koch: 'Koch',
}

const list = computed(() => records.value.slice(0, 50))

/** 趋势数据（按时间正序取最近 30 次） */
const trend = computed(() => {
  const rs = [...records.value].reverse().slice(-30)
  return rs.map((r, i) => ({ x: i, y: r.accuracyPct, wpm: r.wpmChar }))
})

const SVG_W = 560
const SVG_H = 160
const trendPts = computed(() => {
  const n = trend.value.length
  return trend.value.map((p, i) => {
    const x = n === 1 ? SVG_W / 2 : (i / (n - 1)) * (SVG_W - 40) + 20
    const y = SVG_H - 20 - (p.y / 100) * (SVG_H - 40)
    return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) }
  })
})
const trendPoints = computed(() => trendPts.value.map((p) => `${p.x},${p.y}`).join(' '))

/** 汇总弱项字符（跨所有记录聚合） */
const weakAgg = computed(() => {
  const map = new Map<string, WeakChar>()
  for (const r of records.value) {
    for (const w of r.weakChars) {
      const e = map.get(w.ch) ?? { ch: w.ch, correct: 0, total: 0 }
      e.correct += w.correct
      e.total += w.total
      map.set(w.ch, e)
    }
  }
  return [...map.values()]
    .filter((w) => w.correct / w.total < 0.8)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, 12)
})

/** 把弱项字符带去听抄页加练 */
function practiceWeak(): void {
  if (weakAgg.value.length === 0) return
  const text = weakAgg.value
    .map((w) => w.ch)
    .join('')
    .toUpperCase()
  try {
    sessionStorage.setItem('mp.weakPractice', text)
  } catch {
    /* 忽略 */
  }
  router.push('/receive')
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function clearAll(): void {
  if (confirm('确定清空全部练习历史？此操作不可恢复。')) {
    clearHistory()
    records.value = []
  }
}
</script>

<template>
  <main class="page">
    <h2 class="page-title">练习统计</h2>
    <p class="page-sub">数据保存在本机浏览器（localStorage），不上传服务器。</p>

    <div class="card">
      <p class="card-title">正确率趋势（最近 {{ trend.length }} 次）</p>
      <div v-if="trend.length === 0" class="hint">暂无数据，先去练一发</div>
      <svg v-else :viewBox="`0 0 ${SVG_W} ${SVG_H}`" class="trend" data-testid="trend-chart">
        <line x1="20" :y1="SVG_H - 20" :x2="SVG_W - 20" :y2="SVG_H - 20" stroke="#e5e8ec" />
        <line x1="20" y1="20" :x2="SVG_W - 20" y2="20" stroke="#e5e8ec" stroke-dasharray="4 3" />
        <text x="22" y="16" font-size="10" fill="#9aa1ab">100%</text>
        <text :x="22" :y="SVG_H - 6" font-size="10" fill="#9aa1ab">0%</text>
        <polyline :points="trendPoints" fill="none" stroke="#2f6fed" stroke-width="2" />
        <circle
          v-for="(p, i) in trendPts"
          :key="i"
          :cx="p.x"
          :cy="p.y"
          r="3"
          fill="#2f6fed"
        />
      </svg>
    </div>

    <div class="card" style="margin-top: 16px">
      <p class="card-title">弱项字符（正确率 &lt; 80%）</p>
      <p v-if="weakAgg.length === 0" class="hint">暂无明显弱项，继续保持</p>
      <div v-else class="row">
        <span v-for="w in weakAgg" :key="w.ch" class="weak-chip mono">
          {{ w.ch.toLowerCase() }} <b>{{ Math.round((w.correct / w.total) * 100) }}%</b>
        </span>
        <button class="btn" data-testid="practice-weak" @click="practiceWeak">针对弱项加练 →</button>
      </div>
    </div>

    <div class="card" style="margin-top: 16px">
      <div class="row" style="justify-content: space-between; margin-bottom: 8px">
        <p class="card-title" style="margin: 0">练习历史（最近 {{ list.length }} 条）</p>
        <button v-if="records.length" class="btn" @click="clearAll">清空历史</button>
      </div>
      <p v-if="list.length === 0" class="hint">暂无记录</p>
      <table v-else class="hist" data-testid="stats-table">
        <thead>
          <tr>
            <th>时间</th>
            <th>模式</th>
            <th>字符速度</th>
            <th>有效速度</th>
            <th>正确率</th>
            <th>节奏</th>
            <th>字符</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in list" :key="r.id">
            <td class="hint">{{ fmtDate(r.date) }}</td>
            <td>{{ MODE_LABEL[r.mode] ?? r.mode }}</td>
            <td>{{ r.wpmChar }}</td>
            <td>{{ r.wpmEff }}</td>
            <td :class="r.accuracyPct >= 90 ? 'good' : r.accuracyPct < 60 ? 'bad' : ''">{{ r.accuracyPct }}%</td>
            <td>{{ r.symbolAccuracyPct == null ? '—' : `${r.symbolAccuracyPct}%` }}</td>
            <td class="hint">{{ r.charsCorrect }}/{{ r.charsTotal }}</td>
          </tr>
        </tbody>
      </table>
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

.trend {
  width: 100%;
  height: auto;
}

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

.weak-chip {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 4px 10px;
  border: 1px solid var(--danger);
  background: var(--danger-weak);
  color: var(--danger);
  border-radius: 8px;
  font-size: 13px;
}
</style>
