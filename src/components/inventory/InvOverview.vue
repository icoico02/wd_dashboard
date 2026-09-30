<template>
  <div>
    <div class="ov-cards">
      <div class="ov-card glass">
        <p class="ov-label">今日销售额</p>
        <p class="ov-value">{{ fmtMoney(stats.todaySales) }}</p>
        <p class="ov-sub">{{ stats.todayOrders }} 笔订单</p>
      </div>
      <div class="ov-card glass">
        <p class="ov-label">今日利润</p>
        <p class="ov-value" :class="{ pos: stats.todayProfit > 0 }">{{ fmtMoney(stats.todayProfit) }}</p>
        <p class="ov-sub">已完成订单</p>
      </div>
      <div class="ov-card glass">
        <p class="ov-label">待确认出库</p>
        <p class="ov-value">{{ pendingCount }}</p>
        <p class="ov-sub">笔订单等待确认</p>
      </div>
      <div class="ov-card glass">
        <p class="ov-label">商品种类</p>
        <p class="ov-value">{{ products.length }}</p>
        <p class="ov-sub">低库存 {{ lowStockCount }} 项</p>
      </div>
    </div>

    <section class="ov-trend glass">
      <div class="ov-trend-head">
        <h3 class="inv-sub-title">销售趋势</h3>
        <div class="ov-seg">
          <button
            v-for="d in [7, 30, 90]"
            :key="d"
            type="button"
            :class="{ active: days === d }"
            @click="days = d"
          >
            近 {{ d }} 天
          </button>
        </div>
      </div>
      <div class="ov-bars">
        <div v-for="b in bars" :key="b.day" class="ov-bar-col" :title="`${b.day}: ${fmtMoney(b.sales)}`">
          <div class="ov-bar" :style="{ height: b.h + '%' }"></div>
          <span class="ov-bar-label">{{ b.label }}</span>
        </div>
      </div>
      <p class="ov-trend-sum">
        近 {{ days }} 天合计销售额 <strong>{{ fmtMoney(trendTotal) }}</strong> · {{ trendOrders }} 笔订单
      </p>
    </section>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useInventory, fmtMoney } from '../../composables/useInventory'

const { orders, products } = useInventory()
const days = ref(7)

const dayKey = (d) => {
  const t = new Date(d)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

const todayKey = dayKey(new Date())

const stats = computed(() => {
  let sales = 0
  let count = 0
  let profit = 0
  for (const o of orders.value) {
    if (dayKey(o.createdAt) !== todayKey.value) continue
    count++
    if (o.status === 'cancelled') continue
    sales += o.totalAmount
    profit += o.totalProfit || 0
  }
  return { todaySales: sales, todayOrders: count, todayProfit: profit }
})

const pendingCount = computed(
  () => orders.value.filter((o) => ['pending_confirmation', 'pending_fulfillment'].includes(o.status)).length,
)

const lowStockCount = computed(
  () => products.value.filter((p) => p.lowStockThreshold > 0 && p.stock <= p.lowStockThreshold).length,
)

const trend = computed(() => {
  const map = new Map()
  const now = new Date()
  for (let i = days.value - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    map.set(dayKey(d), { sales: 0, count: 0 })
  }
  for (const o of orders.value) {
    if (o.status === 'cancelled') continue
    const k = dayKey(o.createdAt)
    if (map.has(k)) {
      map.get(k).sales += o.totalAmount
      map.get(k).count++
    }
  }
  return [...map.entries()].map(([k, v]) => ({ day: k, label: k.slice(5).replace('-', '/'), ...v }))
})

const bars = computed(() => {
  const max = Math.max(...trend.value.map((t) => t.sales), 1)
  return trend.value.map((t) => ({
    ...t,
    h: Math.max(4, Math.round((t.sales / max) * 100)),
  }))
})

const trendTotal = computed(() => trend.value.reduce((s, t) => s + t.sales, 0))
const trendOrders = computed(() => trend.value.reduce((s, t) => s + t.count, 0))
</script>

<style scoped>
.ov-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.ov-card {
  border-radius: var(--radius-lg);
  padding: 14px 16px;
}

.ov-label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.ov-value {
  margin: 3px 0 1px;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.ov-value.pos {
  color: #1d8a41;
}

html[data-theme="dark"] .ov-value.pos {
  color: #66d489;
}

.ov-sub {
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.ov-trend {
  border-radius: var(--radius-lg);
  padding: 16px;
}

.ov-trend-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 14px;
}

.ov-seg {
  display: inline-flex;
  padding: 3px;
  border-radius: 10px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
}

.ov-seg button {
  border: none;
  background: transparent;
  padding: 5px 12px;
  border-radius: 8px;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
}

.ov-seg button.active {
  background: var(--seg-thumb-bg);
  color: var(--text-primary);
  box-shadow: var(--seg-thumb-shadow);
}

.ov-bars {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 120px;
}

.ov-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  gap: 5px;
  min-width: 0;
}

.ov-bar {
  width: 100%;
  max-width: 34px;
  border-radius: 6px 6px 3px 3px;
  background: linear-gradient(180deg, rgba(10, 132, 255, 0.65), rgba(10, 132, 255, 0.25));
  min-height: 4px;
  transition: height 300ms var(--ease-glass);
}

.ov-bar-label {
  font-size: 10px;
  color: var(--text-tertiary);
  white-space: nowrap;
}

.ov-trend-sum {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.ov-trend-sum strong {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}
</style>
