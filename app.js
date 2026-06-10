/* ============================================================
   石門國小 數位內容與教學軟體需求調查  —  前端邏輯
   邏輯：老師只填「姓名＋職稱＋任教班級」並勾選需要的軟體；
        教師數/班級數/學生數一律由後台去重統計，老師不手填數量。
   ============================================================ */
(function () {
  "use strict";
  const CFG = window.SURVEY_CONFIG || {};
  const $ = (s) => document.querySelector(s);
  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const GROUP = { 1: "數位內容", 2: "課堂教學軟體", 3: "遠距教學軟體" };
  const LS_KEY = "smes_survey_v1";
  const AVG = CFG.avgClassSize || 25;

  /* ── 三項統購軟體（全部勾選制；metric 決定後台統計方式）── */
  const TONGGOU = [
    { sn: "11111-031", name: "AILEAD365 線上教學平臺", brand: "力宇教育",
      desc: "測評、影片、分析、診斷，小中高教學整合管理系統。", key: "ailead", metric: "students" },
    { sn: "11311-180", name: "翰林雲端學院 TEAMS Lite", brand: "翰林雲端學院",
      desc: "教師『派卷』+『派片』國中進度。", key: "hanlin", metric: "students" },
    { sn: "11212-107", name: "ClassSwift 課堂互動軟體", brand: "ViewSonic Education",
      desc: "課堂即時互動、提問、計分搶答。", key: "classswift", metric: "teachers" }
  ];

  /* ── 班級清單 ── */
  const CLASSES = (CFG.classGroups || []).flatMap((g) => g.classes.map((c) => ({ id: g.grade + c, grade: g.grade, label: c })));
  const ROLES = ["導師", "科任", "行政／其他"];
  const clsLabel = (id) => { const c = CLASSES.find((x) => x.id === id); return c ? c.grade + c.label : id; };

  /* ── 送出成功彩帶 ── */
  function launchConfetti() {
    const box = $("#confetti"); if (!box) return; box.innerHTML = "";
    const colors = ["#0f766e", "#2563eb", "#db2777", "#d97706", "#7c3aed", "#10b981", "#fde047"];
    for (let i = 0; i < 46; i++) {
      const p = document.createElement("i"); p.className = "confetti-piece";
      p.style.left = (Math.random() * 100) + "%";
      p.style.background = colors[i % colors.length];
      p.style.width = (7 + Math.random() * 7) + "px";
      p.style.height = (10 + Math.random() * 9) + "px";
      p.style.animationDuration = (2 + Math.random() * 1.7) + "s";
      p.style.animationDelay = (Math.random() * 0.5) + "s";
      p.style.setProperty("--r", (Math.random() * 720 - 360) + "deg");
      box.appendChild(p);
    }
    setTimeout(() => { box.innerHTML = ""; }, 4500);
  }

  /* ── 操作回饋 toast ── */
  function showToast(msg) {
    let t = $("#toast");
    if (!t) { t = el("div", "toast"); t.id = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("toast--show");
    clearTimeout(showToast._t); showToast._t = setTimeout(() => t.classList.remove("toast--show"), 2400);
  }

  /* ── 狀態 ── */
  let CATALOG = [], POOL = [], SNMAP = {};
  const picks = new Set();                 // 勾選的自主軟體 sn
  const buy = { ailead: false, hanlin: false, classswift: false };
  let role = "";                           // 導師 / 科任 / 行政／其他
  const myClasses = new Set();             // 我的班級 id
  let activeTag = "", shown = 0;
  const PAGE = 40;
  let submitted = false;                    // 是否已成功送出（狀態徽章用）
  const existingNames = new Set();           // 已填報過的姓名（重複提醒用）

  /* ── 字級切換（年長友善）── */
  const FS_KEY = "smes_fontscale";
  function initFontScale() {
    applyFontScale(localStorage.getItem(FS_KEY) || "1", false);
    const box = $("#fontScale");
    if (box) box.addEventListener("click", (e) => {
      const b = e.target.closest(".fontscale__btn"); if (b) applyFontScale(b.dataset.fs, true);
    });
  }
  function applyFontScale(z, persist) {
    document.documentElement.style.zoom = z;
    if (persist) { try { localStorage.setItem(FS_KEY, z); } catch (e) { } }
    const box = $("#fontScale");
    if (box) [...box.querySelectorAll(".fontscale__btn")].forEach((b) => b.classList.toggle("fontscale__btn--on", b.dataset.fs === String(z)));
  }

  /* ── 填報狀態徽章 ── */
  function selectedCount() { return (buy.ailead ? 1 : 0) + (buy.hanlin ? 1 : 0) + (buy.classswift ? 1 : 0) + picks.size; }
  function updateStatus() {
    const b = $("#statusBadge"); if (!b) return;
    const n = selectedCount();
    if (submitted) { b.className = "status-badge status-badge--done"; b.textContent = `✅ 已送出（${n} 套）`; }
    else if (n > 0) { b.className = "status-badge status-badge--picked"; b.textContent = `已勾選 ${n} 套，尚未送出`; }
    else { b.className = "status-badge"; b.textContent = "尚未勾選"; }
  }

  /* ── 重複填報提醒（A2）── */
  function checkExistingName() {
    const name = $("#teacherName").value.trim(), hint = $("#nameHint");
    if (!name) { hint.textContent = ""; hint.style.color = ""; return; }
    if (existingNames.has(name)) {
      hint.style.color = "var(--warn)";
      hint.textContent = "⚠️ 此姓名已有填報紀錄。再次送出會「覆蓋更新」；想修改可按上方「載入我先前填過的」。";
    } else { hint.textContent = ""; hint.style.color = ""; }
  }

  /* ── Firebase（可選）── */
  let db = null, FS = null, fbReady = false;
  async function initFirebase() {
    if (!CFG.USE_FIREBASE) return false;
    if (!CFG.firebaseConfig || String(CFG.firebaseConfig.apiKey).startsWith("__")) {
      console.info("Firebase 金鑰未注入，使用本機 DEMO 模式。"); return false;
    }
    try {
      const a = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
      FS = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
      db = FS.getFirestore(a.initializeApp(CFG.firebaseConfig));
      fbReady = true; return true;
    } catch (e) { console.warn("Firebase 初始化失敗，改用本機 DEMO：", e); return false; }
  }

  /* ── 啟動 ── */
  init();
  async function init() {
    if (CFG.deadline) $("#deadlinePill").textContent = CFG.deadline;
    initFontScale();
    renderRoles();
    renderTonggou();
    try {
      const r = await fetch("data/catalog.json", { cache: "no-cache" });
      CATALOG = await r.json();
    } catch (e) { $("#resultsHint").textContent = "⚠️ 軟體清單載入失敗，請重新整理頁面。"; return; }
    CATALOG.forEach((c) => { SNMAP[c.sn] = c; });
    POOL = CATALOG.filter((c) => !c.tonggou);
    renderLoilo();
    renderDomains();
    startCountdown();
    bindEvents();
    await initFirebase();
    renderRank();
    renderSummary();
  }

  /* ── 職稱 ── */
  function renderRoles() {
    $("#roleOpts").innerHTML = ROLES.map((r) =>
      `<button class="role-btn" data-role="${r}" type="button">${r}</button>`).join("");
  }
  function setRole(r, openModal) {
    role = r;
    myClasses.clear();
    [...$("#roleOpts").children].forEach((b) => b.classList.toggle("role-btn--on", b.dataset.role === r));
    updateMyClassesLine();
    renderSummary();
    // 點職稱（需選班級者）→ 跳出選班級彈窗（不跳頁）
    if (openModal && (r === "導師" || r === "科任")) openClassModal();
  }
  // 班級格（彈窗內）
  function renderClassGrid() {
    const byGrade = {};
    CLASSES.forEach((c) => { (byGrade[c.grade] = byGrade[c.grade] || []).push(c); });
    $("#classGrid").innerHTML = Object.keys(byGrade).map((g) =>
      `<div class="cp__row"><span class="cp__grade">${esc(g)}</span>
        ${byGrade[g].map((c) => `<button class="cp__chip ${myClasses.has(c.id) ? "cp__chip--on" : ""}" data-cid="${c.id}" type="button">${esc(c.label)}</button>`).join("")}
       </div>`).join("");
  }
  function updateDoneBtn() {
    $("#classDone").textContent = (role === "科任" && myClasses.size) ? `完成（已選 ${myClasses.size} 班）` : "完成";
  }
  function openClassModal() {
    $("#classModalTitle").textContent = role === "導師" ? "請選擇你帶的班級" : "請選擇你任教的班級";
    $("#classModalHint").textContent = role === "導師" ? "導師只能選 1 班（點一下即完成）" : "可多選：點選你任教的每個班，選完按「完成」";
    renderClassGrid(); updateDoneBtn();
    $("#classModal").hidden = false;
  }
  function closeClassModal() {
    $("#classModal").hidden = true;
    updateMyClassesLine(); renderSummary();
    if (myClasses.size) showToast(`✅ 已選班級：${[...myClasses].map(clsLabel).join("、")}`);
  }
  function toggleClass(cid) {
    if (role === "導師") {
      const had = myClasses.has(cid);
      myClasses.clear();
      if (!had) myClasses.add(cid);
    } else {
      if (myClasses.has(cid)) myClasses.delete(cid); else myClasses.add(cid);
    }
    [...$("#classGrid").querySelectorAll(".cp__chip")].forEach((b) => b.classList.toggle("cp__chip--on", myClasses.has(b.dataset.cid)));
    updateMyClassesLine(); updateDoneBtn();
    if (role === "導師" && myClasses.size === 1) closeClassModal();   // 導師選 1 班即完成（closeClassModal 會 toast）
  }
  // namebar 顯示已選班級 + 重選（收合時也會顯示，作為回饋）
  function updateMyClassesLine() {
    const line = $("#myClassesLine");
    if (!role || role === "行政／其他") { line.hidden = true; line.innerHTML = ""; return; }
    line.hidden = false;
    line.innerHTML = myClasses.size
      ? `📍 任教班級：${[...myClasses].map((i) => `<b>${esc(clsLabel(i))}</b>`).join("、")} <button class="link-btn" id="editClasses" type="button">✏️ 重選</button>`
      : `<button class="link-btn link-btn--warn" id="editClasses" type="button">⚠️ 尚未選班級，請點此選擇</button>`;
  }

  /* ── 區塊一：統購（全部勾選制）── */
  function renderTonggou() {
    const g = $("#tonggouGrid"); g.innerHTML = "";
    TONGGOU.forEach((t) => {
      const note = t.metric === "teachers" ? "教師數由系統統計" : "學生數由你的班級推估";
      const card = el("div", "buy");
      card.innerHTML =
        `<p class="buy__name">${esc(t.name)}</p>
         <p class="buy__brand">${esc(t.brand)} · 序號 ${t.sn}</p>
         <p class="buy__desc">${esc(t.desc)}</p>
         <label class="buy__check">
           <input type="checkbox" data-buycheck="${t.key}" aria-label="我需要 ${esc(t.name)}" />
           <span>我需要這套<small>（${note}）</small></span>
         </label>
         ${infoLink(t.name, t.brand, "buy__link")}`;
      g.appendChild(card);
    });
  }

  /* ── LoiLoNote 主打卡 ── */
  function renderLoilo() {
    const item = SNMAP["11112-045"], c = $("#loiloCard");
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
       <label class="buy__check" style="background:var(--loilo-l);border-color:var(--loilo);color:var(--loilo)">
         <input type="checkbox" class="item__check" data-sn="${item.sn}" ${on ? "checked" : ""} />
         <span>我要繼續使用 LoiLoNote，把它列入需求</span>
       </label>
       ${infoLink(item.name, item.brand, "loilo__link")}`;
  }

  /* ── 領域 chips ── */
  const DOMAIN_ICON = {
    "英語": "🔤", "國語文": "📖", "本土語": "🗣️", "數學": "🔢", "自然科學": "🔬",
    "社會": "🌏", "藝術": "🎨", "資訊程式": "💻", "人工智慧": "🤖", "AR/VR": "🥽",
    "閱讀圖書": "📚", "評量測驗": "📝", "視訊遠距": "📹", "影音多媒體": "🎬",
    "教學平臺工具": "🧰", "健康體育": "⚽", "幼兒學前": "🧸", "特教": "🤝"
  };
  function renderDomains() {
    const box = $("#domainGrid"), counts = {};
    POOL.forEach((c) => { if (!c.excluded) c.tags.forEach((t) => counts[t] = (counts[t] || 0) + 1); });
    box.innerHTML = (CFG.tagOrder || []).filter((t) => counts[t]).map((t) =>
      `<button class="domain-card ${activeTag === t ? "domain-card--on" : ""}" data-tag="${esc(t)}" type="button">
         <span class="domain-card__ic">${DOMAIN_ICON[t] || "📦"}</span>
         <span class="domain-card__name">${esc(t)}</span>
         <span class="domain-card__n">${counts[t]} 套</span>
       </button>`).join("");
    $("#clearDomain").hidden = !activeTag;
  }

  /* ── 截止倒數 ── */
  function startCountdown() {
    const pill = $("#countdownPill"); if (!pill || !CFG.deadlineDate) return;
    const tick = () => {
      const diff = new Date(CFG.deadlineDate).getTime() - Date.now();
      if (isNaN(diff)) { pill.hidden = true; return; }
      if (diff <= 0) { pill.textContent = "⏳ 校內填報已截止"; return; }
      const d = Math.floor(diff / 86400000), h = Math.floor(diff % 86400000 / 3600000), m = Math.floor(diff % 3600000 / 60000);
      pill.textContent = d > 0 ? `⏳ 距校內截止剩 ${d} 天 ${h} 小時` : `⏳ 距校內截止剩 ${h} 小時 ${m} 分`;
    };
    tick(); setInterval(tick, 60000);
  }
  // 「了解這套」Google 查詢連結
  function infoLink(name, brand, cls) {
    const q = encodeURIComponent(`${name} ${brand || ""}`.trim());
    return `<a class="${cls}" href="https://www.google.com/search?q=${q}" target="_blank" rel="noopener noreferrer">🔍 了解這套</a>`;
  }

  /* ── 篩選 ── */
  function getFiltered() {
    const q = $("#searchInput").value.trim().toLowerCase();
    const g = $("#groupSelect").value, inc = $("#showExcluded").checked;
    if (!q && !g && !activeTag) return null;
    let arr = POOL;
    if (!inc) arr = arr.filter((c) => !c.excluded);
    if (g) arr = arr.filter((c) => String(c.group) === g);
    if (activeTag) arr = arr.filter((c) => c.tags.includes(activeTag));
    if (q) arr = arr.filter((c) => (c.name + c.brand + c.orig + c.sn).toLowerCase().includes(q));
    return arr;
  }
  function renderResults(reset) {
    const arr = getFiltered(), ul = $("#results"), hint = $("#resultsHint"), more = $("#moreBtn");
    if (arr === null) { ul.innerHTML = ""; more.hidden = true; hint.style.display = ""; $("#resultCount").textContent = ""; return; }
    hint.style.display = "none";
    if (reset) shown = PAGE;
    $("#resultCount").textContent = `共 ${arr.length} 項`;
    ul.innerHTML = arr.slice(0, shown).map(itemHTML).join("") || `<li class="results-hint">找不到符合的軟體，換個關鍵字試試。</li>`;
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
          <div class="item__foot">${infoLink(c.name, c.brand, "item__link")}</div>
        </div>
      </li>`;
  }

  /* ── 勾選 / 取消 ── */
  function toggle(sn, checked) {
    const c = SNMAP[sn];
    if (!c || c.excluded) return;
    if (checked) picks.add(sn); else picks.delete(sn);
    if (sn === "11112-045") renderLoilo();
    const li = document.querySelector(`#results .item[data-sn="${sn}"]`);
    if (li) { li.classList.toggle("item--on", checked); const cb = li.querySelector(".item__check"); if (cb) cb.checked = checked; }
    renderSummary();
  }

  /* ── 摘要 ── */
  function renderSummary() {
    submitted = false;                 // 任何變動 → 回到「尚未送出」
    const box = $("#summary");
    const clsArr = [...myClasses];
    const idLabel = (id) => { const c = CLASSES.find((x) => x.id === id); return c ? c.grade + c.label : id; };
    const buyNames = TONGGOU.filter((t) => buy[t.key]).map((t) => t.name);
    const pickNames = [...picks].map((sn) => (SNMAP[sn] || {}).name || sn);

    let html = "";
    html += `<div class="sumrow"><span>職稱</span><span>${role ? esc(role) : "<span style='color:var(--danger)'>未選</span>"}</span></div>`;
    if (role && role !== "行政／其他")
      html += `<div class="sumrow"><span>任教班級（${clsArr.length}）</span><span>${clsArr.length ? clsArr.map((i) => esc(idLabel(i))).join("、") : "<span style='color:var(--danger)'>未選</span>"}</span></div>`;
    if (buyNames.length) html += `<div class="sumhead">統購軟體</div>` + buyNames.map((n) => row(n, "需要", null)).join("");
    if (pickNames.length) { html += `<div class="sumhead">自主需求軟體（${pickNames.length} 項）</div>`; [...picks].forEach((sn) => html += row((SNMAP[sn] || {}).name || sn, "", sn)); }
    if (!buyNames.length && !pickNames.length) html += `<p class="summary__empty">還沒勾選任何軟體。往上勾選你需要的吧！</p>`;
    box.innerHTML = html;
    updateStatus();
  }
  function row(name, val, sn) {
    return `<div class="sumrow"><span>${esc(name)}</span>
      <span>${esc(val)}${sn ? ` <button class="sumrow__rm" data-rm="${sn}" type="button">移除</button>` : ""}</span></div>`;
  }

  /* ── 送出 ── */
  async function submit() {
    const name = $("#teacherName").value.trim(), msg = $("#submitMsg");
    const fail = (m, sel) => {
      msg.className = "submit-msg err"; msg.textContent = m;
      const el = sel && $(sel);
      if (el) { el.classList.add("needs-attention"); el.scrollIntoView({ behavior: "smooth", block: "center" }); setTimeout(() => el.classList.remove("needs-attention"), 1600); }
    };
    if (!name) { fail("請先填寫姓名（實名制）。", "#namebar"); $("#teacherName").focus(); return; }
    if (!role) { fail("請選擇職稱（導師／科任／行政）。", "#roleOpts"); return; }
    if (role === "導師" && myClasses.size !== 1) { fail("導師請點選 1 個帶班班級。", "#classPicker"); return; }
    if (role === "科任" && myClasses.size < 1) { fail("科任請至少點選 1 個任教班級。", "#classPicker"); return; }
    const hasNeed = TONGGOU.some((t) => buy[t.key]) || picks.size > 0;
    if (!hasNeed) { fail("你還沒勾選任何軟體（統購或自主至少選一項）。", "#tonggouGrid"); return; }

    const record = {
      name, role, classes: [...myClasses],
      ts: new Date().toISOString(),
      tonggou: { ailead: buy.ailead ? 1 : 0, hanlin: buy.hanlin ? 1 : 0, classswift: buy.classswift ? 1 : 0 },
      picks: [...picks].map((sn) => ({ sn, name: SNMAP[sn].name, group: SNMAP[sn].group }))
    };

    $("#submitBtn").disabled = true;
    try {
      if (fbReady) {
        const id = name.replace(/[\/#\.\[\]\$]/g, "_");
        await FS.setDoc(FS.doc(db, CFG.collection, id), record);
      } else {
        const all = readLocal(); const i = all.findIndex((x) => x.name === name);
        if (i >= 0) all[i] = record; else all.push(record);
        localStorage.setItem(LS_KEY, JSON.stringify(all));
      }
      msg.className = "submit-msg ok";
      msg.textContent = `✅ 已送出，謝謝 ${name} 老師！你的需求已記錄${fbReady ? "（即時統計）" : "（本機 DEMO）"}。`;
      existingNames.add(name);
      submitted = true; updateStatus();
      $("#nameHint").textContent = "";
      renderRank();
      // 心願送出儀式感
      $("#successMsg").textContent = `謝謝 ${name} 老師！你的 ${selectedCount()} 套軟體需求已送達資訊組`;
      $("#successModal").hidden = false;
      launchConfetti();
    } catch (e) { console.error(e); fail("送出失敗，請稍後再試或通知資訊組。"); }
    finally { $("#submitBtn").disabled = false; }
  }

  /* ── 載入我先前填的 ── */
  async function loadMine() {
    const name = $("#teacherName").value.trim(), hint = $("#nameHint");
    if (!name) { hint.textContent = "請先輸入姓名再載入。"; return; }
    let rec = null;
    if (fbReady) {
      try { const snap = await FS.getDocs(FS.collection(db, CFG.collection)); snap.forEach((d) => { const x = d.data(); if (x.name === name) rec = x; }); } catch (e) { }
    } else { rec = readLocal().filter((x) => x.name === name).pop(); }
    if (!rec) { hint.textContent = "找不到先前的紀錄（或尚未填過）。"; return; }
    buy.ailead = !!(rec.tonggou || {}).ailead; buy.hanlin = !!(rec.tonggou || {}).hanlin; buy.classswift = !!(rec.tonggou || {}).classswift;
    TONGGOU.forEach((t) => { const cb = document.querySelector(`[data-buycheck="${t.key}"]`); if (cb) cb.checked = buy[t.key]; });
    picks.clear(); (rec.picks || []).forEach((p) => picks.add(p.sn));
    setRole(rec.role || "", false);
    (rec.classes || []).forEach((id) => myClasses.add(id));
    updateMyClassesLine();
    renderLoilo(); renderResults(true); renderSummary();
    hint.textContent = `已載入 ${name} 老師先前填的內容，可直接修改後再送出。`;
  }

  /* ── 公開排行榜（依勾選人數 = 教師數）── */
  async function renderRank() {
    const list = $("#rankList"), mode = $("#rankMode");
    let subs = [];
    if (fbReady) {
      try { const snap = await FS.getDocs(FS.collection(db, CFG.collection)); snap.forEach((d) => subs.push(d.data())); mode.textContent = "資料來源：Firebase 即時統計"; }
      catch (e) { mode.textContent = "讀取即時資料失敗"; }
    } else { subs = readLocal(); mode.textContent = "DEMO 模式：統計僅來自本機瀏覽器（接上 Firebase 後即為全校即時）"; }
    existingNames.clear();
    subs.forEach((s) => { if (s.name) existingNames.add(s.name); });
    checkExistingName();
    const cnt = {};
    subs.forEach((s) => (s.picks || []).forEach((p) => { cnt[p.sn] = (cnt[p.sn] || 0) + 1; }));
    const ranked = Object.keys(cnt).map((sn) => ({ sn, n: cnt[sn], name: (SNMAP[sn] || {}).name || sn })).sort((a, b) => b.n - a.n).slice(0, 5);
    list.innerHTML = ranked.length ? ranked.map((r, i) =>
      `<li class="rank__row ${r.sn === "11112-045" ? "rank__loilo" : ""}">
         <span class="rank__no">${i + 1}</span>
         <span class="rank__name">${esc(r.name)}${r.sn === "11112-045" ? " ⭐" : ""}</span>
         <span class="rank__cnt">${r.n} 位老師</span>
       </li>`).join("") : `<li class="rank__empty">尚無資料，快來成為第一個填報的老師！</li>`;
  }
  function readLocal() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch (e) { return []; } }

  /* ── 事件 ── */
  function bindEvents() {
    $("#roleOpts").addEventListener("click", (e) => { const b = e.target.closest(".role-btn"); if (b) setRole(b.dataset.role, true); });
    $("#classGrid").addEventListener("click", (e) => { const b = e.target.closest(".cp__chip"); if (b) toggleClass(b.dataset.cid); });
    $("#classDone").addEventListener("click", closeClassModal);
    $("#classModal").addEventListener("click", (e) => { if (e.target.id === "classModal") closeClassModal(); });
    $("#myClassesLine").addEventListener("click", (e) => { if (e.target.closest("#editClasses")) openClassModal(); });
    $("#tonggouGrid").addEventListener("change", (e) => { const cb = e.target.closest("[data-buycheck]"); if (cb) { buy[cb.dataset.buycheck] = cb.checked; renderSummary(); } });

    let t;
    $("#searchInput").addEventListener("input", () => { clearTimeout(t); t = setTimeout(() => renderResults(true), 180); });
    $("#groupSelect").addEventListener("change", () => renderResults(true));
    $("#showExcluded").addEventListener("change", (e) => { const n = $("#excludedNote"); if (n) n.hidden = !e.target.checked; renderResults(true); });
    $("#teacherName").addEventListener("blur", checkExistingName);
    $("#domainGrid").addEventListener("click", (e) => {
      const card = e.target.closest(".domain-card"); if (!card) return;
      activeTag = (activeTag === card.dataset.tag) ? "" : card.dataset.tag;
      renderDomains();
      renderResults(true);
      if (activeTag) $("#resultsHint").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    $("#clearDomain").addEventListener("click", () => { activeTag = ""; renderDomains(); renderResults(true); });
    $("#moreBtn").addEventListener("click", () => { shown += PAGE; renderResults(false); });
    $("#results").addEventListener("change", (e) => { const cb = e.target.closest(".item__check"); if (cb) toggle(cb.dataset.sn, cb.checked); });
    $("#loiloCard").addEventListener("change", (e) => { const cb = e.target.closest(".item__check"); if (cb) toggle(cb.dataset.sn, cb.checked); });
    $("#summary").addEventListener("click", (e) => {
      const b = e.target.closest("[data-rm]"); if (!b) return;
      picks.delete(b.dataset.rm);
      if (b.dataset.rm === "11112-045") renderLoilo();
      const li = document.querySelector(`#results .item[data-sn="${b.dataset.rm}"]`);
      if (li) { li.classList.remove("item--on"); const cb = li.querySelector(".item__check"); if (cb) cb.checked = false; }
      renderSummary();
    });
    $("#submitBtn").addEventListener("click", submit);
    $("#loadMineBtn").addEventListener("click", loadMine);

    // 送出成功彈窗
    $("#successClose").addEventListener("click", () => { $("#successModal").hidden = true; });
    $("#successModal").addEventListener("click", (e) => { if (e.target.id === "successModal") $("#successModal").hidden = true; });
    $("#successRank").addEventListener("click", () => { $("#successModal").hidden = true; $("#rankList").scrollIntoView({ behavior: "smooth", block: "center" }); });

    // 置頂列捲動收合（避免占用下方畫面）；以 class 為狀態，避免旗標不同步
    const nb = $("#namebar");
    window.addEventListener("scroll", () => {
      const c = window.scrollY > 150;
      if (c !== nb.classList.contains("namebar--compact")) nb.classList.toggle("namebar--compact", c);
    }, { passive: true });
  }
})();
