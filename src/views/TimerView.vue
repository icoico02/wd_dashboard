<template>
  <FeatureShell
    title="计时器"
    subtitle="精准计时 · 记录归档"
    :signed-in="!!authUser"
    :user-email="authUser?.email || ''"
    @sign-out="onSignOut"
  >
    <!-- 游客 / 未配置 Supabase 提示条 -->
    <div v-if="!authUser" class="guest-banner glass-subtle">
      <span class="guest-dot" aria-hidden="true"></span>
      <p class="guest-text">
        <template v-if="isConfigured">游客模式：计时记录仅保存在本机浏览器，登录后自动改存云端。</template>
        <template v-else>未配置 Supabase：计时记录仅保存在本机浏览器。</template>
      </p>
      <button v-if="isConfigured" type="button" class="guest-login" @click="loginOpen = true">登录</button>
    </div>

    <section class="hero glass">
      <p class="timer-display">
        <span class="timer-main">{{ displayParts.main }}</span>
        <span class="timer-ms">.{{ displayParts.ms }}</span>
      </p>
      <p class="timer-hint">{{ timerHint }}</p>

      <div class="timer-actions">
        <div class="action-row-main">
          <button type="button" class="timer-btn primary" @click="toggleRun">
            <component :is="timerRunning ? Pause : Play" :size="20" aria-hidden="true" />
            {{ timerRunning ? '暂停计时' : timerSessionStartedAt && !timerSessionSaved ? '继续计时' : '开始计时' }}
          </button>
        </div>
        <div class="action-row-sub">
          <button
            type="button"
            class="timer-btn success"
            :disabled="!timerSessionStartedAt || timerSessionSaved"
            @click="endTimer"
          >
            <Save :size="17" aria-hidden="true" />结束并保存
          </button>
          <button
            type="button"
            class="timer-btn neutral"
            :disabled="timerRunning || timerElapsedMs === 0"
            @click="resetTimer"
          >
            <RotateCcw :size="16" aria-hidden="true" />重置
          </button>
        </div>
      </div>
    </section>

    <section class="history">
      <div class="history-head">
        <h2 class="section-title">计时记录</h2>
        <button
          type="button"
          class="delete-selected"
          :disabled="!selectedIds.length"
          @click="requestDeleteTimerRecords(selectedIds)"
        >
          <Trash2 :size="14" aria-hidden="true" />删除所选{{ selectedIds.length ? `（${selectedIds.length}）` : '' }}
        </button>
      </div>

      <div v-if="historyLoading" class="history-empty glass-subtle"><p>正在加载记录…</p></div>
      <div v-else-if="!timerHistory.length" class="history-empty glass-subtle">
        <p>还没有计时记录，按「开始」跑一段试试。</p>
      </div>

      <ul v-else class="history-list">
        <li
          v-for="record in timerHistory"
          :key="record.id"
          class="history-row glass"
          :class="{ selected: selectedIds.includes(record.id) }"
        >
          <label class="row-check">
            <input
              type="checkbox"
              :checked="selectedIds.includes(record.id)"
              @change="toggleSelected(record.id)"
            />
          </label>
          <div class="row-info">
            <span class="row-range">
              {{ formatRecordDate(record.start_time) }} {{ formatRecordTime(record.start_time) }} →
              {{ formatRecordTime(record.end_time) }}
            </span>
          </div>
          <span class="row-duration">{{ formatStoredDuration(record) }}</span>
        </li>
      </ul>
    </section>
  </FeatureShell>

  <!-- 登录弹窗：游客随时可以登录切到云端记录 -->
  <GlassDialog :open="loginOpen" title="登录后同步到云端" @close="loginOpen = false">
    <AuthPanel />
  </GlassDialog>

  <GlassDialog :open="deleteConfirm.show" title="删除所选记录？" width="360px" @close="deleteConfirm.show = false">
    <p class="dialog-text">将删除 {{ deleteConfirm.ids.length }} 条计时记录，删除后无法恢复。</p>
    <div class="dialog-actions">
      <button type="button" class="btn-plain" @click="deleteConfirm.show = false">取消</button>
      <button type="button" class="btn-danger" @click="confirmDeleteTimerRecords">删除</button>
    </div>
  </GlassDialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Pause, Play, RotateCcw, Save, Trash2 } from 'lucide-vue-next'
import AuthPanel from '../components/AuthPanel.vue'
import FeatureShell from '../components/FeatureShell.vue'
import GlassDialog from '../components/GlassDialog.vue'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { supabase } from '../lib/supabase'

