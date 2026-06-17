/* ============================================================
   石門國小 數位軟體需求調查 — 備查明細 PDF 產生器
   讀 Firestore → 過濾有需求教師 → 列印 A4 備查附件
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.SURVEY_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const LS_KEY = "smes_survey_v1";
  const CLASSES = (CFG.classGroups || []).flatMap((g) => g.classes.map((c) => ({ id: g.grade + c, grade: g.grade, label: c })));
  const clsLabel = (id) => { const c = CLASSES.find((x) => x.id === id); return c ? c.grade + c.label : id; };
  const ADMIN_CODE = "smes-survey-2026";
  try { document.documentElement.style.zoom = localStorage.getItem("smes_fontscale") || "1"; } catch (e) { }

  const TONGGOU = [
    { key: "ailead", name: "AILEAD365 線上教學平臺" },
    { key: "hanlin", name: "翰林雲端學院 TEAMS Lite" },
    { key: "classswift", name: "ClassSwift 課堂互動軟體" }
  ];

  let db = null, FS = null, fbReady = false, SUBS = [];

  $("#gateBtn").addEventListener("click", tryEnter);
  $("#gateInput").addEventListener("keydown", (e) => { if (e.key === "Enter") tryEnter(); });
  function tryEnter() {
    if ($("#gateInput").value === ADMIN_CODE) { $("#gate").style.display = "none"; $("#panel").hidden = false; init(); }
    else { $("#gateMsg").className = "submit-msg err"; $("#gateMsg").textContent = "密碼錯誤"; }
  }

  async function initFirebase() {
    if (!CFG.USE_FIREBASE || !CFG.firebaseConfig || String(CFG.firebaseConfig.apiKey).startsWith("__")) return false;
    try {
      const a = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      FS = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      db = FS.getFirestore(a.initializeApp(CFG.firebaseConfig)); return true;
    } catch (e) { return false; }
  }
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }

  async function init() {
    $("#printBtn").addEventListener("click", () => window.print());
    $("#refreshBtn").addEventListener("click", load);
    await load();
  }

  async function load() {
    $("#repMode").textContent = "讀取中…";
    fbReady = await initFirebase(); SUBS = [];
    if (fbReady) {
      try {
        const snap = await FS.getDocs(FS.collection(db, CFG.collection || "submissions"));
        snap.forEach((d) => SUBS.push(d.data()));
        $("#repMode").textContent = `Firebase 即時（${SUBS.length} 位填報）`;
      } catch (e) { $("#repMode").textContent = "讀取失敗：" + e.message; }
    } else {
      SUBS = readLocal();
      $("#repMode").textContent = `DEMO（本機 ${SUBS.length} 筆）`;
    }
    render();
  }

  function render() {
    // 過濾出「有實際填報需求」的教師名單：排除統購為 0 且 picks 為空者
    const demandTeachers = SUBS.filter((s) => {
      const t = s.tonggou || {};
      const hasTonggou = TONGGOU.some((x) => +t[x.key] > 0);
      const hasPicks = Array.isArray(s.picks) && s.picks.length > 0;
      return hasTonggou || hasPicks;
    }).sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));

    const sc = CFG.school || {};

    const tableRows = demandTeachers.length ? demandTeachers.map((s, i) => {
      const t = s.tonggou || {};
      const buys = TONGGOU.filter((x) => +t[x.key] > 0).map((x) => x.name.split(" ")[0]).join("、") || "—";
      const picks = (s.picks || []).map((p) => p.name).join("<br>") || "—";
      const classes = (s.classes || []).map(clsLabel).join("、") || "—";
      return `<tr>
        <td>${i + 1}</td>
        <td><b>${esc(s.name)}</b></td>
        <td>${esc(s.role || "教師")}</td>
        <td>${esc(classes)}</td>
        <td class="l">${esc(buys)}</td>
        <td class="l">${picks}</td>
      </tr>`;
    }).join("") : `<tr><td colspan="6" style="padding:20px;color:var(--muted)">目前尚無任何教師提出需求。</td></tr>`;

    $("#repDoc").innerHTML = `
      <h1>桃園市115年「中小學數位學習實施計畫」數位內容與教學軟體<br>提報需求教師名單（備查）</h1>
      <p class="rep-sub">學校名稱：${esc(sc.name || "桃園市龍潭區石門國民小學")} ｜ 線上填報編號：1667 ｜ 總計：${demandTeachers.length} 位有需求同仁</p>

      <table class="rep">
        <thead>
          <tr>
            <th style="width:50px">序號</th>
            <th style="width:90px">教師姓名</th>
            <th style="width:90px">職稱</th>
            <th style="width:180px">任教班級</th>
            <th style="width:200px">統購軟體需求</th>
            <th>自主需求軟體（勾選品項）</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <p style="font-size:11px;color:#555;margin-top:10px" class="no-print">說明：本表僅篩選「有勾選需求」的教師名單，未提出需求的老師不列入本備查附件中。</p>

      <div class="rep-sign">
        <div><div class="line">承辦人</div></div>
        <div><div class="line">單位主管</div></div>
        <div><div class="line">校長</div></div>
      </div>
    `;
  }
})();
