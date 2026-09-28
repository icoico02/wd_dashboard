<template>
  <FeatureShell
    title="计时器"
    subtitle="精准计时 · 记录归档"
    :signed-in="!!authUser"
    :user-email="authUser?.email || ''"
    @sign-out="onSignOut"
  >
    <div v-if="!isConfigured" class="state-card glass">
      <span class="state-icon"><Settings :size="24" aria-hidden="true" /></span>
      <h2 class="state-title">尚未配置 Supabase</h2>
      <p class="state-desc">计时记录保存在 Supabase。在项目根目录创建 <code>.env.local</code> 并填入 <code>VITE_SUPABASE_URL</code> 与 <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>，可复用 workTime 已有的 Supabase 项目。</p>
    </div>

    <div v-else-if="authLoading" class="state-card glass">
      <p class="state-desc">正在检查登录状态…</p>
    </div>

    <AuthPanel v-else-if="!authUser" />

    <template v-else>
      <section class="hero glass">
        <p class="timer-display">
          <span class="timer-main">{{ displayParts.main }}</span>
          <span class="timer-ms">.{{ displayParts.ms }}</span>
        </p>
        <p class="timer-hint">{{ timerHint }}</p>

        <div class="timer-actions">
          <button type="button" class="timer-btn primary" @click="toggleRun">
            <component :is="timerRunning ? Pause : Play" :size="19" aria-hidden="true" />
            {{ timerRunning ? '暂停' : timerSessionStartedAt && !timerSessionSaved ? '继续' : '开始' }}
          </button>
          <button
            type="button"
            class="timer-btn success"
            :disabled="!timerSessionStartedAt || timerSessionSaved"
            @click="endTimer"
          >
            <Save :size="18" aria-hidden="true" />结束并保存
          </button>
          <button type="button" class="timer-btn" :disabled="timerRunning || timerElapsedMs === 0" @click="resetTimer">
            <RotateCcw :size="17" aria-hidden="true" />重置
          </button>
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
          <li v-for="record in timerHistory" :key="record.id" class="history-row glass" :class="{ selected: selectedIds.includes(record.id) }">
            <label class="row-check">
              <input
                type="checkbox"
                :checked="selectedIds.includes(record.id)"
                @change="toggleSelected(record.id)"
              />
            </label>
            <div class="row-info">
              <span class="row-range">{{ formatRecordDate(record.start_time) }} {{ formatRecordTime(record.start_time) }} → {{ formatRecordTime(record.end_time) }}</span>
            </div>
            <span class="row-duration">{{ formatStoredDuration(record) }}</span>
          </li>
        </ul>
      </section>
    </template>
  </FeatureShell>

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
import { Pause, Play, RotateCcw, Save, Settings, Trash2 } from 'lucide-vue-next'
import AuthPanel from '../components/AuthPanel.vue'
import FeatureShell from '../components/FeatureShell.vue'
import GlassDialog from '../components/GlassDialog.vue'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { supabase } from '../lib/supabase'

const { authLoading, authUser, isConfigured, signOut } = useAuth()
const { showToast } = useToast()

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

const activeTimerStorageKey = computed(() =>
  authUser.value ? `dada-dashboard:active-timer:${authUser.value.id}` : '',
)

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
  return '按下「开始」启动计时，刷新页面也不会丢'
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
  const key = activeTimerStorageKey.value
  if (!key) return

  if (!timerSessionStartedAt.value || timerSessionSaved.value) {
    localStorage.removeItem(key)
    return
  }

  localStorage.setItem(
    key,
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
  const key = activeTimerStorageKey.value
  if (!key) return

  try {
    const session = JSON.parse(localStorage.getItem(key) || 'null')
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
    localStorage.removeItem(key)
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
  if (activeTimerStorageKey.value) localStorage.removeItem(activeTimerStorageKey.value)
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

async function endTimer() {
  if (!timerSessionStartedAt.value) {
    showToast('请先开始计时')
    return
  }

  syncElapsed()
  timerRunning.value = false
  clearInterval(intervalId)
  intervalId = null
  await saveRecord()
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

async function saveRecord(pending) {
  if (!supabase || !authUser.value) return false

  const record =
    pending || {
      user_id: authUser.value.id,
      start_time: new Date(timerSessionStartedAt.value).toISOString(),
      end_time: new Date().toISOString(),
      total_milliseconds: Math.floor(timerElapsedMs.value),
      total_seconds: Math.floor(timerElapsedMs.value / 1000),
    }

  const { error } = await supabase.from('timer_records').insert(record)

  if (error) {
    console.error('保存计时记录失败:', error)
    showToast(timerSaveErrorMessage(error), { actionLabel: '重试', onAction: () => saveRecord(record) })
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
    timerHistory.value = []
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
  if (!supabase || !authUser.value || !ids.length) return

  const { error } = await supabase
    .from('timer_records')
    .delete()
    .in('id', ids)
    .eq('user_id', authUser.value.id)

  if (error) {
    showToast('删除计时记录失败，请检查网络后重试。')
    return
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

watch(authUser, (user) => {
  if (user) {
    restoreSession()
    loadHistory()
  } else {
    timerHistory.value = []
    selectedIds.value = []
  }
})

onMounted(() => {
  window.addEventListener('pagehide', onPageHide)
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (authUser.value) {
    restoreSession()
    loadHistory()
  }
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
}
</script>

<style scoped>
.state-card {
  border-radius: var(--radius-xl);
  padding: 44px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.state-icon {
  width: 54px;
  height: 54px;
  border-radius: 17px;
  display: grid;
  place-items: center;
  color: var(--text-secondary);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  margin-bottom: 4px;
}

.state-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.state-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  max-width: 460px;
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
  margin-top: 24px;
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.timer-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 136px;
  height: 50px;
  padding: 0 22px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  font: inherit;
  font-size: 14.5px;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  cursor: pointer;
  transition: background 200ms ease, transform 120ms var(--ease-glass), opacity 160ms ease;
}

.timer-btn.primary {
  background: linear-gradient(180deg, #3f9bff, #0a7aff);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 10px 26px rgba(10, 132, 255, 0.4);
}

.timer-btn.success {
  background: linear-gradient(180deg, #43d063, #2eb350);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 10px 26px rgba(52, 199, 89, 0.38);
}

.timer-btn:hover:not(:disabled) {
  filter: brightness(1.06);
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
  transition: opacity 160ms ease, background 200ms ease;
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
  transition: border-color 160ms ease, background 160ms ease;
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

  .timer-btn {
    flex: 1;
    min-width: 104px;
    padding: 0 12px;
  }
}
</style>
