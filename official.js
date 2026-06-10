/* ============================================================
   石門國小 數位軟體需求調查 — 核章 PDF 官方表格
   讀 Firestore → 彙整 → 套教育局表格版面 → 列印/存 PDF
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.SURVEY_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const LS_KEY = "smes_survey_v1";
  const AVG = CFG.avgClassSize || 25;
  const SIZES = CFG.classSizes || {};
  const CLASSES = (CFG.classGroups || []).flatMap((g) => g.classes.map((c) => ({ id: g.grade + c, grade: g.grade, label: c })));
  const classSize = (id) => (+SIZES[id] || AVG);
  const studentsOf = (set) => [...set].reduce((n, id) => n + classSize(id), 0);
  const ADMIN_CODE = "smes-survey-2026";
  try { document.documentElement.style.zoom = localStorage.getItem("smes_fontscale") || "1"; } catch (e) { }

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
    $("#meetName").value = CFG.meetingName || "";
    $("#meetDate").value = CFG.meetingDate || "";
    $("#meetName").addEventListener("input", render);
    $("#meetDate").addEventListener("input", render);
    $("#printBtn").addEventListener("click", () => window.print());
    $("#refreshBtn").addEventListener("click", load);
    await load();
  }

  async function load() {
    $("#ofMode").textContent = "讀取中…";
    fbReady = await initFirebase(); SUBS = [];
    if (fbReady) {
      try { const snap = await FS.getDocs(FS.collection(db, CFG.collection || "submissions")); snap.forEach((d) => SUBS.push(d.data())); $("#ofMode").textContent = `Firebase 即時（${SUBS.length} 位老師）`; }
      catch (e) { $("#ofMode").textContent = "讀取失敗：" + e.message; }
    } else { SUBS = readLocal(); $("#ofMode").textContent = `DEMO（本機 ${SUBS.length} 筆）`; }
    render();
  }

  function aggregate() {
    const buy = { ailead: new Set(), hanlin: new Set(), classswift: [] };
    const soft = {};
    SUBS.forEach((s) => {
      const cls = Array.isArray(s.classes) ? s.classes : [];
      const t = s.tonggou || {};
      if (+t.ailead > 0) cls.forEach((c) => buy.ailead.add(c));
      if (+t.hanlin > 0) cls.forEach((c) => buy.hanlin.add(c));
      if (+t.classswift > 0) buy.classswift.push(s.name);
      (s.picks || []).forEach((p) => {
        const o = soft[p.sn] || (soft[p.sn] = { name: p.name, group: p.group, teachers: [], classUnion: new Set() });
        o.teachers.push(s.name); cls.forEach((c) => o.classUnion.add(c));
      });
    });
    const ranked = Object.keys(soft).map((sn) => {
      const o = soft[sn];
      return { sn, name: o.name, group: o.group, count: o.teachers.length, classes: o.classUnion.size, students: studentsOf(o.classUnion) };
    }).sort((a, b) => b.count - a.count || b.students - a.students);
    return {
      aileadStu: studentsOf(buy.ailead), hanlinStu: studentsOf(buy.hanlin), classswiftTea: buy.classswift.length,
      top5: ranked.slice(0, 5)
    };
  }

  function render() {
    const a = aggregate();
    const sc = CFG.school || {};
    const mDate = $("#meetDate").value.trim() || "________";
    const mName = $("#meetName").value.trim() || "____________";
    const real = a.top5;   // 已 slice ≤5、無 null
    const realRows = real.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.sn)}</td><td>${r.group || ""}</td><td class="l">${esc(r.name)}</td><td>${r.classes}</td><td>${r.count}</td><td>${r.students}</td></tr>`).join("");
    const blanks = Array.from({ length: Math.max(0, 5 - real.length) }, (_, i) =>
      `<tr><td>${real.length + i + 1}</td><td></td><td></td><td class="l"></td><td></td><td></td><td></td></tr>`).join("");

    $("#ofDoc").innerHTML = `
      <h1>桃園市115年「中小學數位學習實施計畫」<br>數位內容與教學軟體需求調查表</h1>
      <p class="of-sub">線上填報編號 1667 ｜ 依據 桃教資字第1150051445號</p>

      <table class="of">
        <tr><th>學校名稱</th><td colspan="3" class="l">${esc(sc.name || "桃園市龍潭區石門國民小學")}</td>
            <th>全校總班級數</th><td>${sc.classesTotal ?? ""}</td><th>普通班</th><td>${sc.classesNormal ?? ""}</td></tr>
        <tr><th>全校教師數</th><td>${sc.teachers ?? ""}</td><th>全校學生數</th><td>${sc.students ?? ""}</td>
            <th>班級最大學生數</th><td>${sc.maxClassStudents ?? ""}</td><th>每班平均</th><td>${AVG}</td></tr>
        <tr><th>填表人</th><td colspan="3" class="l">${esc(sc.reporter || "")}</td>
            <th>聯絡</th><td colspan="3" class="l">${esc(sc.phone || "")}　${esc(sc.email || "")}</td></tr>
      </table>

      <p class="of-meeting">本校業經 115 年 ${esc(mDate)} 正式會議（名稱：${esc(mName)}）討論教學軟體及數位內容師生使用需求數量。</p>

      <h2>一、本局規劃統購之軟體</h2>
      <table class="of">
        <tr><th>序號</th><th>軟體名稱</th><th>實際需求數</th><th>單位</th></tr>
        <tr><td>1</td><td class="l">AILEAD365線上教學平臺</td><td>${a.aileadStu}</td><td>需求學生數</td></tr>
        <tr><td>2</td><td class="l">翰林雲端學院 TEAMS Lite 教師『派卷』+『派片』國中進度</td><td>${a.hanlinStu}</td><td>需求學生數</td></tr>
        <tr><td>3</td><td class="l">ClassSwift 課堂互動軟體</td><td>${a.classswiftTea}</td><td>需求教師數</td></tr>
      </table>

      <h2>二、各校自主需求軟體（依需求高低排序，至多 5 項）</h2>
      <table class="of">
        <tr><th>排序</th><th>教育部公告產品序號</th><th>組別</th><th>品項名稱</th><th>班級數</th><th>教師數</th><th>學生數</th></tr>
        ${realRows}
        ${blanks}
      </table>
      <p style="font-size:11.5px;color:#555">組別代碼：1 數位內容　2 課堂教學軟體　3 遠距教學軟體。學生數依「有需求班級（去重）×每班人數」推估。</p>

      <div class="of-sign">
        <div><div class="line">承辦人</div></div>
        <div><div class="line">單位主管</div></div>
        <div><div class="line">校長</div></div>
      </div>
    `;
  }
})();
