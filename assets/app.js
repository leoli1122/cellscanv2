/**
 * app.js — 電芯篩選查詢工具
 * 台塑尖端能源股份有限公司 ∙ 彰濱廠
 * G450 批號，2026-05-26
 *
 * 依賴：
 *   - assets/data.js  → CELL_SET (全域)
 *   - ZXing Browser   → https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/umd/index.min.js
 */

/* ── LocalStorage helpers ───────────────────────────────────── */
const LS_KEY = 'cellscan_log_g450';

function loadLog()    { try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { return {}; } }
function saveLog(l)   { localStorage.setItem(LS_KEY, JSON.stringify(l)); }
function todayKey()   {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

/* ── State ──────────────────────────────────────────────────── */
let log = loadLog();
let debugMode = false;

/* ── Counter helpers ────────────────────────────────────────── */
function refreshCounters() {
  const today = todayKey();
  const entries = log[today] || [];
  const hit  = entries.filter(e => e.found).length;
  document.getElementById('cnt-total').textContent = entries.length;
  document.getElementById('cnt-hit').textContent   = hit;
  document.getElementById('cnt-miss').textContent  = entries.length - hit;
}

function renderTodayHistory() {
  const list = document.getElementById('history-list');
  list.innerHTML = '';
  const entries = [...(log[todayKey()] || [])].reverse();
  entries.forEach(e => {
    const li = document.createElement('li');
    li.className = 'h-item ' + (e.found ? 'hit' : 'miss');
    li.innerHTML = `
      <span class="h-icon">${e.found ? '✅' : '❌'}</span>
      <span class="h-code">${esc(e.code)}</span>
      <span class="h-time">${e.time}</span>
      <span class="h-src">${e.src || 'gun'}</span>`;
    list.appendChild(li);
  });
}

/* ── Core: process one scanned code ────────────────────────── */
let lastCode = '', lastTs = 0;  // debounce for camera

function processCode(code, src) {
  // camera debounce: same code within 2.5 s → skip
  const now = Date.now();
  if (src === 'cam' && code === lastCode && now - lastTs < 2500) return;
  lastCode = code; lastTs = now;

  const found    = CELL_SET.has(code);
  const timeStr  = new Date().toTimeString().slice(0, 8);
  const today    = todayKey();

  // persist
  if (!log[today]) log[today] = [];
  log[today].push({ code, found, time: timeStr, src: src || 'gun' });
  saveLog(log);

  // counters
  refreshCounters();

  // result panel
  const panel   = document.getElementById('result-panel');
  const content = document.getElementById('result-content');
  panel.className = 'result-panel ' + (found ? 'hit' : 'miss');
  content.innerHTML = `
    <div class="result-icon">${found ? '✅' : '❌'}</div>
    <div class="result-code">${esc(code)}</div>
    <div class="result-status ${found ? 'ok' : 'ng'}">${found ? '在名單內' : '不在名單內'}</div>`;

  // camera flash feedback
  if (src === 'cam') {
    const cc = document.getElementById('cam-container');
    cc.classList.remove('flash-ok', 'flash-ng');
    void cc.offsetWidth;                        // force reflow
    cc.classList.add(found ? 'flash-ok' : 'flash-ng');
  }

  // debug: show raw scanned value
  const dbg = document.getElementById('debug-bar');
  if (dbg) dbg.textContent = '📡 RAW: ' + code;

  // prepend to today history
  const li = document.createElement('li');
  li.className = 'h-item ' + (found ? 'hit' : 'miss');
  li.innerHTML = `
    <span class="h-icon">${found ? '✅' : '❌'}</span>
    <span class="h-code">${esc(code)}</span>
    <span class="h-time">${timeStr}</span>
    <span class="h-src">${src || 'gun'}</span>`;
  const list = document.getElementById('history-list');
  list.insertBefore(li, list.firstChild);
}

/* ── Keyboard / scanner gun input ───────────────────────────── */
const scanInput = document.getElementById('scan-input');

scanInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    const code = scanInput.value.trim();
    scanInput.value = '';
    if (code) processCode(code, 'gun');
  }
});

document.addEventListener('click', () => {
  if (document.getElementById('tab-scan').classList.contains('active') && !cameraOn)
    setTimeout(() => scanInput.focus(), 80);
});

/* ── Camera (ZXing BrowserMultiFormatReader) ────────────────── */
let cameraOn     = false;
let codeReader   = null;
let scanControls = null;

function toggleCamera() {
  cameraOn ? stopCamera() : startCamera();
}

async function startCamera() {
  const btnLabel = document.getElementById('cam-btn-label');
  const btnIcon  = document.getElementById('cam-btn-icon');
  btnLabel.textContent = '相機啟動中…';

  try {
    const video = document.getElementById('cam-video');

    // 1. getUserMedia：後鏡頭 + 持續自動對焦
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width:      { ideal: 1280 },
        height:     { ideal: 720  }
      }
    });
    video.srcObject = stream;

    // 啟動後嘗試設定持續對焦
    const [track] = stream.getVideoTracks();
    if (track && typeof track.applyConstraints === 'function') {
      try { await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }); }
      catch (_) {}
    }

    await video.play();

    // 2. ZXing 從已啟動的 video element 解碼
    codeReader = new ZXingBrowser.BrowserMultiFormatReader();
    scanControls = await codeReader.decodeFromVideoElement(
      video,
      (result) => { if (result) processCode(result.getText(), 'cam'); }
    );

    // 3. 更新 UI
    document.getElementById('cam-wrap').classList.add('open');
    cameraOn = true;
    document.getElementById('cam-toggle-btn').classList.add('active');
    btnIcon.textContent  = '⏹';
    btnLabel.textContent = '關閉相機';

  } catch (err) {
    btnLabel.textContent = '開啟相機掃碼（iPhone / 手機）';
    btnIcon.textContent  = '📷';
    document.getElementById('cam-wrap').classList.remove('open');
    cameraOn = false;
    document.getElementById('cam-toggle-btn').classList.remove('active');
    alert('無法存取相機：' + err.message + '\n請確認已允許瀏覽器使用相機權限。');
  }
}

