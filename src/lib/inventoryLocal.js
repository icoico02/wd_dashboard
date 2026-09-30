/**
 * 进销存游客本地沙箱（localStorage）
 *
 * 与云端同一套业务规则：商品管理、入库、出库/损耗、开单（待确认）、确认出库。
 * 游客数据仅保存在本机浏览器，不与云端交互；登录后切换到 Supabase 云端。
 */

const NS = 'dada-dashboard:inv'

function load(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(`${NS}:${key}`)) || fallback
  } catch {
    return fallback
  }
}

function save(key, list) {
  try {
    localStorage.setItem(`${NS}:${key}`, JSON.stringify(list))
  } catch {
    /* 存储满等场景静默失败 */
  }
}

function uid() {
  return crypto.randomUUID()
}

function nextNo(list, prefix) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const seq = String(list.length + 1).padStart(4, '0')
  return `${prefix}${day}-${seq}`
}

/* ------------------------------------ 商品 ------------------------------------ */
export function listProducts() {
  return load('products')
}

export function saveProduct(payload, productId = null) {
  const list = load('products')
  if (productId) {
    const idx = list.findIndex((p) => p.id === productId)
    if (idx === -1) throw new Error('商品不存在')
    list[idx] = {
      ...list[idx],
      name: payload.name,
      sku: payload.sku,
      category: payload.category || '未分类',
      specification: payload.specification || null,
      salePrice: payload.salePrice,
      costPrice: payload.costPrice,
      lowStockThreshold: payload.lowStockThreshold ?? 0,
      updatedAt: new Date().toISOString(),
    }
    save('products', list)
    return productId
  }
  const product = {
    id: uid(),
    user_id: null,
    name: payload.name,
    sku: payload.sku,
    category: payload.category || '未分类',
    specification: payload.specification || null,
    salePrice: payload.salePrice,
    costPrice: payload.costPrice,
    stock: payload.stock ?? 0,
    lowStockThreshold: payload.lowStockThreshold ?? 0,
    createdAt: new Date().toISOString(),
  }
  list.unshift(product)
  save('products', list)
  return product.id
}

export function deleteProduct(id) {
  save('products', load('products').filter((p) => p.id !== id))
}

function pushMovement(m) {
  const list = load('movements')
  list.unshift(m)
  save('movements', list.slice(0, 300))
}

/* ------------------------------------ 入库 / 出库 ------------------------------------ */
export function receiveProduct({ productId, quantity, unitCost, supplier, note }) {
  if (!supplier || !String(supplier).trim()) throw new Error('供应商为必填项')
  const list = load('products')
  const idx = list.findIndex((p) => p.id === productId)
  if (idx === -1) throw new Error('商品不存在')
  if (quantity <= 0 || unitCost < 0) throw new Error('入库数量或单价无效')
  const p = list[idx]
  const movement = {
    id: uid(),
    type: 'inbound',
    productId,
    productName: p.name,
    quantity,
    unitCost,
    totalAmount: quantity * unitCost,
    supplier: String(supplier).trim(),
    note: note || null,
    docNo: nextNo(list, 'PO'),
    createdAt: new Date().toISOString(),
  }
  p.stock += quantity
  p.costPrice = unitCost
  p.updatedAt = movement.createdAt
  save('products', list)
  pushMovement(movement)
  return movement.id
}

export function stockOutProduct({ productId, quantity, type, note }) {
  if (!['normal_outbound', 'loss'].includes(type)) throw new Error('出库类型无效')
  const list = load('products')
  const idx = list.findIndex((p) => p.id === productId)
  if (idx === -1) throw new Error('商品不存在')
  const p = list[idx]
  if (p.stock < quantity) throw new Error('库存不足')
  const movement = {
    id: uid(),
    type,
    productId,
    productName: p.name,
    quantity: -quantity,
    unitCost: p.costPrice,
    totalAmount: quantity * p.costPrice,
    supplier: null,
    note: note || null,
    docNo: nextNo(list, 'ST'),
    createdAt: new Date().toISOString(),
  }
  p.stock -= quantity
  p.updatedAt = movement.createdAt
  save('products', list)
  pushMovement(movement)
  return movement.id
}

/* ------------------------------------ 订单 / 开单 ------------------------------------ */
export function listOrders() {
  return load('orders')
}

export function listOrderItems() {
  // 本地订单的明细内嵌在订单里，这里返回拍平结构以对齐云端消费方式
  return load('orders').flatMap((o) =>
    (o.items || []).map((i) => ({ ...i, order_id: o.id })),
  )
}

