<template>
  <div class="gcp-wrap glass-subtle" aria-label="摄像头预览">
    <div class="gcp-frame">
      <video
        ref="videoRef"
        class="gcp-video"
        playsinline
        muted
        autoplay
      ></video>
      <canvas ref="canvasRef" class="gcp-canvas"></canvas>
    </div>
    <div class="gcp-caption">
      <span class="status" :class="hasHand ? 'online' : 'offline'">
        <span class="dot"></span>
        {{ hasHand ? '已检测到手' : '未检测到手' }}
      </span>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { HAND_CONNECTIONS } from '../../utils/gestureDetector'

const props = defineProps({
  stream: { type: [Object, null], default: null },
  landmarks: { type: [Array, null], default: null },
  palm: { type: [Object, null], default: null },
  hasHand: { type: Boolean, default: false },
  mirrored: { type: Boolean, default: true },
})

const videoRef = ref(null)
const canvasRef = ref(null)
let raf = 0
let alive = true

function bindStream() {
  const v = videoRef.value
  if (!v) return
  if (props.stream && v.srcObject !== props.stream) {
    v.srcObject = props.stream
    v.play().catch(() => {})
  }
}

function draw() {
  if (!alive) return
  raf = requestAnimationFrame(draw)
  const canvas = canvasRef.value
  const video = videoRef.value
  if (!canvas || !video) return

  const w = video.clientWidth || canvas.clientWidth || 280
  const h = video.clientHeight || canvas.clientHeight || 180
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)

  const lm = props.landmarks
  if (!lm || lm.length < 21) return

  // landmarks 已在逻辑层做过镜像修正（手向左 = x 减小），
  // 与 CSS scaleX(-1) 的自拍预览同一坐标系，直接映射即可
  const mapX = (x) => x * w
  const mapY = (y) => y * h

  // 骨架
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(80, 180, 255, 0.9)'
  ctx.lineCap = 'round'
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = lm[a]
    const pb = lm[b]
    if (!pa || !pb) continue
    ctx.beginPath()
    ctx.moveTo(mapX(pa.x), mapY(pa.y))
    ctx.lineTo(mapX(pb.x), mapY(pb.y))
    ctx.stroke()
  }

  // 关键点（食指指尖 8 高亮 —— 虚拟指针）
  for (let i = 0; i < lm.length; i++) {
    const p = lm[i]
    const isIndexTip = i === 8
    const isThumbTip = i === 4
    const r = isIndexTip ? 6 : isThumbTip ? 4.5 : 3
    ctx.beginPath()
    if (isIndexTip) {
      ctx.fillStyle = 'rgba(10, 132, 255, 1)'
    } else if (isThumbTip) {
      ctx.fillStyle = 'rgba(255, 210, 80, 0.95)'
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
    }
    ctx.arc(mapX(p.x), mapY(p.y), r, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(20, 40, 70, 0.35)'
    ctx.stroke()
    if (isIndexTip) {
      ctx.beginPath()
      ctx.strokeStyle = 'rgba(10, 132, 255, 0.55)'
      ctx.lineWidth = 2
      ctx.arc(mapX(p.x), mapY(p.y), 11, 0, Math.PI * 2)
      ctx.stroke()
    }
  }

  // Palm Center
  if (props.palm) {
    const px = mapX(props.palm.x)
    const py = mapY(props.palm.y)
    ctx.beginPath()
    ctx.fillStyle = 'rgba(52, 199, 89, 0.95)'
    ctx.arc(px, py, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.stroke()
  }
}

watch(
  () => props.stream,
  () => bindStream(),
  { immediate: true },
)

onMounted(() => {
  bindStream()
  draw()
})

onBeforeUnmount(() => {
  alive = false
  if (raf) cancelAnimationFrame(raf)
  const v = videoRef.value
  if (v) {
    try {
      v.srcObject = null
    } catch {
      /* ignore */
    }
  }
})
</script>

<style scoped>
.gcp-wrap {
  border-radius: var(--radius-md);
  overflow: hidden;
  padding: 6px;
}

.gcp-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(12, 16, 28, 0.35);
}

.gcp-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* 自拍镜像，与计算方向一致 */
  transform: scaleX(-1);
  display: block;
}

.gcp-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.gcp-caption {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 4px 2px;
}
</style>
