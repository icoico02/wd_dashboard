<template>
  <FeatureShell
    title="进销存"
    subtitle="商品 · 开单 · 出入库"
    :signed-in="!!authUser"
    :user-email="authUser?.email || ''"
    @sign-out="onSignOut"
  >
    <!-- 游客横幅 -->
    <div v-if="isGuest" class="inv-banner glass-subtle">
      <span class="inv-banner-dot" aria-hidden="true"></span>
      <p class="inv-banner-text">
        游客模式：可以体验全部功能，数据仅保存在本机浏览器；注册登录后使用云端数据，每个账号相互独立。
      </p>
      <button type="button" class="inv-banner-btn" @click="loginOpen = true">登录 / 注册</button>
    </div>

    <!-- 店铺开通（登录后首次进入） -->
    <section v-if="!isGuest && orgSetupNeeded" class="inv-org glass">
      <p class="inv-eyebrow">INVENTORY WORKSPACE</p>
      <h2 class="inv-org-title">创建我的店铺</h2>
      <p class="inv-org-desc">
        进销存数据归属于你的专属店铺，通过 Supabase RLS 与其他账号完全隔离。第一次进入只需为店铺起个名字。
      </p>
      <form class="inv-org-form" @submit.prevent="onCreateOrg">
        <input
          v-model="orgName"
          type="text"
          placeholder="例如：Wstudio 小卖部"
          maxlength="40"
          required
        />
        <button type="submit" class="inv-org-btn" :disabled="creatingOrg">
          {{ creatingOrg ? '创建中…' : '创建并进入' }}
        </button>
      </form>
    </section>

    <!-- 主工作区 -->
    <template v-else>
      <div class="inv-nav-wrap">
        <div class="inv-nav no-scrollbar">
          <button
            v-for="s in sections"
            :key="s.id"
            type="button"
            class="inv-nav-chip"
            :class="{ active: current === s.id }"
            @click="current = s.id"
          >
            {{ s.label }}
            <span v-if="s.badge" class="inv-nav-badge">{{ s.badge }}</span>
          </button>
        </div>
        <button
          type="button"
          class="inv-checkout"
          :disabled="!products.length"
          title="快速开单"
          @click="openSale"
        >
          <Receipt :size="15" aria-hidden="true" />开单
        </button>
      </div>

      <div v-if="loading && !loaded" class="inv-loading glass-subtle">正在载入数据…</div>

      <template v-else>
        <InvProducts
          v-show="current === 'products'"
          :products="products"
          @add="openProductDialog(null)"
          @edit="openProductDialog"
          @receive="(p) => openStockDialog('receive', p)"
          @outbound="(p) => openStockDialog('outbound', p)"
          @delete="askDeleteProduct"
        />
        <InvOrders v-show="current === 'orders'" />
        <InvMovements v-show="current === 'movements'" />
      </template>
    </template>
  </FeatureShell>

  <!-- 登录 / 注册（游客引导） -->
  <GlassDialog :open="loginOpen" title="登录后使用云端数据" @close="loginOpen = false">
    <AuthPanel />
  </GlassDialog>

  <!-- 新增 / 编辑商品 -->
  <GlassDialog
    :open="productDlg.open"
    :title="productDlg.editing ? '编辑商品' : '新增商品'"
    @close="productDlg.open = false"
  >
    <form class="inv-form" @submit.prevent="submitProduct">
      <label class="inv-field">
        <span>商品名称</span>
        <input v-model="productForm.name" type="text" required maxlength="60" />
      </label>
      <div class="inv-field-pair">
        <label class="inv-field">
          <span>分类</span>
          <input v-model="productForm.category" type="text" list="inv-category-list" maxlength="20" />
        </label>
        <label class="inv-field">
          <span>规格（可选）</span>
          <input v-model="productForm.specification" type="text" maxlength="30" />
        </label>
      </div>
      <datalist id="inv-category-list">
        <option v-for="c in categories" :key="c" :value="c" />
      </datalist>
      <label class="inv-field">
        <span>SKU 编码</span>
        <input v-model="productForm.sku" type="text" required maxlength="40" />
      </label>
      <div class="inv-field-pair">
        <label class="inv-field">
          <span>售价</span>
          <input v-model.number="productForm.salePrice" type="number" min="0" step="0.01" required />
        </label>
        <label class="inv-field">
          <span>成本价</span>
          <input v-model.number="productForm.costPrice" type="number" min="0" step="0.01" required />
        </label>
      </div>
      <div class="inv-field-pair">
        <label v-if="!productDlg.editing" class="inv-field">
          <span>期初库存</span>
          <input v-model.number="productForm.stock" type="number" min="0" step="1" required />
        </label>
        <label class="inv-field">
          <span>低库存提醒阈值</span>
          <input v-model.number="productForm.lowStockThreshold" type="number" min="0" step="1" />
        </label>
      </div>
      <p v-if="productDlg.editing" class="inv-form-hint">编辑不改库存，库存请使用「入库 / 出库」调整。</p>
      <div class="inv-dialog-actions">
        <button type="button" class="inv-btn-plain" @click="productDlg.open = false">取消</button>
        <button type="submit" class="inv-btn-primary" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </form>
  </GlassDialog>

  <!-- 入库 / 出库 -->
  <GlassDialog
    :open="stockDlg.open"
    :title="stockDlg.mode === 'receive' ? '商品入库' : '商品出库'"
    @close="stockDlg.open = false"
  >
    <form class="inv-form" @submit.prevent="submitStock">
      <p class="inv-stock-product">
        <strong>{{ stockDlg.product?.name }}</strong>
        <span>当前库存 {{ stockDlg.product?.stock ?? 0 }}</span>
      </p>
      <label class="inv-field">
        <span>数量</span>
        <input v-model.number="stockForm.quantity" type="number" min="1" step="1" required />
      </label>
      <label v-if="stockDlg.mode === 'receive'" class="inv-field">
        <span>入库单价（成本）</span>
        <input v-model.number="stockForm.unitCost" type="number" min="0" step="0.01" required />
      </label>
      <label v-if="stockDlg.mode === 'receive'" class="inv-field">
        <span>供应商（必填）</span>
        <input v-model="stockForm.supplier" type="text" required maxlength="40" />
      </label>
      <label v-if="stockDlg.mode === 'outbound'" class="inv-field">
        <span>出库类型</span>
        <select v-model="stockForm.type">
          <option value="normal_outbound">正常出库</option>
          <option value="loss">报损</option>
        </select>
      </label>
      <label class="inv-field">
        <span>备注（可选）</span>
        <input v-model="stockForm.note" type="text" maxlength="60" />
      </label>
      <p class="inv-form-hint">{{ stockHint }}</p>
      <div class="inv-dialog-actions">
        <button type="button" class="inv-btn-plain" @click="stockDlg.open = false">取消</button>
        <button type="submit" class="inv-btn-primary" :disabled="saving">
          {{ saving ? '处理中…' : stockDlg.mode === 'receive' ? '确认入库' : '确认出库' }}
        </button>
      </div>
    </form>
  </GlassDialog>

  <!-- 快速开单 -->
  <GlassDialog :open="saleDlg.open" title="快速开单" width="480px" @close="closeSale">
    <form class="inv-form" @submit.prevent="submitSale">
      <div class="inv-sale-picker">
        <select v-model="salePick.productId">
          <option value="" disabled>选择商品</option>
          <option v-for="p in products" :key="p.id" :value="p.id">
            {{ p.name }}（库存 {{ p.stock }} · {{ fmtMoney(p.salePrice) }}）
          </option>
        </select>
        <input v-model.number="salePick.quantity" type="number" min="1" step="1" />
        <button type="button" class="inv-btn-plain" :disabled="!salePick.productId" @click="addSaleRow">
          添加
        </button>
      </div>

      <div v-if="!saleRows.length" class="inv-sale-empty">尚未添加商品</div>
      <ul v-else class="inv-sale-rows">
        <li v-for="(row, i) in saleRows" :key="row.productId">
          <span class="row-name" :title="row.name">{{ row.name }}</span>
          <input v-model.number="row.quantity" type="number" min="1" step="1" />
          <input v-model.number="row.unitPrice" type="number" min="0" step="0.01" />
          <span class="row-sum">{{ fmtMoney(row.quantity * row.unitPrice) }}</span>
          <button type="button" class="row-del" aria-label="移除" @click="saleRows.splice(i, 1)">
            <X :size="14" aria-hidden="true" />
          </button>
        </li>
      </ul>

      <div class="inv-sale-summary">
        <label class="inv-field">
          <span>支付方式</span>
          <select v-model="saleForm.paymentMethod">
            <option value="cash">现金</option>
            <option value="wechat">微信支付</option>
            <option value="alipay">支付宝</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label class="inv-field">
          <span>优惠</span>
          <input v-model.number="saleForm.discount" type="number" min="0" step="0.01" />
        </label>
        <span class="inv-sale-total">合计 <strong>{{ fmtMoney(saleTotal) }}</strong></span>
      </div>
      <label class="inv-field">
        <span>备注（可选）</span>
        <input v-model="saleForm.note" type="text" maxlength="60" />
      </label>

      <div class="inv-dialog-actions">
        <button type="button" class="inv-btn-plain" @click="closeSale">取消</button>
        <button type="submit" class="inv-btn-primary" :disabled="saving || !saleRows.length">
          {{ saving ? '创建中…' : '创建订单' }}
        </button>
      </div>
    </form>
  </GlassDialog>

  <!-- 删除商品确认 -->
  <GlassDialog :open="deleteConfirm.open" title="删除商品？" width="360px" @close="deleteConfirm.open = false">
    <p class="inv-dialog-text">
      将删除「{{ deleteConfirm.product?.name }}」及其库存信息。已有销售记录的商品无法删除。
    </p>
    <div class="inv-dialog-actions">
      <button type="button" class="inv-btn-plain" @click="deleteConfirm.open = false">取消</button>
      <button type="button" class="inv-btn-danger" @click="confirmDeleteProduct">删除</button>
    </div>
  </GlassDialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { Receipt, X } from 'lucide-vue-next'