export function createOrder({ items, paymentMethod, discount, note }) {
  if (!Array.isArray(items) || !items.length) throw new Error('请先添加商品')
  const products = load('products')
  const byId = new Map(products.map((p) => [p.id, p]))
  for (const item of items) {
    const p = byId.get(item.product_id)
    if (!p) throw new Error('商品不存在')
    if (item.quantity <= 0 || item.unit_price < 0) throw new Error('数量或单价无效')
  }
  const orders = load('orders')
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const finalTotal = Math.max(subtotal - discount, 0)
  const orderId = uid()
  const order = {
    id: orderId,
    orderNo: nextNo(orders, 'SO'),
    status: 'pending_confirmation',
    fulfillmentStatus: 'not_fulfilled',
    paymentMethod,
    subtotal,
    discount,
    totalAmount: finalTotal,
    totalCost: 0,
    totalProfit: 0,
    note: note || null,
    createdAt: new Date().toISOString(),
    items: items.map((i) => {
      const p = byId.get(i.product_id)
      return {
        id: uid(),
        productId: i.product_id,
        productName: p.name,
        sku: p.sku,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        lineTotal: i.quantity * i.unit_price,
      }
    }),
  }
  orders.unshift(order)
  save('orders', orders)
  return order.id
}

/** 确认出库：扣库存 + 生成销售流水（本地以商品成本价计成本） */
export function confirmOrder(orderId) {
  const orders = load('orders')
  const idx = orders.findIndex((o) => o.id === orderId)
  if (idx === -1) throw new Error('订单不存在')
  const order = orders[idx]
  if (!['pending_confirmation', 'pending_fulfillment'].includes(order.status)) {
    throw new Error('订单当前状态不可确认出库')
  }
  const products = load('products')
  const byIdObj = new Map(products.map((p) => [p.id, p]))
  for (const item of order.items || []) {
    const p = byIdObj.get(item.productId)
    if (!p) throw new Error(`商品不存在: ${item.productName}`)
    if (p.stock < item.quantity) throw new Error(`库存不足: ${item.productName}`)
  }
  let totalCost = 0
  const movements = []
  for (const item of order.items || []) {
    const p = byIdObj.get(item.productId)
    p.stock -= item.quantity
    const cost = p.costPrice * item.quantity
    totalCost += cost
    movements.push({
      id: uid(),
      type: 'sale',
      productId: p.id,
      productName: p.name,
      quantity: -item.quantity,
      unitCost: p.costPrice,
      unitPrice: item.unitPrice,
      totalAmount: item.lineTotal,
      supplier: null,
      note: '订单确认出库',
      docNo: order.orderNo,
      createdAt: new Date().toISOString(),
    })
  }
  save('products', [...byIdObj.values()])
  order.totalCost = totalCost
  order.totalProfit = order.totalAmount - totalCost
  order.status = 'completed'
  order.fulfillmentStatus = 'fulfilled'
  orders[idx] = order
  save('orders', orders)
  for (const m of movements) pushMovement(m)
}

/* ------------------------------------ 退货 ------------------------------------ */
export function listReturns() {
  return load('returns')
}

/** 销售退货（本地沙箱镜像）：resellable 回库存 / damaged 报损 / pending 待定 */
export function createSaleReturn({ order, items, refundAmount, refundMethod, reason, note }) {
  if (!items.length) throw new Error('请选择退货商品')
  if (!reason || !reason.trim()) throw new Error('请填写退货原因')
  if (refundAmount < 0) throw new Error('退款金额无效')
  const returns = load('returns')
  const products = load('products')
  const byId = new Map(products.map((p) => [p.id, p]))
  const returnItems = []
  for (const item of items) {
    const p = byId.get(item.productId)
    if (!p) throw new Error('商品不存在')
    if (item.quantity <= 0) throw new Error('退货数量无效')
    if (!['resellable', 'damaged', 'pending'].includes(item.condition)) {
      throw new Error('退货处理方式无效')
    }
    returnItems.push({
      id: uid(),
      orderItemId: item.orderItemId ?? null,
      productId: item.productId,
      productName: item.productName ?? p.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice ?? p.salePrice,
      condition: item.condition,
    })
    if (item.condition === 'resellable') {
      p.stock += item.quantity
      pushMovementLocal({
        type: 'inbound',
        productId: p.id,
        productName: p.name,
        quantity: item.quantity,
        unitCost: p.costPrice,
        note: `退货入库 ${reason}`,
        docNo: 'RT',
      })
    } else if (item.condition === 'damaged') {
      pushMovementLocal({
        type: 'loss',
        productId: p.id,
        productName: p.name,
        quantity: -item.quantity,
        unitCost: p.costPrice,
        note: `退货报损 ${reason}`,
        docNo: 'RT',
      })
    }
  }
  save('products', products)
  const ret = {
    id: uid(),
    returnNo: nextNo(returns, 'RT'),
    orderNo: order?.orderNo || null,
    refundAmount,
    refundMethod,
    reason,
    note: note || null,
    items: returnItems,
    createdAt: new Date().toISOString(),
  }
  returns.unshift(ret)
  save('returns', returns)
  return ret.id
}

function pushMovementLocal(m) {
  const list = load('movements')
  list.unshift({
    id: uid(),
    supplier: null,
    docNo: 'RT',
    createdAt: new Date().toISOString(),
    ...m,
  })
  save('movements', list.slice(0, 300))
}

/* ------------------------------------ 流水 ------------------------------------ */
export function listMovements() {
  return load('movements')
}
