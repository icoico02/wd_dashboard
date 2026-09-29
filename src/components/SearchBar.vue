<template>
  <div class="search glass" :class="{ 'search-compact': compact }">
    <Search class="search-icon" :size="compact ? 15 : 18" :stroke-width="2" aria-hidden="true" />
    <input
      ref="input"
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      :aria-label="placeholder"
      autocomplete="off"
      spellcheck="false"
      @input="onInput"
      @keydown.esc.stop="onEsc"
      @focus="$emit('focus')"
      @blur="$emit('blur')"
    />
    <kbd v-if="!compact" class="search-kbd">⌘ K</kbd>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { Search } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, default: '' },
  // Sticky Header 紧凑变体
  compact: { type: Boolean, default: false },
  placeholder: { type: String, default: '搜索项目、工具或标签...' },
})

const emit = defineEmits(['update:modelValue', 'focus', 'blur'])
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
    // 多个搜索框并存（首页 + Sticky 面板）时，聚焦当前视口内可见的那个
    const inputs = [...document.querySelectorAll('.search input')]
    const visible = inputs.find((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.top < window.innerHeight && r.bottom > 0
    })
    const target = visible || input.value
    target?.focus()
    target?.select()
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

/* Sticky Header 紧凑变体 */
.search-compact {
  height: 36px;
  border-radius: 11px;
  padding: 0 10px;
  gap: 8px;
}

.search-compact input {
  font-size: 14px;
}

.search-compact input::placeholder {
  font-size: 13px;
}

.search-compact:focus-within {
  /* 柔和聚焦：1px 半透明蓝边 + 小范围 glow，不用粗 ring */
  border-color: rgba(10, 132, 255, 0.5);
  box-shadow:
    0 0 0 1px rgba(10, 132, 255, 0.28),
    0 0 14px var(--accent-soft);
}

/* Search Focus Mode 下搜索框加高 */
.is-search .search-compact {
  height: 44px;
  border-radius: 13px;
  font-size: 15px;
}

.is-search .search-compact input {
  font-size: 15px;
}
</style>
