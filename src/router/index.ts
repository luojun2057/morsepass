import { createRouter, createWebHashHistory } from 'vue-router'

/** Hash 路由：GitHub Pages 子路径下无需服务端回退配置 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/send' },
    { path: '/send', component: () => import('@/views/SendView.vue') },
    { path: '/receive', component: () => import('@/views/ReceiveView.vue') },
    { path: '/follow', component: () => import('@/views/FollowView.vue') },
    { path: '/koch', component: () => import('@/views/KochView.vue') },
    { path: '/stats', component: () => import('@/views/StatsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/send' },
  ],
})
