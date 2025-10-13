// sw.js
const CACHE_NAME = 'morse-trainer-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/receive.html',
    '/receive.js', // 确认此文件存在且内容为JavaScript
    '/receive.css',
    '/follow.html', // <--- 添加这一行
    '/follow.js',   // <--- 添加这一行
    '/follow.css',  // <--- 添加这一行
    '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => response || fetch(event.request))
  );
});