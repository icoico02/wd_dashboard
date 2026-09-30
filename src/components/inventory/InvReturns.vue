<template>
  <div>
    <p v-if="!returns.length" class="rt-empty glass-subtle">
      暂无退货记录。在「销售订单」中对已完成订单点「退货」即可发起。
    </p>
    <ul v-else class="rt-list">
      <li v-for="r in returns" :key="r.id" class="rt-row glass">
        <header class="rt-head">
          <div class="rt-info">
            <span class="rt-no">{{ r.returnNo }}</span>
            <span class="rt-meta">
              {{ fmtDateTime(r.createdAt) }}
              <template v-if="r.orderNo"> · 原单 {{ r.orderNo }}</template>
              · 退款 {{ fmtMoney(r.refundAmount) }}（{{ paymentLabel(r.refundMethod) }}）
            </span>
          </div>
          <span class="rt-reason" :title="r.reason">{{ r.reason }}</span>
        </header>
        <ul class="rt-items">
          <li v-for="i in r.items" :key="i.id">
            <span class="rt-item-name">{{ i.productName }}</span>
            <span class="rt-item-qty">× {{ i.quantity }}</span>
            <span class="rt-item-cond" :class="i.condition">{{ conditionLabel(i.condition) }}</span>
          </li>
        </ul>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useInventory, fmtMoney, fmtDateTime, paymentLabel } from '../../composables/useInventory'

const { returns } = useInventory()

function conditionLabel(c) {
  return { resellable: '可再销售', damaged: '报损', pending: '待定' }[c] || c
}

void fmtMoney
</script>

<style scoped>
.rt-empty {
  padding: 36px;
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: 13.5px;
  color: var(--text-tertiary);
}

.rt-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rt-row {
  border-radius: var(--radius-lg);
  padding: 13px 15px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rt-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.rt-no {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}

.rt-meta {
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.rt-reason {
  font-size: 12px;
  color: var(--text-secondary);
  max-width: 45%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rt-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.rt-items li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}

.rt-item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rt-item-qty {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
}

.rt-item-cond {
  flex: 0 0 auto;
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}

.rt-item-cond.resellable {
  color: #1d8a41;
  background: rgba(52, 199, 89, 0.12);
}

.rt-item-cond.damaged {
  color: #e0483e;
  background: rgba(224, 72, 62, 0.12);
}

.rt-item-cond.pending {
  color: #c76800;
  background: rgba(255, 149, 0, 0.14);
}

html[data-theme="dark"] .rt-item-cond.resellable { color: #66d489; }
html[data-theme="dark"] .rt-item-cond.damaged { color: #ff7a70; }
html[data-theme="dark"] .rt-item-cond.pending { color: #ffa94d; }
</style>
