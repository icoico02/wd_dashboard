<template>
  <div class="home">
    <div ref="topRef" class="home-top">
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
    </div>

    <main class="groups">
      <template v-if="filteredGroups.length">
        <SiteGroup
          v-for="(g, i) in filteredGroups"
          :key="g.id"
          :ref="(el) => registerSection(g.id, el)"
          :group="g"
          :index="i"
          :animate="!ready"
          :active-tag="sectionTags[g.id] ?? null"
          @update:active-tag="setSectionTag(g.id, $event)"
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
      <span class="footer-eyebrow">Wstudio</span>
      <span class="footer-title">Wstudio Dashboard</span>
      <span class="footer-meta">Self-hosted · Cloudflare · {{ year }}</span>
    </footer>
  </div>

  <!-- 供 JS 读取 env(safe-area-inset-top) 的探针 -->
  <div ref="probeRef" class="safe-probe" aria-hidden="true"></div>

  <!-- 统一 Section Sticky Header：内容随 activeSection 数据驱动切换 -->
  <Transition name="sticky-head">
    <div v-if="stickyVisible" class="sticky-layer">
      <div class="sticky-panel">
        <div class="sticky-clip">
          <Transition :name="pushName">
            <div v-if="activeSection" :key="activeSection.id" class="sticky-content">
              <div class="sticky-row1">
                <h2 class="sticky-title">{{ activeSection.title }}</h2>
                <span class="sticky-count" :aria-label="`${stickyCount} 个项目`">
                  {{ stickyCount }}
                </span>
              </div>
              <div class="sticky-row2">
                <TagFilter
                  :tags="collectTags(activeSection.items)"
                  :model-value="sectionTags[activeSection.id] ?? null"
                  @update:model-value="setSectionTag(activeSection.id, $event)"
                />
              </div>
            </div>
          </Transition>
        </div>
        <div class="sticky-actions">
          <ThemePopover compact />
          <button type="button" class="sticky-btn" aria-label="设置" @click="settingsOpen = true">
            <Settings :size="15" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <SettingsPanel :open="settingsOpen" @close="settingsOpen = false" />
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { SearchX, Settings } from 'lucide-vue-next'
import DashboardHeader from '../components/DashboardHeader.vue'
import NetworkSwitch from '../components/NetworkSwitch.vue'
import SearchBar from '../components/SearchBar.vue'
import SettingsPanel from '../components/SettingsPanel.vue'
import SiteGroup from '../components/SiteGroup.vue'
import TagFilter from '../components/TagFilter.vue'
import ThemePopover from '../components/ThemePopover.vue'
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

function collectTags(items) {
  const seen = new Set()
  const out = []
  for (const it of items) {
    for (const t of it.tags || []) {
      if (!seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
    }
  }
  return out
}

function clearFilters() {
  query.value = ''
}

const year = new Date().getFullYear()

/* ------------------------------------ Sticky Header 系统 ------------------------------------
   - activeSection：最后一个把模块头部滚过顶部线的模块（数据驱动，新增模块自动支持）
   - 面板内容用 <Transition> 做「新模块从下方推入、旧模块向上推走」
   - 滞回：面板显示后只在滚回 Dashboard 区时隐藏，模块间隙 / 过滤导致的高度变化不会闪烁
---------------------------------------------------------------------------------------------- */
const topRef = ref(null)
const probeRef = ref(null)
const sectionEls = new Map()

function registerSection(id, el) {
  // ref 挂在组件上时拿到的是组件实例，取其根 DOM 元素
  const node = el && (el.$el || el)
  if (node) sectionEls.set(id, node)
  else sectionEls.delete(id)
}

const sectionTags = reactive({})

function setSectionTag(id, tag) {
  sectionTags[id] = tag
}

const activeId = ref(null)
const stickyVisible = ref(false)
const pushName = ref('sh-down')

const activeSection = computed(
  () => filteredGroups.value.find((g) => g.id === activeId.value) || null,
)

/* Sticky 面板的数量跟随该模块当前分类过滤 */
const stickyCount = computed(() => {
  if (!activeSection.value) return 0
  const tag = sectionTags[activeSection.value.id] ?? null
  const items = tag
    ? activeSection.value.items.filter((it) => (it.tags || []).includes(tag))
    : activeSection.value.items
  return items.length
})

let ticking = false
let lastCollapse = -1
let lastRun = 0
let safeTop = 0

function measureSafe() {
  safeTop = probeRef.value ? probeRef.value.offsetHeight : 0
}

function update() {
  ticking = false
  const scrollY = window.scrollY

  // Dashboard 头部折叠进度（只写 CSS 变量，纯 opacity/transform，无布局抖动）
  const collapse = Math.min(1, Math.max(0, scrollY / 150))
  if (Math.abs(collapse - lastCollapse) > 0.004) {
    lastCollapse = collapse
    topRef.value?.style.setProperty('--collapse', collapse.toFixed(3))
  }

  // 当前模块：最后一个头部越过「顶部线」的模块
  const line = 8 + safeTop + 60
  let currentId = null
  let firstTopAbs = null

  for (const [id, el] of sectionEls) {
    const top = el.getBoundingClientRect().top
    if (firstTopAbs === null) firstTopAbs = top + scrollY
    if (top <= line) currentId = id
    else break
  }

  if (currentId !== null) {
    if (activeId.value !== currentId) {
      const oldIdx = filteredGroups.value.findIndex((g) => g.id === activeId.value)
      const newIdx = filteredGroups.value.findIndex((g) => g.id === currentId)
      pushName.value = newIdx >= oldIdx ? 'sh-down' : 'sh-up'
      activeId.value = currentId
    }
    stickyVisible.value = true
  } else if (
    stickyVisible.value &&
    (firstTopAbs === null ||
      !sectionEls.has(activeId.value) ||
      scrollY + line < firstTopAbs)
  ) {
    // 滚回 Dashboard 区，或当前模块已被过滤掉 → 收起面板，Dashboard 重新展开
    stickyVisible.value = false
    activeId.value = null
  }
}

/* 滚动高频节流：直接执行（时间戳限频）+ rAF 收尾；rAF 不可用时依然工作 */
function requestUpdate() {
  const now = performance.now()
  if (now - lastRun >= 24) {
    lastRun = now
    update()
  } else if (!ticking) {
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      update()
    })
  }
}

