/**
 * 进销存云端数据层（登录后使用）
 *
 * 数据隔离：全部通过 Supabase RLS 实现——线上策略按
 * inventory_current_organization_id()（用户所属店铺）+ 组织角色控制读写，
 * 每个用户首次进入时自动创建自己的店铺并成为该组织的 super_admin，
 * 因此普通用户之间数据完全独立；super_admin 保留平台既有管理能力。
 *
 * 写操作走线上 RPC（security definer，内部校验组织与角色），不做直接前端绕过。
 */
import { supabase } from './supabase'

function assert(data, error) {
  if (error) throw new Error(error.message)
  return data
}

export async function getOrgId() {
  const { data, error } = await supabase.rpc('inventory_current_organization_id')
  if (error) throw new Error(error.message)
  return data || null
}

export async function createOrganization(name) {
  const { data, error } = await supabase.rpc('inventory_create_organization', { p_name: name })
  if (error) throw new Error(error.message)
  return data
}

export async function listProducts() {
  const { data, error } = await supabase
    .from('inventory_products')
    .select('*')
    .order('created_at', { ascending: false })
  return assert(data, error) || []
}

/** 退货记录列表（需执行 supabase/inventory_returns_visibility_fix.sql 后可见） */
export async function listReturns() {
  const { data, error } = await supabase
    .from('inventory_returns')
    .select('*, inventory_return_items(*)')
    .order('created_at', { ascending: false })
    .limit(100)
  return assert(data, error) || []
}

/** 销售退货：按订单退回商品（resellable / damaged / pending），服务端校验数量与退款上限 */
export async function createSaleReturn({ orderId, items, refundAmount, refundMethod, reason, note }) {
  const { data, error } = await supabase.rpc('inventory_create_sale_return', {
    p_order_id: orderId,
    p_items: items,
    p_refund_amount: refundAmount,
    p_refund_method: refundMethod,
    p_reason: reason,
    p_note: note || null,
  })
  if (error) throw new Error(error.message)
  return data
}

/** 新增 / 编辑商品（编辑不改库存，库存走入库/出库/调整） */
export async function saveProduct(payload, productId = null) {
  const { data, error } = await supabase.rpc('inventory_save_product', {
    p_product_id: productId,
    p_name: payload.name,
    p_sku: payload.sku,
    p_category: payload.category || '未分类',
    p_image_url: null,
    p_specification: payload.specification || null,
    p_sale_price: payload.salePrice,
    p_cost_price: payload.costPrice,
    p_stock: payload.stock ?? 0,
    p_low_stock_threshold: payload.lowStockThreshold ?? 0,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('inventory_products').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** 入库（供应商必填，采购成本仅 super_admin/admin 可写——由 RPC 内部校验） */
export async function receiveProduct({ productId, quantity, unitCost, supplier, note }) {
  const { data, error } = await supabase.rpc('inventory_receive', {
    p_product_id: productId,
    p_quantity: quantity,
    p_unit_cost: unitCost,
    p_supplier: supplier,
    p_note: note || null,
  })
  if (error) throw new Error(error.message)
  return data
}

/** 出库 / 损耗 */
export async function stockOutProduct({ productId, quantity, type, note }) {
  const { data, error } = await supabase.rpc('inventory_stock_out', {
    p_product_id: productId,
    p_quantity: quantity,
    p_type: type,
    p_note: note || null,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function listOrders() {
  const { data, error } = await supabase
    .from('inventory_orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  return assert(data, error) || []
}

export async function listOrderItems(orderIds) {
  if (!orderIds.length) return []
  const { data, error } = await supabase
    .from('inventory_order_items')
    .select('*')
    .in('order_id', orderIds)
  return assert(data, error) || []
}

export async function listMovements() {
  const { data, error } = await supabase
    .from('inventory_movements')
    .select('*, inventory_products(name)')
    .order('created_at', { ascending: false })
    .limit(200)
  return assert(data, error) || []
}

/** 快速开单：创建订单（订单进入待确认，确认出库时按批次 FIFO 扣减库存） */
export async function createOrder({ items, paymentMethod, discount, note }) {
  const { data, error } = await supabase.rpc('inventory_create_order', {
    p_items: items,
    p_customer: {},
    p_payment_method: paymentMethod,
    p_initial_received: 0,
    p_discount: discount,
    p_freight: 0,
    p_shipping_method: 'pickup',
    p_customer_note: null,
    p_internal_note: note || null,
  })
  if (error) throw new Error(error.message)
  return data
}

/** 确认出库：批次 FIFO 自动分配、扣库存、算实际成本与利润 */
export async function confirmOrder(orderId) {
  const { error } = await supabase.rpc('inventory_confirm_order_fulfillment', {
    p_order_id: orderId,
  })
  if (error) throw new Error(error.message)
}
