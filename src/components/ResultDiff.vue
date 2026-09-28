<script setup lang="ts">
import { computed } from 'vue'
import type { CompareResult } from '@/core/practice/compare'
import { toDisplayCase } from '@/core/morse/codec'

const props = withDefaults(
  defineProps<{
    result: CompareResult | null
    displayCase?: 'lower' | 'upper'
  }>(),
  { displayCase: 'lower' },
)

const disp = (s: string): string => toDisplayCase(s, props.displayCase)

const items = computed(() => props.result?.items ?? [])
</script>

<template>
  <div class="diff" data-testid="diff-result">
    <template v-if="!result || items.length === 0">
      <span class="hint">尚无比对结果</span>
    </template>
    <template v-else>
      <span
        v-for="(it, i) in items"
        :key="i"
        :class="['cell', it.kind]"
        :title="it.kind === 'wrong' ? `应为 ${disp(it.expected ?? '')}` : it.kind === 'missed' ? `漏抄 ${disp(it.expected ?? '')}` : ''"
      >
        <template v-if="it.kind === 'match'">{{ disp(it.got ?? '') }}</template>
        <template v-else-if="it.kind === 'wrong'"><s>{{ disp(it.got ?? '') }}</s></template>
        <template v-else-if="it.kind === 'missed'">-</template>
        <template v-else-if="it.kind === 'extra'">[+{{ it.count }}]</template>
      </span>
    </template>
  </div>
</template>

<style scoped>
.diff {
  font-family: var(--font-mono);
  font-size: 18px;
  letter-spacing: 0.1em;
  line-height: 2;
  word-break: break-all;
  min-height: 36px;
}

.cell {
  white-space: pre;
}

.cell.match {
  color: var(--success);
  font-weight: 600;
}

.cell.wrong {
  color: var(--danger);
}

.cell.missed {
  color: var(--muted);
  background: var(--bg);
  border-radius: 3px;
  padding: 0 2px;
}

.cell.extra {
  color: var(--warn);
  font-size: 14px;
}
</style>
