/* ruvy 검사 콘솔 — 시안 B. 흐름: S/N → 위치 선택 → 검사(▷ ⏸ ◻, 카메라 숫자 감지, Pass/Fail 로그) → 결과(그룹·표·업로드) → Fail 당시 화면 */
'use strict';
(() => {
  const TARGET = 100, MODES = ['MP', 'Normal'];
  const IMG = { src: 'assets/device-sample.jpg', w: 2000, h: 1500 };
  const VIEW = { x: 560, y: 340, w: 920, h: 680 };
  // 숫자 감지 영역(ROI): 원본 사진(2000×1500) 픽셀 좌표. Tesseract OCR로 검증된 좌표입니다.
  const FIELDS = [
    { key: 'energy',  label: 'Energy',     roi: [915, 495, 1090, 605],  unit: '',   exp: { MP: '1.0', Normal: '1.0' }, main: true },
    { key: 'jshot',   label: 'J/shot',     roi: [957, 606, 1000, 630],  unit: 'J',  exp: { MP: '16.67', Normal: '16.67' }, tag: 'left' },
    { key: 'booster', label: 'Booster',    roi: [1008, 382, 1042, 410], unit: 'mm', exp: { MP: '3.0', Normal: '3.0' }, tag: 'right' },
    { key: 'remain',  label: 'Remain',     roi: [820, 428, 895, 458],   unit: '',   exp: null },
    { key: 'current', label: 'Current',    roi: [1118, 420, 1180, 455], unit: '',   exp: null, tag: 'right' },
    { key: 'total',   label: 'Total',      roi: [1025, 650, 1075, 680], unit: '',   exp: null, tag: 'right' },
    { key: 'counter', label: 'Shot count', roi: [980, 712, 1100, 748],  unit: '',   exp: null, overlayOnly: true, tag: 'left' },
    { key: 'repeat',  label: 'Repeat',     roi: [832, 796, 868, 828],   unit: 's',  exp: { MP: '0.1', Normal: '0.1' } },
    { key: 'length',  label: 'Length',     roi: [1015, 793, 1052, 822], unit: 'mm', exp: { MP: '25', Normal: '25' } },
    { key: 'mode',    label: 'Mode',       roi: [765, 858, 810, 888],   unit: '',   exp: { MP: 'MP', Normal: 'Normal' } },
    { key: 'status',  label: 'Status',     roi: [905, 930, 1125, 990],  unit: '',   exp: { MP: 'STANDBY', Normal: 'STANDBY' } },
  ];
  const TABLE_FIELDS = FIELDS.filter(f => !f.overlayOnly);
  const SCREENS = [['serial', '01 · S/N 입력'], ['position', '02 · 위치 선택'], ['ready', '03 · 검사 준비'], ['running', '04 · Vision AI 감지 중'], ['paused', '05 · 일시정지'], ['stop', '06 · 중지 확인'], ['position-progress', '07 · 위치 1 완료'], ['position-done', '08 · 전체 완료'], ['results', '09 · 결과'], ['fail-detail', '10 · Fail 당시 화면']];
  const ICONS = {
    play: '<path d="m7 4 13 8-13 8z"/>', pause: '<path d="M8 4v16M16 4v16"/>', stop: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', back: '<path d="M19 12H5m5 5-5-5 5-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>', alert: '<path d="M12 3 2 20h20zM12 10v5m0 2v1"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/>', download: '<path d="M12 4v12m-5-5 5 5 5-5M4 20h16"/>',
    camera: '<path d="M4 7h4l2-3h4l2 3h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    key: '<circle cx="8" cy="12" r="4"/><path d="M12 12h9m-3 0v3m-3-3v2"/>', flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
    up: '<path d="M12 19V6m-6 6 6-6 6 6"/>', down: '<path d="M12 5v13m-6-6 6 6 6-6"/>', spark: '<path d="M3 17l5-6 4 3 5-8 4 5"/>',
    chev: '<path d="m9 6 6 6-6 6"/>', tag: '<path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.4"/>',
    pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>',
  };
  const icon = n => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, l = 3) => String(n).padStart(l, '0');
  const hms = d => `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;

  const freshPositions = () => [1, 2, 3].map(id => ({ id, done: false, MP: [], Normal: [] }));
  const state = { screen: 'serial', serial: '', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), showRoi: true, resultsTab: null, uploaded: null, timer: null, last: null, filter: 'all', jumpTo: null, q: '' };
  const app = document.getElementById('app'), confirmDlg = document.getElementById('confirm'), failDlg = document.getElementById('fail-dialog');
  const photo = new Image(); photo.src = IMG.src; photo.onload = () => drawThumbs();
  const pos = () => state.positions[state.position - 1];
  const samples = () => pos()[state.mode];
  const modeDone = (p, m) => p[m].length >= TARGET;
  const allDone = () => state.positions.every(p => p.done);
  const anySamples = () => state.positions.some(p => MODES.some(m => p[m].length));

  // ── 감지 (시뮬레이션). 실제 연결 시 카메라 프레임을 FIELDS[].roi 로 잘라 OCR 한 결과를 { key: { v, conf } } 로 반환 ──
  const hash = (a, b, c) => { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };
  function detectFrame(position, mode, i) {
    const mi = MODES.indexOf(mode) + 1, h = hash(position, mi, i), shot = 436 + i, remain = Math.max(0, 118 - i);
    const base = { energy: '1.0', jshot: '16.67', booster: '3.0', remain: String(remain), current: String(shot), total: String(shot), counter: `${shot}/300`, repeat: '0.1', length: '25', mode, status: 'STANDBY' };
    const f = {}; FIELDS.forEach((x, k) => { f[x.key] = { v: base[x.key], conf: 93 + (hash(i, mi, k) % 6) }; });
    if (h % 11 === 0) f[['jshot', 'booster', 'length', 'repeat'][(h >>> 4) % 4]].conf = 62 + ((h >>> 8) % 16);
    if (h % 17 === 0) { const p = (h >>> 5) % 4; if (p === 0) f.energy = { v: (h >>> 9) % 2 ? '1.2' : '0.8', conf: 91 }; else if (p === 1) f.status = { v: 'READY', conf: 94 }; else if (p === 2) f.length = { v: '30', conf: 89 }; else f.mode = { v: mode === 'MP' ? 'Normal' : 'MP', conf: 92 }; }
    return f;
  }
  function judge(fields, mode) { const failKeys = [], warnKeys = []; for (const f of FIELDS) { const d = fields[f.key]; if (f.exp && d.v !== f.exp[mode]) failKeys.push(f.key); if (d.conf < 80) warnKeys.push(f.key); } return { pass: !failKeys.length, failKey: failKeys[0] || null, failKeys, warnKeys }; }
  const makeSample = (position, mode, i, t) => { const fields = detectFrame(position, mode, i); return { i, t, position, mode, fields, ...judge(fields, mode) }; };
  function addSample() { const list = samples(); if (list.length >= TARGET) return; const s = makeSample(state.position, state.mode, list.length + 1, hms(new Date())); list.push(s); state.last = s; if (list.length >= TARGET) onModeComplete(); render(); }
  function onModeComplete() {
    stopTimer(); state.status = 'idle'; const p = pos(), remaining = MODES.find(m => !modeDone(p, m));
    if (remaining) { toast(`${state.mode} ${TARGET}회 완료 · ${remaining} 모드로 전환`); state.mode = remaining; state.last = null; }
    else { p.done = true; openConfirm({ title: `위치 ${p.id} 검사 완료`, desc: `Normal·MP 각 ${TARGET}회 수집이 끝났습니다. 위치 선택으로 돌아가 다음 위치를 진행하세요.`, cancel: null, ok: '위치 선택으로', action: goPositions }); }
  }
  const startTimer = () => { stopTimer(); state.timer = setInterval(addSample, 1000); };
  const stopTimer = () => { if (state.timer) clearInterval(state.timer); state.timer = null; };

  // ── 렌더 ──
  function render() {
    const keep = app.querySelector('.tbl-wrap'), top = keep ? keep.scrollTop : 0;
    ({ serial: renderSerial, position: renderPositions, inspect: renderInspect, results: renderResults })[state.screen]();
    const wrap = app.querySelector('.tbl-wrap'); if (wrap && top) wrap.scrollTop = top;
    renderRail(); drawThumbs(); afterList();
  }
  // ── 상단 GNB · 상태줄 · 사이드 · 하단 티커 ──
  const STEPS = [
    { key: 'serial',   n: 1, label: 'S/N 입력' },
    { key: 'position', n: 2, label: '위치 선택' },
    { key: 'inspect',  n: 3, label: '검사' },
    { key: 'results',  n: 4, label: '결과' },
  ];
  const stepIndex = () => STEPS.findIndex(x => x.key === state.screen) + 1;
  const allRows = () => state.positions.flatMap(p => MODES.flatMap(m => p[m]));
  function goStep(key) {
    if (key === state.screen) return;
    stopTimer(); state.status = 'idle'; state.jumpTo = null;
    if (key === 'results') { goResults(); return; }
    if (key === 'position') state.selected = null;
    state.screen = key; render();
  }
  // 값 목록을 작은 꺾은선으로. 지수 카드의 스파크라인 자리.
  function sparkline(values, tone) {
    if (values.length < 2) return `<svg class="spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"></svg>`;
    const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
    const pts = values.map((v, i) => [i / (values.length - 1) * 100, 30 - (v - lo) / span * 26]);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join('');
    return `<svg class="spark s-${tone}" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <path class="area" d="${line}L100 32L0 32Z"/><path class="line" d="${line}"/></svg>`;
  }
  const bucket = (rows, n, fn) => {
    if (!rows.length) return [];
    const size = Math.max(1, Math.ceil(rows.length / n)), out = [];
    for (let i = 0; i < rows.length; i += size) out.push(fn(rows.slice(i, i + size), rows.slice(0, i + size)));
    return out;
  };
  // 레퍼런스의 지수 카드 줄: 이름 + 태그 + 큰 값 + 변화 + 스파크라인
  function metricStrip(rows, cap, firstLabel) {
    const n = rows.length, fails = failCount(rows), low = rows.filter(s => s.pass && isWarn(s)).length;
    const rate = n ? (100 - fails / n * 100) : 0;
    const conf = n ? rows.reduce((a, s) => a + avgConf(s), 0) / n : 0;
    const card = (k, tag, tone, val, unit, sub, spark) => `<div class="mx">
      <div class="mx-top"><span class="mx-k">${k}</span>${tag ? `<span class="tag t-${tone}">${tag}</span>` : ''}</div>
      <div class="mx-v num">${val}${unit ? `<small>${unit}</small>` : ''}</div>
      <div class="mx-sub c-${tone}">${sub}</div>${spark}</div>`;
    return `<section class="metrics">
      ${card(firstLabel || '전체 수집', `${Math.round(n / cap * 100)}%`, 'blue', n.toLocaleString(), ` / ${cap}`, `${cap - n}회 남음`,
        sparkline(bucket(rows, 24, (_, acc) => acc.length), 'blue'))}
      ${card('Pass', 'Pass율', 'up', (n - fails).toLocaleString(), '', `${rate.toFixed(1)}%`,
        sparkline(bucket(rows, 24, b => b.filter(s => s.pass).length / b.length * 100), 'up'))}
      ${card('Fail', fails ? '확인 필요' : '없음', 'down', fails.toLocaleString(), '', fails ? `전체의 ${(fails / (n || 1) * 100).toFixed(1)}%` : '기준값 전부 일치',
        sparkline(bucket(rows, 24, (_, acc) => failCount(acc)), 'down'))}
      ${card('평균 신뢰도', low ? `80%↓ ${low}` : '안정', low ? 'warn' : 'up', conf.toFixed(1), '%', low ? `${low}회 확인 권장` : '전 회차 80% 이상',
        sparkline(bucket(rows, 24, b => b.reduce((a, s) => a + avgConf(s), 0) / b.length), low ? 'warn' : 'up'))}
    </section>`;
  }
  function renderRail() {
    const idx = stepIndex(), rows = allRows(), fails = failCount(rows);
    // 상단 메뉴는 그냥 링크 묶음이 아니라 검사 흐름 그 자체 — 지나온 단계는 체크, 지금은 채운 알약, 앞은 흐리게.
    document.getElementById('gnb-menu').innerHTML = STEPS.map((st, i) => {
      const done = st.n < idx, on = st.n === idx;
      const reach = st.n <= idx || (st.key === 'results' && anySamples());
      const badge = st.key === 'results' && fails ? `<em class="step-badge">${fails}</em>` : '';
      return `${i ? '<span class="step-link" aria-hidden="true"></span>' : ''}<button type="button" class="step${on ? ' is-on' : done ? ' is-done' : ''}" data-step="${st.key}"${reach ? '' : ' disabled'}${on ? ' aria-current="step"' : ''}>
        <span class="step-n">${done ? icon('check') : st.n}</span><span class="step-l">${st.label}</span>${badge}</button>`;
    }).join('');
    document.getElementById('gnb-menu').querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => goStep(b.dataset.step)));
    const snEl = document.getElementById('gnb-sn');
    snEl.hidden = !state.serial;
    snEl.innerHTML = state.serial ? `<i>S/N</i><b>${esc(state.serial)}</b>` : '';

    const cta = document.getElementById('gnb-cta');
    const plan = { serial: null, position: null, inspect: ['결과 보기', () => goResults()], results: [state.uploaded ? '업로드 완료' : '업로드', () => uploadNow()] }[state.screen];
    cta.hidden = !plan || (state.screen === 'inspect' && !anySamples());
    if (plan) { cta.textContent = plan[0]; cta.onclick = plan[1]; cta.disabled = state.screen === 'results' && (!anySamples() || !!state.uploaded); }

    const p = state.positions[state.position - 1], pct = rows.length / (TARGET * 6) * 100;
    document.getElementById('statusbar').innerHTML =
      `<span class="st"><i class="dot"></i>Camera 연결됨</span><span class="st"><i class="dot"></i>Edge (Vision AI) 준비됨</span>
       <span class="st st-div"></span>
       <span class="st">${state.status === 'running' ? '<i class="dot live"></i>감지 중' : state.status === 'paused' ? '<i class="dot warn"></i>일시정지' : '<i class="dot off"></i>대기'}</span>
       <span class="st">위치 <b>${p.id}</b> · <b>${esc(state.mode)}</b></span>
       <span class="st st-right">진행 <b class="num">${rows.length}</b> / ${TARGET * 6}<span class="st-bar"><i style="width:${pct.toFixed(1)}%"></i></span></span>`;

    const q = document.getElementById('q'), on = state.screen === 'inspect' || state.screen === 'results';
    q.disabled = !on; q.placeholder = on ? '회차 · 읽은 값 검색' : '검사 시작 후 검색';
    document.getElementById('search-form').classList.toggle('is-off', !on);
    if (q.value !== state.q) q.value = state.q;

    renderTicker();
    const sel = document.getElementById('screen-select');
    const cur = state.screen === 'inspect' ? (state.status === 'running' ? 'running' : state.status === 'paused' ? 'paused' : 'ready') : state.screen === 'position' ? (allDone() ? 'position-done' : state.positions.some(x => x.done) ? 'position-progress' : 'position') : state.screen;
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  }
  // 최근 Fail — 오른쪽 열에 있던 것을 본문 패널로. 누르면 그 회차의 당시 화면이 열린다.
  function recentFails(rows, n) {
    const list = rows.filter(s => !s.pass).slice(-n).reverse();
    return `<div class="card pad"><div class="box-head"><h3>${icon('alert')}최근 Fail</h3><span class="cap">${failCount(rows)}건</span></div>
      ${list.length ? `<div class="flist">${list.map(s => { const f = FIELDS.find(x => x.key === s.failKey);
        return `<button type="button" class="frow" data-ref="${refOf(s)}"><span class="frow-l"><b>${s.position}·${esc(s.mode)} <span class="num">${pad(s.i)}</span></b><small>${esc(f.label)} ${esc(s.fields[s.failKey].v)} ≠ ${esc(f.exp[s.mode])}</small></span><small class="num frow-t">${s.t}</small></button>`; }).join('')}</div>`
        : `<p class="empty">아직 Fail이 없습니다.</p>`}</div>`;
  }
  // 위치·모드 진행 — 오른쪽 열에 있던 관심 종목 목록을 본문 패널로.
  function groupPanel() {
    const gs = groups();
    return `<div class="card pad"><div class="box-head"><h3>${icon('grid')}위치 · 모드</h3><span class="cap">${gs.filter(g => g.rows.length >= TARGET).length} / 6 완료</span></div>
      <div class="glist">${gs.map(g => { const f = failCount(g.rows), pass = g.rows.length - f;
        return `<button type="button" class="wrow${state.screen === 'results' && g.id === state.resultsTab ? ' is-on' : ''}" data-tab="${g.id}">
          <span class="wrow-l"><b>${g.label}</b><small class="num">${g.rows.length} / ${TARGET}회</small></span>
          <span class="wrow-r"><b class="num ${f ? 'c-down' : 'c-up'}">${f ? `${f} Fail` : g.rows.length ? 'Pass' : '—'}</b>
          <span class="duo"><i class="p" style="width:${pass / TARGET * 100}%"></i><i class="f" style="width:${f / TARGET * 100}%"></i></span></span></button>`; }).join('')}</div></div>`;
  }
  function renderTicker() {
    const rows = allRows(), n = rows.length, fails = failCount(rows), low = rows.filter(s => s.pass && isWarn(s)).length;
    const conf = n ? rows.reduce((a, s) => a + avgConf(s), 0) / n : 0, last = rows.filter(s => !s.pass).slice(-1)[0];
    const it = (k, v, tone) => `<span class="tk"><i>${k}</i><b class="num${tone ? ' c-' + tone : ''}">${v}</b></span>`;
    document.getElementById('ticker').innerHTML =
      `<span class="tk tk-sn"><i>S/N</i><b>${state.serial ? esc(state.serial) : '—'}</b></span>` +
      it('수집', `${n} / ${TARGET * 6}`) + it('Pass', n - fails, 'up') + it('Fail', fails, fails ? 'down' : '') +
      it('Pass율', `${n ? (100 - fails / n * 100).toFixed(1) : '—'}%`) + it('평균 신뢰도', `${conf.toFixed(1)}%`) +
      it('신뢰도 80%↓', low, low ? 'warn' : '') +
      (last ? `<span class="tk"><i>최근 Fail</i><b>${last.position}·${esc(last.mode)} <span class="num">${pad(last.i)}</span> · ${esc(FIELDS.find(x => x.key === last.failKey).label)}</b></span>` : '');
  }
  function uploadNow() {
    if (!anySamples() || state.uploaded) return;
    if (state.screen !== 'results') { goResults(); }
    doUpload(document.getElementById('gnb-cta'));
  }

  function renderSerial() {
    app.innerHTML = `<div class="sn-wrap"><section class="card sn-card"><h1>시리얼 번호를 입력하세요</h1><p class="intro">장비 라벨의 S/N을 입력하면 위치 선택으로 넘어갑니다.</p>
      <form id="sn-form" novalidate><div class="sn-field"><label for="sn-input">S/N</label><input class="sn-input" id="sn-input" placeholder="SN-2026-001234" maxlength="32" autocomplete="off" spellcheck="false" value="${esc(state.serial)}" aria-describedby="sn-help sn-err"><p class="sn-help" id="sn-help">영문·숫자·하이픈, 6자 이상</p><p class="sn-err" id="sn-err" role="alert" hidden></p></div>
      <div class="sn-plan"><div class="plan"><b>3</b><span>검사 위치</span></div><div class="plan"><b>2</b><span>모드 (Normal · MP)</span></div><div class="plan"><b>${TARGET}</b><span>모드당 감지 횟수</span></div></div>
      <div class="sn-actions"><button type="reset" class="btn btn-xl">Cancel</button><button type="submit" class="btn btn-xl btn-primary">OK ${icon('arrow')}</button></div></form></section></div>`;
    const form = document.getElementById('sn-form'), input = document.getElementById('sn-input'), err = document.getElementById('sn-err'); input.focus();
    form.addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim().toUpperCase(); if (!/^[A-Z0-9-]{6,}$/.test(v)) { err.textContent = '형식이 올바르지 않습니다. 영문·숫자·하이픈 6자 이상으로 입력하세요.'; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; } state.serial = v; state.screen = 'position'; render(); });
    form.addEventListener('reset', () => { err.hidden = true; input.removeAttribute('aria-invalid'); setTimeout(() => input.focus()); });
  }

  // 2. 위치 선택
  function renderPositions() {
    const done = state.positions.filter(p => p.done).length, selP = state.selected ? state.positions[state.selected - 1] : null;
    const cards = state.positions.map(p => { const slot = p.id === 3 ? 5 : p.id, sel = state.selected === p.id;
      return `<button type="button" class="pos${sel ? ' is-selected' : ''}${p.done ? ' is-done' : ''}" style="--slot:${slot}" data-pos="${p.id}" aria-pressed="${sel}" ${p.done ? 'disabled' : ''}>
        <span class="pos-top"><span>위치 ${p.id}</span>${p.done ? `<span class="pos-done-badge" aria-label="완료">${icon('check')}</span>` : sel ? '<span class="pill pill-accent">선택됨</span>' : '<span class="pill pill-neutral">대기</span>'}</span>
        <span class="pos-big">${p.id}</span>
        <span class="pos-modes">${MODES.map(m => `<span class="pm${modeDone(p, m) ? ' done' : ''}"><b>${m}</b><span class="bar"><span style="width:${p[m].length}%"></span></span><span class="n"><b>${p[m].length}</b>/${TARGET}</span></span>`).join('')}</span></button>`; }).join('');
    const hint = allDone() ? '<b>세 위치 모두 완료</b>결과에서 Pass/Fail을 확인하고 업로드하세요.' : selP ? `<b>위치 ${selP.id}</b>${MODES.find(m => !modeDone(selP, m))} 모드부터 검사합니다.` : '검사할 위치를 고른 뒤 OK를 누르세요. 완료된 위치는 다시 고를 수 없습니다.';
    app.innerHTML = `<div class="head"><div><h1>검사할 위치를 선택하세요</h1><p>장비의 실제 배치와 같은 순서입니다. 1·2·3을 모두 마치면 결과를 볼 수 있습니다.</p></div><div class="head-act"><div class="progress-3" aria-label="위치 완료 ${done}/3">${state.positions.map(p => `<span class="${p.done ? 'on' : ''}"></span>`).join('')}</div><small class="muted num">${done} / 3 완료</small></div></div>
      <div class="layout-hint">${icon('grid')}<span>1·2번은 나란히, 3번은 오른쪽 끝에 있습니다.</span>${anySamples() ? '<button type="button" class="btn btn-ghost" data-action="results" style="margin-left:auto;min-height:36px">결과 보기 →</button>' : ''}</div>
      <div class="pos-grid">${cards}<div class="pos-slot-empty" aria-hidden="true">빈 슬롯</div></div>
      <div class="action-bar"><p class="hint">${hint}</p><div class="actions">${allDone() ? `<button type="button" class="btn btn-xl btn-primary" data-action="results">결과 보러 가기 ${icon('arrow')}</button>` : `<button type="button" class="btn btn-xl" data-action="cancel">Cancel</button><button type="button" class="btn btn-xl btn-primary" data-action="ok" ${selP ? '' : 'disabled'}>OK ${icon('arrow')}</button>`}</div></div>`;
    app.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => { state.selected = state.selected === +b.dataset.pos ? null : +b.dataset.pos; render(); }));
    bind('cancel', () => { state.selected = null; render(); });
    bind('ok', () => { const p = state.positions[state.selected - 1]; state.position = p.id; state.mode = MODES.find(m => !modeDone(p, m)) || 'MP'; state.status = 'idle'; state.last = null; state.screen = 'inspect'; render(); });
    bind('results', goResults);
  }

  // 3. 검사
  function renderInspect() {
    const p = pos(), list = samples(), count = list.length, last = state.last || list[list.length - 1] || null;
    const running = state.status === 'running', paused = state.status === 'paused', done = count >= TARGET;
    const passN = list.filter(s => s.pass).length, failN = count - passN;
    const base = queryRows(list, state.q);
    const shown = filterRows(base, state.filter).slice().reverse();
    const hiSet = state.filter === 'all' && !state.q ? null : new Set(shown.map(refOf));
    const r = 47, circ = 2 * Math.PI * r, off = circ * (1 - count / TARGET);
    app.innerHTML = `<div class="head"><div><h1>위치 ${p.id} 검사</h1><p>▷ 를 누르면 Vision AI가 카메라 화면의 숫자를 1초마다 읽어 기록합니다.</p></div>
      <div class="seg" role="tablist" aria-label="검사 모드">${MODES.map(m => `<button type="button" role="tab" class="${m === state.mode ? 'is-active' : ''}" data-mode="${m}" aria-selected="${m === state.mode}" ${running ? 'disabled' : ''}>${modeDone(p, m) ? icon('check') : ''}${m}<small>${p[m].length}/${TARGET}</small></button>`).join('')}</div></div>
    ${metricStrip(list, TARGET, `위치 ${p.id} · ${state.mode}`)}
    <div class="inspect-grid">
      <section class="card cam" aria-labelledby="cam-title"><div class="cam-head"><h2 id="cam-title">${icon('camera')}카메라 입력</h2><div class="right"><label class="toggle"><input type="checkbox" id="roi-toggle" ${state.showRoi ? 'checked' : ''}>감지 영역</label><span class="live${running ? ' on' : paused ? ' paused' : ''}">${running ? '<i></i>LIVE' : paused ? 'PAUSED' : 'IDLE'}</span></div></div>
        ${viewport(last, { running, showRoi: state.showRoi, position: p.id, mode: state.mode })}
        <div class="cam-strip" aria-label="감지된 숫자">${strip(last)}</div></section>
      <aside class="ctrl">
        <div class="card count-card"><svg class="ring${done ? ' done' : ''}" viewBox="0 0 112 112" aria-hidden="true"><circle class="bg" cx="56" cy="56" r="${r}"/><circle class="fg" cx="56" cy="56" r="${r}" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/><text x="56" y="62" text-anchor="middle" font-size="22">${count}</text></svg>
          <div class="count-meta"><span class="lbl">현재 개수</span><div class="big">${count}<small>/ ${TARGET}</small></div><div class="pf"><span class="p">Pass<b>${passN}</b></span><span class="f">Fail<b>${failN}</b></span><span>${last ? `신뢰도 ${avgConf(last)}%` : ''}</span></div></div></div>
        <div class="card transport" role="group" aria-label="검사 제어">
          <button type="button" class="btn btn-primary btn-play${running ? ' is-live' : paused ? ' is-paused' : ''}" data-action="start" ${running || done ? 'disabled' : ''}>${icon('play')}${running ? 'Vision AI 감지 중' : paused ? '재개' : '시작'}</button>
          <div class="row"><button type="button" class="btn" data-action="pause" ${running ? '' : 'disabled'}>${icon('pause')}일시정지</button><button type="button" class="btn btn-stop" data-action="stop">${icon('stop')}중지</button></div></div>
        ${stateNote(last, state, done)}
        ${recentFails(list, 4)}</aside></div>
    <section class="board">
      <div class="card pad map-panel"><div class="box-head"><h3>${icon('grid')}회차 맵<small>${count} / ${TARGET}</small></h3>${mapLegend()}</div>
        ${shotMap(list, { live: true, hi: hiSet })}</div>
      <div class="card pad"><div class="box-head"><h3>${icon('spark')}항목별 Fail</h3><span class="cap">누르면 그 항목만</span></div>${failBreakdown(base, state.filter)}</div>
    </section>
    <section class="card log" aria-labelledby="log-title"><div class="log-head"><h2 id="log-title">Pass / Fail<span class="sub">${count ? `${shown.length}행 표시${shown.length !== count ? ` · 전체 ${count}행` : ''} · 최신순` : '기록 없음'}</span></h2>
      <div class="head-right">${count ? filterBar(base, state.filter) : ''}${failNav(shown)}<button type="button" class="btn btn-sm" data-action="excel"${count ? '' : ' disabled'}>${icon('download')}Excel</button></div></div>
      <div class="tbl-wrap">${shown.length ? table(shown, { newest: state.filter === 'all', mode: state.mode }) : `<div class="tbl-empty">${icon('table')}<p>${count ? '이 조건에 해당하는 회차가 없습니다.' : '▷ 시작을 누르면 1회마다 한 행씩 기록됩니다.'}</p></div>`}</div></section>`;
    bind('start', () => { state.status = 'running'; if (!count) addSample(); startTimer(); render(); });
    bind('pause', () => { stopTimer(); state.status = 'paused'; render(); });
    bind('stop', requestStop);
    bind('excel', () => exportCsv(list, `${state.serial}_pos${p.id}_${state.mode}`));
    app.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { stopTimer(); state.mode = b.dataset.mode; state.status = 'idle'; state.last = null; state.filter = 'all'; state.jumpTo = null; render(); }));
    document.getElementById('roi-toggle').addEventListener('change', e => { state.showRoi = e.target.checked; render(); });
    wireList(shown);
  }
  function requestStop() {
    stopTimer(); if (state.status === 'running') { state.status = 'paused'; render(); }
    const p = pos();
    openConfirm({ title: `위치 ${p.id} 검사를 중지할까요?`, desc: `중지하면 위치 ${p.id}은(는) 완료로 표시되고 위치 선택으로 돌아갑니다. 지금까지 수집한 ${MODES.map(m => `${m} ${p[m].length}회`).join(', ')}는 결과에 남습니다.`, cancel: '계속 검사', ok: '중지하고 완료 표시', danger: true, action: () => { p.done = true; goPositions(); } });
  }
  function goPositions() { stopTimer(); state.status = 'idle'; state.selected = null; state.screen = 'position'; render(); }
  function goResults() { stopTimer(); state.status = 'idle'; state.screen = 'results'; state.filter = 'all'; state.jumpTo = null; if (!state.resultsTab) state.resultsTab = 'ALL'; render(); }

  function viewport(sample, o) {
    const pct = (v, b, s) => ((v - b) / s * 100).toFixed(2) + '%';
    const boxes = FIELDS.map(f => { const [x0, y0, x1, y1] = f.roi, d = sample?.fields[f.key]; const cls = !sample ? '' : sample.failKey === f.key ? ' fail' : sample.warnKeys.includes(f.key) ? ' warn' : '';
      return `<div class="roi${cls}${f.tag ? ' ' + f.tag : ''}${o.showRoi ? '' : ' off'}" style="left:${pct(x0, VIEW.x, VIEW.w)};top:${pct(y0, VIEW.y, VIEW.h)};width:${((x1 - x0) / VIEW.w * 100).toFixed(2)}%;height:${((y1 - y0) / VIEW.h * 100).toFixed(2)}%"><span class="tag">${f.label}${d ? `<b>${esc(d.v)}</b>` : ''}</span></div>`; }).join('');
    return `<div class="viewport${o.running ? ' is-running' : ''}${o.frozen ? ' is-frozen' : ''}" role="img" aria-label="카메라 입력: 장비 화면과 숫자 감지 영역"><img src="${IMG.src}" alt="" draggable="false"><div class="hud"><div class="hud-bar"><span>${o.frozen ? 'FAIL FRAME' : o.running ? 'REC' : 'CAM 1'}</span><span>POS ${o.position} · ${esc(o.mode)}${sample ? ` · #${pad(sample.i)} ${sample.t}` : ''}</span></div><div class="scan"></div>${boxes}</div></div>`;
  }
  const strip = sample => FIELDS.map(f => { const d = sample?.fields[f.key], bad = sample?.failKey === f.key, warn = d && d.conf < 80;
    return `<div class="rd${f.main ? ' main' : ''}${bad ? ' fail' : warn ? ' warn' : ''}${d ? '' : ' pending'}" title="${f.exp ? `기준 ${esc(f.exp[sample?.mode || state.mode])}` : '기록만'}"><canvas data-thumb="${f.key}" width="${f.main ? 128 : 88}" height="${f.main ? 68 : 52}" aria-hidden="true"></canvas><div><div class="k">${f.label}${d ? ` · ${d.conf}%` : ''}</div><div class="v">${d ? `${esc(d.v)}${f.unit ? `<small>${f.unit}</small>` : ''}` : '—'}</div></div></div>`; }).join('');
  function stateNote(last, st, done) {
    if (st.status === 'paused') return `<div class="state-note paused">${icon('info')}<span>일시정지 중입니다. 재개하면 이어서 수집하고, 중지를 누르면 이 위치를 완료로 표시합니다.</span></div>`;
    if (done) return `<div class="state-note done">${icon('check')}<span>${esc(st.mode)} ${TARGET}회 수집이 끝났습니다. 다른 모드를 선택하거나 중지로 위치를 마무리하세요.</span></div>`;
    if (last && !last.pass) { const f = FIELDS.find(x => x.key === last.failKey); return `<div class="state-note fail">${icon('alert')}<span><b>Fail</b> · ${f.label} 읽은 값 ${esc(last.fields[f.key].v)} ≠ 기준 ${esc(f.exp[last.mode])}</span></div>`; }
    return `<div class="state-note">${icon('scan')}<span>기준값이 있는 7개 항목(Energy, J/shot, Booster, Repeat, Length, Mode, Status)이 모두 같으면 Pass, 하나라도 다르면 Fail입니다. 카운터는 기록만 합니다.</span></div>`;
  }
  const avgConf = s => Math.round(FIELDS.reduce((a, f) => a + s.fields[f.key].conf, 0) / FIELDS.length);
  function drawThumbs() {
    if (!photo.complete || !photo.naturalWidth) return; const k = photo.naturalWidth / IMG.w;
    document.querySelectorAll('canvas[data-thumb]').forEach(c => { const f = FIELDS.find(x => x.key === c.dataset.thumb); if (!f) return; const [x0, y0, x1, y1] = f.roi, ctx = c.getContext('2d'), m = 5; ctx.fillStyle = '#1a1f25'; ctx.fillRect(0, 0, c.width, c.height); const sw = (x1 - x0) * k, sh = (y1 - y0) * k, sc = Math.min((c.width - m * 2) / sw, (c.height - m * 2) / sh); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(photo, x0 * k, y0 * k, sw, sh, (c.width - sw * sc) / 2, (c.height - sh * sc) / 2, sw * sc, sh * sc); });
  }

  // ── 100회 이상을 한눈에: 회차 맵 · 항목별 Fail · 필터 ──
  const PER_ROW = 25;                       // 회차 맵 한 줄에 그리는 칸 수 (100회 = 4줄)
  const isWarn = s => s.warnKeys.length > 0;
  const refOf = s => `${s.position}-${s.mode}-${s.i}`;
  const failCount = rows => rows.reduce((n, s) => n + (s.pass ? 0 : 1), 0);
  function queryRows(rows, q) {
    const t = (q || '').trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(s => {
      if (pad(s.i).includes(t) || String(s.i) === t || s.t.includes(t)) return true;
      if (`${s.position}·${s.mode}`.toLowerCase().includes(t) || `위치 ${s.position}`.includes(t)) return true;
      if ((s.pass ? 'pass' : 'fail').startsWith(t)) return true;
      return TABLE_FIELDS.some(f => String(s.fields[f.key].v).toLowerCase().includes(t) || (s.failKeys.includes(f.key) && f.label.toLowerCase().includes(t)));
    });
  }
  function filterRows(rows, f) {
    if (f === 'fail') return rows.filter(s => !s.pass);
    if (f === 'warn') return rows.filter(s => s.pass && isWarn(s));
    if (f && f.startsWith('k:')) { const k = f.slice(2); return rows.filter(s => s.failKeys.includes(k)); }
    return rows;
  }
  function cellTitle(s) {
    const head = `${pad(s.i)}회 · ${s.t}`;
    if (s.pass) return `${head} · Pass${isWarn(s) ? ' · 신뢰도 낮음' : ''}`;
    const f = FIELDS.find(x => x.key === s.failKey);
    return `${head} · Fail · ${f.label} ${s.fields[s.failKey].v} ≠ 기준 ${f.exp[s.mode]}${s.failKeys.length > 1 ? ` 외 ${s.failKeys.length - 1}개 항목` : ''}`;
  }
  // 한 그룹(위치·모드)의 전 회차를 칸 하나씩. 아직 안 찍은 회차도 빈 칸으로 그려 진행도가 같이 보인다.
  function shotMap(rows, o = {}) {
    const per = o.per || PER_ROW;
    const total = o.total || TARGET, by = new Map(rows.map(s => [s.i, s])), newest = rows.length ? rows[rows.length - 1].i : 0;
    let out = '';
    for (let start = 1; start <= total; start += per) {
      let cells = '';
      for (let i = start; i < start + per && i <= total; i++) {
        const s = by.get(i);
        if (!s) { cells += '<i class="cell"></i>'; continue; }
        const cls = (s.pass ? (isWarn(s) ? 'ok warn' : 'ok') : 'bad tap') + (o.live && i === newest ? ' now' : '') + (o.hi && !o.hi.has(refOf(s)) ? ' dim' : '');
        cells += `<i class="cell ${cls}" data-ref="${refOf(s)}" title="${esc(cellTitle(s))}"${s.pass ? '' : ' role="button" tabindex="0" aria-label="' + esc(cellTitle(s)) + '"'}></i>`;
      }
      out += `<div class="map-row">${o.compact ? '' : `<span class="map-lbl">${pad(start)}</span>`}<div class="map-cells">${cells}</div></div>`;
    }
    return `<div class="shotmap${o.compact ? ' compact' : ''}${o.tight ? ' tight' : ''}" style="--per:${per}">${out}</div>`;
  }
  const mapLegend = () => '<span class="legend"><i class="cell ok"></i>Pass<i class="cell warn ok"></i>신뢰도 낮음<i class="cell bad"></i>Fail<i class="cell"></i>남은 회차</span>';
  // 어느 항목 때문에 Fail 났는지. 100회가 넘어가면 "몇 번째 행"보다 이쪽이 먼저 필요하다.
  function failBreakdown(rows, active) {
    const n = {}; rows.forEach(s => s.failKeys.forEach(k => { n[k] = (n[k] || 0) + 1; }));
    const list = Object.entries(n).sort((a, b) => b[1] - a[1]);
    if (!list.length) return `<p class="brk-empty">${icon('check')}기준값과 다른 회차가 없습니다.</p>`;
    const max = list[0][1];
    return `<div class="brk">${list.map(([k, c]) => { const f = FIELDS.find(x => x.key === k), on = active === 'k:' + k;
      return `<button type="button" class="brk-row${on ? ' is-on' : ''}" data-filter="k:${k}" title="${esc(f.label)} 불일치 ${c}회만 보기"><span class="brk-k">${f.label}</span><span class="brk-bar"><i style="width:${(c / max * 100).toFixed(1)}%"></i></span><span class="brk-n">${c}<small>회</small></span></button>`; }).join('')}</div>`;
  }
  function filterBar(rows, active) {
    const fail = failCount(rows), warn = rows.filter(s => s.pass && isWarn(s)).length;
    const chip = (v, label, n, cls) => `<button type="button" class="chip${active === v ? ' is-on' : ''}${cls ? ' ' + cls : ''}" data-filter="${v}"${!n && v !== 'all' ? ' disabled' : ''}>${label}<b>${n}</b></button>`;
    const field = active && active.startsWith('k:') ? FIELDS.find(f => f.key === active.slice(2)) : null;
    return `<div class="chips">${chip('all', '전체', rows.length)}${chip('fail', 'Fail', fail, 'c-fail')}${chip('warn', '신뢰도 80%↓', warn, 'c-warn')}${field ? `<button type="button" class="chip is-on c-fail" data-filter="all">${esc(field.label)} 불일치<b>${filterRows(rows, active).length}</b><span class="x">✕</span></button>` : ''}${state.q ? `<button type="button" class="chip is-on c-find" data-clear-q="1">"${esc(state.q)}"<b>${rows.length}</b><span class="x">✕</span></button>` : ''}</div>`;
  }
  const failNav = rows => failCount(rows) ? `<div class="jump"><span>Fail 이동</span><button type="button" class="ibtn" data-jump="prev" aria-label="이전 Fail로">${icon('up')}</button><button type="button" class="ibtn" data-jump="next" aria-label="다음 Fail로">${icon('down')}</button></div>` : '';

  // 100행이 넘으면 "다른 값"만 눈에 들어와야 한다: 기준과 같은 값은 흐리게, 다른 값만 진하게.
  function table(rows, o = {}) {
    // 기준값은 헤더 아래 고정 행으로. 값과 같은 칸에 놓여 열 너비를 넓히지 않고, 스크롤해도 따라온다.
    const head = `<tr><th class="c-idx">${o.showGroup ? '위치·모드 · 회차' : '#'}</th><th>시각</th>${TABLE_FIELDS.map(f => `<th>${f.label}${f.unit ? `<small>${esc(f.unit)}</small>` : ''}</th>`).join('')}<th class="judge">P/F</th></tr>`
      + (o.mode ? `<tr class="base"><th class="c-idx">기준</th><th></th>${TABLE_FIELDS.map(f => `<th>${f.exp ? esc(f.exp[o.mode]) : '기록만'}</th>`).join('')}<th class="judge"></th></tr>` : '');
    const body = rows.map((s, i) => {
      const cls = [s.pass ? '' : 'is-fail is-clickable', o.newest && i === 0 ? 'is-new' : ''].filter(Boolean).join(' ');
      const cells = TABLE_FIELDS.map(f => { const d = s.fields[f.key];
        const c = s.failKeys.includes(f.key) ? 'bad' : d.conf < 80 ? 'low' : f.exp ? 'same' : '';
        return `<td class="${c}"${d.conf < 80 ? ` title="신뢰도 ${d.conf}%"` : ''}>${esc(d.v)}</td>`; }).join('');
      return `<tr class="${cls}" data-ref="${refOf(s)}"${s.pass ? '' : ' tabindex="0"'}><td class="idx">${o.showGroup ? `<b>${s.position}·${esc(s.mode)}</b>` : ''}${pad(s.i)}</td><td class="t">${s.t}</td>${cells}<td class="judge"><span class="pill ${s.pass ? 'pill-pass' : 'pill-fail'}">${s.pass ? 'Pass' : 'Fail'}</span></td></tr>`;
    }).join('');
    return `<table class="tbl"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }
  // 표·맵 공통 배선: 필터 칩, 항목별 Fail 막대, Fail 칸/행 클릭, Fail 이동 버튼
  function wireList(rows) {
    app.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; state.jumpTo = null; render(); }));
    app.querySelectorAll('[data-clear-q]').forEach(b => b.addEventListener('click', () => { state.q = ''; state.jumpTo = null; render(); }));
    app.querySelectorAll('[data-ref]').forEach(el => {
      const go = () => { const s = findSample(el.dataset.ref); if (s && !s.pass) openFail(s); };
      el.addEventListener('click', go);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    const fails = rows.filter(s => !s.pass);
    app.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => {
      if (!fails.length) return;
      const cur = fails.findIndex(s => refOf(s) === state.jumpTo);
      const next = b.dataset.jump === 'next' ? (cur + 1) % fails.length : (cur <= 0 ? fails.length - 1 : cur - 1);
      state.jumpTo = refOf(fails[next]); render();
    }));
  }
  // 필터를 바꿔도 보고 있던 위치를 잃지 않도록 스크롤을 유지하고, Fail 이동은 해당 행으로 스크롤한다.
  function afterList() {
    if (!state.jumpTo) return;
    const row = app.querySelector(`tr[data-ref="${state.jumpTo}"]`);
    if (!row) return;
    app.querySelectorAll('.is-target').forEach(e => e.classList.remove('is-target'));
    row.classList.add('is-target');
    row.scrollIntoView({ block: 'center' });
  }

  const findSample = ref => { const [p, m, i] = ref.split('-'); return state.positions[p - 1][m][i - 1]; };

  // 4. 결과
  const groups = () => state.positions.flatMap(p => MODES.map(m => ({ id: `${p.id}-${m}`, label: `${p.id} - ${m}`, rows: p[m] })));
  function renderResults() {
    const all = groups(), flat = all.flatMap(g => g.rows), fails = failCount(flat);
    const isAll = state.resultsTab === 'ALL';
    const cur = isAll ? { id: 'ALL', label: '전체 회차', rows: flat } : (all.find(g => g.id === state.resultsTab) || all[0]);
    state.resultsTab = cur.id;
    const base = queryRows(cur.rows, state.q);
    const shown = filterRows(base, state.filter);
    const hiSet = state.filter === 'all' && !state.q ? null : new Set(shown.map(refOf));
    const firstGroup = (all.find(g => g.rows.length) || all[0]).id;
    app.innerHTML = `<div class="head"><div><h1>검사 결과</h1><p>위치 3곳 × 모드 2개 × ${TARGET}회 · 최대 ${TARGET * 6}회</p></div>
        <div class="head-act"><button type="button" class="btn" data-action="positions">${icon('back')}위치 선택</button><button type="button" class="btn" data-action="excel"${flat.length ? '' : ' disabled'}>${icon('download')}Excel</button></div></div>
      ${metricStrip(flat, TARGET * 6)}
      <div class="tabbar"><div class="tabs">
          <button type="button" class="tab${isAll ? ' is-on' : ''}" data-tab="ALL">전체 회차<small class="num">${flat.length}</small></button>
          <button type="button" class="tab${isAll ? '' : ' is-on'}" data-tab="${isAll ? firstGroup : cur.id}">위치·모드별<small class="num">${isAll ? 6 : cur.rows.length}</small></button>
        </div><div class="head-right">${filterBar(base, state.filter)}${failNav(shown)}</div></div>
      <section class="board">
        <div class="card pad map-panel">
          <div class="box-head"><h3>${icon('grid')}회차 맵<small>${esc(cur.label)}</small></h3>${mapLegend()}</div>
          ${isAll ? `<div class="map-all">${all.map(g => `<button type="button" class="map-line" data-tab="${g.id}"><span class="map-name">${g.label}</span>${shotMap(g.rows, { compact: true, per: 100, hi: hiSet })}<b class="map-n${failCount(g.rows) ? ' f' : ''}">${failCount(g.rows)}</b></button>`).join('')}</div>` : shotMap(cur.rows, { hi: hiSet })}
        </div>
        <div class="card pad"><div class="box-head"><h3>${icon('spark')}항목별 Fail</h3><span class="cap">누르면 그 항목만</span></div>${failBreakdown(base, state.filter)}</div>
      </section>
      <section class="card log">
        <div class="log-head"><h2>${esc(cur.label)}<span class="sub">${shown.length}행 표시${shown.length !== cur.rows.length ? ` · 전체 ${cur.rows.length}행` : ''}</span></h2>
          <span class="upload-state${state.uploaded ? ' ok' : ''}">${state.uploaded ? `${icon('check')}업로드 완료 · ${state.uploaded}` : `${icon('info')}아직 업로드하지 않았습니다`}</span></div>
        <div class="tbl-wrap tall">${shown.length ? table(shown, { showGroup: isAll, mode: isAll ? null : cur.id.split('-')[1] }) : `<div class="tbl-empty">${icon('table')}<p>${cur.rows.length ? '이 조건에 해당하는 회차가 없습니다.' : '이 위치·모드는 수집 기록이 없습니다.'}</p></div>`}</div>
      </section>
      <section class="board board-2">${groupPanel()}${recentFails(flat, 6)}</section>`;
    app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.resultsTab = b.dataset.tab; state.filter = 'all'; state.jumpTo = null; render(); }));
    bind('positions', goPositions);
    bind('excel', () => exportCsv(flat, `${state.serial}_results`));
    wireList(shown);
  }
  function doUpload(btn) {
    btn.disabled = true; btn.textContent = '업로드 중…';
    setTimeout(() => { state.uploaded = hms(new Date()); toast('결과를 서버에 업로드했습니다'); render(); }, 1200);
  }

  // Fail 당시 화면
  function openFail(s) {
    if (!s) return; const f = FIELDS.find(x => x.key === s.failKey);
    document.getElementById('fail-body').innerHTML = `<div class="fail-view"><div class="fail-frame">${viewport(s, { frozen: true, showRoi: true, position: s.position, mode: s.mode })}<div class="meta"><span>FRAME #${pad(s.i)} · ${s.t}</span><span>POS ${s.position} · ${esc(s.mode)} · S/N ${esc(state.serial)}</span></div></div>
      <div class="fail-side"><h2 id="fail-title"><span class="pill pill-fail">Fail</span>위치 ${s.position} · ${esc(s.mode)} · ${pad(s.i)}회</h2><p class="sub">${f.label} 값이 기준과 다릅니다.<br>읽은 값 <b>${esc(s.fields[f.key].v)}</b> · 기준 <b>${esc(f.exp[s.mode])}</b></p>
        <table class="cmp"><thead><tr><th>항목</th><th>읽은 값</th><th>기준</th><th>신뢰도</th></tr></thead><tbody>${FIELDS.map(x => `<tr class="${x.key === s.failKey ? 'bad' : ''}"><td>${x.label}</td><td>${esc(s.fields[x.key].v)}</td><td class="exp">${x.exp ? esc(x.exp[s.mode]) : '—'}</td><td class="exp">${s.fields[x.key].conf}%</td></tr>`).join('')}</tbody></table>
        <div class="dlg-actions"><button type="button" class="btn" data-dlg="close">닫기</button></div></div></div>`;
    failDlg.querySelector('[data-dlg="close"]').addEventListener('click', () => failDlg.close()); failDlg.showModal();
  }
  let confirmAction = null;
  function openConfirm({ title, desc, cancel, ok, action, danger }) {
    document.getElementById('confirm-title').textContent = title; document.getElementById('confirm-desc').textContent = desc;
    const c = confirmDlg.querySelector('[data-dlg="cancel"]'), k = confirmDlg.querySelector('[data-dlg="ok"]');
    c.hidden = !cancel; c.textContent = cancel || ''; k.textContent = ok; k.className = `btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`; confirmAction = action; confirmDlg.showModal(); k.focus();
  }
  confirmDlg.querySelector('[data-dlg="cancel"]').addEventListener('click', () => confirmDlg.close());
  confirmDlg.querySelector('[data-dlg="ok"]').addEventListener('click', () => { confirmDlg.close(); confirmAction?.(); });
  confirmDlg.addEventListener('cancel', () => { if (confirmDlg.querySelector('[data-dlg="cancel"]').hidden) confirmAction?.(); });

  function bind(a, fn) { app.querySelectorAll(`[data-action="${a}"]`).forEach(b => b.addEventListener('click', fn)); }
  let toastTimer; function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
  function exportCsv(rows, name) {
    const head = ['no', 'time', 'position', 'mode', ...TABLE_FIELDS.map(f => f.key), ...TABLE_FIELDS.map(f => `${f.key}_conf`), 'result', 'fail_field'];
    const lines = rows.map(s => [s.i, s.t, s.position, s.mode, ...TABLE_FIELDS.map(f => s.fields[f.key].v), ...TABLE_FIELDS.map(f => s.fields[f.key].conf), s.pass ? 'Pass' : 'Fail', s.failKey || '']);
    const csv = '﻿' + [head, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href); toast('Excel(CSV) 파일을 내려받았습니다');
  }

  // ── 시안용 화면 미리보기 ──
  const fill = (p, m, n) => { p[m] = Array.from({ length: n }, (_, i) => makeSample(p.id, m, i + 1, hms(new Date(2026, 8, 18, 14, 2, i)))); };
  function loadFixture(id) {
    stopTimer(); Object.assign(state, { serial: 'SN-2026-004821', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), resultsTab: null, uploaded: null, last: null, screen: 'position' });
    const [p1, p2, p3] = state.positions, complete = p => { fill(p, 'MP', TARGET); fill(p, 'Normal', TARGET); p.done = true; };
    switch (id) {
      case 'serial': state.serial = ''; state.screen = 'serial'; break;
      case 'position': state.selected = 2; break;
      case 'ready': state.screen = 'inspect'; break;
      case 'running': state.screen = 'inspect'; fill(p1, 'MP', 37); state.status = 'running'; state.last = p1.MP[36]; startTimer(); break;
      case 'paused': state.screen = 'inspect'; fill(p1, 'MP', 52); state.status = 'paused'; state.last = p1.MP[51]; break;
      case 'stop': state.screen = 'inspect'; fill(p1, 'MP', TARGET); fill(p1, 'Normal', 61); state.mode = 'Normal'; state.last = p1.Normal[60]; setTimeout(requestStop, 50); break;
      case 'position-progress': complete(p1); fill(p2, 'MP', 40); state.selected = 2; break;
      case 'position-done': complete(p1); complete(p2); complete(p3); break;
      case 'results': complete(p1); complete(p2); complete(p3); state.screen = 'results'; state.resultsTab = 'ALL'; break;
      case 'fail-detail': complete(p1); complete(p2); complete(p3); state.screen = 'results'; state.resultsTab = '1-MP'; setTimeout(() => openFail(p1.MP.find(s => !s.pass)), 50); break;
    }
    render();
  }
  const sel = document.getElementById('screen-select'); sel.innerHTML = SCREENS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  sel.addEventListener('change', () => loadFixture(sel.value));
  const qInput = document.getElementById('q');
  qInput.addEventListener('input', () => { state.q = qInput.value; state.jumpTo = null; render(); qInput.focus(); });
  document.getElementById('search-form').addEventListener('submit', e => e.preventDefault());
  document.getElementById('btn-reset').addEventListener('click', () => { stopTimer(); Object.assign(state, { serial: '', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), resultsTab: null, uploaded: null, last: null, screen: 'serial', filter: 'all', jumpTo: null, q: '' }); render(); });
  const q = new URLSearchParams(location.search);
  if (q.get('preview') === '1') document.body.classList.add('preview');
  if (q.get('screen') && SCREENS.some(s => s[0] === q.get('screen'))) loadFixture(q.get('screen')); else render();
})();
