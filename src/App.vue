<script setup lang="ts">
const navs = [
  { to: '/send', label: '发报训练' },
  { to: '/receive', label: '听抄练习' },
  { to: '/follow', label: '跟发练习' },
  { to: '/koch', label: 'Koch 课程' },
  { to: '/stats', label: '统计' },
]
</script>

<template>
  <header class="topbar">
    <div class="topbar-inner">
      <RouterLink to="/send" class="logo">
        <span class="logo-dot" /><span class="logo-dash" /><span class="logo-name">MorsePass</span>
      </RouterLink>
      <nav class="nav">
        <RouterLink v-for="n in navs" :key="n.to" :to="n.to" class="nav-link">{{ n.label }}</RouterLink>
      </nav>
    </div>
  </header>
  <RouterView />
  <footer class="footer">
    <span class="hint">MorsePass v2 · 支持安装到桌面离线使用（PWA）· 发报请使用页面任意位置或配置的按键</span>
  </footer>
</template>

<style scoped>
.topbar {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar-inner {
  width: min(960px, 100% - 32px);
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  gap: 12px;
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  text-decoration: none;
}

.logo-dot,
.logo-dash {
  display: inline-block;
  background: var(--primary);
  border-radius: 2px;
}

.logo-dot {
  width: 7px;
  height: 7px;
}

.logo-dash {
  width: 18px;
  height: 7px;
}

.logo-name {
  font-weight: 700;
  font-size: 15px;
  color: var(--text);
  margin-left: 4px;
}

.nav {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

.nav-link {
  text-decoration: none;
  color: var(--text-2);
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 7px;
}

.nav-link:hover {
  color: var(--primary);
  background: var(--primary-weak);
}

.nav-link.router-link-active {
  color: var(--primary);
  font-weight: 600;
  background: var(--primary-weak);
}

.footer {
  text-align: center;
  padding: 14px 0 20px;
}

@media (max-width: 720px) {
  .topbar-inner {
    height: auto;
    padding: 8px 0;
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
