# 石門國小 · 數位內容與教學軟體需求調查填報網站

桃園市龍潭區石門國民小學 — 115 年「中小學數位學習實施計畫」教師軟體需求調查。
依據：桃教資字第1150051445號 · 教育局線上填報編號 **1667** · 教育局截止 **6/25（四）17:00**。

## 功能
- **區塊一｜統購軟體（3 套）**：AILEAD365、翰林雲端 TEAMS Lite、ClassSwift，填需求數。
- **區塊二｜自主需求軟體**：可搜尋／篩選教育部選購名單 **3,308 項**（依組別、領域、廠牌）。
  - LoiLoNote 主打卡（授權即將到期，呼籲續用）。
  - 公文「已大量採購·免填」品項（89 項）自動標示、預設隱藏、不可勾選。
  - 統購 3 項已從自主清單排除，避免重複計票。
- **實名送出**：填姓名 → 記錄「誰需要哪幾套＋需求數」。
- **即時排行榜**：自主需求前 5 名（前 5 名即學校提報教育局名單）。

## 檔案結構
```
smes-survey/
  index.html        主頁
  styles.css        樣式
  app.js            前端邏輯（搜尋／勾選／送出／排行）
  data/
    catalog.json    3,308 項選購名單（已分組＋領域標籤＋免填/統購標記）
    config.js       設定檔（Firebase 開關＋金鑰佔位＋填報資訊）
  README.md
```

## 目前狀態：DEMO 模式（可直接試用）
資料暫存在瀏覽器 localStorage，方便本機試填。**正式全校收集前必須接上 Firebase。**

## 接上 Firebase（正式上線步驟）
1. 於學校帳號 `ipad@mail2.smes.tyc.edu.tw` 建立／指定 Firebase 專案，啟用 Firestore。
2. 編輯 `data/config.js`：`USE_FIREBASE` 改 `true`，填入 `firebaseConfig`
   （金鑰建議走 GitHub Actions 注入，沿用 `__FIREBASE_xxx__` 佔位字串）。
3. 設定 Firestore 安全規則（允許 `submissions` 寫入，建議加 App Check）。
4. Firebase Authentication → 授權網域加入 GitHub Pages 網域。
5. 推上 GitHub → GitHub Pages 自動部署。

## 本機預覽
```bash
cd smes-survey
python -m http.server 8766
# 開 http://127.0.0.1:8766
```

## 資料來源
- 教育局公文.pdf／需求調查表.xlsx／115年度校園數位內容與教學軟體需求調查參考清冊.ods

---
Made with ❤️ by [阿凱老師](https://www.smes.tyc.edu.tw/modules/tadnews/page.php?ncsn=11&nsn=16#a5)

---

<!-- BEGIN:PROJECT_GUIDE -->
## 專案導覽

桃園市石門國小 115年數位內容與教學軟體需求調查填報網站

- 專案定位：校務／行政流程數位化專案
- Repository：`cagoooo/smes-soft-survey`
- 可見性：公開
- 主要技術：JavaScript、Firebase
- 線上入口：未在 GitHub repository metadata 設定

### 可以怎麼應用

- 把紙本、試算表或人工通知流程轉成可追蹤的線上作業
- 依不同學校的欄位、角色與簽核方式進行客製化
- 作為校務系統、資料同步或自動通知整合的參考實作

這些是依目前專案定位整理的延伸方向，不代表所有情境都已內建完成；實作前請先確認現有功能與資料格式。

### 技術與專案結構

- `README.md`
- `app.js`
- `apple-touch-icon.png`
- `firebase.json`
- `index.html`

檔案結構會隨版本演進；若本節與程式碼不一致，以目前預設分支的原始碼為準。

### 本機執行

這是可直接由瀏覽器載入的靜態網站。可用任一靜態檔案伺服器預覽，例如：
```bash
python -m http.server 8000
```
接著開啟 `http://localhost:8000`。請避免直接以 `file://` 測試需要模組、請求或 Service Worker 的功能。

### 給 AI Agent 的接手指南

1. 先閱讀本 README、`AGENTS.md`（若有）、套件腳本與部署設定。
2. 先畫出角色、資料流、權限與外部服務，再修改表單或資料結構。
3. 不得提交學生個資、憑證、API 金鑰或正式環境匯出資料。
4. 涉及 schema、驗證、權限或通知時，同步檢查前後端與部署設定。
5. 不要捏造尚未存在的功能；README 與實作有落差時，應同時更新文件。
6. 提交前只納入本次任務檔案，並記錄實際執行過的驗證。

### 安全與資料注意事項

- 不要提交 `.env`、服務帳號、API 金鑰、token、學生個資或正式環境匯出資料。
- 使用 Firebase、Supabase、Google API 或其他雲端服務時，請建立自己的測試專案並套用最小權限。
- 若要公開衍生作品，請先確認程式碼、圖片、音訊、字型與教材內容的授權。

### 貢獻與客製化

歡迎依教學現場、活動或工作流程需求進行 fork／客製化。建議在變更說明中交代使用情境、主要修改、測試方式，以及是否影響資料格式或部署設定。
<!-- END:PROJECT_GUIDE -->
