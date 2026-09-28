<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min: number
    max: number
    step?: number
    unit?: string
  }>(),
  { step: 1, unit: '' },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

function onInput(e: Event): void {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
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
      :value="props.modelValue"
      @input="onInput"
    />
    <span class="value">{{ props.modelValue }}{{ props.unit }}</span>
  </div>
</template>
