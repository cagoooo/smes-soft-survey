/* ============================================================
   石門國小 數位軟體需求調查 — 設定檔
   ------------------------------------------------------------
   正式站：金鑰由 GitHub Actions 從 Secrets 注入後即連上 Firebase。
   本機預覽：金鑰仍是佔位字串，會自動退回 DEMO（見 app.js 防呆），
            資料暫存瀏覽器 localStorage，可直接試填。
   ============================================================ */
window.SURVEY_CONFIG = {
  // ── 後端開關 ──
  // 正式站由 GitHub Actions 注入金鑰後即為真實 Firebase；
  // 本機預覽因金鑰仍是 __佔位__ 字串，會自動退回 DEMO（見 app.js 防呆）。
  USE_FIREBASE: true,

  // ── Firebase 專案設定（佔位，待填）──
  firebaseConfig: {
    apiKey:            "__FIREBASE_API_KEY__",
    authDomain:        "__FIREBASE_AUTH_DOMAIN__",
    projectId:         "__FIREBASE_PROJECT_ID__",
    storageBucket:     "__FIREBASE_STORAGE_BUCKET__",
    messagingSenderId: "__FIREBASE_MESSAGING_SENDER_ID__",
    appId:             "__FIREBASE_APP_ID__"
  },
  collection: "submissions",      // Firestore 集合名稱

  // ── Google Chat 即時通知（GAS 中繼，webhook 存 GAS Script Property）──
  notifyEndpoint: "https://script.google.com/macros/s/AKfycbyjR2ikSLspSLowYk8Yy0WVHgERTiE5fU4cPKw62jILJRE4qrK7rE-9i78rV_BXibqkLA/exec",

  // ── 填報資訊 ──
  formNo:    "1667",              // 教育局線上填報編號
  docNo:     "桃教資字第1150051445號",
  deadline:  "⏰ 校內填報截止：6/19（五）放學前",
  deadlineOfficial: "教育局截止 6/25（四）17:00",
  deadlineDate: "2026-06-19T16:00:00+08:00",   // 校內截止精確時間（倒數計時用）
  meetingName: "",                              // 正式會議名稱（核章 PDF 用，可後台填）
  meetingDate: "",                              // 正式會議日期

  // ── 學校基本資料（核章 PDF 表單用）──
  school: {
    name:      "桃園市龍潭區石門國民小學",
    shortName: "桃園市石門國小",
    classesTotal: 32,   // 全校總班級數（含藝才/集中式特教）
    classesNormal: 32,  // 普通班班級數
    teachers: 65,       // 全校教師數
    students: 800,      // 全校學生數
    maxClassStudents: 28,
    reporter: "黃凱揚／資訊組長",
    phone: "03-4711752#210",
    email: "h123263110@ms.tyc.edu.tw"
  },

  // ── 學生數估算用平均每班人數（800÷32≈25）──
  avgClassSize: 25,

  // ── 班級清單（去重統計班級數用）── 石門國小實際 32 普通班
  classGroups: [
    { grade: "一年級", classes: ["1班", "2班", "3班", "4班", "5班"] },
    { grade: "二年級", classes: ["1班", "2班", "3班", "4班", "5班"] },
    { grade: "三年級", classes: ["1班", "2班", "3班", "4班", "5班"] },
    { grade: "四年級", classes: ["1班", "2班", "3班", "4班", "5班"] },
    { grade: "五年級", classes: ["1班", "2班", "3班", "4班", "5班", "6班"] },
    { grade: "六年級", classes: ["1班", "2班", "3班", "4班", "5班", "6班"] }
  ],

  // ── 各班實際人數（選填，精算學生數用）──
  // 2026-06-10 阿凱老師確認：全校統一用平均 25 人/班，故留空（自動回退 avgClassSize）。
  // 日後若要精算，填入如 { "一年級1班": 26, ... } 即可，填到的班用實際數、其餘用平均。
  classSizes: {},

  // ── 領域標籤（顯示順序）──
  tagOrder: ["英語","國語文","本土語","數學","自然科學","社會","藝術",
             "資訊程式","人工智慧","AR/VR","閱讀圖書","評量測驗",
             "視訊遠距","影音多媒體","教學平臺工具","健康體育","幼兒學前","特教"]
};