const { authLoading, authUser, isConfigured, signOut } = useAuth()
const { showToast } = useToast()

const ACTIVE_KEY = 'dada-dashboard:active-timer'
const LOCAL_HISTORY_KEY = 'dada-dashboard:local-timer-records'

/* --------------------------------- 计时状态 --------------------------------- */
const timerRunning = ref(false)
const timerStartedAt = ref(0)
const timerElapsedMs = ref(0)
const timerSessionStartedAt = ref(0)
const timerSessionSaved = ref(false)
let intervalId = null

const timerHistory = ref([])
const historyLoading = ref(false)
const selectedIds = ref([])
const deleteConfirm = reactive({ show: false, ids: [] })
const loginOpen = ref(false)

const displayParts = computed(() => {
  const totalMs = Math.max(0, Math.floor(timerElapsedMs.value))
  const hours = Math.floor(totalMs / 3600000)
  const minutes = Math.floor((totalMs % 3600000) / 60000)
  const seconds = Math.floor((totalMs % 60000) / 1000)
  const ms = totalMs % 1000

  return {
    main: [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':'),
    ms: String(ms).padStart(3, '0'),
  }
})

const timerHint = computed(() => {
  if (timerRunning.value) return '计时中…'
  if (timerSessionSaved.value) return '本段已保存，可直接开始下一段'
  if (timerSessionStartedAt.value && timerElapsedMs.value > 0) return '已暂停，可继续或结束保存'
  return '按下「开始计时」启动计时，刷新页面也不会丢'
})

function syncElapsed() {
  if (!timerRunning.value || !timerStartedAt.value) return
  timerElapsedMs.value = Math.max(0, Date.now() - timerStartedAt.value)
}

function startInterval() {
  clearInterval(intervalId)
  intervalId = setInterval(syncElapsed, 37)
}

function persistSession() {
  if (!timerSessionStartedAt.value || timerSessionSaved.value) {
    localStorage.removeItem(ACTIVE_KEY)
    return
  }

  localStorage.setItem(
    ACTIVE_KEY,
    JSON.stringify({
      sessionStartedAt: timerSessionStartedAt.value,
      timerStartedAt: timerStartedAt.value,
      elapsedMs: timerElapsedMs.value,
      running: timerRunning.value,
      saved: timerSessionSaved.value,
    }),
  )
}

function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(ACTIVE_KEY) || 'null')
    const sessionStartedAt = Number(session?.sessionStartedAt)
    const elapsedMs = Math.max(0, Number(session?.elapsedMs || 0))

    if (!Number.isFinite(sessionStartedAt) || sessionStartedAt <= 0) return

    timerSessionStartedAt.value = sessionStartedAt
    timerSessionSaved.value = Boolean(session?.saved)
    timerElapsedMs.value = elapsedMs
    timerRunning.value = false

    if (session?.running) {
      const runningStartedAt = Number(session.timerStartedAt)
      timerStartedAt.value =
        Number.isFinite(runningStartedAt) && runningStartedAt > 0 ? runningStartedAt : Date.now() - elapsedMs
      timerRunning.value = true
      syncElapsed()
      startInterval()
    }
  } catch {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

function clearSession() {
  timerRunning.value = false
  timerStartedAt.value = 0
  timerElapsedMs.value = 0
  timerSessionStartedAt.value = 0
  timerSessionSaved.value = false
  clearInterval(intervalId)
  intervalId = null
  localStorage.removeItem(ACTIVE_KEY)
}

function toggleRun() {
  if (timerRunning.value) {
    syncElapsed()
    timerRunning.value = false
    clearInterval(intervalId)
    intervalId = null
    persistSession()
    return
  }

  if (!timerSessionStartedAt.value || timerSessionSaved.value) {
    timerSessionStartedAt.value = Date.now()
    timerSessionSaved.value = false
    timerElapsedMs.value = 0
  }

  timerStartedAt.value = Date.now() - timerElapsedMs.value
  timerRunning.value = true
  persistSession()
  startInterval()
}

function endTimer() {
  if (!timerSessionStartedAt.value) {
    showToast('请先开始计时')
    return
  }

  syncElapsed()
  timerRunning.value = false
  clearInterval(intervalId)
  intervalId = null
  saveRecord()
}

function resetTimer() {
  if (timerRunning.value) {
    showToast('计时中，请先暂停再重置')
    return
  }
  if (timerElapsedMs.value === 0) return
  clearSession()
  showToast('已重置')
}

/* --------------------------------- 记录存取 --------------------------------- */
/* 登录 → Supabase 云端；游客 / 未配置 → 本机 localStorage，字段结构与云端一致 */
function readLocalRecords() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_HISTORY_KEY)) || []
  } catch {
    return []
  }
}

