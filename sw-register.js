/* 註冊 Service Worker：updateViaCache:none 確保更新檢查繞過瀏覽器快取；
   實作 prompt-to-refresh，當偵測到新版本時彈出提示欄引導同仁重新整理載入。 */

function _showSwUpdateToast(waitingWorker) {
  if (document.getElementById('sw-update-toast')) return;

  // 動態建立專屬的 CSS 樣式，確保在各後台與前台頁面均能完美呈現且不影響列印
  const style = document.createElement('style');
  style.id = 'sw-update-toast-style';
  style.textContent = `
    #sw-update-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #0f766e;
      color: #fff;
      padding: 14px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 16px;
      z-index: 99999;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      animation: swSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }
    #sw-update-toast span {
      font-weight: bold;
    }
    #sw-reload-btn {
      background: #fff;
      color: #0f766e;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: bold;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      transition: all 0.2s;
    }
    #sw-reload-btn:hover {
      background: #f0fdfa;
      transform: scale(1.03);
    }
    .sw-dismiss-btn {
      background: transparent;
      color: rgba(255, 255, 255, 0.7);
      border: none;
      font-size: 16px;
      cursor: pointer;
      padding: 4px;
      transition: color 0.2s;
    }
    .sw-dismiss-btn:hover {
      color: #fff;
    }
    @keyframes swSlideUp {
      from { transform: translate(-50%, 40px); opacity: 0; }
      to { transform: translate(-50%, 0); opacity: 1; }
    }
    @media print {
      #sw-update-toast { display: none !important; }
    }
  `;
  document.head.appendChild(style);

  const toast = document.createElement('div');
  toast.id = 'sw-update-toast';
  toast.className = 'no-print';
  toast.innerHTML = `
    <span>📝 需求調查網站已更新！</span>
    <button id="sw-reload-btn">立即重整</button>
    <button class="sw-dismiss-btn" aria-label="關閉">✕</button>
  `;
  document.body.appendChild(toast);

  document.getElementById('sw-reload-btn').addEventListener('click', () => {
    toast.remove();
    const styleEl = document.getElementById('sw-update-toast-style');
    if (styleEl) styleEl.remove();

    if (waitingWorker) {
      let _reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!_reloaded) {
          _reloaded = true;
          window.location.reload();
        }
      });
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  });

  toast.querySelector('.sw-dismiss-btn').addEventListener('click', () => {
    toast.remove();
    const styleEl = document.getElementById('sw-update-toast-style');
    if (styleEl) styleEl.remove();
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
      .then((reg) => {
        const _watchWorker = (worker) => {
          worker.addEventListener("statechange", () => {
            // 線 A：當發現有新 SW 安裝完成，且當前已有頁面被 SW 控制（代表不是首次安裝），則觸發提示
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              _showSwUpdateToast(worker);
            }
          });
        };

        if (reg.installing) _watchWorker(reg.installing);

        reg.addEventListener("updatefound", () => {
          if (reg.installing) _watchWorker(reg.installing);
        });

        // 雙線偵測 線 B (輪詢檢查更新)：每 5 分鐘主動向伺服器確認是否有新 SW 檔
        setInterval(() => {
          reg.update().catch(() => {});
        }, 5 * 60 * 1000);
      })
      .catch((err) => console.warn("[SW] 註冊失敗:", err));
  });
}
