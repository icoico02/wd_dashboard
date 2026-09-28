<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible" class="app-toast glass" role="status">
        <span class="toast-text">{{ message }}</span>
        <button v-if="actionLabel" type="button" class="toast-action" @click="runAction">
          {{ actionLabel }}
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { useToast } from '../composables/useToast'

const { visible, message, actionLabel, runAction } = useToast()
</script>

<style scoped>
.app-toast {
  position: fixed;
  left: 50%;
  bottom: calc(28px + env(safe-area-inset-bottom));
  transform: translateX(-50%);
  z-index: 80;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(90vw, 480px);
  padding: 11px 18px;
  border-radius: 999px;
  background: var(--glass-bg-strong);
}

.toast-text {
  font-size: 13.5px;
  color: var(--text-primary);
}

.toast-action {
  border: none;
  background: none;
  padding: 0;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 240ms var(--ease-glass),
    transform 240ms var(--ease-glass);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(12px) scale(0.96);
}
</style>
