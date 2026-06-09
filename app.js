/* ============================================================
   石門國小 數位內容與教學軟體需求調查  —  前端邏輯
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.SURVEY_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const GROUP = { 1: "數位內容", 2: "課堂教學軟體", 3: "遠距教學軟體" };
  const LS_KEY = "smes_survey_v1";

  /* ── 三項統購軟體（區塊一）──────────────────────── */
  const TONGGOU = [
    { sn: "11111-031", name: "AILEAD365 線上教學平臺", brand: "力宇教育",
      desc: "測評、影片、分析、診斷，小中高教學整合管理系統。", unit: "學生", key: "ailead", mode: "number" },
    { sn: "11311-180", name: "翰林雲端學院 TEAMS Lite", brand: "翰林雲端學院",
      desc: "教師『派卷』+『派片』國中進度。", unit: "學生", key: "hanlin", mode: "number" },
    // ClassSwift 以「教師數」計：每位老師就是 1 人，改用勾選，教師數由後台統計人頭。
    { sn: "11212-107", name: "ClassSwift 課堂互動軟體", brand: "ViewSonic Education",
      desc: "課堂即時互動、提問、計分搶答。", unit: "教師", key: "classswift", mode: "check" }
  ];

  /* ── 狀態 ──────────────────────────────────────── */
  let CATALOG = [];           // 全部品項
  let POOL = [];              // 自主可選池（排除統購）
  let SNMAP = {};             // sn -> item
  const picks = new Map();    // sn -> {classes,students}（教師數＝1，由後台統計人頭）
  const buy = { ailead: 0, hanlin: 0, classswift: 0 };
  let activeTag = "";
  let shown = 0;
  const PAGE = 40;

  /* ── Firebase（可選）─────────────────────────────── */
  let db = null, FS = null, fbReady = false;
  async function initFirebase() {
    if (!CFG.USE_FIREBASE) return false;
    // 防呆：金鑰仍是 __佔位__ 字串（本機未注入）→ 退回 DEMO 模式
    if (!CFG.firebaseConfig || String(CFG.firebaseConfig.apiKey).startsWith("__")) {
      console.info("Firebase 金鑰未注入，使用本機 DEMO 模式。");
      return false;
    }
    try {
      const a = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      FS = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      db = FS.getFirestore(a.initializeApp(CFG.firebaseConfig));
      fbReady = true;
      return true;
    } catch (e) { console.warn("Firebase 初始化失敗，改用本機 DEMO 模式：", e); return false; }
  }

  /* ── 啟動 ──────────────────────────────────────── */
  init();
  async function init() {
    if (CFG.deadline) $("#deadlinePill").textContent = CFG.deadline;
    renderTonggou();
    try {
      const r = await fetch("data/catalog.json", { cache: "no-cache" });
      CATALOG = await r.json();
    } catch (e) {
      $("#resultsHint").textContent = "⚠️ 軟體清單載入失敗，請重新整理頁面。";
      return;
    }
    CATALOG.forEach((c) => { SNMAP[c.sn] = c; });
    POOL = CATALOG.filter((c) => !c.tonggou);
    renderLoilo();
    renderChips();
    bindEvents();
    await initFirebase();
    renderRank();
    renderSummary();
  }

  /* ── 區塊一：統購 ──────────────────────────────── */
  function renderTonggou() {
    const g = $("#tonggouGrid");
    g.innerHTML = "";
    TONGGOU.forEach((t) => {
      const card = el("div", "buy");
      const control = (t.mode === "check")
        ? `<p class="buy__unit">需求教師數（系統自動統計人頭）</p>
           <label class="buy__check">
             <input type="checkbox" data-buycheck="${t.key}" aria-label="我需要 ${esc(t.name)}" />
             <span>我需要這套（＝1 位教師）</span>
           </label>`
        : `<p class="buy__unit">需求${t.unit}數</p>
           <div class="buy__num">
             <button class="stepper" data-step="-1" data-key="${t.key}" type="button">−</button>
             <input type="number" min="0" inputmode="numeric" value="0" data-buy="${t.key}" aria-label="${esc(t.name)} 需求${t.unit}數" />
             <button class="stepper" data-step="1" data-key="${t.key}" type="button">＋</button>
           </div>`;
      card.innerHTML =
        `<p class="buy__name">${esc(t.name)}</p>
         <p class="buy__brand">${esc(t.brand)} · 序號 ${t.sn}</p>
         <p class="buy__desc">${esc(t.desc)}</p>
         ${control}`;
      g.appendChild(card);
    });
  }

  /* ── LoiLoNote 主打卡 ──────────────────────────── */
  function renderLoilo() {
    const item = SNMAP["11112-045"];
    const c = $("#loiloCard");
    if (!item) { c.hidden = true; return; }
    const on = picks.has(item.sn);
    c.innerHTML =
      `<div class="loilo__top">
         <span class="loilo__badge">⭐ 本校長期使用 · 強烈建議續用</span>
         <span class="loilo__badge" style="background:#b45309">⏳ 授權 116/2/12 到期</span>
       </div>
       <h3 class="loilo__name">${esc(item.name)}</h3>
       <p class="loilo__desc">本校已使用 <b>6–7 年</b>，老師與學生都熟悉的互動教學工具。
         教育局統購授權即將到期，<b>若想繼續使用，務必在此勾選提報</b>，否則明年將無法使用。</p>
       <label class="switch" style="font-size:15px;color:#7a3b56;font-weight:700">
         <input type="checkbox" class="item__check" data-sn="${item.sn}" ${on ? "checked" : ""} />
         我要繼續使用 LoiLoNote，把它列入需求
       </label>
       <div class="item__nums" id="loiloNums" style="${on ? "display:flex" : ""}">
         ${numInputs(item.sn)}
       </div>`;
  }

  /* ── 領域 chips ─────────────────────────────────── */
  function renderChips() {
    const box = $("#tagChips");
    const present = new Set();
    POOL.forEach((c) => c.tags.forEach((t) => present.add(t)));
    const order = (CFG.tagOrder || []).filter((t) => present.has(t));
    box.innerHTML = "";
    order.forEach((t) => {
      const chip = el("button", "chip", esc(t));
      chip.type = "button";
      chip.dataset.tag = t;
      box.appendChild(chip);
    });
  }

  /* ── 數字輸入欄（自主）──────────────────────────
     不含「教師數」：每位老師就是自己 1 人，教師數由後台統計填報人數。 */
  function numInputs(sn) {
    const p = picks.get(sn) || {};
    const f = (k, label) =>
      `<label class="numbox">${label}
         <input type="number" min="0" inputmode="numeric" data-num="${k}" data-sn="${sn}" value="${p[k] || ""}" placeholder="0" />
       </label>`;
    return f("classes", "班級數") + f("students", "學生數")
      + `<span class="numbox numbox--note">教師數＝1（系統統計）</span>`;
  }

  /* ── 篩選 ──────────────────────────────────────── */
  function getFiltered() {
    const q = $("#searchInput").value.trim().toLowerCase();
    const g = $("#groupSelect").value;
    const inc = $("#showExcluded").checked;
    if (!q && !g && !activeTag) return null; // 無條件 → 顯示提示
    let arr = POOL;
    if (!inc) arr = arr.filter((c) => !c.excluded);
    if (g) arr = arr.filter((c) => String(c.group) === g);
    if (activeTag) arr = arr.filter((c) => c.tags.includes(activeTag));
    if (q) arr = arr.filter((c) => (c.name + c.brand + c.orig + c.sn).toLowerCase().includes(q));
    return arr;
  }

  function renderResults(reset) {
    const arr = getFiltered();
    const ul = $("#results");
    const hint = $("#resultsHint");
    const more = $("#moreBtn");
    if (arr === null) {
      ul.innerHTML = ""; more.hidden = true;
      hint.style.display = ""; $("#resultCount").textContent = "";
      return;
    }
    hint.style.display = "none";
    if (reset) shown = PAGE;
    $("#resultCount").textContent = `共 ${arr.length} 項`;
    const slice = arr.slice(0, shown);
    ul.innerHTML = slice.map(itemHTML).join("") ||
      `<li class="results-hint">找不到符合的軟體，換個關鍵字試試。</li>`;
    more.hidden = arr.length <= shown;
  }

  function itemHTML(c) {
    const on = picks.has(c.sn);
    const gt = c.group ? `<span class="gtag gtag-${c.group}">${GROUP[c.group]}</span>` : "";
    const tags = c.tags.slice(0, 3).map((t) => `<span class="tagmini">${esc(t)}</span>`).join("");
    const exBadge = c.excluded ? `<span class="badge-ex">已大量採購·免填</span>` : "";
    const dis = c.excluded ? "disabled title='教育局已大量採購，本次免填'" : "";
    return `<li class="item ${on ? "item--on" : ""} ${c.excluded ? "item--excluded" : ""}" data-sn="${c.sn}">
        <input type="checkbox" class="item__check" data-sn="${c.sn}" ${on ? "checked" : ""} ${dis} aria-label="勾選 ${esc(c.name)}" />
        <div class="item__body">
          <p class="item__name">${esc(c.name)}</p>
          <p class="item__meta">${gt} <span>${esc(c.brand)}</span> <span>· ${c.sn}</span> ${exBadge} ${tags}</p>
          <div class="item__nums">${on ? numInputs(c.sn) : ""}</div>
        </div>
      </li>`;
  }

  /* ── 勾選 / 取消 ───────────────────────────────── */
  function toggle(sn, checked) {
    const c = SNMAP[sn];
    if (!c || c.excluded) return;
    if (checked) { if (!picks.has(sn)) picks.set(sn, { classes: "", students: "" }); }
    else picks.delete(sn);
    // 局部更新 LoiLoNote 卡
    if (sn === "11112-045") renderLoilo();
    refreshItem(sn);
    renderSummary();
  }

  function refreshItem(sn) {
    const li = document.querySelector(`#results .item[data-sn="${sn}"]`);
    if (!li) return;
    const on = picks.has(sn);
    li.classList.toggle("item--on", on);
    const cb = li.querySelector(".item__check"); if (cb) cb.checked = on;
    const nums = li.querySelector(".item__nums");
    if (nums) nums.innerHTML = on ? numInputs(sn) : "";
  }

  function setNum(sn, key, val) {
    const p = picks.get(sn); if (!p) return;
    p[key] = val.replace(/[^0-9]/g, "");
    renderSummary();
  }

  /* ── 摘要 ──────────────────────────────────────── */
  function renderSummary() {
    const box = $("#summary");
    const buyRows = TONGGOU.filter((t) => buy[t.key] > 0)
      .map((t) => row(`${t.name}`, t.mode === "check" ? "需要" : `${buy[t.key]} ${t.unit}`, null));
    const pickRows = [...picks.keys()].map((sn) => {
      const c = SNMAP[sn], p = picks.get(sn);
      const nums = [p.classes && `${p.classes}班`, p.students && `${p.students}生`]
        .filter(Boolean).join("・") || "需求數待填";
      return row(c.name, nums, sn);
    });
    if (!buyRows.length && !pickRows.length) {
      box.innerHTML = `<p class="summary__empty">還沒有選任何軟體。往上勾選你需要的吧！</p>`;
      return;
    }
    let html = "";
    if (buyRows.length) html += `<div class="sumhead">統購軟體</div>` + buyRows.join("");
    if (pickRows.length) html += `<div class="sumhead">自主需求軟體（${pickRows.length} 項）</div>` + pickRows.join("");
    box.innerHTML = html;
  }
  function row(name, val, sn) {
    return `<div class="sumrow"><span>${esc(name)}</span>
      <span>${esc(val)}${sn ? ` <button class="sumrow__rm" data-rm="${sn}" type="button">移除</button>` : ""}</span></div>`;
  }

  /* ── 送出 ──────────────────────────────────────── */
  async function submit() {
    const name = $("#teacherName").value.trim();
    const msg = $("#submitMsg");
    if (!name) { msg.className = "submit-msg err"; msg.textContent = "請先填寫姓名（實名制）。"; $("#teacherName").focus(); return; }
    const hasNeed = TONGGOU.some((t) => buy[t.key] > 0) || picks.size > 0;
    if (!hasNeed) { msg.className = "submit-msg err"; msg.textContent = "你還沒選任何軟體，或需求數都是 0。"; return; }

    const record = {
      name, grade: $("#teacherGrade").value.trim(),
      ts: new Date().toISOString(),
      tonggou: { ailead: buy.ailead, hanlin: buy.hanlin, classswift: buy.classswift },
      picks: [...picks.keys()].map((sn) => {
        const c = SNMAP[sn], p = picks.get(sn);
        return { sn, name: c.name, group: c.group, classes: +p.classes || 0, students: +p.students || 0 };
      })
    };

    $("#submitBtn").disabled = true;
    try {
      if (fbReady) {
        const id = name.replace(/[\/#\.\[\]\$]/g, "_") + "__" + (record.grade || "");
        await FS.setDoc(FS.doc(db, CFG.collection, id), record);
      } else {
        const all = readLocal();
        const i = all.findIndex((x) => x.name === name && (x.grade || "") === record.grade);
        if (i >= 0) all[i] = record; else all.push(record);
        localStorage.setItem(LS_KEY, JSON.stringify(all));
      }
      msg.className = "submit-msg ok";
      msg.textContent = `✅ 已送出，謝謝 ${name} 老師！你的需求已記錄${fbReady ? "（即時統計）" : "（本機 DEMO）"}。`;
      renderRank();
    } catch (e) {
      console.error(e);
      msg.className = "submit-msg err";
      msg.textContent = "送出失敗，請稍後再試或通知資訊組。";
    } finally {
      $("#submitBtn").disabled = false;
    }
  }

  /* ── 載入我先前填的 ─────────────────────────────── */
  async function loadMine() {
    const name = $("#teacherName").value.trim();
    const hint = $("#nameHint");
    if (!name) { hint.textContent = "請先輸入姓名再載入。"; return; }
    let rec = null;
    if (fbReady) {
      try {
        const snap = await FS.getDocs(FS.collection(db, CFG.collection));
        snap.forEach((d) => { const x = d.data(); if (x.name === name) rec = x; });
      } catch (e) { /* ignore */ }
    } else {
      rec = readLocal().filter((x) => x.name === name).pop();
    }
    if (!rec) { hint.textContent = "找不到先前的紀錄（或尚未填過）。"; return; }
    // 還原
    buy.ailead = rec.tonggou.ailead || 0; buy.hanlin = rec.tonggou.hanlin || 0; buy.classswift = rec.tonggou.classswift || 0;
    TONGGOU.forEach((t) => {
      if (t.mode === "check") { const cb = document.querySelector(`[data-buycheck="${t.key}"]`); if (cb) cb.checked = buy[t.key] > 0; }
      else { const inp = document.querySelector(`[data-buy="${t.key}"]`); if (inp) inp.value = buy[t.key]; }
    });
    picks.clear();
    (rec.picks || []).forEach((p) => picks.set(p.sn, { classes: p.classes || "", students: p.students || "" }));
    if (rec.grade) $("#teacherGrade").value = rec.grade;
    renderLoilo(); renderResults(true); renderSummary();
    hint.textContent = `已載入 ${name} 老師先前填的內容，可直接修改後再送出。`;
  }

  /* ── 排行榜 ─────────────────────────────────────── */
  async function renderRank() {
    const list = $("#rankList");
    const mode = $("#rankMode");
    let subs = [];
    if (fbReady) {
      try {
        const snap = await FS.getDocs(FS.collection(db, CFG.collection));
        snap.forEach((d) => subs.push(d.data()));
        mode.textContent = "資料來源：Firebase 即時統計";
      } catch (e) { mode.textContent = "讀取即時資料失敗"; }
    } else {
      subs = readLocal();
      mode.textContent = "DEMO 模式：統計僅來自本機瀏覽器（接上 Firebase 後即為全校即時）";
    }
    const cnt = {};
    subs.forEach((s) => (s.picks || []).forEach((p) => { cnt[p.sn] = (cnt[p.sn] || 0) + 1; }));
    const ranked = Object.keys(cnt).map((sn) => ({ sn, n: cnt[sn], name: (SNMAP[sn] || {}).name || sn }))
      .sort((a, b) => b.n - a.n).slice(0, 5);
    if (!ranked.length) {
      list.innerHTML = `<li class="rank__empty">尚無資料，快來成為第一個填報的老師！</li>`;
      return;
    }
    list.innerHTML = ranked.map((r, i) =>
      `<li class="rank__row ${r.sn === "11112-045" ? "rank__loilo" : ""}">
         <span class="rank__no">${i + 1}</span>
         <span class="rank__name">${esc(r.name)}${r.sn === "11112-045" ? " ⭐" : ""}</span>
         <span class="rank__cnt">${r.n} 位老師</span>
       </li>`).join("");
  }

  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }

  /* ── 事件綁定 ───────────────────────────────────── */
  function bindEvents() {
    // 統購：steppers + 直接輸入
    $("#tonggouGrid").addEventListener("click", (e) => {
      const b = e.target.closest(".stepper"); if (!b) return;
      const k = b.dataset.key, inp = document.querySelector(`[data-buy="${k}"]`);
      let v = (+inp.value || 0) + (+b.dataset.step);
      if (v < 0) v = 0; inp.value = v; buy[k] = v; renderSummary();
    });
    $("#tonggouGrid").addEventListener("input", (e) => {
      const inp = e.target.closest("[data-buy]"); if (!inp) return;
      let v = inp.value.replace(/[^0-9]/g, ""); inp.value = v; buy[inp.dataset.buy] = +v || 0; renderSummary();
    });
    // 統購：ClassSwift 等「教師數」品項用勾選（＝1，後台統計人頭）
    $("#tonggouGrid").addEventListener("change", (e) => {
      const cb = e.target.closest("[data-buycheck]"); if (!cb) return;
      buy[cb.dataset.buycheck] = cb.checked ? 1 : 0; renderSummary();
    });

    // 搜尋 / 篩選
    let t;
    $("#searchInput").addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => renderResults(true), 180); });
    $("#groupSelect").addEventListener("change", () => renderResults(true));
    $("#showExcluded").addEventListener("change", () => renderResults(true));
    $("#tagChips").addEventListener("click", (e) => {
      const chip = e.target.closest(".chip"); if (!chip) return;
      const tag = chip.dataset.tag;
      activeTag = (activeTag === tag) ? "" : tag;
      [...$("#tagChips").children].forEach((ch) => ch.classList.toggle("chip--on", ch.dataset.tag === activeTag));
      renderResults(true);
    });
    $("#moreBtn").addEventListener("click", () => { shown += PAGE; renderResults(false); });

    // 結果區：勾選 + 數字
    $("#results").addEventListener("change", (e) => {
      const cb = e.target.closest(".item__check"); if (cb) { toggle(cb.dataset.sn, cb.checked); return; }
    });
    $("#results").addEventListener("input", (e) => {
      const n = e.target.closest("[data-num]"); if (n) setNum(n.dataset.sn, n.dataset.num, n.value);
    });

    // LoiLoNote 卡
    $("#loiloCard").addEventListener("change", (e) => {
      const cb = e.target.closest(".item__check"); if (cb) toggle(cb.dataset.sn, cb.checked);
    });
    $("#loiloCard").addEventListener("input", (e) => {
      const n = e.target.closest("[data-num]"); if (n) setNum(n.dataset.sn, n.dataset.num, n.value);
    });

    // 摘要移除
    $("#summary").addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]"); if (!b) return;
      picks.delete(b.dataset.rm);
      if (b.dataset.rm === "11112-045") renderLoilo();
      refreshItem(b.dataset.rm); renderSummary();
    });

    $("#submitBtn").addEventListener("click", submit);
    $("#loadMineBtn").addEventListener("click", loadMine);
  }
})();
