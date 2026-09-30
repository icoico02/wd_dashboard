<template>
  <div>
    <!-- 待确认出库 -->
    <section v-if="pendingOrders.length" class="inv-pending">
      <h3 class="inv-sub-title">待确认出库</h3>
      <article v-for="o in pendingOrders" :key="o.id" class="inv-order glass pending">
        <header class="inv-order-head">
          <div class="inv-order-info">
            <span class="inv-order-no">{{ o.orderNo }}</span>
            <span class="inv-order-time">{{ fmtDateTime(o.createdAt) }}</span>
          </div>
          <span class="inv-order-status pending">待确认</span>
        </header>
        <ul class="inv-order-items">
          <li v-for="i in o.items" :key="i.id">
            <span class="item-name">{{ i.productName }}</span>
            <span class="item-qty">× {{ i.quantity }}</span>
            <span class="item-sum">{{ fmtMoney(i.lineTotal) }}</span>
          </li>
        </ul>
        <footer class="inv-order-foot">
          <span class="inv-order-total">应收 <strong>{{ fmtMoney(o.totalAmount) }}</strong></span>
          <button type="button" class="inv-confirm" :disabled="confirmingId === o.id" @click="confirm(o)">
            {{ confirmingId === o.id ? '确认中…' : '确认出库' }}
          </button>
        </footer>
      </article>
    </section>

    <!-- 全部订单 -->
    <section>
      <h3 class="inv-sub-title">全部订单</h3>
      <div v-if="!orders.length" class="inv-empty glass-subtle">
        <p>还没有订单，点击「开单」创建第一笔销售。</p>
      </div>
      <div v-else class="inv-order-list">
        <article v-for="o in orders" :key="o.id" class="inv-order glass">
          <header class="inv-order-head">
            <div class="inv-order-info">
              <span class="inv-order-no">{{ o.orderNo }}</span>
              <span class="inv-order-time">{{ fmtDateTime(o.createdAt) }} · {{ paymentLabel(o.paymentMethod) }}</span>
            </div>
            <span class="inv-order-status" :class="statusClass(o)">{{ statusLabel(o) }}</span>
          </header>
          <ul class="inv-order-items">
            <li v-for="i in o.items" :key="i.id">
              <span class="item-name">{{ i.productName }}</span>
              <span class="item-qty">× {{ i.quantity }}</span>
              <span class="item-sum">{{ fmtMoney(i.lineTotal) }}</span>
            </li>
          </ul>
          <footer class="inv-order-foot">
            <span class="inv-order-total">
              实收 <strong>{{ fmtMoney(o.totalAmount) }}</strong>
              <template v-if="o.fulfillmentStatus === 'fulfilled'">
                <span class="inv-profit"> · 利润 {{ fmtMoney(o.totalProfit) }}</span>
              </template>
            </span>
            <button type="button" class="inv-act" @click="printOrder(o)">
              <Printer :size="14" aria-hidden="true" />打印
            </button>
          </footer>
          <p v-if="o.note" class="inv-order-note">备注：{{ o.note }}</p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { Printer } from 'lucide-vue-next'
import { useInventory, fmtMoney, fmtDateTime, paymentLabel } from '../../composables/useInventory'
import { printTable } from '../../lib/tableExport'
import { useToast } from '../../composables/useToast'

const { orders, confirmOrder } = useInventory()
const { showToast } = useToast()

const confirmingId = ref(null)

const pendingOrders = computed(() =>
  orders.value.filter((o) => ['pending_confirmation', 'pending_fulfillment'].includes(o.status)),
)

function statusLabel(o) {
  const map = {
    pending_confirmation: '待确认',
    pending_fulfillment: '待出库',
    completed: '已完成',
    pending_shipment: '待发货',
    shipped: '已发货',
    cancelled: '已取消',
  }
  return map[o.status] || o.status
}

function statusClass(o) {
  if (o.status === 'completed') return 'done'
  if (o.status === 'cancelled') return 'cancelled'
  return 'pending'
}

async function confirm(o) {
  if (confirmingId.value) return
  confirmingId.value = o.id
  try {
    await confirmOrder(o.id)
    showToast('出库完成，库存已扣减')
  } catch (e) {
    showToast(e.message || '确认出库失败')
  } finally {
    confirmingId.value = null
  }
}

function printOrder(o) {
  printTable({
    title: `销售单 ${o.orderNo}`,
    subtitle: `${fmtDateTime(o.createdAt)} · ${paymentLabel(o.paymentMethod)} · 状态：${statusLabel(o)}`,
    head: ['商品', 'SKU', '数量', '单价', '小计'],
    rows: (o.items || []).map((i) => [i.productName, i.sku, i.quantity, fmtMoney(i.unitPrice), fmtMoney(i.lineTotal)]),
  })
}
</script>

<style scoped>
.inv-sub-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.inv-pending {
  margin-bottom: 22px;
}

.inv-order-list,
.inv-pending {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inv-pending .inv-order.pending {
  border-color: rgba(255, 149, 0, 0.4);
}

.inv-order {
  border-radius: var(--radius-lg);
  padding: 13px 15px;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.inv-order-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.inv-order-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}

.inv-order-no {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}

.inv-order-time {
  font-size: 11.5px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.inv-order-status {
  flex: 0 0 auto;
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
}

.inv-order-status.done {
  color: #1d8a41;
  border-color: rgba(52, 199, 89, 0.35);
  background: rgba(52, 199, 89, 0.12);
}

.inv-order-status.cancelled {
  color: #e0483e;
}

html[data-theme="dark"] .inv-order-status.done {
  color: #66d489;
}

.inv-order-items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.inv-order-items li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary);
}

.item-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-qty,
.item-sum {
  flex: 0 0 auto;
  font-variant-numeric: tabular-nums;
}

.item-sum {
  color: var(--text-primary);
}

.inv-order-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-top: 9px;
  border-top: 1px solid var(--glass-border);
}

.inv-order-total {
  font-size: 13px;
  color: var(--text-secondary);
}

.inv-order-total strong {
  color: var(--text-primary);
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}

.inv-profit {
  color: #1d8a41;
  font-variant-numeric: tabular-nums;
}

html[data-theme="dark"] .inv-profit {
  color: #66d489;
}

.inv-order-note {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.inv-confirm {
  display: inline-flex;
  align-items: center;
  height: 34px;
  padding: 0 18px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(180deg, #43d063, #2eb350);
  box-shadow: 0 6px 16px rgba(52, 199, 89, 0.35);
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass);
}

.inv-confirm:hover:not(:disabled) {
  filter: brightness(1.06);
}

.inv-confirm:active:not(:disabled) {
  transform: scale(0.96);
}

.inv-confirm:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
