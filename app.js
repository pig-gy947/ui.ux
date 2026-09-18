/* Vision AI 검사 콘솔 — 시안 B. 흐름: S/N → 위치 선택 → 검사(▷ ⏸ ◻, 카메라 숫자 감지, Pass/Fail 로그) → 결과(그룹·표·업로드) → Fail 당시 화면 */
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
  };
  const icon = n => `<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, l = 3) => String(n).padStart(l, '0');
  const hms = d => `${pad(d.getHours(), 2)}:${pad(d.getMinutes(), 2)}:${pad(d.getSeconds(), 2)}`;

  const freshPositions = () => [1, 2, 3].map(id => ({ id, done: false, MP: [], Normal: [] }));
  const state = { screen: 'serial', serial: '', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), showRoi: true, resultsTab: null, uploaded: null, timer: null, last: null };
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
  function judge(fields, mode) { let failKey = null; const warnKeys = []; for (const f of FIELDS) { const d = fields[f.key]; if (f.exp && d.v !== f.exp[mode] && !failKey) failKey = f.key; if (d.conf < 80) warnKeys.push(f.key); } return { pass: !failKey, failKey, warnKeys }; }
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
  function render() { ({ serial: renderSerial, position: renderPositions, inspect: renderInspect, results: renderResults })[state.screen](); renderRail(); drawThumbs(); }
  function renderRail() {
    const idx = { serial: 1, position: 2, inspect: 3, results: 4 }[state.screen];
    const steps = [['S/N 입력', '장비 시리얼 확인'], ['위치 선택', '1 · 2 · 3'], ['검사', `모드별 ${TARGET}회`], ['결과', 'Pass / Fail · 업로드']];
    document.getElementById('stepper').innerHTML = steps.map(([b, s], i) => { const n = i + 1, cls = n === idx ? ' is-active' : n < idx ? ' is-done' : ''; return `<div class="stp${cls}"><i>${n < idx ? icon('check') : n}</i><div><b>${b}</b><small>${s}</small></div></div>`; }).join('');
    document.getElementById('rail-foot').innerHTML = `<div class="sn">S/N<b>${state.serial ? esc(state.serial) : '—'}</b></div><div class="conns"><div class="conn"><i class="dot"></i>Camera 연결됨</div><div class="conn"><i class="dot"></i>Edge (Vision AI) 준비됨</div></div>`;
    const sel = document.getElementById('screen-select');
    const cur = state.screen === 'inspect' ? (state.status === 'running' ? 'running' : state.status === 'paused' ? 'paused' : 'ready') : state.screen === 'position' ? (allDone() ? 'position-done' : state.positions.some(p => p.done) ? 'position-progress' : 'position') : state.screen;
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  }

  // 1. S/N
  function renderSerial() {
    app.innerHTML = `<div class="sn-wrap"><section class="card sn-card"><span class="kicker">Step 1</span><h1>시리얼 번호를 입력하세요</h1><p class="intro">장비 라벨의 S/N을 입력하면 위치 선택으로 넘어갑니다.</p>
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
    app.innerHTML = `<section class="page-title"><div><span class="kicker">Step 2</span><h1>검사할 위치를 선택하세요</h1><p>장비의 실제 배치와 같은 순서입니다. 1·2·3을 모두 마치면 결과를 볼 수 있습니다.</p></div><div><div class="progress-3" aria-label="위치 완료 ${done}/3">${state.positions.map(p => `<span class="${p.done ? 'on' : ''}"></span>`).join('')}</div><p class="muted" style="font-size:12px;margin-top:6px;text-align:right">${done} / 3 완료</p></div></section>
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
    const passN = list.filter(s => s.pass).length, failN = count - passN, rows = list.slice().reverse();
    const r = 47, circ = 2 * Math.PI * r, off = circ * (1 - count / TARGET);
    app.innerHTML = `<section class="inspect-top"><div><span class="kicker">Step 3</span><h1>위치 ${p.id} 검사</h1><p>▷ 를 누르면 Vision AI가 카메라 화면의 숫자를 1초마다 읽어 기록합니다.</p></div>
      <div class="seg" role="tablist" aria-label="검사 모드">${MODES.map(m => `<button type="button" role="tab" class="${m === state.mode ? 'is-active' : ''}" data-mode="${m}" aria-selected="${m === state.mode}" ${running ? 'disabled' : ''}>${modeDone(p, m) ? icon('check') : ''}${m}<small>${p[m].length}/${TARGET}</small></button>`).join('')}</div></section>
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
        ${stateNote(last, state, done)}</aside></div>
    <section class="card log" aria-labelledby="log-title"><div class="log-head"><h2 id="log-title">Pass / Fail<span class="sub">${count ? `${count}행 · 최신순 · Fail 행을 누르면 당시 화면` : '기록 없음'}</span></h2><button type="button" class="btn" data-action="excel" ${count ? '' : 'disabled'} style="min-height:40px">${icon('download')}Excel</button></div>
      <div class="tbl-wrap">${rows.length ? table(rows, true) : `<div class="tbl-empty">${icon('table')}<p>▷ 시작을 누르면 1회마다 한 행씩 기록됩니다.</p></div>`}</div></section>`;
    bind('start', () => { state.status = 'running'; if (!count) addSample(); startTimer(); render(); });
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
  function goResults() { stopTimer(); state.status = 'idle'; state.screen = 'results'; if (!state.resultsTab) state.resultsTab = groups()[0].id; render(); }

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
  function table(rows, newest) {
    return `<table class="tbl"><thead><tr><th>#</th><th>시각</th>${TABLE_FIELDS.map(f => `<th>${f.label}<small>${f.unit || '&nbsp;'}</small></th>`).join('')}<th class="judge">P/F</th></tr></thead><tbody>${rows.map((s, i) => `<tr class="${s.pass ? '' : 'is-fail is-clickable'}${newest && i === 0 ? ' is-new' : ''}" data-ref="${s.position}-${s.mode}-${s.i}" ${s.pass ? '' : 'tabindex="0"'}><td class="idx">${pad(s.i)}</td><td>${s.t}</td>${TABLE_FIELDS.map(f => `<td class="${s.failKey === f.key ? 'bad' : ''}">${esc(s.fields[f.key].v)}</td>`).join('')}<td class="judge"><span class="pill ${s.pass ? 'pill-pass' : 'pill-fail'}">${s.pass ? 'Pass' : 'Fail'}</span></td></tr>`).join('')}</tbody></table>`;
  }
  const findSample = ref => { const [p, m, i] = ref.split('-'); return state.positions[p - 1][m][i - 1]; };

  // 4. 결과
  const groups = () => state.positions.flatMap(p => MODES.map(m => ({ id: `${p.id}-${m}`, label: `${p.id} - ${m}`, rows: p[m] })));
  function renderResults() {
    const all = groups(), cur = all.find(g => g.id === state.resultsTab) || all[0]; state.resultsTab = cur.id;
    const flat = all.flatMap(g => g.rows), fails = flat.filter(s => !s.pass).length;
    app.innerHTML = `<section class="page-title"><div><span class="kicker">Step 4</span><h1>검사 결과</h1><p>위치·모드별로 각 회차의 읽은 값과 Pass/Fail을 확인합니다. Fail 행을 누르면 당시 화면이 열립니다.</p></div><button type="button" class="btn" data-action="positions">${icon('back')}위치 선택</button></section>
      <div class="stats"><div class="card stat"><span>전체 수집</span><b>${flat.length}<small> / ${TARGET * 6}</small></b></div><div class="card stat p"><span>Pass</span><b>${flat.length - fails}</b></div><div class="card stat f"><span>Fail</span><b>${fails}</b></div><div class="card stat"><span>Pass율</span><b>${flat.length ? (100 - fails / flat.length * 100).toFixed(1) : '—'}<small>%</small></b></div></div>
      <div class="results"><nav class="card group-list" aria-label="위치·모드">${all.map(g => { const f = g.rows.filter(s => !s.pass).length; return `<button type="button" class="group${g.id === cur.id ? ' is-active' : ''}" data-tab="${g.id}"><span><b>${g.label}</b><small>${g.rows.length} / ${TARGET}</small></span>${f ? `<span class="pill pill-fail">${f} Fail</span>` : g.rows.length ? '<span class="pill pill-pass">Pass</span>' : ''}</button>`; }).join('')}</nav>
        <section class="card"><div class="log-head"><h2>${cur.label}<span class="sub">${cur.rows.length}행</span></h2></div><div class="tbl-wrap tall">${cur.rows.length ? table(cur.rows) : `<div class="tbl-empty">${icon('table')}<p>이 위치·모드는 수집 기록이 없습니다.</p></div>`}</div></section></div>
      <div class="action-bar"><span class="upload-state${state.uploaded ? ' ok' : ''}">${state.uploaded ? `${icon('check')}업로드 완료 · ${state.uploaded}` : `${icon('info')}아직 업로드하지 않았습니다`}</span><div class="actions"><button type="button" class="btn btn-xl" data-action="excel" ${flat.length ? '' : 'disabled'}>${icon('download')}Excel 내보내기</button><button type="button" class="btn btn-xl btn-primary" data-action="upload" ${flat.length ? '' : 'disabled'}>${icon('upload')}업로드</button></div></div>`;
    app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.resultsTab = b.dataset.tab; render(); }));
    bind('positions', goPositions);
    bind('excel', () => exportCsv(flat, `${state.serial}_results`));
    bind('upload', e => { e.currentTarget.disabled = true; e.currentTarget.textContent = '업로드 중…'; setTimeout(() => { state.uploaded = hms(new Date()); toast('결과를 서버에 업로드했습니다'); render(); }, 1200); });
    app.querySelectorAll('tr.is-clickable').forEach(tr => tr.addEventListener('click', () => openFail(findSample(tr.dataset.ref))));
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
      case 'results': complete(p1); complete(p2); complete(p3); state.screen = 'results'; state.resultsTab = '1-MP'; break;
      case 'fail-detail': complete(p1); complete(p2); complete(p3); state.screen = 'results'; state.resultsTab = '1-MP'; setTimeout(() => openFail(p1.MP.find(s => !s.pass)), 50); break;
    }
    render();
  }
  const sel = document.getElementById('screen-select'); sel.innerHTML = SCREENS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  sel.addEventListener('change', () => loadFixture(sel.value));
  document.getElementById('btn-reset').addEventListener('click', () => { stopTimer(); Object.assign(state, { serial: '', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), resultsTab: null, uploaded: null, last: null, screen: 'serial' }); render(); });
  const q = new URLSearchParams(location.search);
  if (q.get('preview') === '1') document.body.classList.add('preview');
  if (q.get('screen') && SCREENS.some(s => s[0] === q.get('screen'))) loadFixture(q.get('screen')); else render();
})();
