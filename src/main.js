import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './style.css'

createApp(App).use(router).mount('#app')

/* 让 iOS Safari 在手指按下的瞬间就应用 :active 按压态（否则按下无反馈） */
document.addEventListener('touchstart', () => {}, { passive: true })
