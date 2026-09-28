<template>
  <div class="feature-shell">
    <header class="feature-header">
      <button type="button" class="back-btn icon-btn" aria-label="返回 Dashboard" @click="goBack">
        <ArrowLeft :size="19" aria-hidden="true" />
      </button>
      <div class="feature-title">
        <h1 class="feature-name">{{ title }}</h1>
        <p v-if="subtitle" class="feature-sub">{{ subtitle }}</p>
      </div>
      <div v-if="signedIn" class="feature-user">
        <span class="user-chip glass-subtle" :title="userEmail">
          <span class="user-dot" aria-hidden="true"></span>{{ username }}
        </span>
        <button type="button" class="icon-btn" aria-label="退出登录" @click="emit('sign-out')">
          <LogOut :size="17" aria-hidden="true" />
        </button>
      </div>
    </header>
    <slot />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, LogOut } from 'lucide-vue-next'

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
  signedIn: { type: Boolean, default: false },
  userEmail: { type: String, default: '' },
})

const emit = defineEmits(['sign-out'])
const router = useRouter()

const username = computed(() => props.userEmail.split('@')[0] || '已登录')

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.feature-shell {
  width: 100%;
  max-width: 880px;
  margin: 0 auto;
  padding: calc(26px + env(safe-area-inset-top)) var(--page-pad) calc(40px + env(safe-area-inset-bottom));
}

.feature-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 24px;
}

.feature-title {
  flex: 1;
  min-width: 0;
}

.feature-name {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-primary);
}

.feature-sub {
  margin-top: 2px;
  font-size: 13px;
  color: var(--text-secondary);
}

.feature-user {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  max-width: 160px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #34c759;
  box-shadow: 0 0 6px rgba(52, 199, 89, 0.55);
  flex: 0 0 auto;
}

@media (max-width: 640px) {
  .feature-header {
    gap: 10px;
  }

  .feature-name {
    font-size: 20px;
  }

  .user-chip {
    display: none;
  }
}
</style>
