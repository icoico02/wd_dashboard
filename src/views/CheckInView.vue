<template>
  <!-- 未配置 Supabase -->
  <FeatureShell
    title="上下班打卡"
    subtitle="签到 · 工时记录 · 补卡"
    :signed-in="!!authUser"
    :user-email="authUser?.email || ''"
    @sign-out="onSignOut"
  >
    <div v-if="!isConfigured" class="state-card glass">
      <span class="state-icon"><Settings :size="24" aria-hidden="true" /></span>
      <h2 class="state-title">尚未配置 Supabase</h2>
      <p class="state-desc">打卡数据保存在 Supabase。在项目根目录创建 <code>.env.local</code> 并填入：</p>
      <pre class="state-code">VITE_SUPABASE_URL=https://你的项目.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=你的匿名密钥</pre>
      <p class="state-hint">可直接复用 workTime 已有的 Supabase 项目，保存后重启 dev server 即可。</p>
    </div>

    <!-- 加载中 -->
    <div v-else-if="authLoading" class="state-card glass">
      <p class="state-desc">正在检查登录状态…</p>
    </div>

    <!-- 未登录 -->
    <AuthPanel v-else-if="!authUser" @keydown.enter.prevent />

    <!-- 已登录：打卡工作区 -->
    <template v-else>
      <section class="hero glass">
        <div class="hero-top">
          <span class="hero-date">{{ currentDate }} {{ weekdayLabel }}</span>
          <span class="hero-status" :class="todayStatus">{{ statusLabel }}</span>
        </div>
        <p class="hero-clock">{{ clockTime }}</p>
        <p class="hero-duration">
          <template v-if="todayStatus === 'working'">今日已工作 <strong>{{ liveDurationText }}</strong></template>
          <template v-else-if="todayStatus === 'done'">今日工时 <strong>{{ todayDurationText }}</strong></template>
          <template v-else>今天还没有签到记录</template>
        </p>
        <div class="hero-actions">
          <button
            type="button"
            class="punch-btn punch-in"
            :disabled="todayStatus !== 'none' || busy"
            @click="startWork"
          >
            <LogIn :size="19" aria-hidden="true" />上班签到
          </button>
          <button
            type="button"
            class="punch-btn punch-out"
            :disabled="todayStatus !== 'working' || busy"
            @click="endWork"
          >
            <LogOut :size="19" aria-hidden="true" />下班签退
          </button>
        </div>
      </section>

      <section class="history">
        <div class="history-head">
          <h2 class="section-title">签到记录</h2>
          <button type="button" class="makeup-btn" @click="openMakeUpPanel">
            <CalendarPlus :size="15" aria-hidden="true" />补卡
          </button>
        </div>

        <div v-if="recordsLoading" class="history-empty glass-subtle">
          <p>正在加载记录…</p>
        </div>
        <div v-else-if="!historyList.length" class="history-empty glass-subtle">
          <p>还没有记录，点击「上班签到」开始第一条吧。</p>
        </div>

        <ul v-else class="history-list">
          <li v-for="item in historyList" :key="item.id" class="history-row glass">
            <div class="row-date">
              <span class="row-day">{{ formatShortDate(item.date) }}</span>
              <span class="row-week">{{ formatWeekday(item.date) }}</span>
            </div>
            <div class="row-times">
              <span class="row-time"><i class="time-label">上班</i>{{ formatAttendanceTime(item.startTime) }}</span>
              <span class="row-time"><i class="time-label">下班</i>{{ formatAttendanceTime(item.endTime) }}</span>
            </div>
            <span class="row-duration">{{ formatWorkDuration(item) }}</span>
            <div class="row-actions">
              <button type="button" class="row-btn" aria-label="编辑记录" @click="openEditPanel(item)">
                <Pencil :size="15" aria-hidden="true" />
              </button>
              <button type="button" class="row-btn danger" aria-label="删除记录" @click="openDeleteConfirmation(item.id)">
                <Trash2 :size="15" aria-hidden="true" />
              </button>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </FeatureShell>

  <!-- 补卡 -->
  <GlassDialog :open="isMakeUpPanelOpen" title="补卡" @close="isMakeUpPanelOpen = false">
    <form class="dialog-form" @submit.prevent="submitMakeUpRecord">
      <label class="field">
        <span class="field-label">日期（仅支持今天之前）</span>
        <input v-model="makeUpForm.recordDate" type="date" :max="yesterdayKey" required />
      </label>
      <div class="field-pair">
        <label class="field">
          <span class="field-label">上班时间</span>
          <input v-model="makeUpForm.startTime" type="time" step="1" required />
        </label>
        <label class="field">
          <span class="field-label">下班时间</span>
          <input v-model="makeUpForm.endTime" type="time" step="1" required />
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-plain" @click="isMakeUpPanelOpen = false">取消</button>
        <button type="submit" class="btn-primary">保存补卡</button>
      </div>
    </form>
  </GlassDialog>

  <!-- 编辑 -->
  <GlassDialog :open="isEditPanelOpen" title="修改签到记录" @close="isEditPanelOpen = false">
    <form class="dialog-form" @submit.prevent="submitEditRecord">
      <label class="field">
        <span class="field-label">日期</span>
        <input v-model="editForm.recordDate" type="date" required />
      </label>
      <div class="field-pair">
        <label class="field">
          <span class="field-label">上班时间</span>
          <input v-model="editForm.startTime" type="time" step="1" required />
        </label>
        <label class="field">
          <span class="field-label">下班时间</span>
          <input v-model="editForm.endTime" type="time" step="1" required />
        </label>
      </div>
      <div class="dialog-actions">
        <button type="button" class="btn-plain" @click="isEditPanelOpen = false">取消</button>
        <button type="submit" class="btn-primary">保存修改</button>
      </div>
    </form>
  </GlassDialog>

  <!-- 删除确认 -->
  <GlassDialog :open="deleteConfirmation.show" title="删除这条记录？" width="360px" @close="closeDeleteConfirmation">
    <p class="dialog-text">删除后无法恢复，确定要删除吗？</p>
    <div class="dialog-actions">
      <button type="button" class="btn-plain" @click="closeDeleteConfirmation">取消</button>
      <button type="button" class="btn-danger" @click="confirmDeleteRecord">删除</button>
    </div>
  </GlassDialog>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { CalendarPlus, LogIn, LogOut, Pencil, Settings, Trash2 } from 'lucide-vue-next'
