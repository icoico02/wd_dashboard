<template>
  <div class="home">
    <DashboardHeader
      :class="{ reveal: !ready }"
      @open-settings="settingsOpen = true"
    />

    <SearchBar
      v-model="query"
      class="search-block"
      :class="{ reveal: !ready }"
      style="--reveal-delay: 70ms"
    />

    <div class="controls-row" :class="{ reveal: !ready }" style="--reveal-delay: 130ms">
      <NetworkSwitch />
    </div>

    <main class="groups">
      <template v-if="filteredGroups.length">
        <SiteGroup
          v-for="(g, i) in filteredGroups"
          :key="g.id"
          :group="g"
          :index="i"
          :animate="!ready"
        />
      </template>

      <div v-else class="empty glass" :class="{ reveal: !ready }" style="--reveal-delay: 200ms">
        <span class="empty-icon" aria-hidden="true">
          <SearchX :size="26" :stroke-width="1.6" />
        </span>
        <h3 class="empty-title">没有找到项目</h3>
        <p class="empty-sub">试试其他名称、标签或分类。</p>
        <button type="button" class="empty-btn" @click="clearFilters">清除搜索</button>
      </div>
    </main>

    <footer class="site-footer" :class="{ reveal: !ready }" style="--reveal-delay: 260ms">
      <span class="footer-eyebrow">Dada</span>
      <span class="footer-title">Dada Dashboard</span>
      <span class="footer-meta">Self-hosted · Cloudflare · {{ year }}</span>
    </footer>
  </div>

  <SettingsPanel :open="settingsOpen" @close="settingsOpen = false" />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { SearchX } from 'lucide-vue-next'
import DashboardHeader from '../components/DashboardHeader.vue'
import SearchBar from '../components/SearchBar.vue'
import NetworkSwitch from '../components/NetworkSwitch.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import SiteGroup from '../components/SiteGroup.vue'
import { groups as allGroups } from '../data/sites'

const query = ref('')
const settingsOpen = ref(false)

const filteredGroups = computed(() => {
  const q = query.value.trim().toLowerCase()
  return allGroups
    .filter((g) => g.enabled !== false)
    .map((g) => {
      let items = (g.items || []).filter((it) => it.enabled !== false)
      if (q) {
        items = items.filter((it) => {
          const hay = [it.name, it.description, ...(it.tags || []), g.title]
          return hay.some((f) => String(f || '').toLowerCase().includes(q))
        })
      }
      return { ...g, items }
    })
    .filter((g) => g.items.length > 0)
})

function clearFilters() {
  query.value = ''
}

const year = new Date().getFullYear()

/* 入场动画只播放一次；动画结束后移除 reveal，避免搜索过滤时卡片重复闪动 */
const ready = ref(false)

onMounted(() => {
  setTimeout(() => {
    ready.value = true
  }, 1500)
})
</script>

<style scoped>
.search-block {
  margin-top: 26px;
}

.controls-row {
  margin-top: 18px;
}

.empty {
  margin-top: 40px;
  padding: 48px 24px;
  border-radius: var(--radius-xl);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}

.empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  margin-bottom: 8px;
}

.empty-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.empty-sub {
  font-size: 13.5px;
  color: var(--text-secondary);
}

.empty-btn {
  margin-top: 14px;
  padding: 9px 20px;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  box-shadow: 0 6px 18px rgba(10, 132, 255, 0.35);
  transition:
    transform 120ms var(--ease-glass),
    filter 160ms ease;
}

.empty-btn:hover {
  filter: brightness(1.06);
}

.empty-btn:active {
  transform: scale(0.96);
}

.site-footer {
  margin-top: 84px;
  padding: 30px 0 calc(34px + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  text-align: center;
}

.footer-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.footer-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.footer-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 640px) {
  .search-block {
    margin-top: 20px;
  }

  .site-footer {
    margin-top: 56px;
  }
}
</style>
