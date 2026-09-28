import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const AUTH_STORAGE_KEY = 'sb-dada-dashboard-auth-token'

/**
 * 可切换的会话存储：登录时按「记住此设备」决定持久化到
 * localStorage（记住）还是 sessionStorage（仅本次会话）
 */
class SwitchableStorage {
  mode = 'local'

  setMode(mode) {
    this.mode = mode === 'session' ? 'session' : 'local'
  }

  getMode() {
    return this.mode
  }

  getStorage() {
    return this.mode === 'session' ? sessionStorage : localStorage
  }

  getItem(key) {
    try {
      return this.getStorage().getItem(key)
    } catch {
      return null
    }
  }

  setItem(key, value) {
    try {
      this.getStorage().setItem(key, value)
    } catch {
      /* Safari 隐私模式等场景静默失败 */
    }
  }

  removeItem(key) {
    try {
      this.getStorage().removeItem(key)
    } catch {
      /* ignore */
    }
  }
}

export const authStorage = new SwitchableStorage()

export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          storage: authStorage,
          storageKey: AUTH_STORAGE_KEY,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null

export const isSupabaseConfigured = Boolean(supabase)