import AuthPanel from '../components/AuthPanel.vue'
import FeatureShell from '../components/FeatureShell.vue'
import GlassDialog from '../components/GlassDialog.vue'
import InvMovements from '../components/inventory/InvMovements.vue'
import InvOrders from '../components/inventory/InvOrders.vue'
import InvProducts from '../components/inventory/InvProducts.vue'
import { useAuth } from '../composables/useAuth'
import { useInventory, fmtMoney } from '../composables/useInventory'
import { useToast } from '../composables/useToast'

const { authUser, signOut } = useAuth()
const { showToast } = useToast()
const {
  products,
  orders,
  loading,
  loaded,
  isGuest,
  orgSetupNeeded,
  createOrganization,
  saveProduct,
  deleteProduct,
  receiveProduct,
  stockOutProduct,
  createSale,
  reload,
} = useInventory()

const loginOpen = ref(false)
const saving = ref(false)
const current = ref('products')
const orgName = ref('')
const creatingOrg = ref(false)

// 登录 / 注册成功后自动关闭弹窗（回到当前模块，数据切换由 useInventory 的 auth 监听处理）
watch(authUser, (user) => {
  if (user) loginOpen.value = false
})

const sections = computed(() => [
  { id: 'products', label: '商品库存' },
  {
    id: 'orders',
    label: '销售订单',
    badge: orders.value.filter((o) =>
      ['pending_confirmation', 'pending_fulfillment'].includes(o.status),
    ).length,
  },
  { id: 'movements', label: '出入库流水' },
])

