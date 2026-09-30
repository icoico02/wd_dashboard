<template>
  <div>
    <div class="stk-legend">
      <span class="stk-badge ok">在库</span>
      <span class="stk-badge low">低库存</span>
      <span class="stk-badge out">缺货</span>
      <span class="stk-badge dmg">报损</span>
      <span class="stk-hint">报损商品不占库存，单独统计</span>
    </div>

    <div v-if="!products.length" class="stk-empty glass-subtle">
      <p>暂无商品数据</p>
    </div>
    <div v-else class="stk-table glass">
      <div class="stk-head">
        <span>商品</span>
        <span>可售库存</span>
        <span>报损</span>
        <span>状态</span>
      </div>
      <div v-for="p in sorted" :key="p.id" class="stk-row">
        <span class="stk-name">
          <b>{{ p.name }}</b>
          <i>{{ p.sku }} · {{ p.category }}</i>
        </span>
        <span class="stk-num" :class="{ danger: p.stock <= 0 }">{{ p.stock }}</span>
        <span class="stk-num">{{ p.damagedQuantity || 0 }}</span>
        <span class="stk-state" :class="stateOf(p).cls">{{ stateOf(p).label }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useInventory } from '../../composables/useInventory'

const { products } = useInventory()

const sorted = computed(() =>
  [...products.value].sort((a, b) => a.stock - b.stock),
)

function stateOf(p) {
  if (p.stock <= 0) return { label: '缺货', cls: 'out' }
  if (p.lowStockThreshold > 0 && p.stock <= p.lowStockThreshold) return { label: '低库存', cls: 'low' }
  return { label: '正常', cls: 'ok' }
}
</script>

<style scoped>
.stk-legend {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.stk-badge {
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
}

.stk-badge.ok {
  color: #1d8a41;
  background: rgba(52, 199, 89, 0.12);
}

.stk-badge.low {
  color: #c76800;
  background: rgba(255, 149, 0, 0.14);
}

.stk-badge.out {
  color: #e0483e;
  background: rgba(224, 72, 62, 0.12);
}

.stk-badge.dmg {
  color: #af52de;
  background: rgba(175, 82, 222, 0.12);
}

.stk-hint {
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.stk-empty {
  padding: 36px;
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: 13.5px;
  color: var(--text-tertiary);
}

.stk-table {
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.stk-head,
.stk-row {
  display: grid;
  grid-template-columns: 1fr 90px 70px 84px;
  gap: 10px;
  align-items: center;
  padding: 10px 16px;
}

.stk-head {
  background: var(--glass-bg-subtle);
  border-bottom: 1px solid var(--glass-border);
  font-size: 12px;
  font-weight: 700;
  color: var(--text-tertiary);
}

.stk-row {
  border-bottom: 1px solid var(--glass-border);
  font-size: 13.5px;
}

.stk-row:last-child {
  border-bottom: none;
}

.stk-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.stk-name b {
  color: var(--text-primary);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stk-name i {
  font-style: normal;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.stk-num {
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
  font-weight: 600;
}

.stk-num.danger {
  color: #e0483e;
}

.stk-state {
  font-size: 12px;
  font-weight: 700;
}

.stk-state.ok { color: #1d8a41; }
.stk-state.low { color: #c76800; }
.stk-state.out { color: #e0483e; }

html[data-theme="dark"] .stk-state.ok { color: #66d489; }
html[data-theme="dark"] .stk-state.low { color: #ffa94d; }
html[data-theme="dark"] .stk-state.out { color: #ff7a70; }

@media (max-width: 480px) {
  .stk-head,
  .stk-row {
    grid-template-columns: 1fr 64px 52px 64px;
    padding: 9px 12px;
    gap: 6px;
  }
}
</style>
