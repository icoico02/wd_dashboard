/**
 * useHandTracking —— 摄像头 + MediaPipe Hand Landmarker 生命周期
 *
 * 职责：getUserMedia / HandLandmarker 初始化 / 推理循环 / FPS / 资源释放
 * 全部本地推理，不上传视频。
 */

import { ref, shallowRef } from 'vue'
import { computePalmCenter, createPalmTracker } from '../utils/gestureSmoothing'
import {
  PALM_INDICES,
  INDEX_TIP,
  normalizeLandmarks,
  readHandConfidence,
  readHandedness,
} from '../utils/gestureDetector'

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

/** 推理目标 FPS（按设备性能自适应） */
const TARGET_FPS = 24

// 模块级单例：避免多实例重复开摄像头 / 重复加载 wasm
let handLandmarker = null
let loadingPromise = null

async function ensureHandLandmarker() {
  if (handLandmarker) return handLandmarker
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE)
    const landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    handLandmarker = landmarker
    return landmarker
  })()

  try {
    return await loadingPromise
  } catch (err) {
    loadingPromise = null
    throw err
  }
}

export function isHandTrackingSupported() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

/**
 * @returns tracking 状态与 start/stop
 */
export function useHandTracking() {
  const status = ref('idle') // idle | loading | running | error | denied
  const errorMessage = ref('')
  const stream = shallowRef(null)
  const videoEl = shallowRef(null)

  const landmarks = shallowRef(null) // 当前帧 21 点（已镜像修正）
  const rawLandmarks = shallowRef(null)
  const handedness = ref('')
  const confidence = ref(0)
  const palm = shallowRef(null) // {x,y}
  const palmVelocity = shallowRef({ x: 0, y: 0 })
  const indexTip = shallowRef(null) // 食指指尖 {x,y} —— 虚拟指针控制点
  const indexVelocity = shallowRef({ x: 0, y: 0 })
  const hasHand = ref(false)

  const fps = ref(0)
  const inferenceMs = ref(0)

  let rafId = 0
  let running = false
  let inferring = false
  let videoReady = false
  let lastVideoTime = -1
  let frameCount = 0
  let fpsWindowStart = 0
  let mirrored = true
  let destroyed = false

  const tracker = createPalmTracker({ historySize: 7, emaAlpha: 0.35 })
  const indexTracker = createPalmTracker({ historySize: 6, emaAlpha: 0.4 })

  function resetFrameState() {
    landmarks.value = null
    rawLandmarks.value = null
    palm.value = null
    palmVelocity.value = { x: 0, y: 0 }
    indexTip.value = null
    indexVelocity.value = { x: 0, y: 0 }
    hasHand.value = false
    confidence.value = 0
    handedness.value = ''
    tracker.reset()
    indexTracker.reset()
  }

  function stopTracks() {
    const s = stream.value
    if (s) {
      try {
        for (const track of s.getTracks()) {
          track.stop()
        }
      } catch {
        /* ignore */
      }
    }
    stream.value = null
    const v = videoEl.value
    if (v) {
      try {
        v.pause()
        v.srcObject = null
      } catch {
        /* ignore */
      }
    }
    videoReady = false
    lastVideoTime = -1
  }

  function cancelLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
  }

  function createVideoElement() {
    const v = document.createElement('video')
    v.setAttribute('playsinline', '')
    v.setAttribute('webkit-playsinline', '')
    v.muted = true
    v.playsInline = true
    v.autoplay = true
    v.style.position = 'fixed'
    v.style.width = '1px'
    v.style.height = '1px'
    v.style.opacity = '0'
    v.style.pointerEvents = 'none'
    v.style.left = '-9999px'
    v.style.top = '0'
    document.body.appendChild(v)
    return v
  }

  function removeVideoElement() {
    const v = videoEl.value
    if (v && v.parentNode) {
      try {
        v.pause()
        v.srcObject = null
      } catch {
        /* ignore */
      }
      v.parentNode.removeChild(v)
    }
    videoEl.value = null
  }

  async function start() {
    // 允许 OFF→ON 再次启动
    destroyed = false
    if (status.value === 'loading' || status.value === 'running') return

    status.value = 'loading'
    errorMessage.value = ''

    if (!isHandTrackingSupported()) {
      status.value = 'error'
      errorMessage.value = '当前浏览器不支持摄像头手势控制'
      return
    }

    let media
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
      })
    } catch (err) {
      const name = err?.name || ''
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        status.value = 'denied'
        errorMessage.value = '需要摄像头权限才能使用手势控制'
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        status.value = 'error'
        errorMessage.value = '未找到可用摄像头'
      } else {
        status.value = 'error'
        errorMessage.value = '无法打开摄像头，请检查系统权限'
      }
      return
    }

    stream.value = media

    // 前置摄像头：镜像显示 + 镜像计算，保证「手向左 = 向左」
    mirrored = true

    const video = videoEl.value || createVideoElement()
    videoEl.value = video
    video.srcObject = media

    try {
      await video.play()
    } catch {
      /* autoplay 策略差异，muted + playsinline 一般可播 */
    }

    videoReady = true

    try {
      await ensureHandLandmarker()
    } catch (err) {
      console.error('[gesture] MediaPipe 初始化失败', err)
      status.value = 'error'
      errorMessage.value = 'MediaPipe 加载失败，请检查网络后重试'
      stopTracks()
      removeVideoElement()
      resetFrameState()
      return
    }

    if (destroyed) {
      stopTracks()
      removeVideoElement()
      return
    }

    status.value = 'running'
    running = true
    frameCount = 0
    fpsWindowStart = performance.now()
    resetFrameState()
    loop()
  }

  function stop() {
    running = false
    cancelLoop()
    inferring = false
    stopTracks()
    removeVideoElement()
    resetFrameState()
    fps.value = 0
    inferenceMs.value = 0
    if (status.value !== 'error' && status.value !== 'denied') {
      status.value = 'idle'
    } else {
      status.value = 'idle'
      errorMessage.value = ''
    }
  }

  function loop() {
    if (!running || destroyed) return
    rafId = requestAnimationFrame(loop)

    const video = videoEl.value
    const landmarker = handLandmarker
    if (!video || !landmarker) return
    if (!videoReady || video.readyState < 2) return

    // 推理与采集解耦：上一帧未完成则跳过，避免堆积
    if (inferring) return

    const now = performance.now()
    // 目标帧率限频
    const minInterval = 1000 / TARGET_FPS
    if (loop._lastTick && now - loop._lastTick < minInterval) return
    loop._lastTick = now

    const videoTime = video.currentTime
    // 同一视频帧不重复推理
    if (videoTime === lastVideoTime) return
    lastVideoTime = videoTime

    inferring = true
    const t0 = performance.now()
    let result
    try {
      result = landmarker.detectForVideo(video, now)
    } catch (err) {
      inferring = false
      console.error('[gesture] 推理失败', err)
      return
    }
    const t1 = performance.now()
    inferenceMs.value = Math.round((t1 - t0) * 10) / 10
    inferring = false

    // FPS 统计
    frameCount++
    if (now - fpsWindowStart >= 500) {
      fps.value = Math.round((frameCount * 1000) / (now - fpsWindowStart))
      frameCount = 0
      fpsWindowStart = now
    }

    const hands = result?.landmarks
    if (!hands || !hands.length) {
      hasHand.value = false
      landmarks.value = null
      palm.value = null
      confidence.value = 0
      return
    }

    const raw = hands[0]
    const lm = normalizeLandmarks(raw, mirrored)
    const palmCenter = computePalmCenter(lm, PALM_INDICES)
    const smoothed = tracker.update(palmCenter.x, palmCenter.y, now)

    // 食指指尖 —— 虚拟鼠标控制点
    const tip = lm[INDEX_TIP]
    const tipSmooth = tip ? indexTracker.update(tip.x, tip.y, now) : null

    rawLandmarks.value = raw
    landmarks.value = lm
    palm.value = { x: smoothed.x, y: smoothed.y }
    palmVelocity.value = smoothed.velocity
    indexTip.value = tipSmooth ? { x: tipSmooth.x, y: tipSmooth.y } : tip ? { x: tip.x, y: tip.y } : null
    indexVelocity.value = tipSmooth ? tipSmooth.velocity : { x: 0, y: 0 }
    hasHand.value = true
    confidence.value = readHandConfidence(result)
    handedness.value = readHandedness(result)
  }

  /** 页面卸载 / 组件销毁时的彻底清理入口 */
  function destroy() {
    destroyed = true
    stop()
  }

  return {
    status,
    errorMessage,
    stream,
    videoEl,
    landmarks,
    rawLandmarks,
    handedness,
    confidence,
    palm,
    palmVelocity,
    indexTip,
    indexVelocity,
    hasHand,
    fps,
    inferenceMs,
    start,
    stop,
    destroy,
    get isRunning() {
      return running
    },
    get mirrored() {
      return mirrored
    },
  }
}
