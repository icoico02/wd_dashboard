<template>
  <header class="dash-header">
    <div class="brand">
      <span class="brand-eyebrow">Dada</span>
      <h1 class="brand-title">Dashboard</h1>
      <p class="brand-sub">我的项目与常用工具</p>
    </div>
    <div class="header-actions">
      <ThemePopover />
      <button type="button" class="icon-btn" aria-label="设置" @click="$emit('open-settings')">
        <Settings :size="19" :stroke-width="1.8" aria-hidden="true" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { Settings } from 'lucide-vue-next'
import ThemePopover from './ThemePopover.vue'

defineEmits(['open-settings'])
</script>

<style scoped>
.dash-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-top: calc(30px + env(safe-area-inset-top));
}

.brand-eyebrow {
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.brand-title {
  margin-top: 4px;
  font-size: clamp(30px, 4.2vw, 38px);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: var(--text-primary);
}

.brand-sub {
  margin-top: 6px;
  font-size: 15px;
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  gap: 10px;
  padding-top: 4px;
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .dash-header {
    padding-top: calc(20px + env(safe-area-inset-top));
  }

  .brand-sub {
    font-size: 14px;
  }
}
</style>
