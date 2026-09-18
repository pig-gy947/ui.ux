/* Vision AI 검사 콘솔 — UI/UX 시안 (단일 파일 앱)
 * 흐름: S/N 입력 → 위치 선택(1·2·3) → 검사(▷ ⏸ ◻, 카메라 입력 + 숫자 감지, Pass/Fail 표) → 결과(탭·표·업로드) → Fail 당시 화면
 * 감지값은 시뮬레이션입니다. detectFrame() 을 실제 OCR/엣지 결과로 교체하면 됩니다.
 */
'use strict';
(() => {
  // ───────────────────────── 설정 ─────────────────────────
  const TARGET = 100;
  const MODES = ['MP', 'Normal'];
  const IMG = { src: 'assets/device-sample.jpg', w: 2000, h: 1500 };      // 원본 사진 좌표계 (2000×1500)
  const VIEW = { x: 560, y: 340, w: 920, h: 680 };                          // 카메라 화면에 보여줄 장비 디스플레이 영역
  // 숫자 감지 영역(ROI). 원본 사진 픽셀 좌표. exp: 모드별 기준값(없으면 기록만)
  const FIELDS = [
    { key: 'energy',  label: 'Energy',     roi: [915, 495, 1090, 605],  unit: '',     exp: { MP: '1.0',   Normal: '1.0' },  main: true },
    { key: 'jshot',   label: 'J/shot',     roi: [957, 606, 1000, 630],  unit: 'J',    exp: { MP: '16.67', Normal: '16.67' }, tag: 'left' },
    { key: 'booster', label: 'Booster',    roi: [1008, 382, 1042, 410], unit: 'mm',   exp: { MP: '3.0',   Normal: '3.0' },  tag: 'right' },
    { key: 'remain',  label: 'Remain',     roi: [820, 428, 895, 458],   unit: '',     exp: null },
    { key: 'current', label: 'Current',    roi: [1118, 420, 1180, 455], unit: '',     exp: null, tag: 'right' },
    { key: 'total',   label: 'Total',      roi: [1025, 650, 1075, 680], unit: '',     exp: null, tag: 'right' },
    { key: 'counter', label: 'Shot count', roi: [980, 712, 1100, 748],  unit: '',     exp: null, overlayOnly: true, tag: 'left' },
    { key: 'repeat',  label: 'Repeat',     roi: [832, 796, 868, 828],   unit: 's',    exp: { MP: '0.1', Normal: '0.1' } },
    { key: 'length',  label: 'Length',     roi: [1015, 793, 1052, 822], unit: 'mm',   exp: { MP: '25',  Normal: '25' } },
    { key: 'mode',    label: 'Mode',       roi: [765, 858, 810, 888],   unit: '',     exp: { MP: 'MP',  Normal: 'Normal' } },
    { key: 'status',  label: 'Status',     roi: [905, 930, 1125, 990],  unit: '',     exp: { MP: 'STANDBY', Normal: 'STANDBY' } },
  ];
  const TABLE_FIELDS = FIELDS.filter(f => !f.overlayOnly);
  const SCREENS = [
    ['serial', '01 · S/N 입력'], ['position', '02 · 위치 선택'], ['ready', '03 · 검사 준비'],
    ['running', '04 · 검사 중 (Vision AI)'], ['paused', '05 · 일시정지'], ['stop', '06 · 중지 확인'],
    ['position-progress', '07 · 위치 1 완료'], ['position-done', '08 · 전체 완료'],
    ['results', '09 · 결과'], ['fail-detail', '10 · Fail 당시 화면'],
  ];
  const ICONS = {
    play: '<path d="m7 4 13 8-13 8z"/>', pause: '<path d="M8 4v16M16 4v16"/>', stop: '<rect x="5" y="5" width="14" height="14" rx="1.5"/>',
    check: '<path d="m5 12 4.5 4.5L19 7"/>', arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', back: '<path d="M19 12H5m5 5-5-5 5-5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>', alert: '<path d="M12 3 2 20h20zM12 10v5m0 2v1"/>',
    upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/>', download: '<path d="M12 4v12m-5-5 5 5 5-5M4 20h16"/>',
    camera: '<path d="M4 7h4l2-3h4l2 3h4a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="4"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 15h18M9 4v16"/>', close: '<path d="M6 6l12 12M18 6 6 18"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16"/>',
  };
  const icon = n => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, l = 3) => String(n).padStart(l, '0');
  const hms = d => `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;

  // ───────────────────────── 상태 ─────────────────────────
  const freshPositions = () => [1, 2, 3].map(id => ({ id, done: false, MP: [], Normal: [] }));
  const state = { screen: 'serial', serial: '', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), showRoi: true, resultsTab: null, uploaded: null, timer: null, last: null };
  const app = document.getElementById('app');
  const confirmDlg = document.getElementById('confirm');
  const failDlg = document.getElementById('fail-dialog');
  const photo = new Image(); photo.src = IMG.src; photo.onload = () => drawThumbs();
  const pos = () => state.positions[state.position - 1];
  const samples = () => pos()[state.mode];
  const modeDone = (p, m) => p[m].length >= TARGET;
  const allDone = () => state.positions.every(p => p.done);
  const anySamples = () => state.positions.some(p => MODES.some(m => p[m].length));

  // ───────────────────────── 감지 (시뮬레이션) ─────────────────────────
  // 실제 연결 시: 카메라 프레임을 FIELDS[].roi 로 잘라 OCR 한 결과를 같은 형태 { key: { v, conf } } 로 반환하면 됩니다.
  const hash = (a, b, c) => { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };
  function detectFrame(position, mode, i) {
    const mi = MODES.indexOf(mode) + 1, h = hash(position, mi, i);
    const shot = 436 + i, remain = Math.max(0, 118 - i);
    const base = { energy: '1.0', jshot: '16.67', booster: '3.0', remain: String(remain), current: String(shot), total: String(shot), counter: `${shot}/300`, repeat: '0.1', length: '25', mode, status: 'STANDBY' };
    const fields = {};
    for (const f of FIELDS) fields[f.key] = { v: base[f.key], conf: 93 + (hash(i, mi, FIELDS.indexOf(f)) % 6) };
    if (h % 11 === 0) { const k = ['jshot', 'booster', 'length', 'repeat'][(h >>> 4) % 4]; fields[k].conf = 62 + ((h >>> 8) % 16); }   // 저신뢰
    if (h % 17 === 0) {                                                                                                                // 불일치 → Fail
      const pick = (h >>> 5) % 4;
      if (pick === 0) fields.energy = { v: (h >>> 9) % 2 ? '1.2' : '0.8', conf: 91 };
      else if (pick === 1) fields.status = { v: 'READY', conf: 94 };
      else if (pick === 2) fields.length = { v: '30', conf: 89 };
      else fields.mode = { v: mode === 'MP' ? 'Normal' : 'MP', conf: 92 };
    }
    return fields;
  }
  function judge(fields, mode) {
    let failKey = null; const warnKeys = [];
    for (const f of FIELDS) {
      const d = fields[f.key];
      if (f.exp && d.v !== f.exp[mode] && !failKey) failKey = f.key;
      if (d.conf < 80) warnKeys.push(f.key);
    }
    return { pass: !failKey, failKey, warnKeys };
  }
  function makeSample(position, mode, i, t) {
    const fields = detectFrame(position, mode, i);
    return { i, t, position, mode, fields, ...judge(fields, mode) };
  }
  function addSample() {
    const list = samples();
    if (list.length >= TARGET) return;
    const s = makeSample(state.position, state.mode, list.length + 1, hms(new Date()));
    list.push(s); state.last = s;
    if (list.length >= TARGET) onModeComplete();
    render();
  }
  function onModeComplete() {
    stopTimer(); state.status = 'idle';
    const p = pos();
    const remaining = MODES.find(m => !modeDone(p, m));
    if (remaining) { toast(`${state.mode} ${TARGET}회 수집 완료 · ${remaining} 모드로 전환합니다`); state.mode = remaining; state.last = null; }
    else { p.done = true; openConfirm({ title: `위치 ${p.id} 검사 완료`, desc: `Normal·MP 각 ${TARGET}회 수집이 끝났습니다. 위치 선택 화면으로 돌아가 다음 위치를 진행하세요.`, cancel: null, ok: '위치 선택으로', action: goPositions }); }
  }
  const startTimer = () => { stopTimer(); state.timer = setInterval(addSample, 1000); };
  const stopTimer = () => { if (state.timer) clearInterval(state.timer); state.timer = null; };

  // ───────────────────────── 렌더 ─────────────────────────
  function render() {
    if (state.screen === 'serial') renderSerial();
    else if (state.screen === 'position') renderPositions();
    else if (state.screen === 'inspect') renderInspect();
    else renderResults();
    renderChrome(); drawThumbs();
  }
  function renderChrome() {
    const idx = { serial: 1, position: 2, inspect: 3, results: 4 }[state.screen];
    document.getElementById('steps').innerHTML = [['S/N 입력'], ['위치 선택'], ['검사'], ['결과']].map(([n], i) => `<span class="step${i + 1 === idx ? ' is-active' : i + 1 < idx ? ' is-done' : ''}"><b>${i + 1 < idx ? '✓' : i + 1}</b>${n}</span>`).join('');
    document.getElementById('topbar-meta').innerHTML = `${state.serial ? `<span>S/N <span class="mono">${esc(state.serial)}</span></span>` : '<span class="muted">새 검사 세션</span>'}<span class="conn"><i class="dot"></i>Camera</span><span class="conn"><i class="dot"></i>Edge</span>`;
    const sel = document.getElementById('screen-select');
    const cur = state.screen === 'inspect' ? (state.status === 'running' ? 'running' : state.status === 'paused' ? 'paused' : 'ready') : state.screen === 'position' ? (allDone() ? 'position-done' : state.positions.some(p => p.done) ? 'position-progress' : 'position') : state.screen;
    if (sel.value !== cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
  }

  // 1. S/N
  function renderSerial() {
    app.innerHTML = `<div class="serial-wrap"><section class="panel serial-grid" aria-labelledby="page-title">
      <form id="serial-form" class="serial-form" novalidate><span class="eyebrow">새 검사 세션</span><h1 id="page-title">시리얼 번호를 입력하세요</h1><p class="intro">검사할 장비의 S/N을 입력한 뒤 위치 선택으로 넘어갑니다.</p>
        <div class="field"><label for="serial-input">S/N</label><input class="input" id="serial-input" placeholder="예: SN-2026-001234" maxlength="32" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(state.serial)}" aria-describedby="serial-help serial-error"><p class="helper" id="serial-help">영문·숫자·하이픈, 6자 이상. 장비 라벨의 번호를 그대로 입력합니다.</p><p class="error" id="serial-error" role="alert" hidden></p></div>
        <div class="form-actions"><button type="reset" class="btn">Cancel</button><button type="submit" class="btn btn-primary">OK ${icon('arrow')}</button></div></form>
      <aside class="serial-aside" aria-label="장비 연결 상태"><h2>연결 상태</h2><div class="device-row"><span>Camera</span><span class="conn"><i class="dot"></i>연결됨</span></div><div class="device-row"><span>Edge (Vision AI)</span><span class="conn"><i class="dot"></i>준비됨</span></div><div class="device-row"><span>감지 영역</span><span class="mono">${FIELDS.length} ROI</span></div><p>S/N 확인 후 위치 1·2·3을 차례로 검사합니다.<br>각 위치는 Normal·MP 모드 ${TARGET}회씩입니다.</p></aside></section></div>`;
    const form = document.getElementById('serial-form'), input = document.getElementById('serial-input'), err = document.getElementById('serial-error');
    input.focus();
    form.addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim().toUpperCase(); if (!/^[A-Z0-9-]{6,}$/.test(v)) { err.textContent = '형식이 올바르지 않습니다. 영문·숫자·하이픈 6자 이상으로 입력하세요.'; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; } state.serial = v; state.screen = 'position'; render(); });
    form.addEventListener('reset', () => { err.hidden = true; input.removeAttribute('aria-invalid'); setTimeout(() => input.focus()); });
  }

  // 2. 위치 선택
  function renderPositions() {
    const done = state.positions.filter(p => p.done).length;
    const cards = state.positions.map(p => {
      const slot = p.id === 3 ? 5 : p.id, sel = state.selected === p.id;
      return `<button type="button" class="pos-card${sel ? ' is-selected' : ''}${p.done ? ' is-done' : ''}" style="--slot:${slot}" data-pos="${p.id}" aria-pressed="${sel}" ${p.done ? 'disabled' : ''}>
        <span class="pos-status"><span>위치</span>${p.done ? `<span class="pos-done-mark" aria-label="완료">${icon('check')}</span>` : sel ? '<span class="chip chip-info">선택됨</span>' : '<span class="muted">대기</span>'}</span>
        <span class="pos-num">${p.id}</span>
        <span class="pos-modes">${MODES.map(m => `<span class="pos-mode"><span class="row"><span>${m}</span><span><b>${p[m].length}</b> / ${TARGET}</span></span><span class="track${modeDone(p, m) ? ' ok' : ''}"><span style="width:${p[m].length}%"></span></span></span>`).join('')}</span></button>`;
    }).join('');
    const selP = state.selected ? state.positions[state.selected - 1] : null;
    const helper = allDone() ? '<strong>세 위치 모두 완료</strong>결과 화면에서 Pass/Fail을 확인하고 업로드하세요.' : selP ? `<strong>위치 ${selP.id}</strong>${MODES.find(m => !modeDone(selP, m))} 모드부터 검사합니다.` : '검사할 위치를 선택한 뒤 OK를 누르세요. 완료된 위치는 다시 선택하지 않습니다.';
    app.innerHTML = `<section class="page-head"><div><span class="eyebrow">S/N ${esc(state.serial)}</span><h1 id="page-title">검사할 위치를 선택하세요</h1><p>장비의 실제 배치 순서와 같습니다. 1·2·3을 모두 검사하면 결과를 볼 수 있습니다.</p></div><div class="overall"><strong>${done}<span> / 3</span></strong><span class="label">위치 완료</span><div class="track ok" style="margin-top:8px"><span style="width:${done / 3 * 100}%"></span></div></div></section>
      <section class="panel"><div class="panel-head"><h2>검사 위치</h2>${anySamples() ? `<button type="button" class="text-link" data-action="results">결과 보기</button>` : ''}</div>
      <div class="position-body"><div class="position-grid">${cards}</div></div>
      <div class="panel-foot"><p class="selection-desc" aria-live="polite">${helper}</p><div class="actions">${allDone() ? `<button type="button" class="btn btn-lg btn-primary" data-action="results">결과 보러 가기 ${icon('arrow')}</button>` : `<button type="button" class="btn" data-action="cancel">Cancel</button><button type="button" class="btn btn-primary" data-action="ok" ${selP ? '' : 'disabled'}>OK ${icon('arrow')}</button>`}</div></div></section>
      <p class="note">${icon('info')}<span>◻ 중지를 누르면 해당 위치는 완료 표시가 되며, 남은 위치를 이어서 검사합니다.</span></p>`;
    app.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => { state.selected = state.selected === +b.dataset.pos ? null : +b.dataset.pos; render(); }));
    bind('cancel', () => { state.selected = null; render(); });
    bind('ok', () => { const p = state.positions[state.selected - 1]; state.position = p.id; state.mode = MODES.find(m => !modeDone(p, m)) || 'MP'; state.status = 'idle'; state.last = null; state.screen = 'inspect'; render(); });
    bind('results', goResults);
  }

  // 3. 검사
  function renderInspect() {
    const p = pos(), list = samples(), count = list.length, last = state.last || list[list.length - 1] || null;
    const running = state.status === 'running', paused = state.status === 'paused';
    const rows = list.slice().reverse().slice(0, 100);
    const passN = list.filter(s => s.pass).length, failN = count - passN;
    const statusLabel = running ? 'Vision AI 감지 중' : paused ? '일시정지' : count >= TARGET ? '수집 완료' : '대기';
    app.innerHTML = `<section class="inspect-head">
      <div class="inspect-title"><div class="transport" role="group" aria-label="검사 제어">
          <button type="button" class="btn${running ? ' is-live' : ''}" data-action="start" title="시작 (Vision AI)" ${running || count >= TARGET ? 'disabled' : ''}>${icon('play')}<span>${running ? '감지 중' : paused ? '재개' : '시작'}</span></button>
          <button type="button" class="btn${paused ? ' is-paused' : ''}" data-action="pause" title="일시정지" ${running ? '' : 'disabled'}>${icon('pause')}</button>
          <button type="button" class="btn" data-action="stop" title="중지 (위치 완료)">${icon('stop')}</button></div>
        <div><h1 id="page-title">위치 ${p.id} 검사</h1><p>S/N ${esc(state.serial)} · ${esc(state.mode)} 모드 · <span class="status ${state.status}"><i class="dot${running ? '' : paused ? ' warn' : ' off'}"></i>${statusLabel}</span></p></div></div>
      <div class="actions"><div class="mode-tabs wide" role="tablist" aria-label="검사 모드">${MODES.map(m => `<button type="button" role="tab" class="mode-tab${m === state.mode ? ' is-active' : ''}${modeDone(p, m) ? ' is-done' : ''}" data-mode="${m}" aria-selected="${m === state.mode}" ${running ? 'disabled' : ''}>${modeDone(p, m) ? icon('check') : ''}${m}<small>${p[m].length}/${TARGET}</small></button>`).join('')}</div>
        <div class="count-badge"><div><span class="lbl">현재 개수</span><span class="num">${count}<span> / ${TARGET}</span></span></div><div class="track" role="progressbar" aria-valuenow="${count}" aria-valuemin="0" aria-valuemax="${TARGET}" aria-label="현재 개수"><span style="width:${count}%"></span></div></div></div></section>
    <div class="inspect-grid">
      <section class="panel" aria-labelledby="table-title"><div class="panel-head"><div><h2 id="table-title">Pass / Fail</h2></div><div class="summary-strip"><span class="p">Pass<b>${passN}</b></span><span class="f">Fail<b>${failN}</b></span><span>Fail 클릭 시 당시 화면</span></div></div>
        <div class="table-wrap">${rows.length ? sampleTable(rows, { newest: true }) : `<div class="table-empty">${icon('table')}<p>▷ 시작을 누르면 Vision AI가 카메라 화면의 숫자를 읽어 1회마다 한 행씩 기록합니다.</p></div>`}</div>
        <div class="panel-foot"><span class="muted" style="font-size:12px">${count ? `최근 ${Math.min(count, 100)}행 · 최신순` : '기록 없음'}</span><div class="actions"><button type="button" class="btn" data-action="excel" ${count ? '' : 'disabled'}>${icon('download')}Excel 내보내기</button></div></div></section>
      <aside class="panel cam-panel" aria-labelledby="cam-title"><div class="panel-head"><h2 id="cam-title">카메라 입력</h2><div class="cam-head-right"><label class="toggle"><input type="checkbox" id="roi-toggle" ${state.showRoi ? 'checked' : ''}>감지 영역 표시</label><span class="status ${state.status}"><i class="dot${running ? '' : paused ? ' warn' : ' off'}"></i>${running ? 'LIVE' : paused ? 'PAUSED' : 'IDLE'}</span></div></div>
        ${viewport(last, { running, showRoi: state.showRoi, position: p.id, mode: state.mode })}
        <div class="cam-foot"><span>Edge · 1 fps · ROI ${FIELDS.length}</span><span class="mono">${last ? `#${pad(last.i)} ${last.t}` : '—'}</span></div>
        <div class="detect-head"><h3>감지된 숫자</h3><span>${last ? `${last.pass ? 'Pass' : 'Fail'} · 신뢰도 평균 ${avgConf(last)}%` : '아직 읽은 값이 없습니다'}</span></div>
        ${detectGrid(last, state.mode)}
        ${ruleNote(last, state)}</aside></div>`;
    bind('start', () => { state.status = 'running'; if (!state.last && !count) addSample(); startTimer(); render(); });
    bind('pause', () => { stopTimer(); state.status = 'paused'; render(); });
    bind('stop', requestStop);
    bind('excel', () => exportCsv(list, `${state.serial}_pos${p.id}_${state.mode}`));
    app.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { stopTimer(); state.mode = b.dataset.mode; state.status = 'idle'; state.last = null; render(); }));
    document.getElementById('roi-toggle').addEventListener('change', e => { state.showRoi = e.target.checked; render(); });
    app.querySelectorAll('tr.is-clickable').forEach(tr => tr.addEventListener('click', () => openFail(findSample(tr.dataset.ref))));
  }
  function requestStop() {
    stopTimer(); if (state.status === 'running') { state.status = 'paused'; render(); }
    const p = pos();
    openConfirm({ title: `위치 ${p.id} 검사를 중지할까요?`, desc: `중지하면 위치 ${p.id}은(는) 완료로 표시되고 위치 선택으로 돌아갑니다. 지금까지 수집한 ${MODES.map(m => `${m} ${p[m].length}회`).join(', ')}는 결과에 남습니다.`, cancel: '계속 검사', ok: '중지하고 완료 표시', danger: true, action: () => { p.done = true; goPositions(); } });
  }
  function goPositions() { stopTimer(); state.status = 'idle'; state.selected = null; state.screen = 'position'; render(); }
  function goResults() { stopTimer(); state.status = 'idle'; state.screen = 'results'; if (!state.resultsTab) state.resultsTab = tabs()[0]?.id || null; render(); }

  // 카메라 뷰포트 + ROI 오버레이
  function viewport(sample, o) {
    const pct = (v, base, size) => ((v - base) / size * 100).toFixed(2) + '%';
    const boxes = FIELDS.map(f => {
      const [x0, y0, x1, y1] = f.roi, d = sample?.fields[f.key];
      const cls = !sample ? '' : sample.failKey === f.key ? ' fail' : sample.warnKeys.includes(f.key) ? ' warn' : '';
      return `<div class="roi${cls}${f.tag ? ' ' + f.tag : ''}${o.showRoi ? '' : ' off'}" style="left:${pct(x0, VIEW.x, VIEW.w)};top:${pct(y0, VIEW.y, VIEW.h)};width:${((x1 - x0) / VIEW.w * 100).toFixed(2)}%;height:${((y1 - y0) / VIEW.h * 100).toFixed(2)}%"><span class="tag">${f.label}${d ? `<b>${esc(d.v)}</b>` : ''}</span></div>`;
    }).join('');
    return `<div class="viewport${o.running ? ' is-running' : ''}${o.frozen ? ' is-frozen' : ''}" role="img" aria-label="카메라 입력: 장비 디스플레이와 숫자 감지 영역"><img src="${IMG.src}" alt="" draggable="false"><div class="hud"><div class="hud-top"><span class="rec"><i></i>${o.frozen ? 'FAIL FRAME' : o.running ? 'REC' : 'CAM 1'}</span><span>POS ${o.position} · ${esc(o.mode)}${sample ? ` · #${pad(sample.i)}` : ''}</span></div><div class="scanline"></div>${boxes}</div></div>`;
  }
  function detectGrid(sample, mode) {
    return `<div class="detect-grid">${FIELDS.map(f => {
      const d = sample?.fields[f.key], bad = sample?.failKey === f.key, warn = d && d.conf < 80;
      return `<div class="det${f.main ? ' main' : ''}${bad ? ' fail' : warn ? ' warn' : ''}${d ? '' : ' pending'}"><canvas data-thumb="${f.key}" width="${f.main ? 172 : 116}" height="${f.main ? 92 : 60}" aria-hidden="true"></canvas><div><div class="k"><span>${f.label}</span><i>${f.exp ? `기준 ${esc(f.exp[mode])}` : '기록'}</i></div><div class="v">${d ? `${esc(d.v)}${f.unit ? `<small>${f.unit}</small>` : ''}` : '—'}</div><div class="conf" title="신뢰도"><span style="width:${d ? d.conf : 0}%"></span></div></div></div>`;
    }).join('')}</div>`;
  }
  function ruleNote(last, st) {
    if (st.status === 'paused') return `<div class="rule-note paused">${icon('info')}<span>일시정지 상태입니다. 재개하면 이어서 수집하고, ◻ 중지를 누르면 이 위치를 완료로 표시합니다.</span></div>`;
    if (last && !last.pass) { const f = FIELDS.find(x => x.key === last.failKey); return `<div class="rule-note fail">${icon('alert')}<span><b>Fail</b> · ${f.label} 읽은 값 ${esc(last.fields[f.key].v)} ≠ 기준 ${esc(f.exp[last.mode])}. 표에서 행을 누르면 당시 화면을 다시 볼 수 있습니다.</span></div>`; }
    return `<div class="rule-note">${icon('scan')}<span>기준값이 있는 항목(Energy·J/shot·Booster·Repeat·Length·Mode·Status)이 모두 일치하면 Pass, 하나라도 다르면 Fail입니다. 카운터(Remain·Current·Total)는 기록만 합니다.</span></div>`;
  }
  const avgConf = s => Math.round(FIELDS.reduce((a, f) => a + s.fields[f.key].conf, 0) / FIELDS.length);
  function drawThumbs() {
    if (!photo.complete || !photo.naturalWidth) return;
    const k = photo.naturalWidth / IMG.w;
    document.querySelectorAll('canvas[data-thumb]').forEach(c => {
      const f = FIELDS.find(x => x.key === c.dataset.thumb); if (!f) return;
      const [x0, y0, x1, y1] = f.roi, ctx = c.getContext('2d'), pad = 6;
      ctx.fillStyle = '#1a1f25'; ctx.fillRect(0, 0, c.width, c.height);
      const sw = (x1 - x0) * k, sh = (y1 - y0) * k, sc = Math.min((c.width - pad * 2) / sw, (c.height - pad * 2) / sh);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(photo, x0 * k, y0 * k, sw, sh, (c.width - sw * sc) / 2, (c.height - sh * sc) / 2, sw * sc, sh * sc);
    });
  }

  // 표 (검사·결과 공용)
  function sampleTable(rows, o = {}) {
    return `<table class="data"><thead><tr><th>#</th><th>시각</th>${TABLE_FIELDS.map(f => `<th>${f.label}${f.unit ? `<small>${f.unit}</small>` : '<small>&nbsp;</small>'}</th>`).join('')}<th class="judge">P/F</th></tr></thead><tbody>${rows.map((s, i) => `<tr class="${s.pass ? '' : 'is-fail is-clickable'}${o.newest && i === 0 ? ' is-new' : ''}" data-ref="${s.position}-${s.mode}-${s.i}" ${s.pass ? '' : 'tabindex="0" title="Fail 당시 화면 보기"'}><td class="idx">${pad(s.i)}</td><td>${s.t}</td>${TABLE_FIELDS.map(f => `<td class="${s.failKey === f.key ? 'bad' : ''}">${esc(s.fields[f.key].v)}</td>`).join('')}<td class="judge"><span class="chip ${s.pass ? 'chip-pass' : 'chip-fail'}">${s.pass ? 'Pass' : 'Fail'}</span></td></tr>`).join('')}</tbody></table>`;
  }
  const findSample = ref => { const [p, m, i] = ref.split('-'); return state.positions[p - 1][m][i - 1]; };

  // 4. 결과
  const tabs = () => state.positions.flatMap(p => MODES.map(m => ({ id: `${p.id}-${m}`, label: `${p.id}-${m}`, rows: p[m] })));
  function renderResults() {
    const all = tabs(), cur = all.find(t => t.id === state.resultsTab) || all[0]; state.resultsTab = cur.id;
    const flat = all.flatMap(t => t.rows), fails = flat.filter(s => !s.pass).length;
    app.innerHTML = `<section class="page-head"><div><span class="eyebrow">S/N ${esc(state.serial)}</span><h1 id="page-title">검사 결과</h1><p>위치·모드별 탭에서 각 회차의 읽은 값과 Pass/Fail을 확인합니다. Fail 행을 누르면 당시 화면을 보여줍니다.</p></div><div class="actions"><button type="button" class="btn" data-action="positions">${icon('back')}위치 선택</button></div></section>
      <div class="result-stats"><div class="panel stat"><span>전체 수집</span><strong>${flat.length}<span style="display:inline;font-size:13px;color:var(--faint);margin-left:4px">/ ${TARGET * 6}</span></strong></div><div class="panel stat p"><span>Pass</span><strong>${flat.length - fails}</strong></div><div class="panel stat f"><span>Fail</span><strong>${fails}</strong></div><div class="panel stat"><span>Pass율</span><strong>${flat.length ? (100 - fails / flat.length * 100).toFixed(1) : '—'}%</strong></div></div>
      <section class="panel"><div class="result-tabs" role="tablist">${all.map(t => { const f = t.rows.filter(s => !s.pass).length; return `<button type="button" role="tab" class="rtab${t.id === cur.id ? ' is-active' : ''}" data-tab="${t.id}" aria-selected="${t.id === cur.id}">${t.label}<small>${t.rows.length}/${TARGET}</small>${f ? `<span class="chip chip-fail">${f} Fail</span>` : t.rows.length ? '<span class="chip chip-pass">Pass</span>' : ''}</button>`; }).join('')}</div>
        <div class="table-wrap results">${cur.rows.length ? sampleTable(cur.rows) : `<div class="table-empty">${icon('table')}<p>이 위치·모드는 아직 수집 기록이 없습니다.</p></div>`}</div>
        <div class="panel-foot"><span class="upload-state${state.uploaded ? ' ok' : ''}">${state.uploaded ? `${icon('check')}업로드 완료 · ${state.uploaded}` : `${icon('info')}아직 업로드하지 않았습니다`}</span><div class="actions"><button type="button" class="btn" data-action="excel" ${flat.length ? '' : 'disabled'}>${icon('download')}Excel 내보내기</button><button type="button" class="btn btn-primary btn-lg" data-action="upload" ${flat.length ? '' : 'disabled'}>${icon('upload')}업로드</button></div></div></section>`;
    app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.resultsTab = b.dataset.tab; render(); }));
    bind('positions', goPositions);
    bind('excel', () => exportCsv(flat, `${state.serial}_results`));
    bind('upload', e => { e.currentTarget.disabled = true; e.currentTarget.textContent = '업로드 중…'; setTimeout(() => { state.uploaded = hms(new Date()); toast('결과를 서버에 업로드했습니다'); render(); }, 1200); });
    app.querySelectorAll('tr.is-clickable').forEach(tr => tr.addEventListener('click', () => openFail(findSample(tr.dataset.ref))));
  }

  // Fail 당시 화면
  function openFail(s) {
    if (!s) return;
    const f = FIELDS.find(x => x.key === s.failKey);
    document.getElementById('fail-body').innerHTML = `<div class="fail-view"><div class="fail-frame">${viewport(s, { running: false, frozen: true, showRoi: true, position: s.position, mode: s.mode })}<div class="frame-meta"><span>FRAME #${pad(s.i)} · ${s.t}</span><span>POS ${s.position} · ${esc(s.mode)} · S/N ${esc(state.serial)}</span></div></div>
      <div class="fail-side"><h2 id="fail-title"><span class="chip chip-fail">Fail</span>위치 ${s.position} · ${esc(s.mode)} · ${pad(s.i)}회</h2><p class="sub">${f.label} 값이 기준과 다릅니다. 읽은 값 <b class="mono">${esc(s.fields[f.key].v)}</b> · 기준 <b class="mono">${esc(f.exp[s.mode])}</b></p>
        <table class="cmp"><thead><tr><th>항목</th><th>읽은 값</th><th>기준</th><th>신뢰도</th></tr></thead><tbody>${FIELDS.map(x => `<tr class="${x.key === s.failKey ? 'bad' : ''}"><td>${x.label}</td><td>${esc(s.fields[x.key].v)}</td><td class="exp">${x.exp ? esc(x.exp[s.mode]) : '—'}</td><td class="exp">${s.fields[x.key].conf}%</td></tr>`).join('')}</tbody></table>
        <div class="dlg-actions" style="padding:16px 0 8px"><button type="button" class="btn" data-dlg="close">닫기</button></div></div></div>`;
    failDlg.querySelector('[data-dlg="close"]').addEventListener('click', () => failDlg.close());
    failDlg.showModal(); drawThumbs();
  }

  // 확인 다이얼로그
  let confirmAction = null;
  function openConfirm({ title, desc, cancel, ok, action, danger }) {
    document.getElementById('confirm-title').textContent = title; document.getElementById('confirm-desc').textContent = desc;
    const c = confirmDlg.querySelector('[data-dlg="cancel"]'), k = confirmDlg.querySelector('[data-dlg="ok"]');
    c.hidden = !cancel; c.textContent = cancel || ''; k.textContent = ok; k.className = `btn ${danger ? 'btn-danger-solid' : 'btn-primary'}`;
    confirmAction = action; confirmDlg.showModal(); k.focus();
  }
  confirmDlg.querySelector('[data-dlg="cancel"]').addEventListener('click', () => confirmDlg.close());
  confirmDlg.querySelector('[data-dlg="ok"]').addEventListener('click', () => { confirmDlg.close(); confirmAction?.(); });
  confirmDlg.addEventListener('cancel', () => { if (confirmDlg.querySelector('[data-dlg="cancel"]').hidden) confirmAction?.(); });

  // 유틸
  function bind(action, fn) { app.querySelectorAll(`[data-action="${action}"]`).forEach(b => b.addEventListener('click', fn)); }
  let toastTimer; function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); }
  function exportCsv(rows, name) {
    const head = ['no', 'time', 'position', 'mode', ...TABLE_FIELDS.map(f => f.key), ...TABLE_FIELDS.map(f => `${f.key}_conf`), 'result', 'fail_field'];
    const lines = rows.map(s => [s.i, s.t, s.position, s.mode, ...TABLE_FIELDS.map(f => s.fields[f.key].v), ...TABLE_FIELDS.map(f => s.fields[f.key].conf), s.pass ? 'Pass' : 'Fail', s.failKey || '']);
    const csv = '﻿' + [head, ...lines].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `${name}.csv`; a.click(); URL.revokeObjectURL(a.href);
    toast('Excel(CSV) 파일을 내려받았습니다');
  }

  // ───────────────────────── 시안용 화면 미리보기 ─────────────────────────
  const fill = (p, m, n) => { p[m] = Array.from({ length: n }, (_, i) => makeSample(p.id, m, i + 1, hms(new Date(2026, 8, 18, 14, 2, i * 1)))); };
  function loadFixture(id) {
    stopTimer(); Object.assign(state, { serial: 'SN-2026-004821', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), resultsTab: null, uploaded: null, last: null, screen: 'position' });
    const [p1, p2, p3] = state.positions;
    const complete = p => { fill(p, 'MP', TARGET); fill(p, 'Normal', TARGET); p.done = true; };
    switch (id) {
      case 'serial': state.serial = ''; state.screen = 'serial'; break;
      case 'position': state.selected = 2; break;
      case 'ready': state.screen = 'inspect'; break;
      case 'running': state.screen = 'inspect'; fill(p1, 'MP', 37); state.status = 'running'; state.last = p1.MP[36]; startTimer(); break;
      case 'paused': state.screen = 'inspect'; fill(p1, 'MP', 52); state.status = 'paused'; state.last = p1.MP[51]; break;
      case 'stop': state.screen = 'inspect'; fill(p1, 'MP', TARGET); fill(p1, 'Normal', 61); state.mode = 'Normal'; state.last = p1.Normal[60]; setTimeout(requestStop, 50); break;
      case 'position-progress': complete(p1); fill(p2, 'MP', 40); state.selected = 2; break;
      case 'position-done': complete(p1); complete(p2); complete(p3); break;
      case 'results': complete(p1); complete(p2); complete(p3); state.screen = 'results'; state.resultsTab = '1-MP'; break;
      case 'fail-detail': complete(p1); complete(p2); complete(p3); state.screen = 'results'; state.resultsTab = '1-MP'; setTimeout(() => openFail(p1.MP.find(s => !s.pass)), 50); break;
    }
    render();
  }
  const sel = document.getElementById('screen-select');
  sel.innerHTML = SCREENS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  sel.addEventListener('change', () => loadFixture(sel.value));
  document.getElementById('btn-reset').addEventListener('click', () => { stopTimer(); Object.assign(state, { serial: '', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), resultsTab: null, uploaded: null, last: null, screen: 'serial' }); render(); });
  const q = new URLSearchParams(location.search);
  if (q.get('preview') === '1') document.body.classList.add('preview');
  if (q.get('screen') && SCREENS.some(s => s[0] === q.get('screen'))) loadFixture(q.get('screen')); else render();
})();