const categories = computed(() => [...new Set(products.value.map((p) => p.category || '未分类'))])

async function onCreateOrg() {
  if (creatingOrg.value) return
  creatingOrg.value = true
  try {
    await createOrganization(orgName.value.trim() || '我的店铺')
    showToast('店铺创建成功，开始使用进销存')
  } catch (e) {
    showToast(e.message || '店铺创建失败')
  } finally {
    creatingOrg.value = false
  }
}

async function onSignOut() {
  await signOut()
  showToast('已退出登录')
}

/* ------------------------------- 新增 / 编辑商品 ------------------------------- */
const productDlg = reactive({ open: false, editing: null })
const productForm = reactive({
  name: '',
  category: '',
  specification: '',
  sku: '',
  salePrice: 0,
  costPrice: 0,
  stock: 0,
  lowStockThreshold: 0,
})

function openProductDialog(product) {
  productDlg.editing = product || null
  if (product) {
    Object.assign(productForm, {
      name: product.name,
      category: product.category,
      specification: product.specification || '',
      sku: product.sku,
      salePrice: product.salePrice,
      costPrice: product.costPrice,
      stock: product.stock,
      lowStockThreshold: product.lowStockThreshold,
    })
  } else {
    Object.assign(productForm, {
      name: '',
      category: '',
      specification: '',
      sku: `SKU-${Date.now().toString(36).toUpperCase()}`,
      salePrice: 0,
      costPrice: 0,
      stock: 0,
      lowStockThreshold: 0,
    })
  }
  productDlg.open = true
}

