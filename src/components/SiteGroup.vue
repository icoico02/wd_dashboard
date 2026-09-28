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

    <TagFilter v-if="tags.length > 1" v-model="selectedTag" :tags="tags" />

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
import { computed, ref, watch } from 'vue'
import SiteCard from './SiteCard.vue'
import TagFilter from './TagFilter.vue'

const props = defineProps({
  group: { type: Object, required: true },
  index: { type: Number, default: 0 },
  animate: { type: Boolean, default: false },
})

const selectedTag = ref(null)

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

watch(tags, (list) => {
  if (selectedTag.value && !list.includes(selectedTag.value)) selectedTag.value = null
})

const visibleItems = computed(() =>
  selectedTag.value
    ? props.group.items.filter((it) => (it.tags || []).includes(selectedTag.value))
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
