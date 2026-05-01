// ============================================================
// 点呼記録システム - WordPress Plugin版 app.js
// localStorage → WP REST API に置き換え
// ============================================================

// WPから渡される設定（tenrec-plugin.php で window.TENREC_CONFIG を定義）
const CFG = window.TENREC_CONFIG || { restUrl: '', nonce: '', useDB: false };

// ============================================================
// API通信ヘルパー
// ============================================================
async function apiGet(path) {
  const res = await fetch(CFG.restUrl + path, {
    headers: { 'X-Tenrec-Nonce': CFG.nonce, 'X-WP-Nonce': CFG.nonce }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPost(path, body) {
  const res = await fetch(CFG.restUrl + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenrec-Nonce': CFG.nonce,
      'X-WP-Nonce': CFG.nonce
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPut(path, body) {
  const res = await fetch(CFG.restUrl + path, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Tenrec-Nonce': CFG.nonce,
      'X-WP-Nonce': CFG.nonce
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiDelete(path) {
  const res = await fetch(CFG.restUrl + path, {
    method: 'DELETE',
    headers: { 'X-Tenrec-Nonce': CFG.nonce, 'X-WP-Nonce': CFG.nonce }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ============================================================
// DATA STORE — DB版（REST API経由）
// ============================================================
let dailyData    = {};   // { YYYYMMDD: { manager, helper, entries:[...] } }
let execMaster   = [];
let vehicleMaster = [];

// 初期データをDBから一括取得
async function loadAllData() {
  showLoading(true);
  try {
    const [execs, vehicles] = await Promise.all([
      apiGet('execs'),
      apiGet('vehicles'),
    ]);
    execMaster    = execs;
    vehicleMaster = vehicles;

    // 当月の日次データを取得
    const now = new Date();
    const ym  = String(now.getFullYear()) + String(now.getMonth()+1).padStart(2,'0');
    await loadMonthData(ym);
  } catch(e) {
    console.error('データ読み込みエラー:', e);
    alert('データの読み込みに失敗しました。ページを再読み込みしてください。');
  } finally {
    showLoading(false);
  }
}

// 指定月のデータをDBから取得してdailyDataにマージ
async function loadMonthData(ymStr) {
  // ymStr = 'YYYYMM'
  const y = ymStr.slice(0,4), m = ymStr.slice(4,6);
  const from = ymStr + '01';
  const lastDay = new Date(Number(y), Number(m), 0).getDate();
  const to = ymStr + String(lastDay).padStart(2,'0');
  try {
    const data = await apiGet(`daily?from=${from}&to=${to}`);
    Object.assign(dailyData, data);
  } catch(e) {
    console.error('月次データ読み込みエラー:', e);
  }
}

// ローディング表示
function showLoading(show) {
  let el = document.getElementById('tenrec-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'tenrec-loading';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15,17,23,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;font-size:16px;color:#60a5fa;';
    el.textContent = '⏳ 読み込み中...';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

// 日次データ保存（DB）
async function saveDailyData(ymd) {
  if (!ymd) return;
  const day = dailyData[ymd];
  if (!day) return;
  if (Array.isArray(dailyData)) dailyData = {};
  try {
    await apiPost('daily', { ymd, supervisor: day.supervisor, manager: day.manager, manager2: day.manager2, helper: day.helper, helper2: day.helper2, entries: day.entries });
  } catch(e) {
    console.error('保存エラー:', e);
  }
}

// ============================================================
// NAVIGATION
// ============================================================
let currentPage = 'daily';

function showPage(p) {
  currentPage = p;
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById('page-' + p).classList.add('active');
  document.getElementById('nav-' + p).classList.add('active');
  const titles = { daily: '日毎点呼記録', list: 'リスト集計', inspect: '日常点検表', master: 'マスタ管理' };
  document.getElementById('page-title').textContent = titles[p];
  if (p === 'list')    initListPage();
  if (p === 'inspect') initInspectPage();
  if (p === 'master')  renderMasterTables();
  updateTopbarMeta();
}

function showTab(id) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  event.target.classList.add('active');
}

function updateTopbarMeta() {
  const now = new Date();
  document.getElementById('topbar-meta').textContent =
    now.toLocaleDateString('ja-JP', {year:'numeric',month:'long',day:'numeric',weekday:'short'});
}

// ============================================================
// UTILITY
// ============================================================
const WEEKDAY_JA = ['日','月','火','水','木','金','土'];
const WAREKI = {2019:'令和1',2020:'令和2',2021:'令和3',2022:'令和4',2023:'令和5',
                2024:'令和6',2025:'令和7',2026:'令和8',2027:'令和9',2028:'令和10'};

function dateToYMD(d) {
  return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
}
function ymdToDate(s) {
  return new Date(s.slice(0,4), s.slice(4,6)-1, s.slice(6,8));
}
function formatDateJa(s) {
  const d = ymdToDate(s);
  const y = d.getFullYear();
  const wr = WAREKI[y] ? WAREKI[y]+'年' : y+'年';
  return `${wr}${d.getMonth()+1}月${d.getDate()}日（${WEEKDAY_JA[d.getDay()]}）`;
}
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// ============================================================
// DAILY PAGE
// ============================================================
let currentDate = dateToYMD(new Date());
let currentMonthYM = currentDate.slice(0,6);

async function initDailyPage() {
  const ym = currentDate.slice(0,4) + '-' + currentDate.slice(4,6);
  document.getElementById('month-select').value = ym;
  renderDailyView(currentDate);
}

async function loadDailyView() {
  const val = document.getElementById('month-select').value;
  if (!val) return;
  const [y, m] = val.split('-');
  const newYM = y + m;
  currentDate = newYM + '01';
  currentMonthYM = newYM;
  // 未ロードの月はDBから取得
  if (!Object.keys(dailyData).some(k => k.startsWith(newYM))) {
    showLoading(true);
    await loadMonthData(newYM);
    showLoading(false);
  }
  renderDailyView(currentDate);
}

async function prevDay() {
  const d = ymdToDate(currentDate);
  d.setDate(d.getDate() - 1);
  currentDate = dateToYMD(d);
  const ym = currentDate.slice(0,6);
  if (!Object.keys(dailyData).some(k => k.startsWith(ym))) {
    showLoading(true);
    await loadMonthData(ym);
    showLoading(false);
  }
  renderDailyView(currentDate);
}
async function nextDay() {
  const d = ymdToDate(currentDate);
  d.setDate(d.getDate() + 1);
  currentDate = dateToYMD(d);
  const ym = currentDate.slice(0,6);
  if (!Object.keys(dailyData).some(k => k.startsWith(ym))) {
    showLoading(true);
    await loadMonthData(ym);
    showLoading(false);
  }
  renderDailyView(currentDate);
}

function getOrCreateDay(ymd) {
  if (!dailyData[ymd]) {
    dailyData[ymd] = { supervisor: '', manager: '', manager2: '', helper: '', helper2: '', entries: [] };
  }
  // 旧データ互換
  const d = dailyData[ymd];
  if (d.supervisor === undefined) d.supervisor = '';
  if (d.manager2   === undefined) d.manager2   = '';
  if (d.helper2    === undefined) d.helper2    = '';
  return d;
}

// マスタから選択肢を生成するヘルパー
function carLabel(v) {
  return [v.bureau, v.classNo, v.usage, v.num].filter(Boolean).join(' ');
}
function carOptions(selected) {
  const cars = vehicleMaster.map(v => carLabel(v)).filter(Boolean);
  return ['', ...cars].map(c =>
    `<option value="${c}" ${c===selected?'selected':''}>${c||'— 選択 —'}</option>`
  ).join('');
}
function driverOptions(selected) {
  const drivers = vehicleMaster.map(v => v.driver).filter(Boolean);
  const uniq = [...new Set(drivers)];
  return ['', ...uniq].map(d =>
    `<option value="${d}" ${d===selected?'selected':''}>${d||'— 選択 —'}</option>`
  ).join('');
}
function execOptions(selected) {
  const execs = execMaster.map(e => e.name).filter(Boolean);
  return ['', ...execs].map(e =>
    `<option value="${e}" ${e===selected?'selected':''}>${e||'— 選択 —'}</option>`
  ).join('');
}

function renderDailyView(ymd) {
  currentDate = ymd;
  const day = getOrCreateDay(ymd);
  const cont = document.getElementById('daily-content');

  cont.innerHTML = `
  <div class="date-header">
    <div>
      <div class="date-label">${ymd.slice(0,4)}-${ymd.slice(4,6)}-${ymd.slice(6,8)}</div>
      <div class="date-sub">${formatDateJa(ymd)}</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn btn-secondary btn-sm" id="btn-copy-prev">📋 前日コピー</button>
      <button class="btn btn-secondary btn-sm" id="btn-auto-exec" title="未入力の執行者欄をマスタの曜日・時間帯から自動補完">⚡ 執行者自動補完</button>
      <button class="btn btn-danger btn-sm" id="btn-clear-day">🗑 クリア</button>
    </div>
  </div>

  <div style="width:100%;margin-bottom:16px;">
    <div class="card-title" style="padding:0 0 10px;">👥 点呼執行者</div>
    <div class="form-row">
      <div class="form-group">
        <label>統括管理者</label>
        <div id="supervisor-select-wrap"></div>
      </div>
      <div class="form-group">
        <label>運行管理者</label>
        <div id="mgr-select-wrap"></div>
      </div>
      <div class="form-group">
        <label>運行管理者</label>
        <div id="mgr2-select-wrap"></div>
      </div>
      <div class="form-group">
        <label>補助者</label>
        <div id="hlp-select-wrap"></div>
      </div>
      <div class="form-group">
        <label>補助者</label>
        <div id="hlp2-select-wrap"></div>
      </div>
    </div>
  </div>

  <div style="width:100%;margin-bottom:16px;">
    <div class="card-title" style="padding:0 0 10px;">🚛 運行記録一覧</div>
    <div class="tbl-wrap">
    <table id="entry-table">
      <thead>
        <tr>
          <th rowspan="3">#</th>
          <th rowspan="3">登録車番<br>（車番）</th>
          <th rowspan="3">運転者名</th>
          <th rowspan="3">作業割当<br>（行き先）</th>
          <th colspan="6" style="background:#1d4ed8;text-align:center;color:#ffffff;font-weight:700;border-left:2px solid #93c5fd;">乗　務　前　点　呼</th>
          <th colspan="6" style="background:#15803d;text-align:center;color:#ffffff;font-weight:700;border-left:2px solid #86efac;">乗　務　途　中　点　呼</th>
          <th colspan="6" style="background:#b91c1c;text-align:center;color:#ffffff;font-weight:700;border-left:2px solid #fca5a5;">乗　務　後　点　呼</th>
          <th colspan="6" style="background:#1d4ed8;text-align:center;color:#ffffff;font-weight:700;border-left:3px solid #94a3b8;">乗　務　前　点　呼</th>
          <th colspan="6" style="background:#b91c1c;text-align:center;color:#ffffff;font-weight:700;">乗　務　後　点　呼</th>
          <th colspan="6" style="background:#1d4ed8;text-align:center;color:#ffffff;font-weight:700;border-left:3px solid #94a3b8;">乗　務　前　点　呼</th>
          <th colspan="6" style="background:#b91c1c;text-align:center;color:#ffffff;font-weight:700;">乗　務　後　点　呼</th>
          <th rowspan="3">指示事項<br>報告事項<br>その他必要事項</th>
          <th rowspan="3"></th>
        </tr>
        <tr>
          <th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;border-left:2px solid #93c5fd;">点呼方法</th><th colspan="2" style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">アルコール検知器</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">確認事項<br>①②③④</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">点呼時間</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">点呼<br>執行者</th>
          <th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;border-left:2px solid #86efac;">点呼方法</th><th colspan="2" style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;">アルコール検知器</th><th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;">確認事項<br>①②④</th><th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;">点呼時間</th><th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;">点呼<br>執行者</th>
          <th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;border-left:2px solid #fca5a5;">点呼方法</th><th colspan="2" style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">アルコール検知器</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">確認事項<br>①⑤⑥⑦</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">点呼時間</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">点呼<br>執行者</th>
          <th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;border-left:3px solid #94a3b8;">点呼方法</th><th colspan="2" style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">アルコール検知器</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">確認事項<br>①②③④</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">点呼時間</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">点呼<br>執行者</th>
          <th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">点呼方法</th><th colspan="2" style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">アルコール検知器</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">確認事項<br>①⑤⑥⑦</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">点呼時間</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">点呼<br>執行者</th>
          <th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;border-left:3px solid #94a3b8;">点呼方法</th><th colspan="2" style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">アルコール検知器</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">確認事項<br>①②③④</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">点呼時間</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">点呼<br>執行者</th>
          <th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">点呼方法</th><th colspan="2" style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">アルコール検知器</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">確認事項<br>①⑤⑥⑦</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">点呼時間</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">点呼<br>執行者</th>
        </tr>
        <tr>
          <th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;border-left:2px solid #93c5fd;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">使用有無</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">測定結果</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th>
          <th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;border-left:2px solid #86efac;"></th><th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;">使用有無</th><th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;">測定結果</th><th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;"></th><th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;"></th><th style="background:#dcfce7;font-size:10px;color:#14532d;font-weight:700;"></th>
          <th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;border-left:2px solid #fca5a5;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">使用有無</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">測定結果</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th>
          <th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;border-left:3px solid #94a3b8;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">使用有無</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">測定結果</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th>
          <th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">使用有無</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">測定結果</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th>
          <th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;border-left:3px solid #94a3b8;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">使用有無</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;">測定結果</th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th><th style="background:#dbeafe;font-size:10px;color:#1e3a8a;font-weight:700;"></th>
          <th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">使用有無</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;">測定結果</th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th><th style="background:#fee2e2;font-size:10px;color:#7f1d1d;font-weight:700;"></th>
        </tr>
      </thead>
      <tbody id="entry-tbody"></tbody>
    </table></div>
    <button class="add-row-btn" id="add-row-btn">＋ 行を追加</button>
  </div>`;

  cont.querySelector('#btn-copy-prev').addEventListener('click', () => copyFromYesterday(currentDate));
  cont.querySelector('#btn-auto-exec').addEventListener('click', () => autoFillExecs(currentDate));
  cont.querySelector('#btn-clear-day').addEventListener('click', () => clearDay(currentDate));
  cont.querySelector('#add-row-btn').addEventListener('click', () => addEntry(currentDate));

  cont.querySelector('#supervisor-select-wrap').appendChild(makeManagerSelEl(day.supervisor, 'supervisor'));
  cont.querySelector('#mgr-select-wrap').appendChild(makeManagerSelEl(day.manager, 'manager'));
  cont.querySelector('#mgr2-select-wrap').appendChild(makeManagerSelEl(day.manager2, 'manager2'));
  cont.querySelector('#hlp-select-wrap').appendChild(makeManagerSelEl(day.helper, 'helper'));
  cont.querySelector('#hlp2-select-wrap').appendChild(makeManagerSelEl(day.helper2, 'helper2'));

  const tbody = cont.querySelector('#entry-tbody');
  day.entries.forEach((e, i) => tbody.appendChild(buildEntryTr(ymd, i, e)));

  // 既存行が10行未満の場合、表示上の空行を補完（DBには保存しない）
  const INITIAL_ROWS = 10;
  const emptyEntry = () => ({
    car:'', driver:'', dest:'',
    g1Method:'', g1Alco:'有', g1AlcoVal:'0', g1Kakunin:'', g1Time:'', g1Exec:'',
    g2Method:'', g2Alco:'有', g2AlcoVal:'0', g2Kakunin:'', g2Time:'', g2Exec:'',
    g3Method:'', g3Alco:'有', g3AlcoVal:'0', g3Kakunin:'', g3Time:'', g3Exec:'',
    g4Method:'', g4Alco:'有', g4AlcoVal:'0', g4Kakunin:'', g4Time:'', g4Exec:'',
    g5Method:'', g5Alco:'有', g5AlcoVal:'0', g5Kakunin:'', g5Time:'', g5Exec:'',
    g6Method:'', g6Alco:'有', g6AlcoVal:'0', g6Kakunin:'', g6Time:'', g6Exec:'',
    g7Method:'', g7Alco:'有', g7AlcoVal:'0', g7Kakunin:'', g7Time:'', g7Exec:'',
    note:''
  });
  for (let i = day.entries.length; i < INITIAL_ROWS; i++) {
    day.entries.push(emptyEntry());
    tbody.appendChild(buildEntryTr(ymd, i, day.entries[i]));
  }
}

// ============================================================
// 行DOM生成
// ============================================================
function makeManagerSelEl(selected, field) {
  const s = document.createElement('select');
  s.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 6px;font-size:13px;width:160px;';
  ['', ...execMaster.map(e => e.name).filter(Boolean)].forEach(name => {
    const o = document.createElement('option');
    o.value = name; o.textContent = name || '— 選択 —';
    if (name === selected) o.selected = true;
    s.appendChild(o);
  });
  s.addEventListener('change', function() { updateManager(currentDate, field, this.value); });
  return s;
}

function makeTd(child) {
  const td = document.createElement('td');
  if (child) td.appendChild(child);
  return td;
}

function makeSelectEl(optionsHTML, styleExtra, field, dataField) {
  const s = document.createElement('select');
  s.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 4px;font-size:12px;' + (styleExtra||'');
  s.innerHTML = optionsHTML;
  if (dataField) s.dataset.field = dataField;
  s.addEventListener('change', function() {
    const idx = parseInt(this.closest('tr').dataset.idx);
    updateEntry(currentDate, idx, field, this.value);
  });
  return s;
}

function makeMethodSelEl(val, field) {
  const s = document.createElement('select');
  s.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 5px;font-size:12px;width:60px;';
  [['','—'],['電話','電話'],['対面','対面']].forEach(([v,t]) => {
    const o = document.createElement('option');
    o.value = v; o.textContent = t;
    if (v === val) o.selected = true;
    s.appendChild(o);
  });
  s.addEventListener('change', function() {
    const idx = parseInt(this.closest('tr').dataset.idx);
    updateEntry(currentDate, idx, field, this.value);
  });
  return s;
}

function makeAlcoSelEl(val, field) {
  const s = document.createElement('select');
  s.style.cssText = 'background:var(--bg);border:1px solid var(--border);border-radius:3px;color:var(--text);padding:2px 3px;font-size:11px;width:44px;';
  ['有','無'].forEach(v => {
    const o = document.createElement('option');
    o.value = v; o.textContent = v;
    if (v === val) o.selected = true;
    s.appendChild(o);
  });
  s.addEventListener('change', function() {
    const idx = parseInt(this.closest('tr').dataset.idx);
    updateEntry(currentDate, idx, field, this.value);
  });
  return s;
}

function makeTextInputEl(val, width, field) {
  const inp = document.createElement('input');
  inp.value = val || '';
  inp.style.cssText = 'background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text);font-family:var(--font);font-size:12px;width:' + width + ';outline:none;padding:2px 4px;';
  inp.addEventListener('change', function() {
    const idx = parseInt(this.closest('tr').dataset.idx);
    updateEntry(currentDate, idx, field, this.value);
  });
  return inp;
}

function makeTimeInputEl(val, field) {
  const inp = document.createElement('input');
  inp.type = 'time';
  inp.value = val || '';
  inp.style.cssText = 'background:transparent;border:none;border-bottom:1px solid var(--border);color:var(--text-dim);font-family:var(--mono);font-size:11px;width:80px;outline:none;';
  inp.addEventListener('change', function() {
    const idx = parseInt(this.closest('tr').dataset.idx);
    updateEntry(currentDate, idx, field, this.value);
  });
  return inp;
}

function buildEntryTr(ymd, i, e) {
  const tr = document.createElement('tr');
  tr.dataset.idx = i;

  const numTd = document.createElement('td');
  numTd.className = 'td-mono';
  numTd.style.textAlign = 'center';
  numTd.textContent = i + 1;
  tr.appendChild(numTd);

  tr.appendChild(makeTd(makeSelectEl(carOptions(e.car||''),        'width:110px;', 'car')));
  tr.appendChild(makeTd(makeSelectEl(driverOptions(e.driver||''),  'width:90px;',  'driver', 'driver')));
  tr.appendChild(makeTd(makeTextInputEl(e.dest, '80px', 'dest')));

  tr.appendChild(makeTd(makeMethodSelEl(e.g1Method||'', 'g1Method')));
  tr.appendChild(makeTd(makeAlcoSelEl(e.g1Alco||'有', 'g1Alco')));
  tr.appendChild(makeTd(makeTextInputEl(e.g1AlcoVal||'0', '36px', 'g1AlcoVal')));
  tr.appendChild(makeTd(makeTextInputEl(e.g1Kakunin||'', '50px', 'g1Kakunin')));
  tr.appendChild(makeTd(makeTimeInputEl(e.g1Time, 'g1Time')));
  tr.appendChild(makeTd(makeSelectEl(execOptions(e.g1Exec||''), 'width:90px;', 'g1Exec', 'g1Exec')));

  tr.appendChild(makeTd(makeMethodSelEl(e.g2Method||'', 'g2Method')));
  tr.appendChild(makeTd(makeAlcoSelEl(e.g2Alco||'有', 'g2Alco')));
  tr.appendChild(makeTd(makeTextInputEl(e.g2AlcoVal||'0', '36px', 'g2AlcoVal')));
  tr.appendChild(makeTd(makeTextInputEl(e.g2Kakunin||'', '50px', 'g2Kakunin')));
  tr.appendChild(makeTd(makeTimeInputEl(e.g2Time, 'g2Time')));
  tr.appendChild(makeTd(makeSelectEl(execOptions(e.g2Exec||''), 'width:90px;', 'g2Exec', 'g2Exec')));

  tr.appendChild(makeTd(makeMethodSelEl(e.g3Method||'', 'g3Method')));
  tr.appendChild(makeTd(makeAlcoSelEl(e.g3Alco||'有', 'g3Alco')));
  tr.appendChild(makeTd(makeTextInputEl(e.g3AlcoVal||'0', '36px', 'g3AlcoVal')));
  tr.appendChild(makeTd(makeTextInputEl(e.g3Kakunin||'', '50px', 'g3Kakunin')));
  tr.appendChild(makeTd(makeTimeInputEl(e.g3Time, 'g3Time')));
  tr.appendChild(makeTd(makeSelectEl(execOptions(e.g3Exec||''), 'width:90px;', 'g3Exec', 'g3Exec')));

  tr.appendChild(makeTd(makeMethodSelEl(e.g4Method||'', 'g4Method')));
  tr.appendChild(makeTd(makeAlcoSelEl(e.g4Alco||'有', 'g4Alco')));
  tr.appendChild(makeTd(makeTextInputEl(e.g4AlcoVal||'0', '36px', 'g4AlcoVal')));
  tr.appendChild(makeTd(makeTextInputEl(e.g4Kakunin||'', '50px', 'g4Kakunin')));
  tr.appendChild(makeTd(makeTimeInputEl(e.g4Time, 'g4Time')));
  tr.appendChild(makeTd(makeSelectEl(execOptions(e.g4Exec||''), 'width:90px;', 'g4Exec', 'g4Exec')));

  tr.appendChild(makeTd(makeMethodSelEl(e.g5Method||'', 'g5Method')));
  tr.appendChild(makeTd(makeAlcoSelEl(e.g5Alco||'有', 'g5Alco')));
  tr.appendChild(makeTd(makeTextInputEl(e.g5AlcoVal||'0', '36px', 'g5AlcoVal')));
  tr.appendChild(makeTd(makeTextInputEl(e.g5Kakunin||'', '50px', 'g5Kakunin')));
  tr.appendChild(makeTd(makeTimeInputEl(e.g5Time, 'g5Time')));
  tr.appendChild(makeTd(makeSelectEl(execOptions(e.g5Exec||''), 'width:90px;', 'g5Exec', 'g5Exec')));

  tr.appendChild(makeTd(makeMethodSelEl(e.g6Method||'', 'g6Method')));
  tr.appendChild(makeTd(makeAlcoSelEl(e.g6Alco||'有', 'g6Alco')));
  tr.appendChild(makeTd(makeTextInputEl(e.g6AlcoVal||'0', '36px', 'g6AlcoVal')));
  tr.appendChild(makeTd(makeTextInputEl(e.g6Kakunin||'', '50px', 'g6Kakunin')));
  tr.appendChild(makeTd(makeTimeInputEl(e.g6Time, 'g6Time')));
  tr.appendChild(makeTd(makeSelectEl(execOptions(e.g6Exec||''), 'width:90px;', 'g6Exec', 'g6Exec')));

  tr.appendChild(makeTd(makeMethodSelEl(e.g7Method||'', 'g7Method')));
  tr.appendChild(makeTd(makeAlcoSelEl(e.g7Alco||'有', 'g7Alco')));
  tr.appendChild(makeTd(makeTextInputEl(e.g7AlcoVal||'0', '36px', 'g7AlcoVal')));
  tr.appendChild(makeTd(makeTextInputEl(e.g7Kakunin||'', '50px', 'g7Kakunin')));
  tr.appendChild(makeTd(makeTimeInputEl(e.g7Time, 'g7Time')));
  tr.appendChild(makeTd(makeSelectEl(execOptions(e.g7Exec||''), 'width:90px;', 'g7Exec', 'g7Exec')));

  tr.appendChild(makeTd(makeTextInputEl(e.note, '100px', 'note')));

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-danger btn-sm';
  delBtn.textContent = '✕';
  delBtn.addEventListener('click', function() { removeEntry(this.closest('tr')); });
  tr.appendChild(makeTd(delBtn));

  return tr;
}

async function updateEntry(ymd, i, field, val) {
  const day = getOrCreateDay(ymd);
  if (i < 0 || i >= day.entries.length) return;
  day.entries[i][field] = val;

  // 車番→運転者 自動セット
  if (field === 'car') {
    const matched = vehicleMaster.find(v => carLabel(v) === val);
    if (matched && matched.driver && !day.entries[i].driver) {
      day.entries[i].driver = matched.driver;
      const tbody = document.getElementById('entry-tbody');
      if (tbody) {
        const tr = tbody.querySelector('tr[data-idx="' + i + '"]');
        if (tr) {
          const ds = tr.querySelector('select[data-field="driver"]');
          if (ds) {
            if (![...ds.options].some(o => o.value === matched.driver)) {
              const opt = document.createElement('option');
              opt.value = matched.driver; opt.textContent = matched.driver;
              ds.appendChild(opt);
            }
            ds.value = matched.driver;
          }
        }
      }
    }
  }

  // 点呼時間→執行者 自動補完
  const timeExecMap = { g1Time:'g1Exec', g2Time:'g2Exec', g3Time:'g3Exec', g4Time:'g4Exec', g5Time:'g5Exec', g6Time:'g6Exec', g7Time:'g7Exec' };
  if (timeExecMap[field] && !day.entries[i][timeExecMap[field]]) {
    const exec = resolveExec(ymd, val);
    if (exec) {
      const ef = timeExecMap[field];
      day.entries[i][ef] = exec;
      const tbody = document.getElementById('entry-tbody');
      if (tbody) {
        const tr = tbody.querySelector('tr[data-idx="' + i + '"]');
        if (tr) {
          const es = tr.querySelector('select[data-field="' + ef + '"]');
          if (es) {
            if (![...es.options].some(o => o.value === exec)) {
              const opt = document.createElement('option');
              opt.value = exec; opt.textContent = exec;
              es.appendChild(opt);
            }
            es.value = exec;
          }
        }
      }
    }
  }

  await saveDailyData(ymd);
}

async function updateManager(ymd, field, val) {
  getOrCreateDay(ymd)[field] = val;
  await saveDailyData(ymd);
}

async function addEntry(ymd) {
  const day = getOrCreateDay(ymd);
  const newEntry = {
    car:'', driver:'', dest:'',
    g1Method:'', g1Alco:'有', g1AlcoVal:'0', g1Kakunin:'', g1Time:'', g1Exec:'',
    g2Method:'', g2Alco:'有', g2AlcoVal:'0', g2Kakunin:'', g2Time:'', g2Exec:'',
    g3Method:'', g3Alco:'有', g3AlcoVal:'0', g3Kakunin:'', g3Time:'', g3Exec:'',
    g4Method:'', g4Alco:'有', g4AlcoVal:'0', g4Kakunin:'', g4Time:'', g4Exec:'',
    g5Method:'', g5Alco:'有', g5AlcoVal:'0', g5Kakunin:'', g5Time:'', g5Exec:'',
    g6Method:'', g6Alco:'有', g6AlcoVal:'0', g6Kakunin:'', g6Time:'', g6Exec:'',
    g7Method:'', g7Alco:'有', g7AlcoVal:'0', g7Kakunin:'', g7Time:'', g7Exec:'',
    note:''
  };
  day.entries.push(newEntry);
  await saveDailyData(ymd);
  const tbody = document.getElementById('entry-tbody');
  if (tbody) {
    const tr = buildEntryTr(ymd, day.entries.length - 1, newEntry);
    tbody.appendChild(tr);
    tr.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    renderDailyView(ymd);
  }
}

async function removeEntry(tr) {
  const tbody = tr.closest('tbody') || document.getElementById('entry-tbody');
  const i = parseInt(tr.dataset.idx);
  const day = getOrCreateDay(currentDate);
  if (isNaN(i) || i < 0 || i >= day.entries.length) return;
  day.entries.splice(i, 1);
  await saveDailyData(currentDate);
  tr.remove();
  if (tbody) {
    [...tbody.querySelectorAll('tr')].forEach((row, idx) => {
      row.dataset.idx = idx;
      row.cells[0].textContent = idx + 1;
    });
  }
}

async function clearDay(ymd) {
  showModal('クリア確認', `${formatDateJa(ymd)} のデータをすべて削除します。`, async () => {
    delete dailyData[ymd];
    try { await apiDelete(`daily/${ymd}`); } catch(e) { console.error(e); }
    renderDailyView(ymd);
  });
}

async function copyFromYesterday(ymd) {
  const d = ymdToDate(ymd);
  d.setDate(d.getDate() - 1);
  const prev = dateToYMD(d);
  // 前日データが未ロードならDBから取得
  if (!dailyData[prev]) {
    showLoading(true);
    try {
      const data = await apiGet(`daily/${prev}`);
      if (data) dailyData[prev] = data;
    } catch(e) {}
    showLoading(false);
  }
  if (!dailyData[prev] || !dailyData[prev].entries.length) {
    alert('前日のデータがありません。'); return;
  }
  const day = getOrCreateDay(ymd);
  const prevDay = dailyData[prev];
  day.supervisor = prevDay.supervisor;
  day.manager    = prevDay.manager;
  day.manager2   = prevDay.manager2;
  day.helper     = prevDay.helper;
  day.helper2    = prevDay.helper2;
  day.entries = JSON.parse(JSON.stringify(prevDay.entries)).map(e => ({
    ...e, g1Method:'', g1Time:'', g1AlcoVal:'0', g2Method:'', g2Time:'', g2AlcoVal:'0', g3Method:'', g3Time:'', g3AlcoVal:'0', g4Method:'', g4Time:'', g4AlcoVal:'0', g5Method:'', g5Time:'', g5AlcoVal:'0', g6Method:'', g6Time:'', g6AlcoVal:'0', g7Method:'', g7Time:'', g7AlcoVal:'0', note:''
  }));
  await saveDailyData(ymd);
  renderDailyView(ymd);
}

// ============================================================
// 執行者自動補完
// ============================================================
function resolveExec(ymd, timeStr) {
  const d = ymdToDate(ymd);
  const isSunday = d.getDay() === 0;
  const toMin = t => { if (!t) return null; const [h,m]=t.split(':').map(Number); return h*60+m; };
  const tMin = toMin(timeStr);
  for (const exec of execMaster) {
    if (exec.day === '月～土' && isSunday) continue;
    if (exec.day === '日曜日' && !isSunday) continue;
    if (exec.start && exec.end && tMin !== null) {
      const sMin = toMin(exec.start), eMin = toMin(exec.end);
      if (eMin >= sMin) { if (tMin < sMin || tMin > eMin) continue; }
      else { if (tMin < sMin && tMin > eMin) continue; }
    }
    return exec.name;
  }
  return '';
}

function autoFillExecs(ymd) {
  const day = getOrCreateDay(ymd);
  let changed = false;
  day.entries.forEach((e, i) => {
    if (!e.g1Exec && e.g1Time) { e.g1Exec = resolveExec(ymd, e.g1Time); if (e.g1Exec) { refreshExecSelect(ymd, i, 'g1Exec', e.g1Exec); changed = true; } }
    if (!e.g2Exec && e.g2Time) { e.g2Exec = resolveExec(ymd, e.g2Time); if (e.g2Exec) { refreshExecSelect(ymd, i, 'g2Exec', e.g2Exec); changed = true; } }
    if (!e.g3Exec && e.g3Time) { e.g3Exec = resolveExec(ymd, e.g3Time); if (e.g3Exec) { refreshExecSelect(ymd, i, 'g3Exec', e.g3Exec); changed = true; } }
    if (!e.g4Exec && e.g4Time) { e.g4Exec = resolveExec(ymd, e.g4Time); if (e.g4Exec) { refreshExecSelect(ymd, i, 'g4Exec', e.g4Exec); changed = true; } }
    if (!e.g5Exec && e.g5Time) { e.g5Exec = resolveExec(ymd, e.g5Time); if (e.g5Exec) { refreshExecSelect(ymd, i, 'g5Exec', e.g5Exec); changed = true; } }
    if (!e.g6Exec && e.g6Time) { e.g6Exec = resolveExec(ymd, e.g6Time); if (e.g6Exec) { refreshExecSelect(ymd, i, 'g6Exec', e.g6Exec); changed = true; } }
    if (!e.g7Exec && e.g7Time) { e.g7Exec = resolveExec(ymd, e.g7Time); if (e.g7Exec) { refreshExecSelect(ymd, i, 'g7Exec', e.g7Exec); changed = true; } }
  });
  if (changed) saveDailyData(ymd);
}

function refreshExecSelect(ymd, i, field, val) {
  const tbody = document.getElementById('entry-tbody');
  if (!tbody) return;
  const tr = tbody.querySelector('tr[data-idx="' + i + '"]');
  if (!tr) return;
  const s = tr.querySelector('select[data-field="' + field + '"]');
  if (!s) return;
  if (![...s.options].some(o => o.value === val)) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = val;
    s.appendChild(opt);
  }
  s.value = val;
}

// ============================================================
// LIST PAGE
// ============================================================
function initListPage() {
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  document.getElementById('list-from').value = ym;
  document.getElementById('list-to').value = ym;
}

async function buildList() {
  const from = document.getElementById('list-from').value;
  const to   = document.getElementById('list-to').value;
  if (!from || !to) { alert('期間を指定してください。'); return; }

  showLoading(true);
  try {
    const fromYMD = from.replace('-','') + '01';
    const [ty, tm] = to.split('-').map(Number);
    const toYMD = to.replace('-','') + String(getDaysInMonth(ty,tm)).padStart(2,'0');
    const data = await apiGet(`daily?from=${fromYMD}&to=${toYMD}`);
    Object.assign(dailyData, data);
  } catch(e) { console.error(e); }
  showLoading(false);

  const rows = [];
  for (const [ymd, day] of Object.entries(dailyData).sort()) {
    const ym = ymd.slice(0,4) + '-' + ymd.slice(4,6);
    if (ym < from || ym > to) continue;
    for (const e of day.entries) {
      if (!e.car && !e.driver) continue;
      rows.push({ date: ymd, car: e.car, driver: e.driver, dest: e.dest,
        startMethod: e.g1Method||'', endMethod: e.g3Method||'',
        supervisor: day.supervisor, manager: day.manager, manager2: day.manager2,
        helper: day.helper, helper2: day.helper2 });
    }
  }

  const stats = document.getElementById('list-stats');
  const cars = [...new Set(rows.map(r=>r.car).filter(Boolean))];
  const days = [...new Set(rows.map(r=>r.date))];
  stats.innerHTML = `
    <div class="stat-card"><div class="stat-num">${rows.length}</div><div class="stat-label">総レコード数</div></div>
    <div class="stat-card"><div class="stat-num">${days.length}</div><div class="stat-label">稼働日数</div></div>
    <div class="stat-card"><div class="stat-num">${cars.length}</div><div class="stat-label">車番数</div></div>
    <div class="stat-card"><div class="stat-num">${rows.filter(r=>r.startMethod==='対面').length}</div><div class="stat-label">乗務前対面点呼</div></div>
    <div class="stat-card"><div class="stat-num">${rows.filter(r=>r.endMethod==='対面').length}</div><div class="stat-label">乗務後対面点呼</div></div>`;

  if (!rows.length) {
    document.getElementById('list-content').innerHTML = '<div class="alert alert-warn">該当期間のデータがありません。</div>';
    return;
  }
  window._listRows = rows;

  const toggleLabel = v => {
    if (!v) return {cls:'badge-gray',text:'—'};
    if (v==='電話') return {cls:'badge-blue',text:'電話'};
    return {cls:'badge-red',text:'対面'};
  };

  let html = `<div class="tbl-wrap"><table>
    <thead><tr><th>日付</th><th>車番</th><th>運転者</th><th>行き先</th>
    <th>乗務前点呼</th><th>乗務後点呼</th><th>統括管理者</th><th>運行管理者</th><th>運行管理者</th><th>補助者</th><th>補助者</th></tr></thead><tbody>`;
  for (const r of rows) {
    const sm = toggleLabel(r.startMethod), em = toggleLabel(r.endMethod);
    html += `<tr>
      <td class="td-mono">${r.date.slice(0,4)}/${r.date.slice(4,6)}/${r.date.slice(6,8)}</td>
      <td>${r.car||'—'}</td><td>${r.driver||'—'}</td><td>${r.dest||'—'}</td>
      <td><span class="badge ${sm.cls}">${sm.text}</span></td>
      <td><span class="badge ${em.cls}">${em.text}</span></td>
      <td>${r.supervisor||'—'}</td><td>${r.manager||'—'}</td><td>${r.manager2||'—'}</td>
      <td>${r.helper||'—'}</td><td>${r.helper2||'—'}</td></tr>`;
  }
  html += '</tbody></table></div>';
  document.getElementById('list-content').innerHTML = html;
}

function exportCSV() {
  const rows = window._listRows;
  if (!rows || !rows.length) { alert('先に集計を実行してください。'); return; }
  const header = ['日付','車番','運転者','行き先','乗務前点呼','乗務後点呼','統括管理者','運行管理者','運行管理者②','補助者','補助者②'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      `${r.date.slice(0,4)}/${r.date.slice(4,6)}/${r.date.slice(6,8)}`,
      r.car,r.driver,r.dest,r.startMethod,r.endMethod,
      r.supervisor,r.manager,r.manager2,r.helper,r.helper2
    ].map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(','));
  }
  const blob = new Blob(['\uFEFF'+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `点呼記録リスト_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
}

// ============================================================
// INSPECTION PAGE
// ============================================================
const INSPECT_ITEMS = [
  { group:'運転者席', items:['エンジンのかかり具合、異音','ブレーキ・ペダルの踏みしろ、効き具合','駐車ブレーキ・レバーの引きしろ','空気圧力計の上がり具合','ブレーキ・バルブの排気音','方向指示器の点滅具合','ウインドウ・ウォッシャの噴射状態','ワイパーの払拭状態'] },
  { group:'車の周り', items:['タイヤの空気圧','タイヤの亀裂・損傷','タイヤの異常な磨耗','タイヤの溝の深さ','灯火類の点灯・点滅、汚れ・損傷','車体の損傷'] },
  { group:'エンジンルーム', items:['冷却水の量','ブレーキ液の量','エンジンオイルの量','バッテリー液の量','ファンベルトのゆるみ・損傷'] },
];

function initInspectPage() {
  const fromMaster = vehicleMaster.map(v => carLabel(v)).filter(Boolean);
  const fromDaily  = Object.values(dailyData).flatMap(d => d.entries.map(e => e.car)).filter(Boolean);
  const cars = [...new Set([...fromMaster, ...fromDaily])].sort();
  const sel = document.getElementById('inspect-car');
  sel.innerHTML = '<option value="">— 車番を選択 —</option>';
  cars.forEach(c => sel.innerHTML += `<option value="${c}">${c}</option>`);
  if (!document.getElementById('inspect-month').value) {
    const now = new Date();
    document.getElementById('inspect-month').value = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
  }
}

function buildInspect() {
  const ym  = document.getElementById('inspect-month').value;
  const car = document.getElementById('inspect-car').value;
  if (!ym || !car) { alert('月と車番を選択してください。'); return; }
  const [y,m] = ym.split('-').map(Number);
  const days = getDaysInMonth(y,m);
  const carDays = getCarDays(ym,car);
  const inspKey = `inspect_${ym}_${car}`;
  if (!window._inspectChecks) window._inspectChecks = {};
  if (!window._inspectChecks[inspKey]) window._inspectChecks[inspKey] = {};
  const checks = window._inspectChecks[inspKey];

  let html = `<div style="width:100%;margin-bottom:16px;">
    <div class="card-title" style="padding:0 0 10px;">📋 日常点検表 — 車番：${car}（${y}年${m}月）</div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">
      <button class="btn btn-secondary btn-sm" onclick="checkAll('${inspKey}',true,'${ym}','${car}')">✅ 全てチェック</button>
      <button class="btn btn-danger btn-sm" onclick="checkAll('${inspKey}',false,'${ym}','${car}')">✕ 全てクリア</button>
      <span style="color:var(--text-dim);font-size:12px;margin-top:6px;">（クリックで✔/—切替）</span>
    </div>
    <div class="tbl-wrap"><table class="inspect-tbl"><thead><tr>
      <th style="width:120px;">区分</th><th>点検項目</th>`;
  for (let d=1;d<=days;d++) {
    const ymd = String(y)+String(m).padStart(2,'0')+String(d).padStart(2,'0');
    html += `<th style="min-width:32px;text-align:center;${carDays[ymd]?'color:#60a5fa;':''}">${d}</th>`;
  }
  html += '</tr></thead><tbody>';
  INSPECT_ITEMS.forEach(group => {
    group.items.forEach((item,gi) => {
      html += `<tr>`;
      if (gi===0) html += `<td rowspan="${group.items.length}" style="font-weight:600;vertical-align:middle;background:var(--surface2);">${group.group}</td>`;
      html += `<td style="white-space:nowrap;">${item}</td>`;
      for (let d=1;d<=days;d++) {
        const ymd = String(y)+String(m).padStart(2,'0')+String(d).padStart(2,'0');
        const ran = !!carDays[ymd];
        const ck = checks[`${ymd}_${group.group}_${gi}`];
        html += ran
          ? `<td class="check-mark" onclick="toggleCheck('${inspKey}','${ymd}_${group.group}_${gi}','${ym}','${car}')">${ck?'✔':'—'}</td>`
          : `<td style="text-align:center;color:var(--border);">·</td>`;
      }
      html += `</tr>`;
    });
  });
  html += `</tbody></table></div>
    <div style="margin-top:12px;">
      <button class="btn btn-secondary" onclick="exportInspectCSV('${inspKey}','${ym}','${car}')">💾 CSV出力</button>
    </div></div>`;
  document.getElementById('inspect-content').innerHTML = html;
}

function toggleCheck(inspKey,key,ym,car) {
  if (!window._inspectChecks[inspKey]) window._inspectChecks[inspKey]={};
  window._inspectChecks[inspKey][key] = !window._inspectChecks[inspKey][key];
  buildInspect();
}
function checkAll(inspKey,val,ym,car) {
  const [y,m] = ym.split('-').map(Number);
  const days = getDaysInMonth(y,m);
  if (!window._inspectChecks[inspKey]) window._inspectChecks[inspKey]={};
  const carDays = getCarDays(ym,car);
  for (let d=1;d<=days;d++) {
    const ymd = String(y)+String(m).padStart(2,'0')+String(d).padStart(2,'0');
    if (!carDays[ymd]) continue;
    INSPECT_ITEMS.forEach(g => g.items.forEach((_,gi) => {
      window._inspectChecks[inspKey][`${ymd}_${g.group}_${gi}`] = val;
    }));
  }
  buildInspect();
}
function getCarDays(ym,car) {
  const [y,m] = ym.split('-').map(Number);
  const days = getDaysInMonth(y,m);
  const carDays = {};
  for (let d=1;d<=days;d++) {
    const ymd = String(y)+String(m).padStart(2,'0')+String(d).padStart(2,'0');
    const day = dailyData[ymd];
    if (!day) continue;
    const entry = day.entries.find(e => e.car===car);
    if (entry) carDays[ymd] = entry;
  }
  return carDays;
}
function exportInspectCSV(inspKey,ym,car) {
  const [y,m] = ym.split('-').map(Number);
  const days = getDaysInMonth(y,m);
  const checks = window._inspectChecks[inspKey]||{};
  const carDays = getCarDays(ym,car);
  const header = ['区分','点検項目',...Array.from({length:days},(_,i)=>i+1+'日')];
  const lines = [header.join(',')];
  INSPECT_ITEMS.forEach(g => g.items.forEach((item,gi) => {
    const row = [g.group,item];
    for (let d=1;d<=days;d++) {
      const ymd = String(y)+String(m).padStart(2,'0')+String(d).padStart(2,'0');
      if (!carDays[ymd]) { row.push(''); continue; }
      row.push(checks[`${ymd}_${g.group}_${gi}`]?'✔':'');
    }
    lines.push(row.map(v=>`"${v}"`).join(','));
  }));
  const blob = new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `日常点検表_${car}_${ym}.csv`;
  a.click();
}

// ============================================================
// MASTER PAGE
// ============================================================
async function addExec() {
  const name = document.getElementById('exec-name').value.trim();
  if (!name) { alert('名前を入力してください。'); return; }
  try {
    const res = await apiPost('execs', {
      name,
      day:   document.getElementById('exec-day').value,
      start: document.getElementById('exec-start').value,
      end:   document.getElementById('exec-end').value,
    });
    execMaster.push({ id: res.id, name,
      day:   document.getElementById('exec-day').value,
      start: document.getElementById('exec-start').value,
      end:   document.getElementById('exec-end').value });
    document.getElementById('exec-name').value = '';
    renderMasterTables();
  } catch(e) { alert('追加に失敗しました: ' + e.message); }
}

async function deleteExec(id) {
  try {
    await apiDelete(`execs/${id}`);
    execMaster = execMaster.filter(e => e.id !== id);
    renderMasterTables();
  } catch(e) { alert('削除に失敗しました'); }
}

async function addVehicle() {
  const bureau = document.getElementById('veh-bureau').value.trim();
  if (!bureau) { alert('運輸支局を入力してください。'); return; }
  const data = {
    seq:     document.getElementById('veh-seq').value.trim(),
    bureau,
    classNo: document.getElementById('veh-class').value.trim(),
    usage:   document.getElementById('veh-usage').value.trim(),
    num:     document.getElementById('veh-num').value.trim(),
    type:    document.getElementById('veh-type').value,
    driver:  document.getElementById('veh-driver').value.trim(),
    tel:     document.getElementById('veh-tel').value.trim(),
  };
  try {
    const res = await apiPost('vehicles', data);
    vehicleMaster.push({ id: res.id, ...data });
    ['veh-seq','veh-bureau','veh-class','veh-usage','veh-num','veh-driver','veh-tel'].forEach(id => {
      document.getElementById(id).value = '';
    });
    renderMasterTables();
  } catch(e) { alert('追加に失敗しました: ' + e.message); }
}

async function deleteVehicle(id) {
  try {
    await apiDelete(`vehicles/${id}`);
    vehicleMaster = vehicleMaster.filter(v => v.id !== id);
    renderMasterTables();
  } catch(e) { alert('削除に失敗しました'); }
}

// CSV関連（車両マスタ）
function parseCSV(text) {
  text = text.replace(/^\uFEFF/,'');
  const lines = text.split(/\r?\n/).filter(l=>l.trim()!=='');
  return lines.map(line => {
    const cols=[]; let cur='',inQ=false;
    for (let i=0;i<line.length;i++) {
      const ch=line[i];
      if (ch==='"') { if (inQ&&line[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
      else if (ch===','&&!inQ){cols.push(cur.trim());cur='';}
      else cur+=ch;
    }
    cols.push(cur.trim()); return cols;
  });
}
function handleVehicleCSV(input) {
  const file = input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const rows = parseCSV(e.target.result);
    if (rows.length < 2) { document.getElementById('csv-preview').innerHTML='<div class="alert alert-warn">データ行が見つかりません。</div>'; return; }
    const preview = rows.slice(1).map((r,i) => ({
      seq:r[0]||String(i+1),bureau:r[1]||'',classNo:r[2]||'',usage:r[3]||'',
      num:r[4]||'',type:r[5]||'その他',driver:r[6]||'',tel:r[7]||''
    })).filter(r=>r.bureau||r.classNo||r.num);
    if (!preview.length) { document.getElementById('csv-preview').innerHTML='<div class="alert alert-warn">有効なデータが見つかりませんでした。</div>'; return; }
    window._csvPreview = preview;
    let html = `<div style="margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
      <span style="color:var(--success);font-size:13px;">✅ ${preview.length}件を読み込みました。</span>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('csv-preview').innerHTML='';document.getElementById('csv-file-input').value='';">✕ キャンセル</button>
        <button class="btn btn-primary btn-sm" onclick="commitVehicleCSV()">💾 ${preview.length}件を登録</button>
      </div></div>
      <div class="tbl-wrap"><table><thead><tr>
        <th>ID</th><th>運輸支局</th><th>分類番号</th><th>用途区別</th><th>一連指定番号</th>
        <th>形状</th><th>乗務員</th><th>携帯電話番号</th><th>状態</th>
      </tr></thead><tbody>`;
    preview.forEach(r => {
      const key = [r.bureau,r.classNo,r.usage,r.num].join('_');
      const exists = vehicleMaster.some(v=>[v.bureau,v.classNo,v.usage,v.num].join('_')===key);
      html += `<tr><td>${r.seq}</td><td>${r.bureau||'—'}</td><td>${r.classNo||'—'}</td>
        <td>${r.usage||'—'}</td><td>${r.num||'—'}</td><td>${r.type}</td>
        <td>${r.driver||'—'}</td><td>${r.tel||'—'}</td>
        <td><span class="badge ${exists?'badge-red':'badge-green'}">${exists?'上書き':'新規'}</span></td></tr>`;
    });
    html += '</tbody></table></div>';
    document.getElementById('csv-preview').innerHTML = html;
  };
  reader.readAsText(file,'UTF-8');
}

async function commitVehicleCSV() {
  const preview = window._csvPreview || [];
  try {
    showLoading(true);
    const res = await apiPost('vehicles/bulk', { items: preview });
    // ローカルのvehicleMasterを再取得
    vehicleMaster = await apiGet('vehicles');
    document.getElementById('csv-preview').innerHTML =
      `<div class="alert alert-success">✅ 登録完了：新規 ${res.added}件、更新 ${res.updated}件</div>`;
    document.getElementById('csv-file-input').value='';
    window._csvPreview=[];
    renderMasterTables();
  } catch(e) { alert('登録に失敗しました: '+e.message); }
  finally { showLoading(false); }
}

function downloadVehicleCSVTemplate() {
  const csv = '\uFEFFID,運輸支局,分類番号,用途区別,一連指定番号,形状,乗務員,携帯電話番号\n1,青森,100,あ,1234,低床冷蔵ウイング,,\n';
  const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download='車両マスタ_テンプレート.csv'; a.click();
}
function exportVehicleCSV() {
  const header='ID,運輸支局,分類番号,用途区別,一連指定番号,形状,乗務員,携帯電話番号\n';
  const rows=vehicleMaster.map(v=>[v.seq||'',v.bureau||'',v.classNo||'',v.usage||'',v.num||'',v.type||'',v.driver||'',v.tel||'']
    .map(x=>`"${x.replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+header+rows],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`車両マスタ_${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

function renderMasterTables() {
  let html = `<div class="tbl-wrap"><table>
    <thead><tr><th>名前</th><th>曜日区分</th><th>開始</th><th>終了</th><th></th></tr></thead><tbody>`;
  if (!execMaster.length) html += `<tr><td colspan="5" style="text-align:center;color:var(--text-dim);">データなし</td></tr>`;
  execMaster.forEach(e => {
    html += `<tr><td>${e.name}</td><td>${e.day}</td><td class="td-mono">${e.start||'—'}</td><td class="td-mono">${e.end||'—'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteExec(${e.id})">削除</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  document.getElementById('exec-table').innerHTML = html;

  html = `<div class="tbl-wrap"><table>
    <thead><tr><th>ID</th><th>運輸支局</th><th>分類番号</th><th>用途区別</th><th>一連指定番号</th><th>形状</th><th>乗務員</th><th>携帯電話番号</th><th></th></tr></thead><tbody>`;
  if (!vehicleMaster.length) html += `<tr><td colspan="9" style="text-align:center;color:var(--text-dim);">データなし</td></tr>`;
  vehicleMaster.forEach(v => {
    html += `<tr>
      <td class="td-mono">${v.seq||'—'}</td><td>${v.bureau||'—'}</td>
      <td class="td-mono">${v.classNo||'—'}</td><td>${v.usage||'—'}</td>
      <td class="td-mono">${v.num||'—'}</td><td>${v.type||'—'}</td>
      <td>${v.driver||'—'}</td><td class="td-mono">${v.tel||'—'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteVehicle(${v.id})">削除</button></td></tr>`;
  });
  html += '</tbody></table></div>';
  document.getElementById('vehicle-table').innerHTML = html;
}

// ============================================================
// 印刷・PDF出力
// ============================================================
// ============================================================
// 共通印刷ウィンドウ生成
// ============================================================
function _openPrintWin(docTitle, pages) {
  const PFXS = ['g1','g2','g3','g4','g5','g6','g7'];
  const alcoFmt = (v,r) => v==='有' ? `有(${r||'0'})` : '無';
  const methodLabel = v => v||'';

  let bodyHTML = '';
  pages.forEach((page, pi) => {
    const isLast = pi === pages.length - 1;
    bodyHTML += `<div class="day-block${isLast?' last':''}">`;
    bodyHTML += `<div class="day-header"><span class="dt">${page.title}</span><span class="exec">${page.execStr}</span></div>`;
    bodyHTML += `<table id="tbl-${pi}">`;
    bodyHTML += `<colgroup>
      <col style="width:14px"><col style="width:58px"><col style="width:46px"><col style="width:46px">`;
    for (let g=0;g<7;g++) bodyHTML += `<col><col><col><col><col><col>`;
    bodyHTML += `<col style="width:44px"></colgroup>`;
    bodyHTML += `<thead><tr>
      <th class="bg-gray" rowspan="3">#</th>
      <th class="bg-gray" rowspan="3">登録車番<br>（車番）</th>
      <th class="bg-gray" rowspan="3">運転者名</th>
      <th class="bg-gray" rowspan="3">作業割当<br>（行き先）</th>
      <th class="bg-blue"  colspan="6">乗務前点呼</th>
      <th class="bg-green" colspan="6">乗務途中点呼</th>
      <th class="bg-red"   colspan="6">乗務後点呼</th>
      <th class="bg-blue"  colspan="6">乗務前点呼</th>
      <th class="bg-red"   colspan="6">乗務後点呼</th>
      <th class="bg-blue"  colspan="6">乗務前点呼</th>
      <th class="bg-red"   colspan="6">乗務後点呼</th>
    </tr><tr>`;
    const gDefs = [
      {bg:'blue',k:'①②③④'},{bg:'green',k:'①②④'},{bg:'red',k:'①⑤⑥⑦'},
      {bg:'blue',k:'①②③④'},{bg:'red',k:'①⑤⑥⑦'},
      {bg:'blue',k:'①②③④'},{bg:'red',k:'①⑤⑥⑦'}
    ];
    gDefs.forEach(g => {
      bodyHTML += `<th class="bg-${g.bg}" rowspan="2">点呼方法</th><th class="bg-${g.bg}" colspan="2">アルコール検知器</th><th class="bg-${g.bg}" rowspan="2">確認事項<br>${g.k}</th><th class="bg-${g.bg}" rowspan="2">点呼時間</th><th class="bg-${g.bg}" rowspan="2">執行者</th>`;
    });
    bodyHTML += `<th class="bg-gray" rowspan="2">指示事項<br>報告事項<br>その他必要事項</th>`;
    bodyHTML += `</tr><tr>`;
    gDefs.forEach(g => {
      bodyHTML += `<th class="bg-${g.bg}">使用有無</th><th class="bg-${g.bg}">測定結果</th>`;
    });
    bodyHTML += `</tr></thead><tbody>`;

    const entries = page.entries.filter(e => e.car||e.driver||e.dest||PFXS.some(p=>e[p+'Time']));
    if (!entries.length) {
      bodyHTML += `<tr><td colspan="48" style="text-align:center;color:#aaa;padding:4px;">記録なし</td></tr>`;
    } else {
      entries.forEach((e,i) => {
        bodyHTML += `<tr><td>${i+1}</td><td>${e.car||''}</td><td>${e.driver||''}</td><td>${e.dest||''}</td>`;
        PFXS.forEach(p => {
          bodyHTML += `<td>${methodLabel(e[p+'Method'])}</td><td>${e[p+'Alco']||''}</td><td>${e[p+'AlcoVal']||''}</td><td>${e[p+'Kakunin']||''}</td><td>${e[p+'Time']||''}</td><td>${e[p+'Exec']||''}</td>`;
        });
        bodyHTML += `<td>${e.note||''}</td></tr>`;
      });
    }
    bodyHTML += `</tbody></table>`;
    bodyHTML += `<div class="footer-note">注1：確認事項は、①酒気帯びの有無　②運転者の疾病、疲労等の状況、睡眠不足の状況　③日常点検の状況　④その他必要な事項（携帯用アルコール検知器、免許証、検査証、運行指示書、乗務記録、チャート紙等の携行状況等）　⑤自動車、道路及び運行の状況　⑥交替運転者に対する通告　⑦その他必要な事項（事故・違反・乗客の異常。遺失物等の有無及び乗務記録・チャート紙等の記載状況等）とする。<br>注2：点呼方法欄中、[対面]とは対面による点呼方法を示し、[電話]とは電話等での間接的な点呼方法を示す。<br>注3：記録は 00:00～24:00 の間に実施した各点呼の実施状況を記載すること。</div>`;
    bodyHTML += `</div>`;
  });

  const win = window.open('', '_blank', 'width=1400,height=900');
  win.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>${docTitle}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&family=IBM+Plex+Mono&display=swap');
  @page { margin: 5mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { height: 100%; }
  body { font-family: 'Noto Sans JP', sans-serif; background: #fff; color: #000; }
  .day-block { page-break-after: always; margin-bottom: 4px; }
  .day-block:last-child { page-break-after: auto; }
  .day-header { display: flex; justify-content: space-between; align-items: center;
    background: #f5f5f5; border: 1px solid #aaa; padding: 3px 6px; margin-bottom: 3px; }
  .day-header .dt { font-size: 10px; font-weight: 700; }
  .day-header .exec { font-size: 7.5px; color: #333; }
  /* テーブルラッパー：印刷時に用紙幅へfitさせるためのコンテナ */
  .tbl-wrap { width: 100%; overflow: visible; }
  table { border-collapse: collapse; table-layout: auto; white-space: nowrap; }
  th, td { border: 1px solid #aaa; padding: 1px 2px; font-size: 6.5px;
    vertical-align: middle; text-align: center; line-height: 1.3; }
  th { font-weight: 600; word-break: keep-all; white-space: normal; }
  td { white-space: nowrap; }
  th.bg-blue  { background: #dde8ff; }
  th.bg-green { background: #ddffd8; }
  th.bg-red   { background: #ffddd8; }
  th.bg-gray  { background: #eeeeee; }
  input, select { border: none; background: transparent; font-size: 6.5px;
    width: 100%; padding: 0; -webkit-appearance: none; appearance: none; color: #000; }
  .footer-note { font-size: 6px; color: #333; line-height: 1.7; margin-top: 4px;
    border-top: 1px solid #bbb; padding-top: 3px; white-space: normal; }
  /* ── 印刷時のみ適用 ── */
  @media print {
    body { margin: 0; padding: 0; }
    /* テーブルを印刷可能幅(100vw)にfitさせる */
    .tbl-wrap {
      width: 100vw;
      overflow: hidden;
    }
    table {
      width: 100% !important;
      table-layout: fixed !important;
    }
    th, td { font-size: 5.5px !important; padding: 1px !important; }
  }
</style>
</head><body>
${bodyHTML}
<script>
window.onload = function() {
  // 画面表示時：テーブル実幅を取得してbodyをfit幅に設定
  // 印刷時はブラウザの「用紙に合わせる」設定で自動フィット
  const tables = document.querySelectorAll('table');
  let maxW = 0;
  tables.forEach(t => { maxW = Math.max(maxW, t.scrollWidth); });
  if (maxW > 0) document.body.style.minWidth = maxW + 'px';

  // 印刷前イベントでズームをリセット（ブラウザ自動縮小に委ねる）
  window.onbeforeprint = function() {
    document.body.style.minWidth = '';
    // Chromeは「用紙に合わせる」がデフォルトでON → 自動縮小される
  };
  setTimeout(() => { window.print(); window.close(); }, 800);
};
<\/script>
</body></html>`);
  win.document.close();
}

function printDaily() {
  const tbl = document.getElementById('entry-table');
  if (!tbl) return;
  const dateLabel = document.querySelector('#daily-content .date-label');
  const dateSub   = document.querySelector('#daily-content .date-sub');
  const titleStr  = (dateLabel?dateLabel.textContent:'') + '　' + (dateSub?dateSub.textContent:'');
  const day = dailyData[currentDate] || {};
  const execStr = `統括: ${day.supervisor||'　'} / 運行管理者: ${day.manager||'　'} ${day.manager2||'　'} / 補助者: ${day.helper||'　'} ${day.helper2||'　'}`;
  _openPrintWin('日次点呼記録　' + titleStr, [{
    title: titleStr, execStr, entries: day.entries||[], ymd: currentDate
  }]);
}

function showPrintMonthModal() {
  const ym = currentDate.slice(0,4)+'-'+currentDate.slice(4,6);
  document.getElementById('print-month-select').value = ym;
  document.getElementById('print-month-modal').classList.add('open');
}
function closePrintMonthModal() {
  document.getElementById('print-month-modal').classList.remove('open');
}
async function printMonth() {
  const ym    = document.getElementById('print-month-select').value;
  const scope = document.getElementById('print-month-scope').value;
  if (!ym) { alert('月を選択してください。'); return; }
  closePrintMonthModal();

  const [y,m] = ym.split('-').map(Number);
  const ymStr = String(y)+String(m).padStart(2,'0');
  if (!Object.keys(dailyData).some(k=>k.startsWith(ymStr))) {
    showLoading(true);
    await loadMonthData(ymStr);
    showLoading(false);
  }

  const days = getDaysInMonth(y,m);
  const pages = [];
  for (let d=1;d<=days;d++) {
    const ymd = ymStr+String(d).padStart(2,'0');
    const day = dailyData[ymd];
    if (scope==='all' && (!day||!day.entries||!day.entries.length)) continue;
    const dateObj = ymdToDate(ymd);
    const wr = WAREKI[y]?WAREKI[y]+'年':y+'年';
    const titleStr = `${wr}${m}月${d}日（${WEEKDAY_JA[dateObj.getDay()]}）`;
    const execStr = `統括: ${(day&&day.supervisor)||'　'} / 運行管理者: ${(day&&day.manager)||'　'} ${(day&&day.manager2)||'　'} / 補助者: ${(day&&day.helper)||'　'} ${(day&&day.helper2)||'　'}`;
    pages.push({ title: titleStr, execStr, entries: (day&&day.entries)||[], ymd });
  }
  if (!pages.length) { alert(`${y}年${m}月にデータがありません。`); return; }
  _openPrintWin(`月次点呼記録　${y}年${m}月`, pages);
}

// ============================================================
// MODAL
// ============================================================
function showModal(title,msg,onOk) {
  document.getElementById('modal-title').textContent=title;
  document.getElementById('modal-msg').textContent=msg;
  document.getElementById('modal-ok').onclick=()=>{ onOk(); closeModal(); };
  document.getElementById('modal').classList.add('open');
}
function closeModal() { document.getElementById('modal').classList.remove('open'); }

// ============================================================
// HTMLにアプリのUIを挿入してから初期化
// ============================================================
function injectAppHTML() {
  const root = document.getElementById('tenrec-app-root');
  if (!root) return;
  root.innerHTML = `
<div class="app">
  <div class="sidebar">
    <div class="sidebar-logo">
      <h1>🚛 点呼記録</h1>
      <p>Transport Log System</p>
    </div>
    <div class="nav-section">
      <div class="nav-label">メニュー</div>
      <button class="nav-item active" onclick="showPage('daily')" id="nav-daily"><span class="nav-icon">📋</span>日毎点呼記録</button>
      <button class="nav-item" onclick="showPage('list')" id="nav-list"><span class="nav-icon">📊</span>リスト集計</button>
      <button class="nav-item" onclick="showPage('inspect')" id="nav-inspect"><span class="nav-icon">🔍</span>日常点検表</button>
      <button class="nav-item" onclick="showPage('master')" id="nav-master"><span class="nav-icon">⚙️</span>マスタ管理</button>
    </div>
    <div class="nav-section" style="margin-top:auto;border-top:1px solid var(--border);padding-top:12px;">
      <div class="nav-label">印刷・出力</div>
      <button class="nav-item" onclick="printDaily()"><span class="nav-icon">🖨️</span>日次印刷</button>
      <button class="nav-item" onclick="showPrintMonthModal()"><span class="nav-icon">📄</span>月次印刷</button>
    </div>
  </div>
  <div class="main">
    <div class="topbar">
      <h2 id="page-title">日毎点呼記録</h2>
      <div class="topbar-meta" id="topbar-meta"></div>
    </div>
    <div class="content">
      <div class="page active" id="page-daily">
        <div class="month-picker">
          <input type="month" id="month-select" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text);font-family:var(--font);font-size:14px;outline:none;">
          <button class="btn btn-primary" onclick="loadDailyView()">📅 月を選択</button>
          <button class="btn btn-secondary" onclick="prevDay()">◀ 前日</button>
          <button class="btn btn-secondary" onclick="nextDay()">翌日 ▶</button>
          <div style="margin-left:auto;display:flex;gap:8px;">
            <button class="btn btn-secondary" onclick="printDaily()">🖨️ 日次印刷</button>
            <button class="btn btn-secondary" onclick="showPrintMonthModal()">📄 月次印刷</button>
          </div>
        </div>
        <div id="daily-content"></div>
      </div>

      <div class="page" id="page-list">
        <div class="card">
          <div class="card-title">📊 集計期間</div>
          <div class="form-row">
            <div class="form-group"><label>開始月</label><input type="month" id="list-from"></div>
            <div class="form-group"><label>終了月</label><input type="month" id="list-to"></div>
            <div class="form-group" style="justify-content:flex-end;flex-direction:row;align-items:flex-end;">
              <button class="btn btn-primary" onclick="buildList()">🔄 集計実行</button>
              <button class="btn btn-secondary" onclick="exportCSV()" style="margin-left:8px;">💾 CSV出力</button>
            </div>
          </div>
        </div>
        <div id="list-stats" class="stats-bar"></div>
        <div id="list-content"></div>
      </div>

      <div class="page" id="page-inspect">
        <div class="card">
          <div class="card-title">🔍 日常点検表 — 車番別</div>
          <div class="form-row">
            <div class="form-group"><label>対象月</label><input type="month" id="inspect-month"></div>
            <div class="form-group"><label>車番</label><select id="inspect-car"><option value="">— 車番を選択 —</option></select></div>
            <div class="form-group" style="justify-content:flex-end;flex-direction:row;align-items:flex-end;">
              <button class="btn btn-primary" onclick="buildInspect()">🔍 点検表生成</button>
            </div>
          </div>
        </div>
        <div id="inspect-content"></div>
      </div>

      <div class="page" id="page-master">
        <div class="tab-bar">
          <button class="tab-btn active" onclick="showTab('tab-exec')">執行者マスタ</button>
          <button class="tab-btn" onclick="showTab('tab-vehicle')">車両・運転者マスタ</button>
        </div>
        <div class="tab-content active" id="tab-exec">
          <div class="card">
            <div class="card-title">👤 執行者（点呼執行者）マスタ</div>
            <div class="form-row">
              <div class="form-group"><label>名前</label><input type="text" id="exec-name" placeholder="例：山田 太郎"></div>
              <div class="form-group"><label>曜日区分</label><select id="exec-day"><option>月～土</option><option>日曜日</option><option>全日</option></select></div>
              <div class="form-group"><label>開始時刻</label><input type="time" id="exec-start"></div>
              <div class="form-group"><label>終了時刻</label><input type="time" id="exec-end"></div>
              <div class="form-group" style="justify-content:flex-end;flex-direction:row;align-items:flex-end;">
                <button class="btn btn-primary" onclick="addExec()">＋ 追加</button>
              </div>
            </div>
          </div>
          <div id="exec-table"></div>
        </div>
        <div class="tab-content" id="tab-vehicle">
          <div class="card" style="border-color:#2a4a6b;">
            <div class="card-title" style="color:#60a5fa;">📥 CSV一括登録</div>
            <div style="margin-bottom:12px;">
              <div class="alert alert-info" style="margin-bottom:10px;">1行目はヘッダ行として読み飛ばします。</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <label class="btn btn-primary" style="cursor:pointer;">📂 CSVファイルを選択<input type="file" id="csv-file-input" accept=".csv" style="display:none;" onchange="handleVehicleCSV(this)"></label>
                <button class="btn btn-secondary" onclick="downloadVehicleCSVTemplate()">⬇ テンプレートDL</button>
                <button class="btn btn-secondary" onclick="exportVehicleCSV()">💾 現在のデータをCSV出力</button>
              </div>
            </div>
            <div id="csv-preview"></div>
          </div>
          <div class="card">
            <div class="card-title">🚛 車両・運転者マスタ（手動追加）</div>
            <div class="form-row">
              <div class="form-group" style="max-width:80px;"><label>ID</label><input type="text" id="veh-seq" placeholder="1"></div>
              <div class="form-group"><label>運輸支局</label><input type="text" id="veh-bureau" placeholder="例：青森"></div>
              <div class="form-group" style="max-width:90px;"><label>分類番号</label><input type="text" id="veh-class" placeholder="100"></div>
              <div class="form-group" style="max-width:80px;"><label>用途区別</label><input type="text" id="veh-usage" placeholder="あ"></div>
              <div class="form-group" style="max-width:100px;"><label>一連指定番号</label><input type="text" id="veh-num" placeholder="1234"></div>
              <div class="form-group"><label>形状</label><select id="veh-type"><option>低床冷蔵ウイング</option><option>高床冷蔵ウイング</option><option>平ボディ</option><option>その他</option></select></div>
              <div class="form-group"><label>乗務員</label><input type="text" id="veh-driver" placeholder="名前"></div>
              <div class="form-group"><label>携帯電話番号</label><input type="tel" id="veh-tel" placeholder="090-xxxx-xxxx"></div>
              <div class="form-group" style="justify-content:flex-end;flex-direction:row;align-items:flex-end;">
                <button class="btn btn-primary" onclick="addVehicle()">＋ 追加</button>
              </div>
            </div>
          </div>
          <div id="vehicle-table"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- Modal confirm -->
<div class="modal-bg" id="modal">
  <div class="modal">
    <h3 id="modal-title"></h3>
    <p id="modal-msg" style="color:var(--text-dim);font-size:13px;margin-bottom:20px;"></p>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-primary" id="modal-ok">OK</button>
    </div>
  </div>
</div>

<!-- 月次印刷モーダル -->
<div class="modal-bg" id="print-month-modal">
  <div class="modal" style="width:360px;">
    <h3>📄 月次印刷・PDF出力</h3>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px;">対象月を選択して印刷またはPDF保存できます。</p>
    <div class="form-group" style="margin-bottom:16px;">
      <label>対象月</label>
      <input type="month" id="print-month-select" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:13px;outline:none;width:100%;">
    </div>
    <div class="form-group" style="margin-bottom:20px;">
      <label>出力形式</label>
      <select id="print-month-scope" style="background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text);font-family:var(--font);font-size:13px;outline:none;width:100%;">
        <option value="all">全日（データあり日のみ）</option>
        <option value="full">全日（空日含む全日程）</option>
      </select>
    </div>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button class="btn btn-secondary" onclick="closePrintMonthModal()">キャンセル</button>
      <button class="btn btn-primary" onclick="printMonth()">🖨️ 印刷・PDF出力</button>
    </div>
  </div>
</div>`;
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  injectAppHTML();
  updateTopbarMeta();
  await loadAllData();
  initDailyPage();
  renderMasterTables();
});