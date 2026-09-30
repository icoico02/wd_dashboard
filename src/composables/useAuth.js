import { computed, ref } from 'vue'
import { AUTH_STORAGE_KEY, authStorage, isSupabaseConfigured, supabase } from '../lib/supabase'

/**
 * 全局单例认证状态（移植自 workTime）：
 * - 用户名 + 密码登录（映射为 {username}@attendance.local）
 * - 注册后等待管理员审批（profiles.approval_status）
 * - 「记住此设备」切换 localStorage / sessionStorage 会话
 */

const authLoading = ref(true)
const authUser = ref(null)
const userProfile = ref(null)
const gateMessage = ref('')
const registering = ref(false)

const isAdmin = computed(() => ['admin', 'super_admin'].includes(userProfile.value?.role))
const isSuperAdmin = computed(() => userProfile.value?.role === 'super_admin')

let initialized = false

async function loadProfile(user) {
  if (!supabase || !user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, role, approval_status, created_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error(error)
    gateMessage.value = '用户资料加载失败，请稍后重试。'
    return null
  }

  return data
}

async function handleSession(session) {
  if (!session?.user) {
    authUser.value = null
    userProfile.value = null
    authStorage.setMode('local')
    return false
  }

  const profile = await loadProfile(session.user)
  const status = profile?.approval_status

  if (!profile || status !== 'approved') {
    if (status === 'pending') gateMessage.value = '您的账号正在等待管理员审批。'
    else if (status === 'rejected') gateMessage.value = '您的注册申请未通过审批。'
    else if (!profile) gateMessage.value = '用户资料不存在，请联系管理员。'

    await supabase.auth.signOut()
    authUser.value = null
    userProfile.value = null
    return false
  }

  gateMessage.value = ''
  authUser.value = session.user
  userProfile.value = profile
  return true
}

async function initAuth() {
  if (initialized) return
  initialized = true

  if (!isSupabaseConfigured) {
    authLoading.value = false
    return
  }

  const {
    data: { session },
  } = await supabase.auth.getSession()
  await handleSession(session)
  authLoading.value = false

  supabase.auth.onAuthStateChange((_event, sessionState) => {
    if (registering.value) return
    window.setTimeout(() => handleSession(sessionState), 0)
  })
}

function migrateSessionToStorage(mode) {
  if (!supabase || !authStorage.getItem(AUTH_STORAGE_KEY)) return
  if (authStorage.getMode() === mode) return
  authStorage.setMode(mode)
}

export function useAuth() {
  initAuth()

  async function signIn(username, password, remember = true) {
    gateMessage.value = ''

    if (!isSupabaseConfigured) return '登录服务尚未配置'
    if (!username || !password) return '请输入账号和密码'

    migrateSessionToStorage(remember ? 'local' : 'session')

    const { error } = await supabase.auth.signInWithPassword({
      email: `${username}@attendance.local`,
      password,
    })

    if (!error) return ''
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('invalid login credentials')) return '账号或密码错误'
    if (msg.includes('fetch') || error.name === 'AuthRetryableFetchError') {
      return '网络连接失败，请检查网络后重试'
    }
    if (msg.includes('email not confirmed')) return '账号邮箱未验证，请联系管理员'
    return `登录失败：${error.message}`
  }

  async function signUp(username, password, confirmation) {
    gateMessage.value = ''

    if (!isSupabaseConfigured) return '登录服务尚未配置'
    if (!username || !password || !confirmation) return '请完整填写注册信息'
    if (!/^[a-zA-Z0-9._-]+$/.test(username)) return '账号只能包含字母、数字、点、下划线或短横线'
    if (password.length < 6) return '密码至少需要 6 位'
    if (password !== confirmation) return '两次输入的密码不一致'

    registering.value = true
    migrateSessionToStorage('local')

    try {
      const { data, error } = await supabase.auth.signUp({
        email: `${username}@attendance.local`,
        password,
      })

      if (error) {
        if (error.code === 'user_already_exists' || error.message?.toLowerCase().includes('already registered')) {
          return '账号已存在，请直接登录'
        }
        if (error.code === 'signup_disabled') return '当前暂未开放注册，请联系管理员'
        if (error.code === 'email_address_invalid') return '账号格式无效，请更换账号后重试'
        if (error.code === 'weak_password') return '密码强度不足，请使用至少 6 位密码'
        return '注册失败，请检查 Supabase Auth 配置'
      }

      if (!data.user) return '注册失败，未获取到用户信息'

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', data.user.id)

      if (profileError) {
        console.error(profileError)
        return '注册失败，用户资料保存失败，请稍后重试'
      }

      if (data.session) await supabase.auth.signOut()
      return '注册申请已提交，请等待管理员审批。'
    } finally {
      registering.value = false
    }
  }

  async function checkApprovalStatus(username) {
    if (!isSupabaseConfigured) return { error: '查询服务尚未配置' }

    if (!username || !/^[a-zA-Z0-9._-]+$/.test(username)) {
      return { error: '请输入正确的用户名' }
    }

    const { data, error } = await supabase.rpc('check_approval_status', {
      p_username: username,
    })

    if (error) return { error: '未找到该账号，请确认用户名是否正确。' }

    const result = Array.isArray(data) ? data[0] : data
    if (!['pending', 'approved', 'rejected'].includes(result?.approval_status)) {
      return { error: '未找到该账号，请确认用户名是否正确。' }
    }

    return {
      status: result.approval_status,
      reason: result.rejection_reason || result.reason || '',
    }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    authUser.value = null
    userProfile.value = null
    gateMessage.value = ''
  }

  return {
    authLoading,
    authUser,
    userProfile,
    gateMessage,
    isAdmin,
    isSuperAdmin,
    isConfigured: isSupabaseConfigured,
    signIn,
    signUp,
    signOut,
    checkApprovalStatus,
  }
}
