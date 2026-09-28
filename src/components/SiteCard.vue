<template>
  <a
    class="site-card glass"
    :class="{ reveal: animate }"
    :href="href"
    target="_blank"
    rel="noopener noreferrer"
    :style="{ '--reveal-delay': delay }"
    :aria-label="`${site.name}（在新标签页打开）`"
    @click="onClick"
    @pointermove="onMove"
  >
    <div class="card-top">
      <span class="icon-tile" :class="site.accent ? `accent-${site.accent}` : null">
        <component :is="iconComp" :size="22" :stroke-width="1.8" aria-hidden="true" />
      </span>
      <ArrowUpRight class="card-arrow" :size="18" :stroke-width="2" aria-hidden="true" />
    </div>

    <h3 class="card-name">{{ site.name }}</h3>
    <p class="card-desc">{{ site.description }}</p>

    <div class="card-meta">
      <span class="status" :class="site.status">
        <span class="dot" aria-hidden="true"></span>{{ statusLabel }}
      </span>
      <span v-if="tagsShown.length" class="card-tags">
        <span v-for="t in tagsShown" :key="t" class="mini-tag">{{ t }}</span>
      </span>
    </div>
  </a>
</template>

<script setup>
import { computed } from 'vue'
import { ArrowUpRight, icons } from 'lucide-vue-next'
import { resolveUrl, useNetworkMode } from '../composables/useNetworkMode'

const props = defineProps({
  site: { type: Object, required: true },
  delay: { type: String, default: '0ms' },
  animate: { type: Boolean, default: false },
})

const { mode } = useNetworkMode()

const href = computed(() => resolveUrl(props.site, mode.value))

const iconComp = computed(
  () => (props.site.icon && icons[props.site.icon]) || icons.AppWindow,
)

const STATUS_LABELS = {
  online: '在线',
  development: '开发中',
  experimental: '实验中',
  offline: '离线',
}

const statusLabel = computed(() => STATUS_LABELS[props.site.status] || '在线')
const tagsShown = computed(() => (props.site.tags || []).slice(0, 2))

const canHover =
  typeof window !== 'undefined' &&
  window.matchMedia('(hover: hover) and (pointer: fine)').matches

function onMove(e) {
  if (!canHover) return
  const el = e.currentTarget
  const r = el.getBoundingClientRect()
  el.style.setProperty('--mx', `${e.clientX - r.left}px`)
  el.style.setProperty('--my', `${e.clientY - r.top}px`)
}

function onClick(e) {
  if (href.value === '#') e.preventDefault()
}
</script>

<style scoped>
.site-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 16px;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition:
    transform 220ms var(--ease-glass),
    background 220ms var(--ease-glass),
    border-color 220ms var(--ease-glass),
    box-shadow 220ms var(--ease-glass);
}

@media (hover: hover) and (pointer: fine) {
  .site-card:hover {
    transform: translateY(-4px) scale(1.01);
    background: var(--glass-bg-hover);
    border-color: var(--glass-border-bright);
    box-shadow:
      var(--glass-shadow-hover),
      inset 0 1px 0 var(--glass-highlight);
  }

  .site-card:hover .icon-tile {
    transform: scale(1.05);
  }

  .site-card:hover .card-arrow {
    transform: translate(2px, -2px);
    color: var(--accent);
    opacity: 1;
  }
}

.site-card:active {
  transform: scale(0.98);
  transition-duration: 100ms;
}

/* 鼠标柔光：极低透明度，仅精确指针设备 */
.site-card::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  transition: opacity 320ms ease;
  background: radial-gradient(
    220px circle at var(--mx, 50%) var(--my, 50%),
    var(--card-glow),
    transparent 65%
  );
}

@media (hover: hover) and (pointer: fine) {
  .site-card:hover::after {
    opacity: 1;
  }
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.card-arrow {
  flex: 0 0 auto;
  color: var(--text-tertiary);
  opacity: 0.55;
  transition:
    transform 220ms var(--ease-glass),
    color 220ms ease,
    opacity 220ms ease;
}

.card-name {
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: var(--text-primary);
}

.card-desc {
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-secondary);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
}

.card-meta {
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 22px;
}

.card-tags {
  display: inline-flex;
  gap: 5px;
  min-width: 0;
  overflow: hidden;
}

.mini-tag {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

html[data-card-size="compact"] .site-card {
  padding: 12px 14px;
  gap: 2px;
}

html[data-card-size="compact"] .card-top {
  margin-bottom: 4px;
}

html[data-card-size="compact"] .card-desc {
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

html[data-card-size="compact"] .card-meta {
  padding-top: 8px;
}
</style>
