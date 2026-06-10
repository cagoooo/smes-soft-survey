/* ============================================================
   石門國小 數位軟體需求調查 — Service Worker
   策略：network-first（每次優先抓網路最新，徹底避免拿到舊版；
        離線時才用快取當後備）。版本號由部署時注入，每次更新即換新。
   ============================================================ */
const BUILD_VERSION = "__VER__";
const CACHE = "smes-survey-" + BUILD_VERSION;

self.addEventListener("install", () => {
  self.skipWaiting();                       // 新版立即就緒
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())      // 立刻接管所有頁面
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (url.origin !== self.location.origin) return;   // 跨域（Firebase SDK / Firestore）交給瀏覽器

  // network-first：先抓網路（繞過 HTTP 快取），成功就更新快取；失敗才用快取
  e.respondWith(
    fetch(req, { cache: "reload" })
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req))
  );
});
