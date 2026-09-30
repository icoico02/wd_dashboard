<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="gvc"
      :class="{ 'gvc-press': pressing }"
      :style="{ transform: `translate3d(${x}px, ${y}px, 0)` }"
      aria-hidden="true"
    >
      <div class="gvc-ring"></div>
      <div class="gvc-dot"></div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  visible: { type: Boolean, default: false },
  pressing: { type: Boolean, default: false },
})
</script>

<style scoped>
.gvc {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 2000;
  width: 0;
  height: 0;
  pointer-events: none;
  will-change: transform;
}

.gvc-dot {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px 0 0 -6px;
  border-radius: 50%;
  background: rgba(10, 132, 255, 0.92);
  box-shadow:
    0 0 0 2px rgba(255, 255, 255, 0.85),
    0 2px 10px rgba(10, 132, 255, 0.45);
  transition: transform 80ms var(--ease-glass);
}

.gvc-ring {
  position: absolute;
  width: 36px;
  height: 36px;
  margin: -18px 0 0 -18px;
  border-radius: 50%;
  border: 1.5px solid rgba(10, 132, 255, 0.35);
  transition: transform 140ms var(--ease-glass), border-color 140ms ease;
}

.gvc-press .gvc-dot {
  transform: scale(0.7);
  background: rgba(255, 55, 95, 0.95);
}

.gvc-press .gvc-ring {
  transform: scale(0.72);
  border-color: rgba(255, 55, 95, 0.55);
}
</style>
