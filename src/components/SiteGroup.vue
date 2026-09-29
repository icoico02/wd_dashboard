<template>
  <section
    class="site-group"
    :class="{ reveal: animate }"
    :style="{ '--reveal-delay': groupDelay }"
    :aria-label="group.title"
  >
    <div class="group-head">
      <h2 class="group-title">{{ group.title }}</h2>
      <span class="group-count" :aria-label="`${visibleItems.length} 个项目`">
        {{ visibleItems.length }}
      </span>
    </div>

    <TagFilter
      v-if="!hideTags && tags.length > 1"
      :model-value="activeTag"
      :tags="tags"
      @update:model-value="$emit('update:activeTag', $event)"
    />

    <div class="group-grid">
      <SiteCard
        v-for="(item, i) in visibleItems"
        :key="item.id"
        :site="item"
        :delay="cardDelay(i)"
        :animate="animate"
      />
    </div>
  </section>
</template>

<script setup>
import { computed, watch } from 'vue'
import SiteCard from './SiteCard.vue'
import TagFilter from './TagFilter.vue'

const props = defineProps({
  group: { type: Object, required: true },
  index: { type: Number, default: 0 },
  animate: { type: Boolean, default: false },
  // 分类状态由 HomeView 统一持有（页面内头部与 Sticky 头部共享，按模块独立记忆）
  activeTag: { type: String, default: null },
  // 搜索过程中隐藏分类栏（结果直接跨模块展示）
  hideTags: { type: Boolean, default: false },
})

const emit = defineEmits(['update:activeTag'])

const tags = computed(() => {
  const seen = new Set()
  const out = []
  for (const it of props.group.items) {
    for (const t of it.tags || []) {
      if (!seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
    }
  }
  return out
})

watch([tags, () => props.activeTag], ([list, tag]) => {
  if (tag && !list.includes(tag)) emit('update:activeTag', null)
})

const visibleItems = computed(() =>
  props.activeTag
    ? props.group.items.filter((it) => (it.tags || []).includes(props.activeTag))
    : props.group.items,
)

const groupDelay = `${200 + props.index * 70}ms`
const cardDelay = (i) => `${200 + props.index * 70 + Math.min(i * 45, 320)}ms`
</script>

<style scoped>
.site-group {
  margin-top: 34px;
}

.group-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.group-title {
  font-size: 21px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.group-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}

.group-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

@media (min-width: 500px) {
  .group-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  }
}

@media (min-width: 768px) {
  .group-grid {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
}

@media (min-width: 1200px) {
  .group-grid {
    grid-template-columns: repeat(auto-fill, minmax(255px, 1fr));
  }
}

@media (max-width: 640px) {
  .site-group {
    margin-top: 28px;
  }

  .group-title {
    font-size: 19px;
  }
}
</style>
