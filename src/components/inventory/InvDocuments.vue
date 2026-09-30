<template>
  <div>
    <div v-if="!docs.length" class="doc-empty glass-subtle">
      <p>暂无业务单据。入库、出库、开单和退货都会自动生成单据。</p>
    </div>

    <div v-else class="doc-filter">
      <button
        v-for="t in typeFilters"
        :key="t.value"
        type="button"
        class="doc-filter-btn"
        :class="{ active: current === t.value }"
        @click="current = t.value"
      >
        {{ t.label }}
      </button>
    </div>

    <ul v-if="filtered.length" class="doc-list">
      <li v-for="d in filtered" :key="d.docNo + d.type" class="doc-row glass">
        <span class="doc-badge" :class="d.cls">{{ d.typeLabel }}</span>
        <div class="doc-info">
          <span class="doc-no">{{ d.docNo }}</span>
          <span class="doc-date">{{ fmtDateTime(d.date) }}</span>
        </div>
        <span class="doc-amount" :class="{ neg: d.amount < 0 }">{{ fmtMoney(d.amount) }}</span>
      </li>
    </ul>
    <div v-else class="doc-empty glass-subtle"><p>该类型下暂无单据</p></div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useInventory, fmtMoney, fmtDateTime } from '../../composables/useInventory'

const { orders, movements } = useInventory()
const current = ref('all')

const typeFilters = [
  { value: 'all', label: '全部' },
  { value: 'SO', label: '销售单' },
  { value: 'PO', label: '入库单' },
  { value: 'ST', label: '出库单' },
  { value: 'RT', label: '退货单' },
]

const docs = computed(() => {
  const list = []
  for (const o of orders.value) {
    list.push({
      docNo: o.orderNo,
      type: 'SO',
      typeLabel: '销售单',
      cls: 'so',
      date: o.createdAt,
      amount: o.totalAmount,
    })
  }
  for (const m of movements.value) {
    if (!m.docNo) continue
    const type = String(m.docNo).slice(0, 2)
    if (type === 'SO') continue
    const label = type === 'PO' ? '入库单' : type === 'ST' ? '出库单' : type === 'RT' ? '退货单' : type
    list.push({
      docNo: m.docNo,
      type,
      typeLabel: label,
      cls: type === 'PO' ? 'po' : type === 'RT' ? 'rt' : 'st',
      date: m.createdAt,
      amount: m.quantity > 0 ? m.totalAmount : -m.totalAmount,
    })
  }
  return list.sort((a, b) => new Date(b.date) - new Date(a.date))
})

const filtered = computed(() =>
  current.value === 'all' ? docs.value : docs.value.filter((d) => d.type === current.value),
)
</script>

<style scoped>
.doc-filter {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px;
  margin-bottom: 12px;
}

.doc-filter-btn {
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

.doc-filter-btn.active {
  background: var(--pill-selected-bg);
  color: var(--text-primary);
  font-weight: 600;
  border-color: var(--glass-border-bright);
  box-shadow: var(--pill-selected-shadow);
}

.doc-empty {
  padding: 36px;
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: 13.5px;
  color: var(--text-tertiary);
}

.doc-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.doc-row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-radius: var(--radius-md);
  padding: 10px 14px;
}

.doc-badge {
  flex: 0 0 auto;
  font-size: 11.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 999px;
  white-space: nowrap;
}

.doc-badge.so {
  color: #0a6ed6;
  background: rgba(10, 132, 255, 0.12);
}

.doc-badge.po {
  color: #1d8a41;
  background: rgba(52, 199, 89, 0.12);
}

.doc-badge.st {
  color: #c76800;
  background: rgba(255, 149, 0, 0.14);
}

.doc-badge.rt {
  color: #af52de;
  background: rgba(175, 82, 222, 0.12);
}

html[data-theme="dark"] .doc-badge.so { color: #7db8ff; }
html[data-theme="dark"] .doc-badge.po { color: #66d489; }
html[data-theme="dark"] .doc-badge.st { color: #ffa94d; }
html[data-theme="dark"] .doc-badge.rt { color: #d0a5f5; }

.doc-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.doc-no {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
}

.doc-date {
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.doc-amount {
  flex: 0 0 auto;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.doc-amount.neg {
  color: #c76800;
}
</style>