function writeLocalRecords(records) {
  try {
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(records.slice(0, 200)))
  } catch {
    /* 存储空间不足等场景静默失败 */
  }
}

function timerSaveErrorMessage(error) {
  const detail = `${error?.code || ''} ${error?.message || ''}`.toLowerCase()

  if (detail.includes('total_milliseconds') || detail.includes('42703')) {
    return '计时记录表尚未升级，请先在 Supabase 执行 timer_records.sql。'
  }
  if (detail.includes('42501') || detail.includes('row-level security')) {
    return '没有保存计时记录的权限，请检查 timer_records 的 RLS 策略。'
  }
  return '记录保存失败，请检查网络后重试。'
}

function saveRecord(pending) {
  const record =
    pending || {
      id: crypto.randomUUID(),
      user_id: authUser.value?.id || null,
      start_time: new Date(timerSessionStartedAt.value).toISOString(),
      end_time: new Date().toISOString(),
      total_milliseconds: Math.floor(timerElapsedMs.value),
      total_seconds: Math.floor(timerElapsedMs.value / 1000),
      created_at: new Date().toISOString(),
    }

  if (supabase && authUser.value) {
    const { id, ...cloudRecord } = record
    return saveCloudRecord(cloudRecord)
  }

  writeLocalRecords([record, ...readLocalRecords()])
  timerSessionSaved.value = true
  clearSession()
  loadHistory()
  showToast('记录已保存到本机')
  return true
}

async function saveCloudRecord(cloudRecord) {
  const { error } = await supabase.from('timer_records').insert(cloudRecord)

  if (error) {
    console.error('保存计时记录失败:', error)
    showToast(timerSaveErrorMessage(error), {
      actionLabel: '存到本机',
      onAction: () => {
        writeLocalRecords([{ ...cloudRecord, id: crypto.randomUUID() }, ...readLocalRecords()])
        timerSessionSaved.value = true
        clearSession()
        loadHistory()
        showToast('记录已保存到本机')
      },
    })
    return false
  }

  timerSessionSaved.value = true
  clearSession()
  await loadHistory()
  showToast('记录已保存')
  return true
}

