/* ============================================================
   石門國小 數位軟體需求調查 — 管理後台
   統計邏輯：教師數＝勾選人數；班級數＝勾選老師班級的「聯集（去重）」；
            學生數＝班級數 × 平均每班人數。同一班被導師＋科任重複需求只算一次。
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.SURVEY_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const GROUP = { 1: "數位內容", 2: "課堂教學軟體", 3: "遠距教學軟體" };
  const LS_KEY = "smes_survey_v1";
  const AVG = CFG.avgClassSize || 25;
  const CLASSES = (CFG.classGroups || []).flatMap((g) => g.classes.map((c) => ({ id: g.grade + c, grade: g.grade, label: c })));
  const clsLabel = (id) => { const c = CLASSES.find((x) => x.id === id); return c ? c.grade + c.label : id; };
  const SIZES = CFG.classSizes || {};
  const classSize = (id) => (+SIZES[id] || AVG);                       // 各班實際人數，無則用平均
  const studentsOf = (set) => [...set].reduce((n, id) => n + classSize(id), 0);
  // 套用老師端設定的字級（同源 localStorage）
  try { document.documentElement.style.zoom = localStorage.getItem("smes_fontscale") || "1"; } catch (e) { }

  // 輕量密碼閘（可自行修改）。Firestore 為公開讀取，此僅避免誤入，非真實權限控管。
  const ADMIN_CODE = "smes-survey-2026";

  const TONGGOU = [
    { key: "ailead", name: "AILEAD365 線上教學平臺", metric: "students" },
    { key: "hanlin", name: "翰林雲端學院 TEAMS Lite", metric: "students" },
    { key: "classswift", name: "ClassSwift 課堂互動軟體", metric: "teachers" }
  ];

  let db = null, FS = null, fbReady = false, SUBS = [];

  $("#gateBtn").addEventListener("click", tryEnter);
  $("#gateInput").addEventListener("keydown", (e) => { if (e.key === "Enter") tryEnter(); });
  function tryEnter() {
    if ($("#gateInput").value === ADMIN_CODE) { $("#gate").style.display = "none"; $("#panel").hidden = false; load(); }
    else { $("#gateMsg").className = "submit-msg err"; $("#gateMsg").textContent = "密碼錯誤"; }
  }

  async function initFirebase() {
    if (!CFG.USE_FIREBASE || !CFG.firebaseConfig || String(CFG.firebaseConfig.apiKey).startsWith("__")) return false;
    try {
      const a = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      FS = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      db = FS.getFirestore(a.initializeApp(CFG.firebaseConfig)); return true;
    } catch (e) { console.warn("Firebase init 失敗，改讀本機 DEMO：", e); return false; }
  }

  async function load() {
    $("#dataMode").textContent = "讀取中…";
    fbReady = await initFirebase(); SUBS = [];
    if (fbReady) {
      try {
        const snap = await FS.getDocs(FS.collection(db, CFG.collection || "submissions"));
        snap.forEach((d) => SUBS.push(d.data()));
        $("#dataMode").textContent = `資料來源：Firebase 即時（${SUBS.length} 位老師填報）· 平均每班 ${AVG} 人`;
      } catch (e) { $("#dataMode").textContent = "讀取 Firebase 失敗：" + e.message; }
    } else { SUBS = readLocal(); $("#dataMode").textContent = `DEMO 模式（本機 ${SUBS.length} 筆）· 平均每班 ${AVG} 人`; }
    render();
  }
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }

  // ── 彙總（班級用聯集去重）──
  function aggregate() {
    // 統購
    const buy = {};
    TONGGOU.forEach((x) => buy[x.key] = { teachers: [], classUnion: new Set() });
    // 自主
    const soft = {}; // sn -> {name, group, teachers:[], classUnion:Set}
    SUBS.forEach((s) => {
      const cls = Array.isArray(s.classes) ? s.classes : [];
      const t = s.tonggou || {};
      TONGGOU.forEach((x) => {
        if (+t[x.key] > 0) { buy[x.key].teachers.push(s.name); cls.forEach((c) => buy[x.key].classUnion.add(c)); }
      });
      (s.picks || []).forEach((p) => {
        const o = soft[p.sn] || (soft[p.sn] = { name: p.name, group: p.group, teachers: [], classUnion: new Set() });
        o.teachers.push(s.name); cls.forEach((c) => o.classUnion.add(c));
      });
    });
    const ranked = Object.keys(soft).map((sn) => {
      const o = soft[sn];
      return { sn, name: o.name, group: o.group, teachers: o.teachers, count: o.teachers.length, classes: o.classUnion.size, students: studentsOf(o.classUnion) };
    }).sort((a, b) => b.count - a.count || b.students - a.students);
    return { buy, ranked };
  }

  function render() {
    const { buy, ranked } = aggregate();

    const picksTotal = SUBS.reduce((n, s) => n + (s.picks ? s.picks.length : 0), 0);
    $("#statGrid").innerHTML = [
      stat("填報老師", SUBS.length, "位"),
      stat("自主軟體勾選", picksTotal, "項次"),
      stat("不重複自主軟體", ranked.length, "套"),
      stat("導師/科任/其他", roleCounts(), "")
    ].join("");

    // 統購
    $("#tonggouStat").innerHTML = TONGGOU.map((x) => {
      const b = buy[x.key], n = b.teachers.length, cls = b.classUnion.size;
      const val = x.metric === "teachers"
        ? `教師數 <b>${n}</b>`
        : `學生數 <b>${studentsOf(b.classUnion)}</b> <span style="color:var(--muted);font-size:12px">（${cls} 班去重推估）· 教師 ${n}</span>`;
      return `<div class="sumrow"><span><b>${esc(x.name)}</b></span><span>${val}</span></div>
        <div style="font-size:12px;color:var(--muted);margin:-2px 0 8px">需求老師：${b.teachers.map(esc).join("、") || "—"}</div>`;
    }).join("");

    // 自主排行
    $("#rankFull").innerHTML = ranked.length ? ranked.map((r, i) => {
      const top5 = i < 5;
      return `<details class="adm-rank ${top5 ? "adm-rank--top" : ""}">
        <summary>
          <span class="rank__no">${top5 ? "🏅" : ""}${i + 1}</span>
          <span class="rank__name">${esc(r.name)}${r.sn === "11112-045" ? " ⭐" : ""}
            <span class="gtag gtag-${r.group}">${GROUP[r.group] || ""}</span></span>
          <span class="rank__cnt">教師 ${r.count}｜班級 ${r.classes}｜學生 ${r.students}</span>
        </summary>
        <div class="adm-rank__body">序號 ${r.sn}　需求老師：${r.teachers.map(esc).join("、")}</div>
      </details>`;
    }).join("") : `<div class="card"><p class="summary__empty">尚無自主需求填報。</p></div>`;

    // 老師名單
    $("#teacherCount").textContent = `共 ${SUBS.length} 位老師填報`;
    const sorted = [...SUBS].sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));
    $("#teacherList").innerHTML = sorted.length ? sorted.map((s) => {
      const buyStr = TONGGOU.filter((x) => +(s.tonggou || {})[x.key] > 0).map((x) => x.name.split(" ")[0]).join("、");
      const pickStr = (s.picks || []).map((p) => esc(p.name)).join("、");
      const clsStr = (s.classes || []).map((c) => esc(clsLabel(c))).join("、") || "—";
      return `<div class="card adm-teacher">
        <div class="adm-teacher__top"><b>${esc(s.name)}</b>
          <span style="color:var(--muted);font-size:12px">${esc(s.role || "")} · ${fmtTime(s.ts)}</span></div>
        <div class="adm-teacher__line"><span class="tagmini">班級</span> ${clsStr}</div>
        ${buyStr ? `<div class="adm-teacher__line"><span class="tagmini" style="background:var(--buy-l);color:var(--buy)">統購</span> ${esc(buyStr)}</div>` : ""}
        ${pickStr ? `<div class="adm-teacher__line"><span class="tagmini" style="background:var(--pick-l);color:var(--pick)">自主</span> ${pickStr}</div>` : ""}
      </div>`;
    }).join("") : `<div class="card"><p class="summary__empty">尚無老師填報。</p></div>`;
  }
  function stat(label, val, unit) { return `<div class="stat"><div class="stat__v">${val}<small>${unit}</small></div><div class="stat__l">${label}</div></div>`; }
  function roleCounts() {
    const c = { 導師: 0, 科任: 0 }; let other = 0;
    SUBS.forEach((s) => { if (s.role === "導師") c.導師++; else if (s.role === "科任") c.科任++; else other++; });
    return `${c.導師}/${c.科任}/${other}`;
  }
  function fmtTime(iso) { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? iso : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

  // ── CSV（UTF-8 BOM）──
  function dl(name, rows) {
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  $("#csvSoft").addEventListener("click", () => {
    const { ranked } = aggregate();
    const rows = [["排名", "序號", "軟體名稱", "組別", "教師數", "班級數(去重)", "學生數(估)", "是否前5", "需求老師"]];
    ranked.forEach((r, i) => rows.push([i + 1, r.sn, r.name, GROUP[r.group] || "", r.count, r.classes, r.students, i < 5 ? "★前5" : "", r.teachers.join("、")]));
    dl("石門國小_自主軟體需求彙總.csv", rows);
  });
  $("#csvTeacher").addEventListener("click", () => {
    const rows = [["姓名", "職稱", "任教班級", "送出時間", "AILEAD365", "翰林TEAMS Lite", "ClassSwift", "自主需求軟體"]];
    SUBS.forEach((s) => {
      const t = s.tonggou || {};
      rows.push([s.name, s.role || "", (s.classes || []).map(clsLabel).join("、"), fmtTime(s.ts),
        +t.ailead > 0 ? "✓" : "", +t.hanlin > 0 ? "✓" : "", +t.classswift > 0 ? "✓" : "",
        (s.picks || []).map((p) => p.name).join("；")]);
    });
    dl("石門國小_老師填報明細.csv", rows);
  });

  $("#refreshBtn").addEventListener("click", load);
})();
