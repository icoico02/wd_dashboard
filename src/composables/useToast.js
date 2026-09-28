import { ref } from 'vue'

/**
 * 轻量玻璃 Toast：模块级单例，任何组件调用 showToast 全局弹出。
 * 支持 action（如计时记录保存失败后的「重试」）。
 */
const visible = ref(false)
const message = ref('')
const actionLabel = ref('')
let actionCallback = null
let hideTimer = null

export function useToast() {
  function showToast(text, options = {}) {
    message.value = text
    actionLabel.value = options.actionLabel || ''
    actionCallback = options.onAction || null
    visible.value = true

    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      visible.value = false
      actionCallback = null
    }, options.duration || 2800)
  }

  function runAction() {
    clearTimeout(hideTimer)
    visible.value = false
    const cb = actionCallback
    actionCallback = null
    cb?.()
  }

  return { visible, message, actionLabel, showToast, runAction }
}