async function submitProduct() {
  if (saving.value) return
  if (productForm.salePrice < 0 || productForm.costPrice < 0) {
    showToast('价格不能为负数')
    return
  }
  saving.value = true
  try {
    await saveProduct({ ...productForm }, productDlg.editing?.id || null)
    productDlg.open = false
    showToast(productDlg.editing ? '商品已更新' : '商品已创建')
  } catch (e) {
    showToast(e.message || '保存失败')
  } finally {
    saving.value = false
  }
}

const deleteConfirm = reactive({ open: false, product: null })

function askDeleteProduct(product) {
  deleteConfirm.product = product
  deleteConfirm.open = true
}

async function confirmDeleteProduct() {
  if (!deleteConfirm.product) return
  try {
    await deleteProduct(deleteConfirm.product.id)
    deleteConfirm.open = false
    showToast('商品已删除')
  } catch (e) {
    deleteConfirm.open = false
    showToast(e.message || '删除失败：商品可能已有出入库或销售记录')
  }
}

/* ---------------------------------- 入库 / 出库 ---------------------------------- */
const stockDlg = reactive({ open: false, mode: 'receive', product: null })
const stockForm = reactive({ quantity: 1, unitCost: 0, supplier: '', type: 'normal_outbound', note: '' })

function openStockDialog(mode, product) {
  stockDlg.mode = mode
  stockDlg.product = product
  stockForm.quantity = 1
  stockForm.unitCost = product.costPrice
  stockForm.supplier = ''
  stockForm.type = 'normal_outbound'
  stockForm.note = ''
  stockDlg.open = true
}

const stockHint = computed(() => {
  if (!stockDlg.product) return ''
  const q = Number(stockForm.quantity) || 0
  const cur = stockDlg.product.stock
  return stockDlg.mode === 'receive'
    ? `入库后库存：${cur} → ${cur + q}`
    : `出库后库存：${cur} → ${cur - q}`
})

async function submitStock() {
  if (saving.value || !stockDlg.product) return
  saving.value = true
  try {
    if (stockDlg.mode === 'receive') {
      await receiveProduct({
        productId: stockDlg.product.id,
        quantity: stockForm.quantity,
        unitCost: stockForm.unitCost,
        supplier: stockForm.supplier,
        note: stockForm.note,
      })
      showToast('入库完成')
    } else {
      await stockOutProduct({
        productId: stockDlg.product.id,
        quantity: stockForm.quantity,
        type: stockForm.type,
        note: stockForm.note,
      })
      showToast('出库完成')
    }
    stockDlg.open = false
  } catch (e) {
    showToast(e.message || '操作失败')
  } finally {
    saving.value = false
  }
}

