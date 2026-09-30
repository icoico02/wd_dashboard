/**
 * 手势识别 —— 从 21 个 Hand Landmark 识别静态手势 + 左右快挥
 * 不依赖分类器训练，纯几何规则，全部本地计算
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

export const FINGER_TIPS = [4, 8, 12, 16, 20]
export const FINGER_PIPS = [3, 6, 10, 14, 18]
export const FINGER_MCPS = [2, 5, 9, 13, 17]

/**
 * 判断手指是否伸直
 * 以 MCP 为基准，指尖距离应明显大于近节指关节距离
 */
function isFingerExtended(lm, mcp, pip, tip) {
  const dTip = dist2d(lm[tip], lm[mcp])
  const dPip = dist2d(lm[pip], lm[mcp])
  return dTip > dPip * 1.12
}

function isThumbExtended(lm) {
  // 拇指指尖应远离食指根部（张开）或靠近掌心轴（收拢）
  const dTipWrist = dist2d(lm[4], lm[0])
  const dIpWrist = dist2d(lm[3], lm[0])
  const dTipIndexMcp = dist2d(lm[4], lm[5])
  const dIpIndexMcp = dist2d(lm[3], lm[5])
  // 张开：指尖比 IP 更远；收拢：指尖靠近食指 MCP
  const spread = dTipWrist > dIpWrist * 1.05 && dTipIndexMcp > dIpIndexMcp * 1.02
  return spread
}

/**
 * 静态手势
 * @returns {'open_palm'|'fist'|'pinch'|'point'|'unknown'}
 */
export function detectHandShape(landmarks, options = {}) {
  if (!landmarks || landmarks.length < 21) return 'unknown'

  const pinchThreshold = options.pinchThreshold ?? 0.07

  // 捏合优先：拇指尖 4 + 食指指尖 8
  const pinchDist = dist2d(landmarks[4], landmarks[8])
  if (pinchDist < pinchThreshold) {
    return 'pinch'
  }

  const indexExt = isFingerExtended(landmarks, 5, 6, 8)
  const middleExt = isFingerExtended(landmarks, 9, 10, 12)
  const ringExt = isFingerExtended(landmarks, 13, 14, 16)
  const pinkyExt = isFingerExtended(landmarks, 17, 18, 20)
  const thumbExt = isThumbExtended(landmarks)

  const extendedCount = [indexExt, middleExt, ringExt, pinkyExt].filter(Boolean).length

  // ✋ 张开手掌：四指伸直（拇指可略收）
  if (extendedCount >= 3 && indexExt && middleExt) {
    return 'open_palm'
  }

  // ✊ 握拳：四指弯曲
  if (extendedCount <= 1 && !indexExt && !middleExt) {
    return 'fist'
  }

  // 👆 单指点选（可选识别）
  if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    return 'point'
  }

  if (thumbExt && extendedCount === 0) return 'fist'

  return 'unknown'
}

/**
 * 左右快挥：基于水平速度 + 位移一致性
 * @returns {'left'|'right'|null}
 */
export function detectSwipe(
  velocity,
  options = {},
) {
  const swipeThreshold = options.swipeThreshold ?? 0.14 // 归一化单位/秒
  const vx = velocity?.x ?? 0
  const vy = velocity?.y ?? 0

  // 水平分量需显著，且主导方向
  if (Math.abs(vx) < swipeThreshold) return null
  if (Math.abs(vx) < Math.abs(vy) * 1.35) return null

  // 前置摄像头镜像后：x 减小 = 用户视角向左
  return vx < 0 ? 'left' : 'right'
}

/**
 * 上下移动方向（用于状态显示）
 * @returns {'up'|'down'|null}
 */
export function detectVerticalMove(velocityY, movementThreshold = 0.012) {
  if (Math.abs(velocityY) < movementThreshold * 30) return null
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
  open_palm: '✋ 张开手',
  fist: '✊ 暂停',
  pinch: '🤏 捏合',
  point: '👆 指点',
  unknown: '…',
}

export const STATE_LABELS = {
  IDLE: '待机',
  ACTIVE: '就绪',
  SCROLLING: '滚动中',
  COOLDOWN: '冷却',
  PAUSED: '已暂停',
}