function formatStoredDuration(record) {
  const ms =
    record.total_milliseconds != null
      ? Number(record.total_milliseconds)
      : record.total_seconds != null
        ? Number(record.total_seconds) * 1000
        : Math.max(0, new Date(record.end_time) - new Date(record.start_time))

  const hours = Math.floor(ms / 3600000)
  const minutes = Math.floor((ms % 3600000) / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return hours > 0 ? `${hours}小时${minutes}分${seconds}秒` : minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`
}

function formatRecordTime(value) {
  if (!value) return '--:--:--'
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

function formatRecordDate(value) {
  if (!value) return '--'
  return new Date(value).toLocaleDateString('zh-CN')
}

async function loadHistory() {
  if (!supabase || !authUser.value) {
    timerHistory.value = readLocalRecords()
    historyLoading.value = false
    return
  }

  historyLoading.value = true
  const { data, error } = await supabase
    .from('timer_records')
    .select('*')
    .eq('user_id', authUser.value.id)
    .order('created_at', { ascending: false })

  historyLoading.value = false

  if (error) {
    showToast('历史记录加载失败，请检查网络后重试。')
    return
  }

  timerHistory.value = data || []
  selectedIds.value = selectedIds.value.filter((id) => timerHistory.value.some((record) => record.id === id))
}

function toggleSelected(id) {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((item) => item !== id)
    : [...selectedIds.value, id]
}

function requestDeleteTimerRecords(ids) {
  const list = [...new Set(ids)].filter(Boolean)
  if (!list.length) return
  deleteConfirm.ids = list
  deleteConfirm.show = true
}

async function confirmDeleteTimerRecords() {
  const ids = deleteConfirm.ids
  if (!ids.length) return

  if (supabase && authUser.value) {
    const { error } = await supabase
      .from('timer_records')
      .delete()
      .in('id', ids)
      .eq('user_id', authUser.value.id)

    if (error) {
      showToast('删除计时记录失败，请检查网络后重试。')
      return
    }
  } else {
    writeLocalRecords(readLocalRecords().filter((record) => !ids.includes(record.id)))
  }

  deleteConfirm.show = false
  selectedIds.value = selectedIds.value.filter((id) => !ids.includes(id))
  showToast('记录已删除')
  await loadHistory()
}

/* --------------------------------- 生命周期 --------------------------------- */
function onPageHide() {
  syncElapsed()
  persistSession()
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    syncElapsed()
    persistSession()
    return
  }
  syncElapsed()
}

watch(authUser, () => {
  loginOpen.value = false
  selectedIds.value = []
  loadHistory()
})

onMounted(() => {
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)
  restoreSession()
  loadHistory()
})

onBeforeUnmount(() => {
  syncElapsed()
  persistSession()
  clearInterval(intervalId)
  window.removeEventListener('pagehide', onPageHide)
  document.removeEventListener('visibilitychange', onVisibilityChange)
})

async function onSignOut() {
  syncElapsed()
  persistSession()
  await signOut()
  loadHistory()
}
</script>

<style scoped>
.guest-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 16px;
  border-radius: 14px;
  margin-bottom: 16px;
}

.guest-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff9500;
  box-shadow: 0 0 6px rgba(255, 149, 0, 0.5);
  flex: 0 0 auto;
}

.guest-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.guest-login {
  flex: 0 0 auto;
  padding: 6px 16px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass);
}

.guest-login:hover {
  filter: brightness(1.06);
}

.guest-login:active {
  transform: scale(0.95);
}

.hero {
  border-radius: var(--radius-xl);
  padding: 40px 28px 32px;
  text-align: center;
}

.timer-display {
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: var(--text-primary);
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 6px;
  flex-wrap: wrap;
}

.timer-main {
  font-size: clamp(56px, 13vw, 104px);
  font-weight: 800;
  letter-spacing: 0.02em;
}

.timer-ms {
  font-size: clamp(22px, 4.5vw, 34px);
  font-weight: 700;
  color: var(--text-tertiary);
}

.timer-hint {
  margin-top: 10px;
  font-size: 13.5px;
  color: var(--text-secondary);
}

.timer-actions {
  margin-top: 26px;
  width: 100%;
  max-width: 340px;
  margin-left: auto;
  margin-right: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-row-main {
  display: flex;
}

.action-row-sub {
  display: flex;
  gap: 12px;
}

.action-row-sub .timer-btn {
  flex: 1;
  min-width: 0;
}

.timer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 56px;
  padding: 0 18px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 200ms ease,
    border-color 200ms ease,
    transform 120ms var(--ease-glass),
    opacity 160ms ease;
}

.timer-btn.primary {
  color: #fff;
  background: linear-gradient(180deg, #3f9bff, #0a7aff);
  box-shadow: 0 12px 28px rgba(10, 132, 255, 0.42);
}

/* 淡绿色玻璃 */
.timer-btn.success {
  height: 48px;
  font-size: 14px;
  color: #1d8a41;
  background: rgba(52, 199, 89, 0.14);
  border: 1px solid rgba(52, 199, 89, 0.35);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

html[data-theme="dark"] .timer-btn.success {
  color: #66d489;
  background: rgba(52, 199, 89, 0.16);
  border-color: rgba(52, 199, 89, 0.4);
}

/* 灰色低权重玻璃 */
.timer-btn.neutral {
  height: 48px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.timer-btn.primary:hover:not(:disabled) {
  filter: brightness(1.06);
}

.timer-btn.success:hover:not(:disabled) {
  background: rgba(52, 199, 89, 0.24);
}

html[data-theme="dark"] .timer-btn.success:hover:not(:disabled) {
  background: rgba(52, 199, 89, 0.26);
}

.timer-btn.neutral:hover:not(:disabled) {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.timer-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.timer-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

.history {
  margin-top: 30px;
}

.history-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.delete-selected {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #e0483e;
  cursor: pointer;
  transition:
    opacity 160ms ease,
    background 200ms ease;
}

.delete-selected:disabled {
  opacity: 0.4;
  cursor: default;
  color: var(--text-tertiary);
}

.delete-selected:not(:disabled):hover {
  background: var(--glass-bg-hover);
}

.history-empty {
  padding: 30px;
  border-radius: var(--radius-lg);
  text-align: center;
  font-size: 13.5px;
  color: var(--text-tertiary);
}

.history-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border-radius: var(--radius-lg);
  transition:
    border-color 160ms ease,
    background 160ms ease;
}

.history-row.selected {
  background: var(--glass-bg-hover);
  border-color: rgba(10, 132, 255, 0.35);
}

.row-check input {
  width: 17px;
  height: 17px;
  accent-color: var(--accent);
  cursor: pointer;
}

.row-info {
  flex: 1;
  min-width: 0;
}

.row-range {
  font-size: 14px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.row-duration {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 640px) {
  .hero {
    padding: 30px 16px 24px;
  }
}
</style>
