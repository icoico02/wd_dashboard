<template>
  <div class="tag-row no-scrollbar" role="group" aria-label="标签筛选">
    <button
      type="button"
      class="tag-pill"
      :class="{ selected: modelValue === null }"
      :aria-pressed="modelValue === null"
      @click="$emit('update:modelValue', null)"
    >
      全部
    </button>
    <button
      v-for="t in tags"
      :key="t"
      type="button"
      class="tag-pill"
      :class="{ selected: modelValue === t }"
      :aria-pressed="modelValue === t"
      @click="$emit('update:modelValue', t)"
    >
      {{ t }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  tags: { type: Array, default: () => [] },
  modelValue: { type: String, default: null },
})

defineEmits(['update:modelValue'])
</script>

<style scoped>
.tag-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  width: 100%;
  padding: 2px;
  margin-bottom: 14px;
}

.tag-pill {
  flex: 0 0 auto;
  padding: 7px 15px;
  border-radius: 999px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(var(--glass-blur-subtle)) saturate(140%);
  backdrop-filter: blur(var(--glass-blur-subtle)) saturate(140%);
  cursor: pointer;
  transition:
    background 200ms var(--ease-glass),
    color 200ms ease,
    border-color 200ms ease,
    box-shadow 200ms var(--ease-glass),
    transform 120ms var(--ease-glass);
}

.tag-pill:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.tag-pill:active {
  transform: scale(0.95);
}

.tag-pill.selected {
  background: var(--pill-selected-bg);
  color: var(--text-primary);
  font-weight: 600;
  border-color: var(--glass-border-bright);
  box-shadow: var(--pill-selected-shadow);
}
</style>
