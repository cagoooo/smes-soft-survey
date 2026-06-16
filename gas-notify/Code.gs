/**
 * 石門國小 數位軟體需求調查 — Google Chat 即時通知中繼
 * 前端送出成功 → POST 到本 web app → 組 cardsV2 卡片 → 推到 Google Chat space
 * webhook URL 存 Script Property GOOGLE_CHAT_WEBHOOK（不寫進原始碼）
 */

var ADMIN_URL = 'https://cagoooo.github.io/smes-soft-survey/admin.html';
var TOTAL_TEACHERS = 65; // 全校教師數（進度分母）

function chatTargets_() {
  return (PropertiesService.getScriptProperties().getProperty('GOOGLE_CHAT_WEBHOOK') || '').trim();
}

function chatCard_(title, subtitle, rows, body, buttons) {
  var widgets = rows.map(function (r) {
    return { decoratedText: { topLabel: r.label, text: r.text, wrapText: true } };
  });
  if (body) widgets.push({ textParagraph: { text: body } });
  if (buttons && buttons.length) {
    widgets.push({ buttonList: { buttons: buttons.map(function (b) {
      return { text: b.text, onClick: { openLink: { url: b.url } } };
    }) } });
  }

  // 建立適合手機推播的純文字摘要（結合標題與第一行資訊，如職稱班級）
  var notificationText = title;
  if (rows && rows.length > 0) {
    var firstRow = rows[0];
    if (firstRow && firstRow.text) {
      var info = firstRow.text.replace(/<[^>]*>/g, '').trim();
      if (info) {
        notificationText += ' (' + info + ')';
      }
    }
  }

  return {
    text: notificationText,
    cardsV2: [{ cardId: 'c-' + Date.now(),
      card: { header: { title: title, subtitle: subtitle }, sections: [{ widgets: widgets }] } }]
  };
}

function pushChat_(payload) {
  var url = chatTargets_();
  if (!url) return -1;
  var resp = UrlFetchApp.fetch(url, {
    method: 'post', contentType: 'application/json; charset=utf-8',
    payload: JSON.stringify(payload), muteHttpExceptions: true
  });
  return resp.getResponseCode();
}

/** 前端送出成功後 POST（text/plain JSON 避免 CORS preflight） */
function doPost(e) {
  var out = { ok: false };
  try {
    var d = JSON.parse((e.postData && e.postData.contents) || '{}');
    var name = String(d.name || '').slice(0, 30);
    if (!name) throw new Error('no name');
    var role = String(d.role || '').slice(0, 12);
    var classes = (d.classes || []).slice(0, 40).join('、') || '—';
    var buys = (d.tonggou || []).slice(0, 5).join('、') || '—';
    var picks = (d.picks || []).slice(0, 60);
    var total = Math.max(0, parseInt(d.total, 10) || 0);
    var isUpdate = !!d.isUpdate;

    var pickText = picks.length ? picks.map(function (p, i) { return (i + 1) + '. ' + String(p).slice(0, 60); }).join('<br>') : '（無）';
    var pct = TOTAL_TEACHERS ? Math.round(total / TOTAL_TEACHERS * 100) : 0;

    var code = pushChat_(chatCard_(
      (isUpdate ? '🔁 更新填報：' : '📥 新填報：') + name + ' 老師',
      '石門國小 數位軟體需求調查',
      [
        { label: '職稱／班級', text: role + '　' + classes },
        { label: '統購軟體', text: buys },
        { label: '自主需求（' + picks.length + ' 套）', text: pickText },
        { label: '全校進度', text: '已填報 ' + total + ' / ' + TOTAL_TEACHERS + ' 位（' + pct + '%）' }
      ],
      null,
      [{ text: '📊 開管理後台', url: ADMIN_URL }]
    ));
    out = { ok: code === 200, httpCode: code };
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** 管理動作：?action=ping / setchat / testcard */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';
  var out = { ok: true, action: action };

  if (action === 'setchat') {
    var url = ((e.parameter && e.parameter.url) || '').trim();
    if (url) PropertiesService.getScriptProperties().setProperty('GOOGLE_CHAT_WEBHOOK', url);
    out.httpCode = pushChat_(chatCard_('✅ 通知已接上 Google Chat', '石門國小 數位軟體需求調查',
      [], '之後每位老師送出需求，這裡都會即時收到卡片通知。', [{ text: '📊 開管理後台', url: ADMIN_URL }]));
  } else if (action === 'testcard') {
    out.httpCode = pushChat_(chatCard_('📥 新填報：測試老師', '石門國小 數位軟體需求調查（測試卡）',
      [
        { label: '職稱／班級', text: '科任　三年級2班、五年級6班' },
        { label: '統購軟體', text: 'AILEAD365、ClassSwift' },
        { label: '自主需求（2 套）', text: '1. LoiLoNote School互動式教學軟體<br>2. 數位閱讀學習教材' },
        { label: '全校進度', text: '已填報 1 / 65 位（2%）' }
      ], null, [{ text: '📊 開管理後台', url: ADMIN_URL }]));
  } else if (action === 'ping') {
    out.webhookSet = !!chatTargets_();
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** 編輯器手動執行一次以完成 OAuth 授權（UrlFetchApp scope） */
function authorize() {
  UrlFetchApp.fetch('https://www.google.com', { muteHttpExceptions: true });
  Logger.log('authorized, webhookSet=' + !!chatTargets_());
}
