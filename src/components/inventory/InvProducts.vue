<template>
  <div>
    <div class="inv-toolbar">
      <div class="inv-search">
        <Search :size="15" aria-hidden="true" />
        <input v-model="keyword" type="text" placeholder="搜索商品名称 / SKU / 分类" />
      </div>
      <button type="button" class="inv-add" @click="$emit('add')">
        <Plus :size="15" aria-hidden="true" />新增商品
      </button>
    </div>

    <div class="inv-cats no-scrollbar">
      <button
        v-for="c in cats"
        :key="c"
        type="button"
        class="inv-cat"
        :class="{ active: current === c }"
        @click="current = c"
      >
        {{ c }}
      </button>
    </div>

    <div v-if="filtered.length" class="inv-grid">
      <article v-for="p in filtered" :key="p.id" class="inv-card glass">
        <div class="inv-card-head">
          <span class="inv-sku">{{ p.sku }}</span>
          <span class="inv-stock" :class="stockClass(p)" :title="`库存 ${p.stock}`">
            库存 {{ p.stock }}
          </span>
        </div>
        <h3 class="inv-name">{{ p.name }}</h3>
        <p class="inv-meta">
          {{ p.category }}<template v-if="p.specification"> · {{ p.specification }}</template>
        </p>
        <div class="inv-prices">
          <span class="inv-sale">售价 <strong>{{ fmtMoney(p.salePrice) }}</strong></span>
          <span class="inv-cost">成本 {{ fmtMoney(p.costPrice) }}</span>
        </div>
        <div class="inv-actions">
          <button type="button" class="inv-act" @click="$emit('receive', p)">
            <ArrowDownToLine :size="14" aria-hidden="true" />入库
          </button>
          <button
            type="button"
            class="inv-act"
            :disabled="p.stock <= 0"
            @click="$emit('outbound', p)"
          >
            <ArrowUpFromLine :size="14" aria-hidden="true" />出库
          </button>
          <button type="button" class="inv-act icon" aria-label="编辑商品" @click="$emit('edit', p)">
            <Pencil :size="14" aria-hidden="true" />
          </button>
          <button
            type="button"
            class="inv-act icon danger"
            aria-label="删除商品"
            @click="$emit('delete', p)"
          >
            <Trash2 :size="14" aria-hidden="true" />
          </button>
        </div>
      </article>
    </div>
    <div v-else class="inv-empty glass-subtle">
      <p>{{ keyword || current !== '全部' ? '没有匹配的商品' : '还没有商品，点击「新增商品」开始建库' }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-vue-next'
import { fmtMoney } from '../../composables/useInventory'

const props = defineProps({
  products: { type: Array, required: true },
})

defineEmits(['add', 'edit', 'receive', 'outbound', 'delete'])

const keyword = ref('')
const current = ref('全部')

const cats = computed(() => {
  const set = new Set(['全部'])
  for (const p of props.products) set.add(p.category || '未分类')
  return [...set]
})

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return props.products.filter((p) => {
    if (current.value !== '全部' && (p.category || '未分类') !== current.value) return false
    if (!kw) return true
    return [p.name, p.sku, p.category, p.specification]
      .some((f) => String(f || '').toLowerCase().includes(kw))
  })
})

function stockClass(p) {
  if (p.stock <= 0) return 'out'
  if (p.lowStockThreshold > 0 && p.stock <= p.lowStockThreshold) return 'low'
  return 'ok'
}
</script>

<style scoped>
.inv-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.inv-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  border-radius: 11px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-tertiary);
}

.inv-search input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font: inherit;
  font-size: 13.5px;
  color: var(--text-primary);
}

.inv-add {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 15px;
  flex: 0 0 auto;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass);
}

.inv-add:hover {
  filter: brightness(1.06);
}

.inv-add:active {
  transform: scale(0.96);
}

.inv-cats {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px;
  margin-bottom: 14px;
}

.inv-cat {
  flex: 0 0 auto;
  padding: 6px 14px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}

.inv-cat.active {
  background: var(--pill-selected-bg);
  color: var(--text-primary);
  font-weight: 600;
  border-color: var(--glass-border-bright);
  box-shadow: var(--pill-selected-shadow);
}

.inv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
}

.inv-card {
  border-radius: var(--radius-lg);
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.inv-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.inv-sku {
  font-size: 11px;
  color: var(--text-tertiary);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}

.inv-stock {
  font-size: 11.5px;
  font-weight: 700;
  padding: 2px 9px;
  border-radius: 999px;
}

.inv-stock.ok {
  color: #1d8a41;
  background: rgba(52, 199, 89, 0.12);
}

.inv-stock.low {
  color: #c76800;
  background: rgba(255, 149, 0, 0.14);
}

.inv-stock.out {
  color: #e0483e;
  background: rgba(224, 72, 62, 0.12);
}

html[data-theme="dark"] .inv-stock.ok { color: #66d489; }
html[data-theme="dark"] .inv-stock.low { color: #ffa94d; }
html[data-theme="dark"] .inv-stock.out { color: #ff7a70; }

.inv-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inv-meta {
  font-size: 12.5px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inv-prices {
  display: flex;
  gap: 14px;
  font-size: 12.5px;
  color: var(--text-tertiary);
}

.inv-sale strong {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.inv-cost {
  font-variant-numeric: tabular-nums;
}

.inv-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--glass-border);
}

.inv-act {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease, transform 120ms var(--ease-glass), opacity 160ms ease;
}

.inv-act:hover:not(:disabled) {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.inv-act:active:not(:disabled) {
  transform: scale(0.95);
}

.inv-act:disabled {
  opacity: 0.4;
  cursor: default;
}

.inv-act.icon {
  flex: 0 0 36px;
}

.inv-act.danger:hover {
  color: #e0483e;
}

.inv-empty {
  padding: 36px;
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: 13.5px;
  color: var(--text-tertiary);
}

@media (max-width: 480px) {
  .inv-toolbar {
    flex-wrap: wrap;
  }

  .inv-add {
    flex: 1;
    justify-content: center;
  }
}
</style>
