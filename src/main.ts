import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { router } from './router'
import './styles/tokens.css'
import './styles/base.css'

// PWA：autoUpdate 模式，新版本就绪后自动刷新缓存
registerSW({ immediate: true })

createApp(App).use(router).mount('#app')
