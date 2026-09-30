/**
 * 手势识别 —— 从 21 个 Hand Landmark 识别静态手势 + 左右快挥
 * 不依赖分类器训练，纯几何规则，全部本地计算
 *
 * v2：更稳的伸指判定 + 自适应捏合阈值；食指为控制点
 */

import { dist2d } from './gestureSmoothing'

/** MediaPipe Hand 关键点连接（骨架绘制） */
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

/** 用于 Palm Center 的 landmark 索引 */
export const PALM_INDICES = [0, 5, 9, 13, 17]

/** 控制点：食指指尖 */
export const INDEX_TIP = 8
export const THUMB_TIP = 4
export const WRIST = 0
export const MIDDLE_MCP = 9

export const FINGER_TIPS = [4, 8, 12, 16, 20]
export const FINGER_PIPS = [3, 6, 10, 14, 18]
export const FINGER_MCPS = [2, 5, 9, 13, 17]

/** 手部尺度（腕 → 中指根），用于自适应阈值 */
export function handScale(lm) {
  return Math.max(dist2d(lm[0], lm[9]), 0.05)
}

/**
 * 手指是否伸直 —— 双条件投票，比单一距离更稳
 * 1) 指尖-腕 距离 > 指关节-腕 距离
 * 2) 指尖-根节 距离 明显大于 中节-根节 距离
 */
function isFingerExtended(lm, mcp, pip, tip) {
  const wrist = lm[0]
  const dTipWrist = dist2d(lm[tip], wrist)
  const dPipWrist = dist2d(lm[pip], wrist)
  const dTipMcp = dist2d(lm[tip], lm[mcp])
  const dPipMcp = dist2d(lm[pip], lm[mcp])

  const byWrist = dTipWrist > dPipWrist * 1.08
  const byMcp = dTipMcp > dPipMcp * 1.05
  // 至少一条成立，且指尖没有明显贴近掌心
  return (byWrist || byMcp) && dTipWrist > dPipWrist * 0.9
}

function isThumbExtended(lm) {
  const scale = handScale(lm)
  // 拇指尖相对食指根的张开距离
  const spread = dist2d(lm[4], lm[5])
  return spread > scale * 0.72
}

/** 捏合距离（拇指尖 4 ↔ 食指尖 8） */
export function pinchDistance(lm) {
  return dist2d(lm[4], lm[8])
}

/** 自适应捏合阈值（按手部尺度缩放） */
export function adaptivePinchThreshold(lm, base = 0.07) {
  const scale = handScale(lm)
  // scale 约 0.15~0.35；base=0.07 对应中等手
  return Math.max(base * 0.65, Math.min(base * 1.45, scale * 0.38 * (base / 0.07)))
}

/**
 * 静态手势 —— 优先级：捏合 > 张开手掌 > 握拳 > 指点
 * @returns {'open_palm'|'fist'|'pinch'|'point'|'unknown'}
 */
export function detectHandShape(landmarks, options = {}) {
  if (!landmarks || landmarks.length < 21) return 'unknown'

  const basePinch = options.pinchThreshold ?? 0.07
  const thr = adaptivePinchThreshold(landmarks, basePinch)

  // 🤏 捏合优先：拇指尖 4 + 食指指尖 8
  if (pinchDistance(landmarks) < thr) {
    return 'pinch'
  }

  const indexExt = isFingerExtended(landmarks, 5, 6, 8)
  const middleExt = isFingerExtended(landmarks, 9, 10, 12)
  const ringExt = isFingerExtended(landmarks, 13, 14, 16)
  const pinkyExt = isFingerExtended(landmarks, 17, 18, 20)

  const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length

  // ✋ 张开手掌：至少 3 指伸直（含食指+中指）
  if (extendedCount >= 3 && indexExt && middleExt) {
    return 'open_palm'
  }

  // ✊ 握拳：食指+中指都弯，且伸直指 ≤ 1
  if (extendedCount <= 1 && !indexExt && !middleExt) {
    return 'fist'
  }

  // 👆 单指点选：仅食指伸直（中/无名/小指弯曲）
  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    return 'point'
  }

  // 食指+中指（剪刀手）也当作 point 变体，便于控制
  if (indexExt && middleExt && !ringExt && !pinkyExt && extendedCount === 2) {
    return 'point'
  }

  return 'unknown'
}

/**
 * 左右快挥：基于水平速度 + 位移一致性
 * @returns {'left'|'right'|null}
 */
export function detectSwipe(velocity, options = {}) {
  const swipeThreshold = options.swipeThreshold ?? 0.8
  const vx = velocity?.x ?? 0
  const vy = velocity?.y ?? 0

  if (Math.abs(vx) < swipeThreshold) return null
  if (Math.abs(vx) < Math.abs(vy) * 1.25) return null

  // 前置摄像头镜像后：x 减小 = 用户视角向左
  return vx < 0 ? 'left' : 'right'
}

/**
 * 上下移动方向（用于状态显示）
 * @returns {'up'|'down'|null}
 */
export function detectVerticalMove(velocityY, movementThreshold = 0.25) {
  if (Math.abs(velocityY) < movementThreshold) return null
  return velocityY < 0 ? 'up' : 'down'
}

/**
 * 归一化 landmark，应用前置摄像头镜像
 * 保证「手向左 → 系统认为向左」
 */
export function normalizeLandmarks(landmarks, mirrored = true) {
  if (!mirrored) return landmarks.map((p) => ({ ...p }))
  return landmarks.map((p) => ({ ...p, x: 1 - p.x }))
}

/** 取手部置信度（handedness 分类 score） */
export function readHandConfidence(result) {
  const h = result?.handedness?.[0]?.[0]
  return typeof h?.score === 'number' ? h.score : 1
}

/** 取手部左右标签 */
export function readHandedness(result) {
  return result?.handedness?.[0]?.[0]?.categoryName || result?.handedness?.[0]?.[0]?.displayName || ''
}

export const GESTURE_LABELS = {
  none: '—',
  open_palm: '✋ 张开手 · 滚动',
  fist: '✊ 暂停',
  pinch: '🤏 捏合 · 点击',
  point: '👆 食指 · 指针',
  unknown: '…',
}

export const STATE_LABELS = {
  IDLE: '待机',
  ACTIVE: '就绪',
  SCROLLING: '滚动中',
  COOLDOWN: '冷却',
  PAUSED: '已暂停',
}