import AuthPanel from '../components/AuthPanel.vue'
import FeatureShell from '../components/FeatureShell.vue'
import GlassDialog from '../components/GlassDialog.vue'
import { useAuth } from '../composables/useAuth'
import { useToast } from '../composables/useToast'
import { supabase } from '../lib/supabase'

const { authLoading, authUser, isConfigured, signOut } = useAuth()
const { showToast } = useToast()

/* ---------------------------------- 时钟 ---------------------------------- */
const now = ref(new Date())
let clockTimer = null

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onBeforeUnmount(() => clearInterval(clockTimer))

const currentDate = computed(() => {
  const d = now.value
  return `${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`
})

const weekdayLabel = computed(() => `周${['日', '一', '二', '三', '四', '五', '六'][now.value.getDay()]}`)

const clockTime = computed(() =>
  now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
)

const todayKey = computed(() => {
  const d = now.value
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

const yesterdayKey = computed(() => {
  const d = new Date(now.value)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

/* --------------------------------- 打卡数据 -------------------------------- */
const attendanceRecords = ref([])
const recordsLoading = ref(false)
const busy = ref(false)

const todayRecord = computed(() => attendanceRecords.value.find((item) => item.date === todayKey.value) || null)

const todayStatus = computed(() => {
  if (!todayRecord.value) return 'none'
  return todayRecord.value.endTime ? 'done' : 'working'
})

const statusLabel = computed(() =>
  todayStatus.value === 'working' ? '工作中' : todayStatus.value === 'done' ? '已完成' : '未签到',
)

function durationText(startIso, endIso) {
  if (!startIso || !endIso) return '--:--'
  const start = new Date(startIso)
  const end = new Date(endIso)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return '--:--'
  const totalMinutes = Math.round((end - start) / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}小时${minutes}分钟`
}

const todayDurationText = computed(() =>
  durationText(todayRecord.value?.startTime, todayRecord.value?.endTime),
)

const liveDurationText = computed(() =>
  durationText(todayRecord.value?.startTime, now.value.toISOString()),
)

const historyList = computed(() =>
  [...attendanceRecords.value].sort(
    (a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date),
  ),
)

function formatShortDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatWeekday(dateString) {
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return `周${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`
}

function formatAttendanceTime(value) {
  if (!value) return '--:--:--'
  return new Date(value).toLocaleTimeString('zh-CN', { hour12: false })
}

function formatWorkDuration(item) {
  return durationText(item.startTime, item.endTime)
}

async function loadRecords() {
  if (!supabase || !authUser.value) {
    attendanceRecords.value = []
    return
  }

  recordsLoading.value = true
  const { data, error } = await supabase
    .from('attendance_records')
    .select('id, user_id, work_date, check_in_time, check_out_time, created_at')
    .eq('user_id', authUser.value.id)
    .order('work_date', { ascending: false })

  recordsLoading.value = false

  if (error) {
    showToast('签到记录加载失败，请检查网络后重试。')
    return
  }

  attendanceRecords.value = (data || []).map((record) => ({
    id: record.id,
    user_id: record.user_id,
    date: record.work_date,
    startTime: record.check_in_time,
    endTime: record.check_out_time,
  }))
}

watch(authUser, (user) => {
  if (user) loadRecords()
  else attendanceRecords.value = []
})

if (authUser.value) loadRecords()

async function startWork() {
  if (!supabase || !authUser.value || busy.value) return

  busy.value = true
  const { data: existing, error: queryError } = await supabase
    .from('attendance_records')
    .select('id, check_in_time')
    .eq('user_id', authUser.value.id)
    .eq('work_date', todayKey.value)
    .maybeSingle()

  if (queryError) {
    busy.value = false
    showToast('签到记录查询失败，请检查网络后重试。')
    return
  }

  if (existing?.check_in_time) {
    busy.value = false
    showToast('今天已经完成上班签到')
    await loadRecords()
    return
  }

  const { error } = await supabase.from('attendance_records').insert({
    user_id: authUser.value.id,
    work_date: todayKey.value,
    check_in_time: new Date().toISOString(),
  })
  busy.value = false

  if (error) {
    showToast('上班签到失败，请检查网络后重试。')
    return
  }

  showToast('上班签到成功，开工顺利 ✨')
  await loadRecords()
}

async function endWork() {
  if (!supabase || !authUser.value || busy.value) return
  const record = todayRecord.value

  if (!record?.startTime) {
    showToast('请先进行上班签到')
    return
  }
  if (record.endTime) {
    showToast('今天已经完成下班签到')
    return
  }

  busy.value = true
  const { error } = await supabase
    .from('attendance_records')
    .update({ check_out_time: new Date().toISOString() })
    .eq('id', record.id)
    .eq('user_id', authUser.value.id)
  busy.value = false

  if (error) {
    showToast('下班签退失败，请检查网络后重试。')
    return
  }

  showToast('下班签退成功，辛苦了 🎉')
  await loadRecords()
}

/* ------------------------------ 补卡 / 编辑 / 删除 ------------------------------ */
function isValidTimeString(value) {
  return /^\d{2}:\d{2}(:\d{2})?$/.test(value)
}

function parseLocalDateTimeToIso(dateString, timeString) {
  if (!dateString || !timeString) return null
  const localDate = new Date(`${dateString}T${timeString}`)
  return Number.isNaN(localDate.getTime()) ? null : localDate.toISOString()
}

const isMakeUpPanelOpen = ref(false)
const makeUpForm = reactive({ recordDate: '', startTime: '09:00:00', endTime: '18:00:00' })

function openMakeUpPanel() {
  makeUpForm.recordDate = yesterdayKey.value
  makeUpForm.startTime = '09:00:00'
  makeUpForm.endTime = '18:00:00'
  isMakeUpPanelOpen.value = true
}

async function submitMakeUpRecord() {
  const { recordDate, startTime, endTime } = makeUpForm
  const checkInTime = parseLocalDateTimeToIso(recordDate, startTime)
  const checkOutTime = parseLocalDateTimeToIso(recordDate, endTime)

  if (!recordDate || !isValidTimeString(startTime) || !isValidTimeString(endTime) || !checkInTime || !checkOutTime) {
    showToast('请填写有效的补签日期和时间')
    return
  }
  if (recordDate >= todayKey.value) {
    showToast('补签仅支持今天之前的日期')
    return
  }
  if (new Date(checkOutTime) <= new Date(checkInTime)) {
    showToast('下班时间需要晚于上班时间')
    return
  }
  if (!supabase || !authUser.value) return

  const { data: existing, error: queryError } = await supabase
    .from('attendance_records')
    .select('id')
    .eq('user_id', authUser.value.id)
    .eq('work_date', recordDate)
    .maybeSingle()

  if (queryError) {
    showToast('补签记录查询失败，请检查网络后重试。')
    return
  }
  if (existing) {
    showToast('该日期已有签到记录，请使用修改功能')
    return
  }

  const { error } = await supabase.from('attendance_records').insert({
    user_id: authUser.value.id,
    work_date: recordDate,
    check_in_time: checkInTime,
    check_out_time: checkOutTime,
  })

  if (error) {
    showToast('补签保存失败，请检查网络后重试。')
    return
  }

  isMakeUpPanelOpen.value = false
  showToast('补卡已保存')
  await loadRecords()
}

const isEditPanelOpen = ref(false)
const editForm = reactive({ recordId: '', recordDate: '', startTime: '', endTime: '' })

function openEditPanel(record) {
  editForm.recordId = record.id
  editForm.recordDate = record.date
  editForm.startTime = record.startTime ? formatAttendanceTime(record.startTime) : '09:00:00'
  editForm.endTime = record.endTime ? formatAttendanceTime(record.endTime) : '18:00:00'
  isEditPanelOpen.value = true
}

async function submitEditRecord() {
  if (!editForm.recordDate || !isValidTimeString(editForm.startTime) || !isValidTimeString(editForm.endTime)) {
    showToast('请填写有效的日期和时间')
    return
  }
  if (!supabase || !authUser.value) return

  const checkInTime = parseLocalDateTimeToIso(editForm.recordDate, editForm.startTime)
  const checkOutTime = parseLocalDateTimeToIso(editForm.recordDate, editForm.endTime)

  const { error } = await supabase
    .from('attendance_records')
    .update({
      work_date: editForm.recordDate,
      check_in_time: checkInTime,
      check_out_time: checkOutTime,
    })
    .eq('id', editForm.recordId)
    .eq('user_id', authUser.value.id)

  if (error) {
    showToast('修改签到记录失败，请检查网络后重试。')
    return
  }

  isEditPanelOpen.value = false
  showToast('记录已更新')
  await loadRecords()
}

const deleteConfirmation = reactive({ show: false, recordId: '' })

function openDeleteConfirmation(recordId) {
  deleteConfirmation.recordId = recordId
  deleteConfirmation.show = true
}

function closeDeleteConfirmation() {
  deleteConfirmation.show = false
  deleteConfirmation.recordId = ''
}

async function confirmDeleteRecord() {
  if (!supabase || !authUser.value || !deleteConfirmation.recordId) return

  const { error } = await supabase
    .from('attendance_records')
    .delete()
    .eq('id', deleteConfirmation.recordId)
    .eq('user_id', authUser.value.id)

  if (error) {
    showToast('删除签到记录失败，请检查网络后重试。')
    return
  }

  closeDeleteConfirmation()
  showToast('记录已删除')
  await loadRecords()
}

async function onSignOut() {
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

.state-code {
  margin: 6px 0 0;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--glass-bg-subtle);
  border: 1px solid var(--glass-border);
  font-family: ui-monospace, "SF Mono", Menlo, monospace;
  font-size: 12px;
  color: var(--text-secondary);
  text-align: left;
}

.state-hint {
  font-size: 12.5px;
  color: var(--text-tertiary);
}

/* Hero */
.hero {
  border-radius: var(--radius-xl);
  padding: 28px;
  text-align: center;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hero-date {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.hero-status {
  font-size: 12.5px;
  font-weight: 700;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg-subtle);
  color: var(--text-secondary);
}

.hero-status.working {
  color: #1d8a41;
  border-color: rgba(52, 199, 89, 0.35);
  background: rgba(52, 199, 89, 0.12);
}

.hero-status.done {
  color: var(--accent);
  border-color: rgba(10, 132, 255, 0.3);
  background: rgba(10, 132, 255, 0.1);
}

html[data-theme="dark"] .hero-status.working { color: #66d489; }
html[data-theme="dark"] .hero-status.done { color: #7db8ff; }

.hero-clock {
  margin-top: 10px;
  font-size: clamp(52px, 11vw, 84px);
  font-weight: 800;
  letter-spacing: 0.01em;
  line-height: 1.1;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.hero-duration {
  margin-top: 6px;
  font-size: 14.5px;
  color: var(--text-secondary);
}

.hero-duration strong {
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.hero-actions {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.punch-btn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 172px;
  height: 52px;
  padding: 0 26px;
  border: none;
  border-radius: 999px;
  font: inherit;
  font-size: 15.5px;
  font-weight: 700;
  color: #fff;
  cursor: pointer;
  transition: filter 160ms ease, transform 120ms var(--ease-glass), opacity 160ms ease;
}

.punch-in {
  background: linear-gradient(180deg, #43d063, #2eb350);
  box-shadow: 0 10px 26px rgba(52, 199, 89, 0.4);
}

.punch-out {
  background: linear-gradient(180deg, #3f9bff, #0a7aff);
  box-shadow: 0 10px 26px rgba(10, 132, 255, 0.4);
}

.punch-btn:hover:not(:disabled) {
  filter: brightness(1.06);
}

.punch-btn:active:not(:disabled) {
  transform: scale(0.96);
}

.punch-btn:disabled {
  opacity: 0.45;
  cursor: default;
}

/* 历史列表 */
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

.makeup-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 200ms ease, color 200ms ease, transform 120ms var(--ease-glass);
}

.makeup-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.makeup-btn:active {
  transform: scale(0.95);
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
  gap: 16px;
  padding: 13px 18px;
  border-radius: var(--radius-lg);
}

.row-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 46px;
}

.row-day {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.row-week {
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.row-times {
  flex: 1;
  display: flex;
  gap: 22px;
  min-width: 0;
}

.row-time {
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  font-size: 14.5px;
  font-variant-numeric: tabular-nums;
  color: var(--text-primary);
}

.time-label {
  font-style: normal;
  font-size: 11.5px;
  color: var(--text-tertiary);
}

.row-duration {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
  min-width: 84px;
  text-align: right;
}

.row-actions {
  display: flex;
  gap: 6px;
}

.row-btn {
  width: 30px;
  height: 30px;
  border-radius: 9px;
  display: grid;
  place-items: center;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  transition: background 160ms ease, color 160ms ease;
}

.row-btn:hover {
  background: var(--glass-bg-hover);
  color: var(--text-primary);
}

.row-btn.danger:hover {
  color: #e0483e;
}

@media (max-width: 640px) {
  .hero {
    padding: 22px 18px;
  }

  .punch-btn {
    min-width: 148px;
    flex: 1;
  }

  .history-row {
    flex-wrap: wrap;
    gap: 10px;
  }

  .row-times {
    flex-basis: 100%;
    order: 3;
    justify-content: space-between;
    gap: 12px;
  }

  .row-duration {
    margin-left: auto;
    min-width: 0;
  }
}
</style>
