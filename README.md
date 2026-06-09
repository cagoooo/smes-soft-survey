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
