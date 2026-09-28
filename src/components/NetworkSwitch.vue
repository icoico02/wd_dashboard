<template>
  <div class="net-switch glass" role="group" aria-label="网络模式">
    <span class="net-thumb" :class="mode" aria-hidden="true"></span>
    <button
      type="button"
      :class="{ active: mode === 'internal' }"
      :aria-pressed="mode === 'internal'"
      @click="setMode('internal')"
    >
      内网
    </button>
    <button
      type="button"
      :class="{ active: mode === 'external' }"
      :aria-pressed="mode === 'external'"
      @click="setMode('external')"
    >
      外网
    </button>
  </div>
</template>

<script setup>
import { useNetworkMode } from '../composables/useNetworkMode'

const { mode, setMode } = useNetworkMode()
</script>

<style scoped>
.net-switch {
  position: relative;
  display: inline-flex;
  padding: 4px;
  border-radius: 999px;
  isolation: isolate;
}

.net-switch button {
  position: relative;
  z-index: 1;
  appearance: none;
  width: 92px;
  padding: 7px 0;
  border: none;
  background: transparent;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color 200ms ease;
}

.net-switch button.active {
  color: var(--text-primary);
  font-weight: 600;
}

.net-thumb {
  position: absolute;
  z-index: 0;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc(50% - 4px);
  border-radius: 999px;
  background: var(--seg-thumb-bg);
  box-shadow: var(--seg-thumb-shadow);
  transition: transform 260ms var(--ease-glass);
}

.net-thumb.external {
  transform: translateX(100%);
}
</style>
