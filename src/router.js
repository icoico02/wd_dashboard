import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'
// 进销存静态导入：与主应用共享同一份 supabase/useAuth 模块实例，
// 避免懒加载 chunk 复制模块导致登录态分裂（rolldown chunk 副本 env 替换异常）
import InventoryView from './views/InventoryView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: HomeView },
    { path: '/checkin', component: () => import('./views/CheckInView.vue') },
    { path: '/timer', component: () => import('./views/TimerView.vue') },
    { path: '/inventory', component: InventoryView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
