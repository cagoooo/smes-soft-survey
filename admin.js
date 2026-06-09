/* ============================================================
   石門國小 數位軟體需求調查 — 管理後台
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.SURVEY_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const GROUP = { 1: "數位內容", 2: "課堂教學軟體", 3: "遠距教學軟體" };
  const LS_KEY = "smes_survey_v1";

  // 輕量密碼閘（可自行修改）。注意：因 Firestore 開放讀取，此僅為避免誤入，非真實權限控管。
  const ADMIN_CODE = "smes-survey-2026";

  const TONGGOU = [
    { key: "ailead", name: "AILEAD365 線上教學平臺", unit: "學生" },
    { key: "hanlin", name: "翰林雲端學院 TEAMS Lite", unit: "學生" },
    { key: "classswift", name: "ClassSwift 課堂互動軟體", unit: "教師" }
  ];

  let db = null, FS = null, fbReady = false, SUBS = [];

  // ── 密碼閘 ──
  $("#gateBtn").addEventListener("click", tryEnter);
  $("#gateInput").addEventListener("keydown", (e) => { if (e.key === "Enter") tryEnter(); });
  function tryEnter() {
    if ($("#gateInput").value === ADMIN_CODE) {
      $("#gate").style.display = "none";
      $("#panel").hidden = false;
      load();
    } else {
      $("#gateMsg").className = "submit-msg err";
      $("#gateMsg").textContent = "密碼錯誤";
    }
  }

  async function initFirebase() {
    if (!CFG.USE_FIREBASE || !CFG.firebaseConfig || String(CFG.firebaseConfig.apiKey).startsWith("__")) return false;
    try {
      const a = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      FS = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      db = FS.getFirestore(a.initializeApp(CFG.firebaseConfig));
      return true;
    } catch (e) { console.warn("Firebase init 失敗，改讀本機 DEMO：", e); return false; }
  }

  async function load() {
    $("#dataMode").textContent = "讀取中…";
    fbReady = await initFirebase();
    SUBS = [];
    if (fbReady) {
      try {
        const snap = await FS.getDocs(FS.collection(db, CFG.collection || "submissions"));
        snap.forEach((d) => SUBS.push(d.data()));
        $("#dataMode").textContent = `資料來源：Firebase 即時（${SUBS.length} 位老師填報）`;
      } catch (e) { $("#dataMode").textContent = "讀取 Firebase 失敗：" + e.message; }
    } else {
      SUBS = readLocal();
      $("#dataMode").textContent = `DEMO 模式（本機 ${SUBS.length} 筆）`;
    }
    render();
  }
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }

  // ── 彙總 ──
  function aggregate() {
    const buy = { ailead: 0, hanlin: 0, classswift: 0 };
    const buyTeachers = { ailead: [], hanlin: [], classswift: [] };
    const soft = {}; // sn -> {name, group, count, classes, teachers, students, names:[]}
    SUBS.forEach((s) => {
      const t = s.tonggou || {};
      TONGGOU.forEach((x) => {
        const v = +t[x.key] || 0;
        if (v > 0) { buy[x.key] += v; buyTeachers[x.key].push(`${s.name}(${v})`); }
      });
      (s.picks || []).forEach((p) => {
        const o = soft[p.sn] || (soft[p.sn] = { name: p.name, group: p.group, count: 0, classes: 0, teachers: 0, students: 0, names: [] });
        o.count++; o.classes += +p.classes || 0; o.teachers += +p.teachers || 0; o.students += +p.students || 0;
        o.names.push(s.name);
      });
    });
    const ranked = Object.keys(soft).map((sn) => ({ sn, ...soft[sn] })).sort((a, b) => b.count - a.count || b.students - a.students);
    return { buy, buyTeachers, ranked };
  }

  // ── 渲染 ──
  function render() {
    const { buy, buyTeachers, ranked } = aggregate();

    // 總覽
    const picksTotal = SUBS.reduce((n, s) => n + (s.picks ? s.picks.length : 0), 0);
    $("#statGrid").innerHTML = [
      stat("填報老師", SUBS.length, "位"),
      stat("自主軟體勾選", picksTotal, "項次"),
      stat("不重複自主軟體", ranked.length, "套"),
      stat("統購需求合計", buy.ailead + buy.hanlin + buy.classswift, "")
    ].join("");

    // 統購
    $("#tonggouStat").innerHTML = TONGGOU.map((x) =>
      `<div class="sumrow"><span><b>${esc(x.name)}</b></span>
         <span>${buy[x.key]} ${x.unit} <span style="color:var(--muted);font-size:12px">（${buyTeachers[x.key].length} 位老師）</span></span></div>
       <div style="font-size:12px;color:var(--muted);margin:-2px 0 8px">${buyTeachers[x.key].map(esc).join("、") || "—"}</div>`
    ).join("");

    // 自主排行（全部）
    if (!ranked.length) {
      $("#rankFull").innerHTML = `<div class="card"><p class="summary__empty">尚無自主需求填報。</p></div>`;
    } else {
      $("#rankFull").innerHTML = ranked.map((r, i) => {
        const top5 = i < 5;
        return `<details class="adm-rank ${top5 ? "adm-rank--top" : ""}">
          <summary>
            <span class="rank__no">${top5 ? "🏅" : ""}${i + 1}</span>
            <span class="rank__name">${esc(r.name)}${r.sn === "11112-045" ? " ⭐" : ""}
              <span class="gtag gtag-${r.group}">${GROUP[r.group] || ""}</span></span>
            <span class="rank__cnt">${r.count} 人 ｜ ${r.classes}班 ${r.teachers}師 ${r.students}生</span>
          </summary>
          <div class="adm-rank__body">序號 ${r.sn}　需求老師：${r.names.map(esc).join("、")}</div>
        </details>`;
      }).join("");
    }

    // 老師完整名單
    $("#teacherCount").textContent = `共 ${SUBS.length} 位老師填報`;
    const sorted = [...SUBS].sort((a, b) => (a.ts || "").localeCompare(b.ts || ""));
    $("#teacherList").innerHTML = sorted.length ? sorted.map((s) => {
      const buyStr = TONGGOU.filter((x) => (+(s.tonggou || {})[x.key] || 0) > 0)
        .map((x) => `${x.name.split(" ")[0]}×${s.tonggou[x.key]}`).join("、");
      const pickStr = (s.picks || []).map((p) =>
        `${esc(p.name)}（${[p.classes && p.classes + "班", p.teachers && p.teachers + "師", p.students && p.students + "生"].filter(Boolean).join("·") || "未填數"}）`).join("、");
      return `<div class="card adm-teacher">
        <div class="adm-teacher__top"><b>${esc(s.name)}</b>
          <span style="color:var(--muted);font-size:12px">${esc(s.grade || "")} · ${fmtTime(s.ts)}</span></div>
        ${buyStr ? `<div class="adm-teacher__line"><span class="tagmini" style="background:var(--buy-l);color:var(--buy)">統購</span> ${esc(buyStr)}</div>` : ""}
        ${pickStr ? `<div class="adm-teacher__line"><span class="tagmini" style="background:var(--pick-l);color:var(--pick)">自主</span> ${pickStr}</div>` : ""}
      </div>`;
    }).join("") : `<div class="card"><p class="summary__empty">尚無老師填報。</p></div>`;
  }
  function stat(label, val, unit) {
    return `<div class="stat"><div class="stat__v">${val}<small>${unit}</small></div><div class="stat__l">${label}</div></div>`;
  }
  function fmtTime(iso) { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? iso : `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

  // ── CSV 匯出（UTF-8 BOM，Excel 中文不亂碼）──
  function dl(name, rows) {
    const csv = "﻿" + rows.map((r) => r.map((c) => `"${String(c == null ? "" : c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = name; a.click(); URL.revokeObjectURL(a.href);
  }
  $("#csvSoft").addEventListener("click", () => {
    const { ranked } = aggregate();
    const rows = [["排名", "序號", "軟體名稱", "組別", "需求人數", "班級數合計", "教師數合計", "學生數合計", "是否前5", "需求老師"]];
    ranked.forEach((r, i) => rows.push([i + 1, r.sn, r.name, GROUP[r.group] || "", r.count, r.classes, r.teachers, r.students, i < 5 ? "★前5" : "", r.names.join("、")]));
    dl("石門國小_自主軟體需求彙總.csv", rows);
  });
  $("#csvTeacher").addEventListener("click", () => {
    const rows = [["姓名", "年級/領域", "送出時間", "AILEAD365", "翰林TEAMS Lite", "ClassSwift", "自主需求軟體（含數量）"]];
    SUBS.forEach((s) => {
      const t = s.tonggou || {};
      const picks = (s.picks || []).map((p) => `${p.name}[${[p.classes && p.classes + "班", p.teachers && p.teachers + "師", p.students && p.students + "生"].filter(Boolean).join("/")}]`).join("；");
      rows.push([s.name, s.grade || "", fmtTime(s.ts), +t.ailead || 0, +t.hanlin || 0, +t.classswift || 0, picks]);
    });
    dl("石門國小_老師填報明細.csv", rows);
  });

  $("#refreshBtn").addEventListener("click", load);
})();
