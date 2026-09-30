<template>
  <div class="gdp glass-subtle" role="status" aria-live="polite">
    <div class="gdp-title">Debug</div>
    <div class="gdp-grid">
      <div class="gdp-row">
        <span>FPS</span><em>{{ debug.fps }}</em>
      </div>
      <div class="gdp-row">
        <span>Confidence</span><em>{{ fmt(debug.confidence) }}</em>
      </div>
      <div class="gdp-row">
        <span>Palm X</span><em>{{ fmt(debug.palmX) }}</em>
      </div>
      <div class="gdp-row">
        <span>Palm Y</span><em>{{ fmt(debug.palmY) }}</em>
      </div>
      <div class="gdp-row">
        <span>delta X</span><em>{{ fmt(debug.deltaX) }}</em>
      </div>
      <div class="gdp-row">
        <span>delta Y</span><em>{{ fmt(debug.deltaY) }}</em>
      </div>
      <div class="gdp-row">
        <span>vel X</span><em>{{ fmt(debug.velocityX) }}</em>
      </div>
      <div class="gdp-row">
        <span>vel Y</span><em>{{ fmt(debug.velocityY) }}</em>
      </div>
      <div class="gdp-row">
        <span>Gesture</span><em>{{ debug.gesture }}</em>
      </div>
      <div class="gdp-row">
        <span>State</span><em>{{ debug.state }}</em>
      </div>
      <div class="gdp-row">
        <span>Scroll V</span><em>{{ fmt(debug.scrollVelocity) }}</em>
      </div>
      <div class="gdp-row">
        <span>Ptr X</span><em>{{ debug.pointerX ?? '—' }}</em>
      </div>
      <div class="gdp-row">
        <span>Ptr Y</span><em>{{ debug.pointerY ?? '—' }}</em>
      </div>
      <div class="gdp-row">
        <span>Infer ms</span><em>{{ debug.inferenceMs }}</em>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  debug: { type: Object, required: true },
})

function fmt(n) {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
}
</script>

<style scoped>
.gdp {
  border-radius: var(--radius-md);
  padding: 10px 12px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.gdp-title {
  font-weight: 700;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.gdp-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px 10px;
}

.gdp-row {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  color: var(--text-tertiary);
}

.gdp-row em {
  font-style: normal;
  color: var(--text-secondary);
  font-weight: 600;
}
</style>
