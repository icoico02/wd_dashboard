/**
 * 手势坐标平滑 / 速度 / 死区
 * —— Palm Center 历史窗口 + EMA + 滚动速度平滑
 */

export function dist2d(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** 多点平均得到 Palm Center（归一化坐标） */
export function computePalmCenter(landmarks, indices = [0, 5, 9, 13, 17]) {
  let sx = 0
  let sy = 0
  for (const i of indices) {
    const p = landmarks[i]
    if (!p) continue
    sx += p.x
    sy += p.y
  }
  const n = indices.length
  return { x: sx / n, y: sy / n }
}

/**
 * 坐标追踪器：Moving Average + EMA + 速度
 * 用于过滤手抖、计算移动方向/距离/速度
 */
export function createPalmTracker(options = {}) {
  const historySize = options.historySize ?? 7
  const emaAlpha = options.emaAlpha ?? 0.35

  /** @type {{x:number,y:number,t:number}[]} */
  let history = []
  let ema = null
  let prevEma = null
  let velocity = { x: 0, y: 0 } // 归一化单位 / 秒
  let lastTs = 0

  function reset() {
    history = []
    ema = null
    prevEma = null
    velocity = { x: 0, y: 0 }
    lastTs = 0
  }

  /**
   * @param {number} x 归一化
   * @param {number} y 归一化
   * @param {number} ts 毫秒时间戳
   */
  function update(x, y, ts) {
    history.push({ x, y, t: ts })
    if (history.length > historySize) history.shift()

    // Moving Average
    let mx = 0
    let my = 0
    for (const h of history) {
      mx += h.x
      my += h.y
    }
    mx /= history.length
    my /= history.length

    // EMA
    prevEma = ema ? { ...ema } : null
    if (!ema) ema = { x: mx, y: my }
    else {
      ema = {
        x: ema.x + emaAlpha * (mx - ema.x),
        y: ema.y + emaAlpha * (my - ema.y),
      }
    }

    // 速度（基于 EMA，归一化单位/秒）
    if (lastTs && ts > lastTs && prevEma) {
      const dt = Math.max((ts - lastTs) / 1000, 1 / 120)
      const instVx = (ema.x - prevEma.x) / dt
      const instVy = (ema.y - prevEma.y) / dt
      // 轻量一阶平滑，避免速度尖刺
      velocity = {
        x: velocity.x * 0.55 + instVx * 0.45,
        y: velocity.y * 0.55 + instVy * 0.45,
      }
    }
    lastTs = ts

    return {
      x: ema.x,
      y: ema.y,
      movingAvg: { x: mx, y: my },
      velocity: { ...velocity },
    }
  }

  function get() {
    return {
      position: ema ? { ...ema } : null,
      velocity: { ...velocity },
      samples: history.length,
    }
  }

  return { update, reset, get }
}

/** 是否落在死区（微小手抖忽略） */
export function isDeadZone(delta, threshold) {
  return Math.abs(delta) < threshold
}

/**
 * 滚动速度平滑器：target → current 一阶逼近，手停自然减速
 */
export function createVelocitySmoother(options = {}) {
  const smoothFactor = options.smoothFactor ?? 0.15
  const maxVelocity = options.maxVelocity ?? 48
  let current = 0
  let target = 0

  function setTarget(v) {
    target = v
  }

  function setTargetFromPalmDelta(deltaY, opts = {}) {
    const deadZone = opts.deadZone ?? 0.004
    const multiplier = opts.multiplier ?? 1
    const gain = opts.gain ?? 1200
    if (Math.abs(deltaY) < deadZone) {
      target = 0
      return 0
    }
    // 手向上（deltaY < 0）→ 页面向下滚（正方向 scrollBy）
    // 用帧间位移 × gain 映射为 px/s，再乘灵敏度
    const v = -deltaY * gain * multiplier
    target = clamp(v, -maxVelocity, maxVelocity)
    return target
  }

  function tick(dtScale = 1) {
    // current += (target - current) * 0.15
    // dtScale 兼容不同帧率：60fps 约 1，30fps 约 2
    const k = 1 - Math.pow(1 - smoothFactor, Math.max(dtScale, 0.25))
    current += (target - current) * k
    if (Math.abs(current) < 0.05 && Math.abs(target) < 0.05) current = 0
    return current
  }

  function reset() {
    current = 0
    target = 0
  }

  return {
    setTarget,
    setTargetFromPalmDelta,
    tick,
    reset,
    get current() {
      return current
    },
    get target() {
      return target
    },
  }
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

/**
 * 灵敏度档位 → 阈值表
 * 控制 deadZone / movementThreshold / swipeThreshold / velocityMultiplier / pinchThreshold
 */
export const SENSITIVITY_PRESETS = {
  low: {
    deadZone: 0.012,
    movementThreshold: 0.018,
    swipeThreshold: 1.05,
    velocityMultiplier: 0.55,
    pinchThreshold: 0.05,
    swipeCooldownMs: 800,
    handLostMs: 400,
    minConfidence: 0.55,
    velocityDeadZone: 0.32,
  },
  medium: {
    deadZone: 0.008,
    movementThreshold: 0.012,
    swipeThreshold: 0.8,
    velocityMultiplier: 1.0,
    pinchThreshold: 0.07,
    swipeCooldownMs: 650,
    handLostMs: 320,
    minConfidence: 0.45,
    velocityDeadZone: 0.22,
  },
  high: {
    deadZone: 0.005,
    movementThreshold: 0.008,
    swipeThreshold: 0.55,
    velocityMultiplier: 1.55,
    pinchThreshold: 0.09,
    swipeCooldownMs: 500,
    handLostMs: 250,
    minConfidence: 0.35,
    velocityDeadZone: 0.15,
  },
}

export function resolveSensitivity(level) {
  return { ...(SENSITIVITY_PRESETS[level] || SENSITIVITY_PRESETS.medium) }
}