/* ------------------------------------ 快速开单 ------------------------------------ */
const saleDlg = reactive({ open: false })
const salePick = reactive({ productId: '', quantity: 1 })
const saleRows = ref([])
const saleForm = reactive({ paymentMethod: 'cash', discount: 0, note: '' })

const saleTotal = computed(() =>
  Math.max(
    saleRows.value.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0) -
      (Number(saleForm.discount) || 0),
    0,
  ),
)

function openSale() {
  salePick.productId = ''
  salePick.quantity = 1
  saleRows.value = []
  saleForm.paymentMethod = 'cash'
  saleForm.discount = 0
  saleForm.note = ''
  saleDlg.open = true
}

function closeSale() {
  saleDlg.open = false
}

function addSaleRow() {
  const p = products.value.find((x) => x.id === salePick.productId)
  if (!p) return
  const existing = saleRows.value.find((r) => r.productId === p.id)
  if (existing) {
    existing.quantity += Math.max(1, Number(salePick.quantity) || 1)
    return
  }
  saleRows.value.push({
    productId: p.id,
    name: p.name,
    quantity: Math.max(1, Number(salePick.quantity) || 1),
    unitPrice: p.salePrice,
    stock: p.stock,
  })
}

async function submitSale() {
  if (saving.value || !saleRows.value.length) return
  saving.value = true
  try {
    await createSale({
      items: saleRows.value.map((r) => ({
        product_id: r.productId,
        quantity: r.quantity,
        unit_price: r.unitPrice,
      })),
      paymentMethod: saleForm.paymentMethod,
      discount: Number(saleForm.discount) || 0,
      note: saleForm.note,
    })
    saleDlg.open = false
    current.value = 'orders'
    showToast('订单已创建，请到「销售订单」确认出库')
  } catch (e) {
    showToast(e.message || '开单失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.inv-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 14px;
  border-radius: 14px;
  margin-bottom: 16px;
}

.inv-banner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff9500;
  box-shadow: 0 0 6px rgba(255, 149, 0, 0.5);
  flex: 0 0 auto;
}

.inv-banner-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.inv-banner-btn {
  flex: 0 0 auto;
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass);
}

.inv-banner-btn:hover {
  filter: brightness(1.06);
}

.inv-banner-btn:active {
  transform: scale(0.95);
}

/* 店铺开通 */
.inv-org {
  border-radius: var(--radius-xl);
  padding: 30px 26px;
  text-align: center;
}

.inv-eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--text-tertiary);
}

.inv-org-title {
  margin-top: 6px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.inv-org-desc {
  margin: 8px auto 16px;
  max-width: 420px;
  font-size: 13.5px;
  color: var(--text-secondary);
}

.inv-org-form {
  display: flex;
  gap: 10px;
  max-width: 400px;
  margin: 0 auto;
}

.inv-org-form input {
  flex: 1;
  min-width: 0;
  height: 44px;
  padding: 0 14px;
  border-radius: 13px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 14.5px;
  color: var(--text-primary);
  outline: none;
}

.inv-org-form input:focus {
  border-color: rgba(10, 132, 255, 0.5);
  box-shadow: 0 0 0 1px rgba(10, 132, 255, 0.28), 0 0 14px var(--accent-soft);
}

.inv-org-btn {
  flex: 0 0 auto;
  padding: 0 18px;
  border: none;
  border-radius: 13px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass);
}

.inv-org-btn:hover:not(:disabled) {
  filter: brightness(1.06);
}

.inv-org-btn:disabled {
  opacity: 0.6;
}

/* 分区导航 */
.inv-nav-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.inv-nav {
  flex: 1;
  min-width: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px;
}

.inv-nav-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 15px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}

.inv-nav-chip.active {
  background: var(--pill-selected-bg);
  color: var(--text-primary);
  border-color: var(--glass-border-bright);
  box-shadow: var(--pill-selected-shadow);
}

