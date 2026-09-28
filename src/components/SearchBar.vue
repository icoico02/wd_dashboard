<template>
  <div class="search glass">
    <Search class="search-icon" :size="18" :stroke-width="2" aria-hidden="true" />
    <input
      ref="input"
      :value="modelValue"
      type="text"
      placeholder="搜索项目、工具或标签..."
      aria-label="搜索项目、工具或标签"
      autocomplete="off"
      spellcheck="false"
      @input="onInput"
      @keydown.esc.stop="onEsc"
    />
    <kbd class="search-kbd">⌘ K</kbd>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Search } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])
const input = ref(null)

function onInput(e) {
  emit('update:modelValue', e.target.value)
}

function onEsc() {
  if (props.modelValue) emit('update:modelValue', '')
  else input.value?.blur()
}

function onGlobalKey(e) {
  if ((e.metaKey || e.ctrlKey) && String(e.key).toLowerCase() === 'k') {
    e.preventDefault()
    input.value?.focus()
    input.value?.select()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<style scoped>
.search {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 54px;
  padding: 0 18px;
  border-radius: 20px;
  transition:
    background 240ms var(--ease-glass),
    border-color 240ms var(--ease-glass),
    box-shadow 240ms var(--ease-glass);
}

.search:focus-within {
  background: var(--glass-bg-strong);
  border-color: var(--glass-border-bright);
  box-shadow:
    var(--glass-shadow),
    0 0 0 4px var(--accent-soft),
    inset 0 1px 0 var(--glass-highlight);
}

.search-icon {
  color: var(--text-tertiary);
  flex: 0 0 auto;
}

.search input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  outline: none;
  font: inherit;
  font-size: 16px;
  color: var(--text-primary);
}

.search input::placeholder {
  color: var(--text-tertiary);
}

.search-kbd {
  flex: 0 0 auto;
  font-family: inherit;
  font-size: 12px;
  color: var(--text-tertiary);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  border-radius: 7px;
  padding: 3px 8px;
  transition: opacity 200ms ease;
}

.search:focus-within .search-kbd {
  opacity: 0;
}

@media (max-width: 640px) {
  .search {
    height: 50px;
    border-radius: 18px;
  }

  .search-kbd {
    display: none;
  }
}
</style>
