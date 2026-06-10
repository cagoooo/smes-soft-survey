/* 註冊 Service Worker：updateViaCache:none 確保更新檢查繞過瀏覽器快取；
   每 10 分鐘主動檢查一次新版。network-first 已確保內容永遠最新。 */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then((reg) => { setInterval(() => reg.update().catch(() => {}), 10 * 60 * 1000); })
      .catch(() => {});
  });
}