.inv-nav-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  display: inline-grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: #ff9500;
}

.inv-checkout {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(180deg, #43d063, #2eb350);
  box-shadow: 0 6px 16px rgba(52, 199, 89, 0.35);
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass), opacity 160ms ease;
}

.inv-checkout:hover:not(:disabled) {
  filter: brightness(1.06);
}

.inv-checkout:active:not(:disabled) {
  transform: scale(0.96);
}

.inv-checkout:disabled {
  opacity: 0.45;
  cursor: default;
}

.inv-loading {
  padding: 40px;
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: 13.5px;
  color: var(--text-tertiary);
}

/* 对话框表单 */
.inv-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.inv-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.inv-field > span {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.inv-field input,
.inv-field select {
  height: 42px;
  padding: 0 12px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 14.5px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 180ms ease, box-shadow 180ms ease;
}

.inv-field input:focus,
.inv-field select:focus {
  background: var(--glass-bg-strong);
  border-color: rgba(10, 132, 255, 0.5);
  box-shadow: 0 0 0 1px rgba(10, 132, 255, 0.28), 0 0 14px var(--accent-soft);
}

.inv-field-pair {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.inv-form-hint {
  margin: 0;
  font-size: 12px;
  color: var(--text-tertiary);
}

.inv-dialog-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.inv-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.inv-btn-plain {
  padding: 9px 18px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}

.inv-btn-plain:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.inv-btn-primary {
  padding: 9px 20px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  box-shadow: 0 6px 18px rgba(10, 132, 255, 0.32);
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass);
}

.inv-btn-primary:hover:not(:disabled) {
  filter: brightness(1.06);
}

.inv-btn-primary:disabled {
  opacity: 0.6;
}

.inv-btn-danger {
  padding: 9px 20px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 13.5px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(180deg, #ff6b5e, #e0483e);
  cursor: pointer;
}

/* 开单 */
.inv-sale-picker {
  display: grid;
  grid-template-columns: 1fr 74px auto;
  gap: 8px;
}

.inv-sale-picker select,
.inv-sale-picker input {
  height: 40px;
  padding: 0 10px;
  border-radius: 11px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 13.5px;
  color: var(--text-primary);
  outline: none;
  min-width: 0;
}

.inv-sale-empty {
  text-align: center;
  font-size: 13px;
  color: var(--text-tertiary);
  padding: 14px;
}

.inv-sale-rows {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 200px;
  overflow-y: auto;
}

.inv-sale-rows li {
  display: grid;
  grid-template-columns: 1fr 62px 82px 76px 28px;
  gap: 7px;
  align-items: center;
}

.inv-sale-rows .row-name {
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.inv-sale-rows input {
  width: 100%;
  height: 32px;
  padding: 0 8px;
  border-radius: 9px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 13px;
  color: var(--text-primary);
  outline: none;
  font-variant-numeric: tabular-nums;
}

.inv-sale-rows .row-sum {
  font-size: 13px;
  font-weight: 600;
  text-align: right;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.row-del {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  border: none;
  display: grid;
  place-items: center;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
}

.row-del:hover {
  color: #e0483e;
  background: var(--glass-bg-hover);
}

.inv-sale-summary {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.inv-sale-summary .inv-field {
  flex: 1;
  min-width: 110px;
}

.inv-sale-total {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.inv-sale-total strong {
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.inv-stock-product {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  margin: 0;
  padding: 10px 12px;
  border-radius: 11px;
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
}

.inv-stock-product strong {
  font-size: 14px;
  color: var(--text-primary);
}

.inv-stock-product span {
  font-size: 12.5px;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 480px) {
  .inv-nav-wrap {
    flex-wrap: wrap;
  }

  .inv-checkout {
    flex: 1;
    justify-content: center;
  }

  .inv-org-form {
    flex-direction: column;
  }

  .inv-org-btn {
    height: 44px;
  }
}
</style>
