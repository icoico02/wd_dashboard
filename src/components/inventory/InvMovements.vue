<template>
  <div>
    <div v-if="!movements.length" class="inv-empty glass-subtle">
      <p>暂无出入库流水。入库、出库和确认出库都会在这里留下记录。</p>
    </div>
    <ul v-else class="mv-list">
      <li v-for="m in movements" :key="m.id" class="mv-row glass">
        <span class="mv-badge" :class="m.quantity > 0 ? 'in' : 'out'">
          {{ movementLabel(m.type) }}
        </span>
        <div class="mv-info">
          <span class="mv-name">{{ m.productName || '未知商品' }}</span>
          <span class="mv-meta">
            {{ fmtDateTime(m.createdAt) }}
            <template v-if="m.docNo"> · {{ m.docNo }}</template>
            <template v-if="m.supplier"> · 供应商：{{ m.supplier }}</template>
            <template v-if="m.note"> · {{ m.note }}</template>
          </span>
        </div>
        <span class="mv-qty" :class="m.quantity > 0 ? 'in' : 'out'">
          {{ m.quantity > 0 ? '+' : '' }}{{ m.quantity }}
        </span>
        <span class="mv-amount">{{ fmtMoney(m.totalAmount) }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useInventory, fmtMoney, fmtDateTime, movementLabel } from '../../composables/useInventory'

const { movements } = useInventory()
</script>

<style scoped>
.inv-empty {
  padding: 36px;
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: 13.5px;
  color: var(--text-tertiary);
}

.mv-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mv-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: var(--radius-md);
  padding: 10px 14px;
}

.mv-badge {
  flex: 0 0 auto;
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.mv-badge.in {
  color: #1d8a41;
  background: rgba(52, 199, 89, 0.12);
}

.mv-badge.out {
  color: #c76800;
  background: rgba(255, 149, 0, 0.14);
}

html[data-theme="dark"] .mv-badge.in { color: #66d489; }
html[data-theme="dark"] .mv-badge.out { color: #ffa94d; }

.mv-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.mv-name {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mv-meta {
  font-size: 11.5px;
  color: var(--text-tertiary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mv-qty {
  flex: 0 0 auto;
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.mv-qty.in {
  color: #1d8a41;
}

.mv-qty.out {
  color: #e0483e;
}

html[data-theme="dark"] .mv-qty.in { color: #66d489; }
html[data-theme="dark"] .mv-qty.out { color: #ff7a70; }

.mv-amount {
  flex: 0 0 84px;
  text-align: right;
  font-size: 13px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}
</style>
