<template>
  <Teleport to="body">
    <Transition name="gd-fade">
      <div v-if="open" class="gd-overlay" @click="emit('close')"></div>
    </Transition>
    <Transition name="gd">
      <div
        v-if="open"
        class="gd-panel glass"
        :style="{ maxWidth: width }"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <h2 class="gd-title">{{ title }}</h2>
        <div class="gd-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="gd-footer">
          <slot name="footer" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  width: { type: String, default: '420px' },
})

const emit = defineEmits(['close'])

function onKey(e) {
  if (e.key === 'Escape' && props.open) emit('close')
}

watch(
  () => props.open,
  (v) => document.body.classList.toggle('no-scroll', v),
)

window.addEventListener('keydown', onKey)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.classList.remove('no-scroll')
})
</script>

<style scoped>
.gd-overlay {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(8, 10, 16, 0.32);
  -webkit-backdrop-filter: blur(3px);
  backdrop-filter: blur(3px);
}

.gd-panel {
  position: fixed;
  z-index: 71;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: calc(100vw - 40px);
  border-radius: var(--radius-xl);
  padding: 20px;
  background: var(--glass-bg-strong);
}

.gd-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 14px;
}

.gd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.gd-enter-active,
.gd-leave-active {
  transition:
    opacity 240ms var(--ease-glass),
    transform 240ms var(--ease-glass);
}

.gd-enter-from,
.gd-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.96) translateY(8px);
}

.gd-fade-enter-active,
.gd-fade-leave-active {
  transition: opacity 200ms ease;
}

.gd-fade-enter-from,
.gd-fade-leave-to {
  opacity: 0;
}

@media (max-width: 767px) {
  .gd-panel {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    transform: none;
    width: 100%;
    max-width: none;
    border-radius: 26px 26px 0 0;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
  }

  .gd-enter-from,
  .gd-leave-to {
    transform: translateY(100%);
  }
}
</style>
