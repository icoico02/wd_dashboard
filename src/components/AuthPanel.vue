<template>
  <div class="auth-wrap">
    <div class="auth-card glass">
      <span class="auth-eyebrow">Wstudio Workspace</span>
      <h2 class="auth-title">{{ mode === 'status' ? '查询审批状态' : mode === 'register' ? '创建账号' : '登录' }}</h2>
      <p class="auth-desc">{{ mode === 'status' ? '输入用户名查看注册申请的审批进度' : '登录后即可使用打卡与计时功能' }}</p>

      <form v-if="mode === 'status'" class="auth-form" @submit.prevent="onCheckStatus">
        <label class="field">
          <span class="field-label">用户名</span>
          <input v-model="statusUsername" type="text" autocomplete="username" placeholder="请输入用户名" />
        </label>

        <p v-if="error" class="auth-error" role="alert">{{ error }}</p>

        <div v-if="statusResult" class="status-result glass-subtle">
          <strong :class="`status-badge status-${statusResult.status}`">
            {{ statusResult.status === 'pending' ? '待审批' : statusResult.status === 'approved' ? '已通过' : '已拒绝' }}
          </strong>
          <p>{{ statusText }}</p>
          <p v-if="statusResult.status === 'rejected' && statusResult.reason">拒绝原因：{{ statusResult.reason }}</p>
        </div>

        <button class="auth-submit" type="submit" :disabled="statusLoading">
          {{ statusLoading ? '查询中…' : '查询状态' }}
        </button>
        <button class="auth-link" type="button" @click="switchMode('login')">← 返回登录</button>
      </form>

      <form v-else class="auth-form" @submit.prevent="onSubmit">
        <label class="field">
          <span class="field-label">账号</span>
          <input v-model="form.username" type="text" autocomplete="username" placeholder="请输入账号" />
        </label>
        <label class="field">
          <span class="field-label">密码</span>
          <input v-model="form.password" type="password" autocomplete="current-password" placeholder="请输入密码" />
        </label>
        <label v-if="mode === 'register'" class="field">
          <span class="field-label">确认密码</span>
          <input v-model="form.confirmation" type="password" autocomplete="new-password" placeholder="请再次输入密码" />
        </label>

        <button v-if="mode === 'login'" type="button" class="remember-row" :aria-pressed="remember" @click="remember = !remember">
          <span class="ios-switch mini" :aria-checked="remember" role="switch" aria-label="记住此设备"></span>
          <span class="remember-text">记住此设备</span>
        </button>

        <p v-if="error || gateMessage" class="auth-error" role="alert">{{ error || gateMessage }}</p>

        <button class="auth-submit" type="submit" :disabled="submitting">
          {{ submitting ? '处理中…' : mode === 'login' ? '登录' : '注册' }}
        </button>
      </form>

      <div v-if="mode !== 'status'" class="auth-footer">
        <button class="auth-link" type="button" @click="switchMode(mode === 'login' ? 'register' : 'login')">
          {{ mode === 'login' ? '还没有账号？注册' : '已有账号？返回登录' }}
        </button>
        <button v-if="mode === 'login'" class="auth-link muted" type="button" @click="switchMode('status')">
          查询审批状态
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const { signIn, signUp, checkApprovalStatus, gateMessage } = useAuth()

const mode = ref('login')
const form = ref({ username: '', password: '', confirmation: '' })
const remember = ref(true)
const error = ref('')
const submitting = ref(false)

const statusUsername = ref('')
const statusResult = ref(null)
const statusLoading = ref(false)

const statusText = computed(() => {
  if (!statusResult.value) return ''
  if (statusResult.value.status === 'pending') return '您的账号正在等待管理员审批，通过后即可登录。'
  if (statusResult.value.status === 'approved') return '您的账号已通过审批，可以登录系统。'
  return '该账号暂未通过审批。'
})

function switchMode(next) {
  mode.value = next
  error.value = ''
  statusResult.value = null
  statusUsername.value = ''
}

async function onSubmit() {
  error.value = ''
  submitting.value = true
  try {
    if (mode.value === 'login') {
      const msg = await signIn(form.value.username.trim(), form.value.password, remember.value)
      if (msg) error.value = msg
      else form.value.password = ''
    } else {
      const msg = await signUp(form.value.username.trim(), form.value.password, form.value.confirmation)
      if (msg) {
        error.value = msg
      } else {
        form.value = { username: '', password: '', confirmation: '' }
        mode.value = 'login'
        error.value = '注册申请已提交，请等待管理员审批。'
      }
    }
  } finally {
    submitting.value = false
  }
}

async function onCheckStatus() {
  error.value = ''
  statusResult.value = null
  statusLoading.value = true
  try {
    const result = await checkApprovalStatus(statusUsername.value.trim())
    if (result.error) error.value = result.error
    else statusResult.value = result
  } finally {
    statusLoading.value = false
  }
}
</script>

<style scoped>
.auth-wrap {
  display: flex;
  justify-content: center;
  padding: 4vh 0 40px;
}

.auth-card {
  width: 100%;
  max-width: 400px;
  border-radius: var(--radius-xl);
  padding: 28px;
  background: var(--glass-bg-strong);
}

.auth-eyebrow {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.auth-title {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.auth-desc {
  margin-top: 4px;
  font-size: 13.5px;
  color: var(--text-secondary);
}

.auth-form {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.field input {
  height: 44px;
  padding: 0 14px;
  border-radius: 13px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  font: inherit;
  font-size: 15px;
  color: var(--text-primary);
  outline: none;
  transition: border-color 180ms ease, box-shadow 180ms ease, background 180ms ease;
}

.field input:focus {
  background: var(--glass-bg-strong);
  border-color: var(--glass-border-bright);
  box-shadow: 0 0 0 4px var(--accent-soft);
}

.remember-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  justify-content: flex-start;
}

.remember-text {
  font-size: 13.5px;
  color: var(--text-secondary);
}

.ios-switch.mini {
  width: 42px;
  height: 25px;
  pointer-events: none;
}

.ios-switch.mini::after {
  width: 21px;
  height: 21px;
}

.ios-switch.mini[aria-checked="true"]::after {
  transform: translateX(17px);
}

.auth-submit {
  margin-top: 2px;
  height: 46px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  box-shadow: 0 8px 22px rgba(10, 132, 255, 0.35);
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass);
}

.auth-submit:hover {
  filter: brightness(1.06);
}

.auth-submit:active {
  transform: scale(0.97);
}

.auth-submit:disabled {
  opacity: 0.6;
  cursor: default;
}

.auth-footer {
  margin-top: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.auth-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
}

.auth-link.muted {
  color: var(--text-tertiary);
}

.auth-error {
  margin: 0;
  font-size: 13px;
  color: #e0483e;
}

html[data-theme="dark"] .auth-error {
  color: #ff7a70;
}

.status-result {
  padding: 14px;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.status-result p {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.status-badge {
  font-size: 13.5px;
}

.status-badge.status-pending { color: #ff9500; }
.status-badge.status-approved { color: #1d8a41; }
.status-badge.status-rejected { color: #e0483e; }

html[data-theme="dark"] .status-badge.status-approved { color: #66d489; }
html[data-theme="dark"] .status-badge.status-rejected { color: #ff7a70; }
</style>
