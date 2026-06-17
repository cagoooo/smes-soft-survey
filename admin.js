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
  const classSize = (id) => {
    try {
      const localSizes = JSON.parse(localStorage.getItem(SIZES_LS_KEY) || "{}");
      if (localSizes[id] != null && !isNaN(+localSizes[id])) {
        return +localSizes[id];
      }
    } catch (e) {}
    return (+SIZES[id] || AVG);
  };
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

  let db = null, FS = null, fbReady = false, SUBS = [], SNTAGS = {};
  const SIZES_LS_KEY = "smes_survey_class_sizes";
  const PICKS_LS_KEY = "smes_survey_official_picks";

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
    if (!Object.keys(SNTAGS).length) {
      try { const cat = await (await fetch("data/catalog.json", { cache: "no-cache" })).json(); cat.forEach((c) => { SNTAGS[c.sn] = c.tags || []; }); } catch (e) { }
    }
    render();
    loadState();
  }
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }

  // ── 前台填報開關（Firestore config/state；DEMO 退回 localStorage）──
  const STATE_LS_KEY = "smes_survey_state";
  const DEFAULT_CLOSED_MSG = "本次數位內容與教學軟體需求調查已截止，感謝全校老師踴躍填報！您仍可在下方查看目前的需求排行榜。";
  let surveyState = { frozen: false, message: "", updatedAt: "" };
  async function loadState() {
    if (fbReady) {
      try { const snap = await FS.getDoc(FS.doc(db, "config", "state")); surveyState = snap.exists() ? snap.data() : { frozen: false, message: "", updatedAt: "" }; }
      catch (e) { surveyState = { frozen: false, message: "", updatedAt: "" }; }
    } else {
      try { surveyState = JSON.parse(localStorage.getItem(STATE_LS_KEY)) || { frozen: false, message: "", updatedAt: "" }; }
      catch (e) { surveyState = { frozen: false, message: "", updatedAt: "" }; }
    }
    renderState();
  }
  function renderState() {
    const wrap = $("#surveyStateCtl"); if (!wrap) return;
    const frozen = !!surveyState.frozen;
    const upd = surveyState.updatedAt ? fmtTime(surveyState.updatedAt) : "—";
    const demoNote = fbReady ? "" : " · ⚠️ DEMO 模式（僅本機，正式站才會同步全校）";
    wrap.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between">
        <div>
          <span style="font-size:19px;font-weight:800;color:${frozen ? "#b91c1c" : "#0f766e"}">${frozen ? "🔴 已截止（老師無法送出）" : "🟢 開放填報中"}</span>
          <div style="font-size:12px;color:var(--muted);margin-top:4px">最後變更：${upd}${demoNote}</div>
        </div>
        <button id="stateToggleBtn" class="btn ${frozen ? "btn--primary" : "btn--danger"}" type="button">${frozen ? "▶️ 重新開放填報" : "⏸️ 切換為「已截止」"}</button>
      </div>
      <details style="margin-top:14px">
        <summary style="cursor:pointer;font-size:14px;color:var(--muted)">✏️ 自訂截止公告文字（選填，最多 200 字）</summary>
        <textarea id="stateMsg" maxlength="200" rows="2" style="width:100%;margin-top:8px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;font:inherit;font-size:14px" placeholder="${esc(DEFAULT_CLOSED_MSG)}">${esc(surveyState.message || "")}</textarea>
        <div style="font-size:12px;color:var(--muted);margin-top:4px">老師端截止橫幅會顯示此文字（留空用預設）。切換狀態時一併儲存。</div>
      </details>`;
    $("#stateToggleBtn").addEventListener("click", toggleState);
  }
  async function toggleState() {
    const next = !surveyState.frozen;
    if (next && !confirm("確定切換為「已截止」？老師端會顯示截止橫幅、無法再送出填報（可隨時切回開放）。")) return;
    const msgEl = $("#stateMsg");
    const rec = {
      frozen: next,
      message: (msgEl && msgEl.value.trim()) ? msgEl.value.trim().slice(0, 200) : DEFAULT_CLOSED_MSG,
      updatedAt: new Date().toISOString()
    };
    const btn = $("#stateToggleBtn"); if (btn) { btn.disabled = true; btn.textContent = "儲存中…"; }
    try {
      if (fbReady) { await FS.setDoc(FS.doc(db, "config", "state"), rec); }
      else { localStorage.setItem(STATE_LS_KEY, JSON.stringify(rec)); }
      surveyState = rec; renderState();
    } catch (e) {
      alert("切換失敗：" + (e && e.message ? e.message : e));
      renderState();
    }
  }

  function getOfficialPicks(ranked) {
    try {
      const picks = JSON.parse(localStorage.getItem(PICKS_LS_KEY));
      if (Array.isArray(picks)) {
        return picks.filter(sn => ranked.some(r => r.sn === sn));
      }
    } catch (e) {}
    const defaultPicks = (ranked || []).slice(0, 5).map(r => r.sn);
    try { localStorage.setItem(PICKS_LS_KEY, JSON.stringify(defaultPicks)); } catch (e) {}
    return defaultPicks;
  }

  // ── 彙總（班級用聯集去重）──
  function aggregate() {
    // 統購
    const buy = {};
    TONGGOU.forEach((x) => buy[x.key] = { teachers: [], classUnion: new Set() });
    // 自主
    const soft = {}; // sn -> {name, group, teachers:[], classUnion:Set}
    const byGroup = { 1: 0, 2: 0, 3: 0 }, byDomain = {}, byDay = {}, demandClasses = new Set();
    SUBS.forEach((s) => {
      const cls = Array.isArray(s.classes) ? s.classes : [];
      const t = s.tonggou || {};
      let hasNeed = false;
      TONGGOU.forEach((x) => {
        if (+t[x.key] > 0) { hasNeed = true; buy[x.key].teachers.push(s.name); cls.forEach((c) => buy[x.key].classUnion.add(c)); }
      });
      (s.picks || []).forEach((p) => {
        hasNeed = true;
        const o = soft[p.sn] || (soft[p.sn] = { name: p.name, group: p.group, teachers: [], classUnion: new Set() });
        o.teachers.push(s.name); cls.forEach((c) => o.classUnion.add(c));
        if (p.group) byGroup[p.group] = (byGroup[p.group] || 0) + 1;
        (SNTAGS[p.sn] || []).forEach((tag) => byDomain[tag] = (byDomain[tag] || 0) + 1);
      });
      if (hasNeed) cls.forEach((c) => demandClasses.add(c));
      const day = (s.ts || "").slice(0, 10); if (day) byDay[day] = (byDay[day] || 0) + 1;
    });
    const ranked = Object.keys(soft).map((sn) => {
      const o = soft[sn];
      return { sn, name: o.name, group: o.group, teachers: o.teachers, count: o.teachers.length, classes: o.classUnion.size, students: studentsOf(o.classUnion) };
    }).sort((a, b) => b.count - a.count || b.students - a.students);
    const byGrade = {};
    (CFG.classGroups || []).forEach((g) => byGrade[g.grade] = 0);
    demandClasses.forEach((id) => { const c = CLASSES.find((x) => x.id === id); if (c) byGrade[c.grade] = (byGrade[c.grade] || 0) + 1; });
    return { buy, ranked, byGroup, byDomain, byGrade, byDay, soft };
  }

  /* ── 圖表（純 CSS/SVG）── */
  function barChart(elId, rows, color) {
    const el = $(elId); if (!el) return;
    const max = Math.max(1, ...rows.map((r) => r.value));
    el.innerHTML = rows.length ? rows.map((r) =>
      `<div class="bar"><span class="bar__l">${esc(r.label)}</span>
        <span class="bar__track"><span class="bar__fill" style="width:${Math.round(r.value / max * 100)}%;background:${color || "var(--brand)"}"></span></span>
        <span class="bar__v">${r.value}</span></div>`).join("") : `<p class="summary__empty">尚無資料</p>`;
  }
  function pieChart(elId, parts) {
    const el = $(elId); if (!el) return;
    const total = parts.reduce((n, p) => n + p.value, 0);
    if (!total) { el.innerHTML = `<p class="summary__empty">尚無資料</p>`; return; }
    let acc = 0; const segs = parts.map((p) => { const a = acc, b = acc + p.value / total * 360; acc = b; return `${p.color} ${a}deg ${b}deg`; }).join(",");
    el.innerHTML = `<div class="pie" style="background:conic-gradient(${segs})"></div>
      <div class="pie__legend">${parts.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.label)}　${p.value}（${Math.round(p.value / total * 100)}%）</span>`).join("")}</div>`;
  }
  function renderCharts(a) {
    pieChart("#chartGroup", [
      { label: "數位內容", value: a.byGroup[1] || 0, color: "#4338ca" },
      { label: "課堂教學軟體", value: a.byGroup[2] || 0, color: "#047857" },
      { label: "遠距教學軟體", value: a.byGroup[3] || 0, color: "#b91c1c" }
    ]);
    barChart("#chartDomain", Object.keys(a.byDomain).map((t) => ({ label: t, value: a.byDomain[t] })).sort((x, y) => y.value - x.value).slice(0, 10), "var(--pick)");
    barChart("#chartGrade", Object.keys(a.byGrade).map((g) => ({ label: g, value: a.byGrade[g] })), "var(--brand)");
    barChart("#chartDay", Object.keys(a.byDay).sort().map((d) => ({ label: d.slice(5), value: a.byDay[d] })), "var(--rank)");
  }

  function render() {
    const agg = aggregate();
    const { buy, ranked, soft } = agg;
    renderCharts(agg);

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

    // 渲染有需求班級人數微調區
    const classSizesBlock = $("#classSizesBlock");
    const classSizesInputs = $("#classSizesInputs");
    if (classSizesBlock && classSizesInputs) {
      const activeClasses = [];
      Object.keys(buy).forEach(k => {
        if (buy[k].classUnion) [...buy[k].classUnion].forEach(c => activeClasses.push(c));
      });
      ranked.forEach(r => {
        const item = soft[r.sn];
        if (item && item.classUnion) [...item.classUnion].forEach(c => activeClasses.push(c));
      });
      const uniqueActiveClasses = [...new Set(activeClasses)].sort((a, b) => a.localeCompare(b));
      
      if (uniqueActiveClasses.length > 0) {
        classSizesBlock.hidden = false;
        try {
          const localSizes = JSON.parse(localStorage.getItem(SIZES_LS_KEY) || "{}");
          classSizesInputs.innerHTML = uniqueActiveClasses.map((id) => {
            const currentVal = localSizes[id] != null ? localSizes[id] : (SIZES[id] || "");
            return `<div style="display:flex;align-items:center;gap:6px;font-size:14px;background:var(--card-bg);border:1px solid var(--line);padding:6px 12px;border-radius:8px">
              <span style="font-weight:bold">${esc(clsLabel(id))}：</span>
              <input type="number" class="class-size-input" data-cid="${esc(id)}" value="${currentVal}" placeholder="預設 25" style="width:70px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;font-size:14px" min="0" /> 人
            </div>`;
          }).join("");
        } catch (e) {
          classSizesInputs.innerHTML = "<p style='color:var(--warn)'>載入班級人數設定失敗</p>";
        }
      } else {
        classSizesBlock.hidden = true;
      }
    }

    const officialPicks = getOfficialPicks(ranked);

    // 自主排行
    $("#rankFull").innerHTML = ranked.length ? ranked.map((r, i) => {
      const isPicked = officialPicks.includes(r.sn);
      return `<details class="adm-rank ${isPicked ? "adm-rank--top" : ""}">
        <summary>
          <label style="display:inline-flex;align-items:center;gap:6px;margin-right:8px" class="no-print" onclick="event.stopPropagation()">
            <input type="checkbox" class="rank-pick-cb" data-sn="${esc(r.sn)}" ${isPicked ? "checked" : ""} style="cursor:pointer" />
            <span style="font-size:12px;color:var(--muted);user-select:none;cursor:pointer">提報</span>
          </label>
          <span class="rank__no">${isPicked ? "🏅" : ""}#${i + 1}</span>
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
  // 官方表單格式（對應教育局調查表欄位，可直接貼入）
  $("#csvOfficial").addEventListener("click", () => {
    const { buy, ranked } = aggregate();
    const officialPicks = getOfficialPicks(ranked);
    const sUnit = (k) => studentsOf(buy[k].classUnion);
    const rows = [];
    rows.push(["桃園市115年數位內容與教學軟體需求調查表 — 系統彙整"]);
    rows.push([`學校：${(CFG.school || {}).name || ""}`, `填表人：${(CFG.school || {}).reporter || ""}`]);
    rows.push([]);
    rows.push(["一、本局規劃統購之軟體"]);
    rows.push(["序號", "軟體名稱", "實際需求數", "單位"]);
    rows.push([1, "AILEAD365線上教學平臺", sUnit("ailead"), "需求學生數"]);
    rows.push([2, "翰林雲端學院 TEAMS Lite 教師『派卷』+『派片』國中進度", sUnit("hanlin"), "需求學生數"]);
    rows.push([3, "ClassSwift 課堂互動軟體", buy.classswift.teachers.length, "需求教師數"]);
    rows.push([]);
    rows.push(["二、各校自主需求軟體（依需求高低取前 5 名）"]);
    rows.push(["排序", "教育部公告產品序號", "組別(1數位內容/2課堂教學/3遠距)", "品項名稱", "班級數", "教師數", "學生數"]);
    
    const pickedItems = officialPicks.map((sn) => ranked.find(r => r.sn === sn)).filter(Boolean);
    pickedItems.forEach((r, i) => rows.push([i + 1, r.sn, r.group, r.name, r.classes, r.count, r.students]));
    
    if (!pickedItems.length) rows.push(["（尚無自主需求填報）"]);
    dl("石門國小_教育局官方表單格式.csv", rows);
  });

  // ── 一鍵複製官方填報文字（對應教育局 1667 線上表單，可直接貼上）──
  function buildOfficialText() {
    const { buy, ranked } = aggregate();
    const officialPicks = getOfficialPicks(ranked);
    const sch = CFG.school || {};
    const sStu = (k) => studentsOf(buy[k].classUnion);
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}/${pad(now.getMonth() + 1)}/${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const L = [];
    L.push(`桃園市115年「中小學數位學習實施計畫」數位內容與教學軟體需求調查`);
    L.push(`（教育局線上填報編號 ${CFG.formNo || "1667"}／${CFG.docNo || ""}）`);
    L.push("");
    L.push(`學校：${sch.name || ""}`);
    L.push(`填表人：${sch.reporter || ""}　電話：${sch.phone || ""}`);
    L.push(`產出時間：${stamp}　填報老師數：${SUBS.length} 位`);
    L.push("");
    L.push("═══ 一、本局規劃統購之軟體 ═══");
    L.push(`1. AILEAD365線上教學平臺　需求學生數：${sStu("ailead")} 人`);
    L.push(`2. 翰林雲端學院 TEAMS Lite（教師派卷+派片國中進度）　需求學生數：${sStu("hanlin")} 人`);
    L.push(`3. ClassSwift 課堂互動軟體　需求教師數：${buy.classswift.teachers.length} 人`);
    L.push("");
    L.push("═══ 二、各校自主需求軟體（依需求高低取前 5 名）═══");
    L.push("排序　產品序號　組別　品項名稱　班級數　教師數　學生數");
    const picked = officialPicks.map((sn) => ranked.find((r) => r.sn === sn)).filter(Boolean);
    if (picked.length) {
      picked.forEach((r, i) => L.push(`${i + 1}　${r.sn}　${GROUP[r.group] || ""}　${r.name}　${r.classes}　${r.count}　${r.students}`));
    } else {
      L.push("（尚無自主需求填報）");
    }
    return L.join("\n");
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
    } catch (e) { /* 退回 execCommand */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.focus(); ta.select();
      const ok = document.execCommand("copy"); document.body.removeChild(ta); return ok;
    } catch (e) { return false; }
  }
  $("#copyOfficial").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const text = buildOfficialText();
    const ok = await copyText(text);
    const orig = btn.textContent;
    if (ok) {
      btn.textContent = "✅ 已複製，貼到 1667 即可";
      setTimeout(() => { btn.textContent = orig; }, 2600);
    } else {
      // 複製失敗：開新視窗讓承辦人手動全選複製
      const w = window.open("", "_blank");
      if (w) { w.document.write("<pre style='font:14px/1.7 monospace;padding:20px;white-space:pre-wrap'>" + esc(text) + "</pre>"); w.document.title = "官方填報文字（請全選複製）"; }
      else { alert("複製失敗，請手動複製：\n\n" + text); }
    }
  });

  // ── 完整備份 JSON（保險用，含 metadata）──
  $("#backupJson").addEventListener("click", () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const payload = {
      _meta: {
        school: (CFG.school || {}).name || "",
        formNo: CFG.formNo || "",
        exportedAt: now.toISOString(),
        source: fbReady ? "Firebase Firestore（即時）" : "本機 DEMO",
        count: SUBS.length
      },
      submissions: SUBS
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `石門國小_需求調查備份_${dateStr}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  });

  $("#refreshBtn").addEventListener("click", load);

  // 監聽班級人數修改
  const classSizesInputs = $("#classSizesInputs");
  if (classSizesInputs) {
    classSizesInputs.addEventListener("change", (e) => {
      const input = e.target.closest(".class-size-input");
      if (!input) return;
      const cid = input.dataset.cid;
      const val = input.value.trim();
      try {
        const localSizes = JSON.parse(localStorage.getItem(SIZES_LS_KEY) || "{}");
        if (val === "" || isNaN(+val) || +val < 0) {
          delete localSizes[cid];
        } else {
          localSizes[cid] = +val;
        }
        localStorage.setItem(SIZES_LS_KEY, JSON.stringify(localSizes));
        render();
      } catch (err) { console.error(err); }
    });
  }

  // 監聽排行榜勾選
  const rankFull = $("#rankFull");
  if (rankFull) {
    rankFull.addEventListener("change", (e) => {
      const cb = e.target.closest(".rank-pick-cb");
      if (!cb) return;
      const sn = cb.dataset.sn;
      const checked = cb.checked;
      
      const agg = aggregate();
      let picks = getOfficialPicks(agg.ranked);
      
      if (checked) {
        if (picks.length >= 5) {
          alert("自主軟體至多只能提報 5 項！請先取消其他軟體。");
          cb.checked = false;
          return;
        }
        if (!picks.includes(sn)) picks.push(sn);
      } else {
        picks = picks.filter(x => x !== sn);
      }
      try {
        localStorage.setItem(PICKS_LS_KEY, JSON.stringify(picks));
      } catch (err) {}
      render();
    });
  }
})();