function stopCamera() {
  if (scanControls) { try { scanControls.stop();  } catch (_) {} scanControls = null; }
  if (codeReader)   { try { codeReader.reset();   } catch (_) {} codeReader   = null; }

  const video = document.getElementById('cam-video');
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  }

  document.getElementById('cam-wrap').classList.remove('open');
  document.getElementById('cam-toggle-btn').classList.remove('active');
  document.getElementById('cam-btn-icon').textContent  = '📷';
  document.getElementById('cam-btn-label').textContent = '開啟相機掃碼（iPhone / 手機）';
  cameraOn = false;
  setTimeout(() => scanInput.focus(), 100);
}

// stop camera when page hides (lock screen / tab switch)
document.addEventListener('visibilitychange', () => {
  if (document.hidden && cameraOn) stopCamera();
});

/* ── Clear today ────────────────────────────────────────────── */
function clearToday() {
  if (!confirm('確定清除今日紀錄？')) return;
  delete log[todayKey()];
  saveLog(log);
  refreshCounters();
  renderTodayHistory();
  document.getElementById('result-panel').className = 'result-panel';
  document.getElementById('result-content').innerHTML = '<div class="result-idle">AWAITING SCAN</div>';
}

/* ── Log tab ────────────────────────────────────────────────── */
function renderLogTab() {
  const c     = document.getElementById('daily-cards');
  const dates = Object.keys(log).sort().reverse();

  if (!dates.length) {
    c.innerHTML = '<div class="empty-msg">尚無任何掃描紀錄</div>';
    return;
  }

  c.innerHTML = '';
  dates.forEach(date => {
    const entries = log[date] || [];
    const hit     = entries.filter(e => e.found).length;
    const miss    = entries.length - hit;

    const card = document.createElement('div');
    card.className = 'day-card';

    const head = document.createElement('div');
    head.className = 'day-card-head';
    head.innerHTML = `
      <span class="day-date">${date}</span>
      <div class="day-chips">
        <span class="chip chip-total">總計 ${entries.length}</span>
        <span class="chip chip-hit">✓ ${hit}</span>
        <span class="chip chip-miss">✗ ${miss}</span>
      </div>
      <span class="day-toggle">▼</span>`;

    const detail = document.createElement('div');
    detail.className = 'day-detail';
    entries.forEach(e => {
      const row = document.createElement('div');
      row.className = 'detail-row ' + (e.found ? 'hit' : 'miss');
      row.innerHTML = `
        <span class="dr-icon">${e.found ? '✅' : '❌'}</span>
        <span class="dr-code">${esc(e.code)}</span>
        <span class="dr-time">${e.time}</span>
        <span class="dr-src">${e.src || 'gun'}</span>`;
      detail.appendChild(row);
    });

    head.addEventListener('click', () => {
      detail.classList.toggle('open');
      head.querySelector('.day-toggle').textContent =
        detail.classList.contains('open') ? '▲' : '▼';
    });

    card.appendChild(head);
    card.appendChild(detail);
    c.appendChild(card);
  });
}

/* ── CSV export ─────────────────────────────────────────────── */
function exportCSV() {
  const dates = Object.keys(log).sort();
  if (!dates.length) { alert('尚無紀錄可匯出'); return; }

  let csv = '\uFEFF日期,時間,電芯碼,結果,輸入方式\n';
  dates.forEach(date => {
    (log[date] || []).forEach(e => {
      const src = e.src === 'cam' ? '相機' : '掃碼槍';
      csv += `${date},${e.time},${e.code},${e.found ? '在名單內' : '不在名單內'},${src}\n`;
    });
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `電芯掃描紀錄_G450_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function clearAllLog() {
  if (!confirm('確定清除所有歷史紀錄？此操作無法復原。')) return;
  log = {};
  saveLog(log);
  refreshCounters();
  renderTodayHistory();
  document.getElementById('result-panel').className = 'result-panel';
  document.getElementById('result-content').innerHTML = '<div class="result-idle">AWAITING SCAN</div>';
  renderLogTab();
}

/* ── Debug mode ─────────────────────────────────────────────── */
function toggleDebug() {
  debugMode = !debugMode;
  const bar = document.getElementById('debug-bar');
  const btn = document.getElementById('debug-btn');
  if (bar) bar.style.display = debugMode ? 'block' : 'none';
  if (btn) btn.textContent   = debugMode ? 'DEBUG ON' : 'DEBUG';
}

/* ── Tab switching ──────────────────────────────────────────── */
function switchTab(name, el) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b  => b.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
  el.classList.add('active');
  if (name === 'log') renderLogTab();
  if (name === 'scan' && !cameraOn) setTimeout(() => scanInput.focus(), 80);
  if (name !== 'scan' && cameraOn) stopCamera();
}

/* ── Utility ────────────────────────────────────────────────── */
function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Boot ───────────────────────────────────────────────────── */
refreshCounters();
renderTodayHistory();
setTimeout(() => scanInput.focus(), 200);
