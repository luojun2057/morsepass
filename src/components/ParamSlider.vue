<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min: number
    max: number
    step?: number
    unit?: string
    /** 显示倍率：滑块值 = modelValue * scale（如音量 0-1 ↔ 滑块 0-100），默认 1 */
    scale?: number
  }>(),
  { step: 1, unit: '', scale: 1 },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onInput(e: Event): void {
  const raw = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', props.scale === 1 ? raw : raw / props.scale)
}
</script>

<template>
  <div class="param-row" :data-testid="`param-${props.label}`">
    <label>{{ props.label }}</label>
    <input
      type="range"
      :min="props.min"
      :max="props.max"
      :step="props.step"
      :value="props.modelValue * props.scale"
      @input="onInput"
    />
    <span class="value">{{
      props.scale === 1 ? props.modelValue : Math.round(props.modelValue * props.scale)
    }}{{ props.unit }}</span>
  </div>
</template>
