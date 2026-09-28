<script setup lang="ts">
import { ref } from 'vue'
import { generateMaterial, mulberry32, QSO_TEMPLATES, type MaterialKind } from '@/core/practice/material'
import { useSettings } from '@/composables/useSettings'

const props = withDefaults(
  defineProps<{
    /** Koch 模式下锁定为字符组并使用外部字符集 */
    lockedCharSet?: string[] | null
    initialText?: string
  }>(),
  { lockedCharSet: null, initialText: '' },
)

const materialText = defineModel<string>({ default: '' })
/** 当前素材类型（父组件可读取以决定验证方式） */
const kind = defineModel<MaterialKind>('kind', { default: 'text' })

const kinds: { key: MaterialKind; label: string }[] = [
  { key: 'text', label: '自由文本' },
  { key: 'chars', label: '字符组' },
  { key: 'digits', label: '数字组' },
  { key: 'article', label: '英文文章' },
  { key: 'words', label: '单词' },
  { key: 'callsigns', label: '呼号' },
  { key: 'abbreviations', label: 'Q码缩写' },
  { key: 'qso', label: 'QSO 模板' },
]

const count = ref(5)
const groupLen = ref(4)
const customChars = ref('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789')
const qsoId = ref('cq')
const callsignSelf = ref('')
const callsignPeer = ref('')
const settings = useSettings()

function isLocked(): boolean {
  return props.lockedCharSet !== null
}

function generate(): void {
  const set = isLocked() ? (props.lockedCharSet as string[]) : [...customChars.value.toUpperCase()]
  const text = generateMaterial(mulberry32((Math.random() * 2 ** 31) | 0), {
    kind: kind.value,
    count: count.value,
    text: materialText.value,
    charSet: set.length > 0 ? set : undefined,
    groupLen: groupLen.value,
    qsoId: qsoId.value,
    callsign: callsignSelf.value,
    peer: callsignPeer.value,
  })
  if (text) materialText.value = text
}

function onTab(k: MaterialKind): void {
  if (isLocked() && k !== 'chars') return
  if (k === 'digits') {
    kind.value = 'digits'
    customChars.value = '0123456789'
    if (count.value < 5) count.value = 5
    return
  }
  kind.value = k
  if (k === 'text' && !materialText.value) materialText.value = props.initialText
}
</script>

<template>
  <div class="card">
    <p class="card-title">练习素材</p>
    <div class="row" style="margin-bottom: 10px">
      <div class="tabs">
        <button
          v-for="k in kinds"
          :key="k.key"
          :class="{ on: kind === k.key }"
          :disabled="isLocked() && k.key !== 'chars'"
          :data-testid="`material-tab-${k.key}`"
          @click="onTab(k.key)"
        >
          {{ k.label }}
        </button>
      </div>
      <template v-if="!isLocked() && kind !== 'text' && kind !== 'qso'">
        <label class="inline">
          {{ kind === 'article' ? '词数' : kind === 'chars' || kind === 'digits' ? '组数' : '数量' }}
          <input v-model.number="count" type="number" min="1" max="300" style="width: 64px" />
        </label>
      </template>
      <template v-if="!isLocked() && (kind === 'chars' || kind === 'digits')">
        <label class="inline">
          每组
          <input v-model.number="groupLen" type="number" min="2" max="8" style="width: 52px" />
        </label>
      </template>
      <button v-if="!isLocked() && kind !== 'text'" class="btn" data-testid="material-generate" @click="generate">
        {{ kind === 'qso' ? '生成模板' : kind === 'article' ? '生成文章' : '生成素材' }}
      </button>
    </div>
    <div v-if="!isLocked() && (kind === 'chars' || kind === 'digits')" class="row" style="margin-bottom: 10px">
      <label class="inline">字符集 <input v-model="customChars" type="text" class="mono" style="flex: 1" /></label>
    </div>
    <div v-if="!isLocked() && kind === 'qso'" class="row" style="margin-bottom: 10px; flex-wrap: wrap">
      <label class="inline">
        模板
        <select v-model="qsoId" data-testid="qso-template">
          <option v-for="t in QSO_TEMPLATES" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
      </label>
      <label class="inline">本台呼号 <input v-model="callsignSelf" type="text" class="mono" placeholder="如 BA1XXX" style="width: 110px" /></label>
      <label class="inline">对方呼号 <input v-model="callsignPeer" type="text" class="mono" placeholder="如 BA9ZZZ" style="width: 110px" /></label>
    </div>
    <textarea
      v-model="materialText"
      rows="3"
      placeholder="输入或粘贴练习文本（大写字母/数字/空格），或点上方生成"
      data-testid="material-input"
    />
    <p class="hint" style="margin: 6px 0 0">
      支持字母、数字与常用标点；空格为单词间隔。当前显示偏好：{{ settings.displayCase === 'lower' ? '小写' : '大写' }}
      <template v-if="kind === 'article'">；文章素材用<b>大片匹配</b>方式验证，容忍中间的错漏</template>
    </p>
  </div>
</template>

<style scoped>
.inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-2);
}
</style>