function onResize() {
  measureSafe()
  requestUpdate()
}

/* 入场动画只播放一次；动画结束后移除 reveal，避免搜索过滤时卡片重复闪动 */
const ready = ref(false)

onMounted(() => {
  measureSafe()
  update()
  window.addEventListener('scroll', requestUpdate, { passive: true })
  window.addEventListener('resize', onResize)
  setTimeout(() => {
    ready.value = true
  }, 1500)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', requestUpdate)
  window.removeEventListener('resize', onResize)
})

watch(filteredGroups, () => {
  nextTick(() => {
    measureSafe()
    requestUpdate()
  })
})
</script>

<style scoped>
.home-top {
  --collapse: 0;
}

/* Dashboard 头部折叠：滚动时通过 --collapse 连续渐隐 / 缩小，回顶自动恢复 */
.home-top :deep(.brand-eyebrow),
.home-top :deep(.brand-sub) {
  opacity: calc(1 - var(--collapse) * 2.4);
}

.home-top :deep(.brand-title) {
  transform-origin: left center;
  transform: scale(calc(1 - var(--collapse) * 0.12)) translateY(calc(var(--collapse) * -6px));
  opacity: calc(1 - var(--collapse) * 1.5);
}

.home-top :deep(.dash-header) {
  padding-top: calc((30px + env(safe-area-inset-top)) * (1 - var(--collapse) * 0.85));
}

.home-top :deep(.header-actions) {
  opacity: calc(1 - var(--collapse) * 1.9);
}

.home-top .search-block {
  opacity: calc(1 - var(--collapse) * 1.15);
  transform: translateY(calc(var(--collapse) * -8px));
}

.home-top .controls-row {
  opacity: calc(1 - var(--collapse) * 0.95);
  transform: translateY(calc(var(--collapse) * -8px));
}

.search-block {
  margin-top: 26px;
}

.controls-row {
  margin-top: 18px;
}

/* safe-area 探针：height = env(safe-area-inset-top)，供 JS 读取像素值 */
.safe-probe {
  position: fixed;
  top: -100px;
  left: 0;
  width: 1px;
  height: env(safe-area-inset-top);
  pointer-events: none;
}

/* ---------------------------------- Sticky 面板 ---------------------------------- */
.sticky-layer {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  padding: calc(8px + env(safe-area-inset-top)) 16px 0;
  pointer-events: none;
}

.sticky-panel {
  pointer-events: auto;
  position: relative;
  width: min(100%, calc(var(--page-max) - 2 * var(--page-pad)));
  height: 92px;
  border-radius: 22px;
  background: var(--glass-bg-strong);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
  backdrop-filter: blur(20px) saturate(160%);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow), inset 0 1px 0 var(--glass-highlight);
}

.sticky-clip {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
}

.sticky-content {
  position: absolute;
  inset: 0;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sticky-row1 {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  padding-right: 76px;
  min-width: 0;
}

.sticky-title {
  font-size: 16.5px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sticky-count {
  flex: 0 0 auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
}

.sticky-row2 {
  min-width: 0;
}

/* Sticky 内胶囊去掉各自 blur（面板本身已有玻璃层，避免多层 backdrop-filter） */
.sticky-content :deep(.tag-row) {
  margin-bottom: 0;
  padding: 0 2px;
}

.sticky-content :deep(.tag-pill) {
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  padding: 6px 13px;
  font-size: 13px;
}

.sticky-actions {
  position: absolute;
  top: 9px;
  right: 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 3;
}

.sticky-btn {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 120ms var(--ease-glass);
}

.sticky-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.sticky-btn:active {
  transform: scale(0.92);
}

/* 面板整体滑入 / 滑出 */
.sticky-head-enter-active,
.sticky-head-leave-active {
  transition:
    transform 320ms var(--ease-glass),
    opacity 260ms ease;
}

.sticky-head-enter-from,
.sticky-head-leave-to {
  transform: translateY(-130%);
  opacity: 0;
}

/* 模块切换：新 Header 把旧 Header 推走（方向感知） */
.sh-down-enter-active,
.sh-down-leave-active,
.sh-up-enter-active,
.sh-up-leave-active {
  transition:
    transform 320ms var(--ease-glass),
    opacity 300ms ease;
}

.sh-down-enter-from {
  transform: translateY(105%);
}

.sh-down-leave-to {
  transform: translateY(-105%);
}

.sh-up-enter-from {
  transform: translateY(-105%);
}

.sh-up-leave-to {
  transform: translateY(105%);
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

  .sticky-layer {
    padding-left: 14px;
    padding-right: 14px;
  }

  .sticky-content {
    padding: 9px 12px;
  }
}
</style>
