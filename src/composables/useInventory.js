/**
 * 进销存统一数据层（组合式）
 *
 * - 登录用户：src/lib/inventoryApi.js → Supabase（组织 RLS 隔离，见 lib 内注释）
 * - 游客：src/lib/inventoryLocal.js → localStorage 沙箱（可完整体验，数据不出本机）
 * 两个后端的方法签名一一对应，页面组件不感知差异。
 *
 * 注意：本文件的状态是模块级单例；authUser 的监听在 useInventory() 调用时
 * 注册到当前组件作用域，组件卸载后自动停止，再次挂载会重新注册并重载数据。
 */
import { computed, ref, watch } from 'vue'
import { useAuth } from './useAuth'
import * as api from '../lib/inventoryApi'
import * as local from '../lib/inventoryLocal'

const products = ref([])
const orders = ref([])
const movements = ref([])
const returns = ref([])
const loading = ref(false)
const loaded = ref(false)
const orgSetupNeeded = ref(false)
let reloadSeq = 0

function mapProduct(p) {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category || '未分类',
    specification: p.specification || null,
    salePrice: Number(p.sale_price || 0),
    costPrice: Number(p.cost_price || 0),
    stock: p.stock ?? 0,
    damagedQuantity: p.damaged_quantity ?? 0,
    pendingStock: p.pending_stock ?? 0,
    lowStockThreshold: p.low_stock_threshold ?? 0,
    createdAt: p.created_at,
  }
}

function mapReturn(r) {
  return {
    id: r.id,
    returnNo: r.return_no,
    orderNo: r.order_no,
    refundAmount: Number(r.refund_amount || 0),
    refundMethod: r.refund_method,
    reason: r.reason,
    note: r.note,
    createdAt: r.created_at,
    items: (r.inventory_return_items || []).map((i) => ({
      id: i.id,
      productName: i.product_name,
      quantity: i.quantity,
      condition: i.item_condition,
    })),
  }
}

function mapOrder(o, items) {
  return {
    id: o.id,
    orderNo: o.order_no,
    status: o.order_status,
    fulfillmentStatus: o.fulfillment_status,
    paymentMethod: o.payment_method,
    subtotal: Number(o.subtotal || 0),
    discount: Number(o.discount || 0),
    totalAmount: Number(o.total_amount || 0),
    totalCost: Number(o.total_cost || 0),
    totalProfit: Number(o.total_profit || 0),
    note: o.note,
    createdAt: o.created_at,
    items: items
      .filter((i) => i.order_id === o.id)
      .map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: Number(i.unit_price || 0),
        lineTotal: Number(i.line_total || 0),
      })),
  }
}

function mapMovement(m) {
  return {
    id: m.id,
    type: m.operation_type,
    quantity: m.quantity,
    unitCost: Number(m.unit_cost || 0),
    unitPrice: Number(m.unit_price || 0),
    totalAmount: Number(m.total_amount || 0),
    supplier: m.supplier,
    note: m.note,
    docNo: m.business_no,
    productName: m.inventory_products?.name || null,
    createdAt: m.created_at,
  }
}

export function useInventory() {
  const { authUser, isConfigured } = useAuth()

  const isGuest = computed(() => !isConfigured || !authUser.value)

  async function reload() {
    const seq = ++reloadSeq
    loading.value = true
    try {
      if (isGuest.value) {
        products.value = local.listProducts()
        orders.value = local.listOrders()
        movements.value = local.listMovements()
        returns.value = local.listReturns()
        orgSetupNeeded.value = false
        loaded.value = true
        return
      }
      const oid = await api.getOrgId()
      if (reloadSeq !== seq) return
      if (!oid) {
        orgSetupNeeded.value = true
        products.value = []
        orders.value = []
        movements.value = []
        loaded.value = true
        return
      }
      orgSetupNeeded.value = false
      const [p, o, m, r] = await Promise.all([
        api.listProducts(),
        api.listOrders(),
        api.listMovements(),
        api.listReturns().catch(() => []),
      ])
      if (reloadSeq !== seq) return
      const items = await api.listOrderItems(o.map((x) => x.id))
      products.value = p.map(mapProduct)
      orders.value = o.map((order) => mapOrder(order, items))
      movements.value = m.map(mapMovement)
      returns.value = r.map(mapReturn)
      loaded.value = true
    } finally {
      if (reloadSeq === seq) loading.value = false
    }
  }

  // 登录态变化（登录 / 退出 / 首次会话恢复）→ 自动重新加载数据
  watch(isGuest, () => reload())
  // 挂载即加载（guest / cloud 都走一遍）
  reload()

  async function createOrganization(name) {
    await api.createOrganization(name)
    await reload()
  }

  async function saveProduct(payload, productId = null) {
    if (isGuest.value) local.saveProduct(payload, productId)
    else await api.saveProduct(payload, productId)
    await reload()
  }

  async function deleteProduct(id) {
    if (isGuest.value) local.deleteProduct(id)
    else await api.deleteProduct(id)
    await reload()
  }

  async function receiveProduct(payload) {
    if (isGuest.value) local.receiveProduct(payload)
    else await api.receiveProduct(payload)
    await reload()
  }

  async function stockOutProduct(payload) {
    if (isGuest.value) local.stockOutProduct(payload)
    else await api.stockOutProduct(payload)
    await reload()
  }

  async function createSale(payload) {
    if (isGuest.value) return local.createOrder(payload)
    return api.createOrder(payload)
  }

  async function confirmOrder(orderId) {
    if (isGuest.value) local.confirmOrder(orderId)
    else await api.confirmOrder(orderId)
    await reload()
  }

  /** 销售退货：guest → 本地沙箱；登录 → inventory_create_sale_return RPC（库存与订单状态由服务端原子更新） */
  async function createReturn(payload) {
    if (isGuest.value) local.createSaleReturn(payload)
    else await api.createSaleReturn(payload)
    await reload()
  }

  return {
    products,
    orders,
    movements,
    returns,
    loading,
    loaded,
    isGuest,
    orgSetupNeeded,
    reload,
    createOrganization,
    saveProduct,
    deleteProduct,
    receiveProduct,
    stockOutProduct,
    createSale,
    confirmOrder,
    createReturn,
  }
}

const PAYMENT_LABELS = { cash: '现金', wechat: '微信支付', alipay: '支付宝', other: '其他' }
const MOVEMENT_LABELS = {
  inbound: '入库',
  sale: '销售',
  normal_outbound: '出库',
  loss: '损耗',
  adjustment: '调整',
  sale_return: '销售退货',
  purchase_return: '采购退货',
}

export function paymentLabel(v) {
  return PAYMENT_LABELS[v] || v
}

export function movementLabel(v) {
  return MOVEMENT_LABELS[v] || v
}

export function fmtMoney(n) {
  return `¥${Number(n || 0).toFixed(2)}`
}

export function fmtDateTime(v) {
  if (!v) return '--'
  return new Date(v).toLocaleString('zh-CN', { hour12: false })
}
