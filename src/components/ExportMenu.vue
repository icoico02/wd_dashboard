<template>
  <div ref="wrap" class="em-wrap">
    <button
      type="button"
      class="em-trigger"
      :disabled="disabled"
      aria-label="导出记录"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <Download :size="14" aria-hidden="true" />
      <span>导出</span>
      <ChevronDown :size="13" aria-hidden="true" />
    </button>

    <Transition name="em">
      <div v-if="open" class="em-menu glass" role="menu" aria-label="导出记录">
        <button
          v-for="o in options"
          :key="o.kind"
          type="button"
          class="em-item"
          role="menuitem"
          @click="pick(o.kind)"
        >
          <component :is="o.icon" :size="15" aria-hidden="true" />
          <span>{{ o.label }}</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, Download, FileDown, FileSpreadsheet, FileText } from 'lucide-vue-next'

defineProps({
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['export'])

const open = ref(false)
const wrap = ref(null)

const options = [
  { kind: 'csv', label: '导出 CSV', icon: FileText },
  { kind: 'excel', label: '导出 Excel', icon: FileSpreadsheet },
  { kind: 'pdf', label: '导出 PDF', icon: FileDown },
]

function pick(kind) {
  open.value = false
  emit('export', kind)
}

function onDocPointer(e) {
  if (open.value && wrap.value && !wrap.value.contains(e.target)) open.value = false
}

function onKey(e) {
  if (e.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true)
  document.addEventListener('keydown', onKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.em-wrap {
  position: relative;
  z-index: 60;
}

.em-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur-subtle)) saturate(140%);
  backdrop-filter: blur(var(--glass-blur-subtle)) saturate(140%);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 120ms var(--ease-glass),
    opacity 160ms ease;
}

.em-trigger:hover:not(:disabled) {
  background: var(--glass-bg-hover);
  color: var(--accent);
}

.em-trigger:active:not(:disabled) {
  transform: scale(0.95);
}

.em-trigger:disabled {
  opacity: 0.4;
  cursor: default;
}

.em-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 158px;
  padding: 5px;
  border-radius: 15px;
  background: var(--glass-bg-strong);
  z-index: 70;
}

.em-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 9px 10px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13.5px;
  cursor: pointer;
  text-align: left;
  transition: background 160ms ease;
}

.em-item:hover {
  background: var(--glass-bg-hover);
}

.em-item:active {
  transform: scale(0.98);
}

.em-enter-active,
.em-leave-active {
  transition:
    opacity 180ms var(--ease-glass),
    transform 180ms var(--ease-glass);
}

.em-enter-from,
.em-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}
</style>
