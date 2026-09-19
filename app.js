/* ruvy 검사 콘솔. 흐름: S/N → 위치 선택 → 검사(▷ ⏸ ◻, 카메라 숫자 감지, Pass/Fail 로그) → 결과(그룹·표·업로드) → Fail 당시 화면 */
'use strict';
(() => {
  const TARGET = 100, MODES = ['MP', 'Normal'];
  const IMG = { src: 'assets/device-sample.jpg', w: 2000, h: 1500 };
  const VIEW = { x: 560, y: 340, w: 920, h: 680 };
  // 서비스모드 26개 항목. roi 는 원본 사진(2000×1500) 픽셀 좌표, raw 는 화면에 그대로 찍히는 원문입니다.
  // rule 이 판정 규칙입니다. 종이에 적힌 원칙만 넣었고, 기준이 안 적힌 항목은 rule: null (기록만) 로 두었습니다.
  //   max   값 < max            range  min~max       eq    정해진 값
  //   zero  0 이어야 정상        enum   목록 안의 값   band  warn 이상 주의 · fail 이상 에러
  //   match 같은 group 끼리 값이 모두 일치해야 함
  const FIELDS = [
    { n: 1,  key: 'rfp',      label: 'RF+',                 roi: [662, 489, 719, 504],   raw: 'D08402D',      rule: null },
    { n: 2,  key: 'rfm',      label: 'RF-',                 roi: [663, 505, 720, 520],   raw: '44820A0',      rule: null },
    { n: 3,  key: 'rfpErr',   label: 'RF+ 오차',             roi: [663, 522, 704, 536],   raw: 'CB0B9',        rule: { type: 'max', max: 100, note: '100 이상이면 베이스보드 FET 의심' }, unit: '' },
    { n: 4,  key: 'rfmErr',   label: 'RF- 오차',             roi: [663, 539, 704, 553],   raw: '930EF',        rule: { type: 'max', max: 100, note: '100 이상이면 베이스보드 FET 의심' }, unit: '' },
    { n: 5,  key: 'freqCart', label: '카트리지 주파수',        roi: [663, 556, 731, 571],   raw: '3067709A',     rule: { type: 'match', group: 'freq', note: '5 · 6 · 15 주파수가 일치해야 함' }, unit: 'kHz' },
    { n: 6,  key: 'freqBase', label: '베이스보드 주파수',      roi: [663, 572, 731, 587],   raw: '87677042',     rule: { type: 'match', group: 'freq', note: '5 · 6 · 15 주파수가 일치해야 함' }, unit: 'kHz' },
    { n: 7,  key: 'rfErr',    label: 'RF 에러',              roi: [663, 589, 711, 603],   raw: 'E90BB',        rule: null },
    { n: 8,  key: 'rfPwrErr', label: 'RF 파워 에러',          roi: [663, 605, 709, 620],   raw: 'B80F4',        rule: null },
    { n: 9,  key: 'tempCart', label: '카트리지 온도',          roi: [664, 622, 716, 637],   raw: '162826',       rule: { type: 'band', warn: 40, fail: 45, note: '40도 이상 주의 · 45도 이상 에러' }, unit: '°C' },
    { n: 10, key: 'hpStat',   label: '핸드피스 스테이터스',     roi: [680, 639, 721, 652],   raw: '460080',       rule: null },
    { n: 11, key: 'baseStat', label: '베이스보드 스테이터스',   roi: [754, 639, 804, 652],   raw: '11704B',       rule: null },
    { n: 12, key: 'tempIn',   label: '내부온도',              roi: [680, 655, 723, 667],   raw: '874093',       rule: null, unit: '°C' },
    { n: 13, key: 'fanRpm',   label: 'FAN RPM',             roi: [755, 655, 818, 667],   raw: '66160041',     rule: null, unit: 'rpm' },
    { n: 14, key: 'cartSn',   label: '카트리지 시리얼 넘버',    roi: [680, 672, 776, 684],   raw: 'AB286078611C', rule: null },
    { n: 15, key: 'freqHp',   label: '핸드피스 주파수',        roi: [1241, 473, 1308, 485], raw: 'EF67705D',     rule: { type: 'match', group: 'freq', note: '5 · 6 · 15 주파수가 일치해야 함' }, unit: 'kHz' },
    { n: 16, key: 'hpRegion', label: '핸드피스 지역코드',      roi: [1242, 491, 1290, 503], raw: '7740BF',       rule: null },
    { n: 17, key: 'cartRegion', label: '카트리지 지역코드',    roi: [1241, 508, 1293, 519], raw: '8A40BB',
      rule: { type: 'enum', values: ['40', '41', '42', '43'], labels: { '40': '국내', '41': 'E', '42': 'C', '43': 'R' }, note: '40 국내 · 41 E · 42 C · 43 R' } },
    { n: 18, key: 'cartPower', label: '카트리지 셋팅 전력값',  roi: [1241, 525, 1300, 536], raw: '5F84055',      rule: { type: 'eq', value: '820', note: '에이징용 820' } },
    { n: 19, key: 'shotLeft', label: '잔여 샷수',             roi: [1241, 541, 1299, 553], raw: '75118F2',      rule: null },
    { n: 20, key: 'baseStat2', label: '베이스보드 스테이터스2', roi: [1242, 558, 1286, 570], raw: '4511A5',       rule: null },
    { n: 21, key: 'cartMax',  label: '카트리지 MAX 파워값',    roi: [1241, 576, 1292, 587], raw: '8D18CC',       rule: null },
    { n: 22, key: 'baseFault', label: '베이스보드 Fault',     roi: [1241, 593, 1288, 604], raw: 'E70076',       rule: { type: 'zero', note: '0 이면 정상' } },
    { n: 23, key: 'hpFault',  label: '핸드피스 Fault',        roi: [1241, 610, 1287, 621], raw: '8700A0',       rule: { type: 'zero', note: '0 이면 정상' } },
    { n: 24, key: 'iSense1',  label: '전류센서 1',            roi: [1241, 625, 1292, 637], raw: '6A989D',       rule: { type: 'range', min: 95, max: 100 }, unit: '%' },
    { n: 25, key: 'iSense2',  label: '전류센서 2',            roi: [1326, 625, 1374, 637], raw: 'C699B0',       rule: { type: 'range', min: 95, max: 100 }, unit: '%' },
    { n: 26, key: 'commErr',  label: 'BB-HP-GUI 통신에러', roi: [1241, 642, 1282, 653], raw: '1E0D7',    rule: { type: 'zero', note: '0 이면 정상' } },
  ];
  const BY_KEY = Object.fromEntries(FIELDS.map(f => [f.key, f]));
  const RULED = FIELDS.filter(f => f.rule);            // 기준이 있는 항목
  const TABLE_FIELDS = RULED;                          // 표에는 기준이 있는 항목만 (나머지는 상세에서)
  const ruleText = f => {
    const r = f.rule; if (!r) return '기록만';
    if (r.type === 'max') return `< ${r.max}`;
    if (r.type === 'range') return `${r.min}~${r.max}${f.unit || ''}`;
    if (r.type === 'eq') return `= ${r.value}`;
    if (r.type === 'zero') return '= 0';
    if (r.type === 'enum') return r.values.join(' / ');
    if (r.type === 'band') return `< ${r.warn}${f.unit || ''}`;
    if (r.type === 'match') return '5 · 6 · 15 일치';
    return '';
  };
  // 한 항목의 판정. 'pass' | 'warn' | 'fail' | 'none'(기록만)
  function verdict(f, fields) {
    const r = f.rule; if (!r) return 'none';
    const raw = fields[f.key].v, num = parseFloat(raw);
    switch (r.type) {
      case 'max':   return Number.isNaN(num) ? 'fail' : num < r.max ? 'pass' : 'fail';
      case 'range': return Number.isNaN(num) ? 'fail' : num >= r.min && num <= r.max ? 'pass' : 'fail';
      case 'eq':    return raw === r.value ? 'pass' : 'fail';
      case 'zero':  return num === 0 ? 'pass' : 'fail';
      case 'enum':  return r.values.includes(raw) ? 'pass' : 'fail';
      case 'band':  return Number.isNaN(num) ? 'fail' : num >= r.fail ? 'fail' : num >= r.warn ? 'warn' : 'pass';
      case 'match': {
        const peers = FIELDS.filter(x => x.rule && x.rule.type === 'match' && x.rule.group === r.group);
        return peers.every(x => fields[x.key].v === fields[peers[0].key].v) ? 'pass' : 'fail';
      }
      default: return 'none';
    }
  }
  // 왜 어긋났는지 한 줄로
  function reason(f, fields) {
    const r = f.rule, v = fields[f.key].v, u = f.unit || '';
    if (!r) return '';
    if (r.type === 'match') return `5 · 6 · 15 주파수 불일치 (${FIELDS.filter(x => x.rule && x.rule.type === 'match').map(x => fields[x.key].v).join(' / ')})`;
    if (r.type === 'max')   return `${v}${u} — 기준 ${r.max} 미만${r.note ? ` · ${r.note}` : ''}`;
    if (r.type === 'range') return `${v}${u} — 기준 ${r.min}~${r.max}${u}`;
    if (r.type === 'eq')    return `${v} — 기준 ${r.value}`;
    if (r.type === 'zero')  return `${v} — 0 이어야 정상`;
    if (r.type === 'enum')  return `${v} — 허용 ${r.values.join(' / ')}`;
    if (r.type === 'band')  return `${v}${u} — ${parseFloat(v) >= r.fail ? `${r.fail}${u} 이상 에러` : `${r.warn}${u} 이상 주의`}`;
    return v;
  }
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
  const state = { screen: 'serial', serial: '', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), showRoi: true, resultsTab: null, uploaded: null, timer: null, last: null, filter: 'issue', jumpTo: null, q: '' };
  const app = document.getElementById('app'), confirmDlg = document.getElementById('confirm'), failDlg = document.getElementById('fail-dialog');
  const photo = new Image(); photo.src = IMG.src; photo.onload = () => drawThumbs();
  const pos = () => state.positions[state.position - 1];
  const samples = () => pos()[state.mode];
  const modeDone = (p, m) => p[m].length >= TARGET;
  const allDone = () => state.positions.every(p => p.done);
  const anySamples = () => state.positions.some(p => MODES.some(m => p[m].length));

  // ── 감지 (시뮬레이션) ──
  // 실제 연결 시 카메라 프레임을 FIELDS[].roi 로 잘라 OCR → 디코드한 결과를
  // { key: { v, conf } } 로 돌려주면 됩니다. v 는 규칙과 비교할 값, conf 는 OCR 신뢰도입니다.
  const hash = (a, b, c) => { let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791); h = Math.imul(h ^ (h >>> 13), 0x5bd1e995); return (h ^ (h >>> 15)) >>> 0; };
  const pick = (h, lo, hi) => lo + (h % (hi - lo + 1));
  function detectFrame(position, mode, i) {
    const mi = MODES.indexOf(mode) + 1, h = hash(position, mi, i);
    const freq = '2450';                                  // 5 · 6 · 15 는 평소 같은 값
    const base = {
      rfp: String(pick(h, 1180, 1220)), rfm: String(pick(h >>> 3, 1170, 1210)),
      rfpErr: String(pick(h >>> 6, 12, 46)), rfmErr: String(pick(h >>> 9, 10, 44)),
      freqCart: freq, freqBase: freq, freqHp: freq,
      rfErr: '0', rfPwrErr: '0',
      tempCart: String(pick(h >>> 12, 31, 38)),
      hpStat: '0x' + ((h >>> 2) % 256).toString(16).toUpperCase().padStart(2, '0'),
      baseStat: '0x' + ((h >>> 5) % 256).toString(16).toUpperCase().padStart(2, '0'),
      tempIn: String(pick(h >>> 15, 28, 36)), fanRpm: String(pick(h >>> 18, 3200, 3600) * 1),
      cartSn: 'AB286078611C', hpRegion: '40', cartRegion: '40', cartPower: '820',
      shotLeft: String(Math.max(0, 118 - i)), baseStat2: '0x' + ((h >>> 7) % 256).toString(16).toUpperCase().padStart(2, '0'),
      cartMax: String(pick(h >>> 21, 900, 960)),
      baseFault: '0', hpFault: '0',
      iSense1: String(pick(h >>> 11, 96, 100)), iSense2: String(pick(h >>> 14, 96, 100)),
      commErr: '0',
    };
    // 실제 라인에서 나오는 만큼만 어긋나게 — 26개 중 하나가 규칙을 벗어나는 회차를 섞는다
    if (h % 31 === 0) {
      const w = (h >>> 5) % 7;
      if (w === 0) base.rfpErr = String(pick(h >>> 8, 102, 140));          // 3 전류값 100 이상 → FET 의심
      else if (w === 1) base.rfmErr = String(pick(h >>> 8, 101, 132));     // 4 같은 규칙
      else if (w === 2) base.freqHp = '2448';                               // 15 주파수 불일치
      else if (w === 3) base.tempCart = String(pick(h >>> 8, 45, 48));      // 9 45도 이상 에러
      else if (w === 4) base.iSense1 = String(pick(h >>> 8, 88, 94));       // 24 전류센서 범위 미달
      else if (w === 5) base.baseFault = String(pick(h >>> 8, 1, 6));       // 22 Fault
      else base.cartRegion = '45';                                          // 17 지역코드 밖
    } else if (h % 19 === 0) {
      base.tempCart = String(pick(h >>> 8, 40, 44));                        // 9 40~45 주의 구간
    } else if (h % 61 === 0) {
      base.commErr = String(pick(h >>> 8, 1, 3));                           // 26 통신에러
    }
    const f = {};
    FIELDS.forEach((x, k) => { f[x.key] = { v: base[x.key], conf: 93 + (hash(i, mi, k) % 6) }; });
    if (h % 11 === 0) { const t = RULED[(h >>> 4) % RULED.length]; f[t.key].conf = 62 + ((h >>> 8) % 16); }
    return f;
  }
  // 26개 항목을 각자 규칙으로 판정하고, 하나라도 fail 이면 그 회차는 Fail.
  function judge(fields) {
    const failKeys = [], warnKeys = [], lowKeys = [];
    for (const f of FIELDS) {
      const v = verdict(f, fields);
      if (v === 'fail') failKeys.push(f.key);
      else if (v === 'warn') warnKeys.push(f.key);
      if (fields[f.key].conf < 80) lowKeys.push(f.key);
    }
    return { pass: !failKeys.length, failKey: failKeys[0] || null, failKeys, ruleWarnKeys: warnKeys, lowKeys, warnKeys: [...warnKeys, ...lowKeys] };
  }
  const makeSample = (position, mode, i, t) => { const fields = detectFrame(position, mode, i); return { i, t, position, mode, fields, ...judge(fields) }; };
  function addSample() { const list = samples(); if (list.length >= TARGET) return; const s = makeSample(state.position, state.mode, list.length + 1, hms(new Date())); list.push(s); state.last = s; if (list.length >= TARGET) onModeComplete(); render(); }
  function onModeComplete() {
    stopTimer(); state.status = 'idle'; const p = pos(), remaining = MODES.find(m => !modeDone(p, m));
    if (remaining) { toast(`${state.mode} ${TARGET}회 완료 · ${remaining} 모드로 전환`); state.mode = remaining; state.last = null; }
    else { p.done = true; const t = tally(MODES.flatMap(m => p[m]));
      openConfirm({ title: `위치 ${p.id} 검사 완료`, desc: `Normal·MP 각 ${TARGET}회 수집이 끝났습니다. ${t.need ? `확인이 필요한 회차가 <b>${t.need}회</b>(Fail ${t.fail} · 주의 ${t.warn} · OCR 미확인 ${t.ocr})입니다.` : '전 회차가 기준 안에 있습니다.'}`, cancel: null, ok: '위치 선택으로', action: goPositions }); }
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
      ${(() => {
        const warn = rows.filter(s => s.pass && s.ruleWarnKeys.length).length;
        const ocr = rows.filter(s => s.pass && !s.ruleWarnKeys.length && s.lowKeys.length).length;
        const need = fails + warn + ocr;
        return card('평균 신뢰도', need ? `확인 필요 ${need}` : '안정', need ? 'warn' : 'up', conf.toFixed(1), '%',
          need ? `Fail ${fails} · 주의 ${warn} · OCR 미확인 ${ocr}` : '전 회차 정상',
          sparkline(bucket(rows, 24, b => b.reduce((a, s) => a + avgConf(s), 0) / b.length), need ? 'warn' : 'up'));
      })()}
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
        return `<button type="button" class="frow" data-ref="${refOf(s)}"><span class="frow-l"><b><span class="num">${giPad(s)}</span>번 <small class="sub2">${s.position}·${esc(s.mode)} ${pad(s.i)}</small></b><small>${f.n}. ${esc(f.label)} · ${esc(reason(f, s.fields))}</small></span><small class="num frow-t">${s.t}</small></button>`; }).join('')}</div>`
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
    const rows = allRows(), n = rows.length, fails = failCount(rows);
    const conf = n ? rows.reduce((a, s) => a + avgConf(s), 0) / n : 0, last = rows.filter(s => !s.pass).slice(-1)[0];
    const warn = rows.filter(s => s.pass && s.ruleWarnKeys.length).length;
    const ocr = rows.filter(s => s.pass && !s.ruleWarnKeys.length && s.lowKeys.length).length;
    const it = (k, v, tone) => `<span class="tk"><i>${k}</i><b class="num${tone ? ' c-' + tone : ''}">${v}</b></span>`;
    document.getElementById('ticker').innerHTML =
      `<span class="tk tk-sn"><i>S/N</i><b>${state.serial ? esc(state.serial) : '—'}</b></span>` +
      it('수집', `${n} / ${TARGET * 6}`) + it('Pass', n - fails, 'up') + it('Fail', fails, fails ? 'down' : '') +
      it('Pass율', `${n ? (100 - fails / n * 100).toFixed(1) : '—'}%`) + it('평균 신뢰도', `${conf.toFixed(1)}%`) +
      it('주의', warn, warn ? 'warn' : '') + it('OCR 미확인', ocr, ocr ? 'warn' : '') +
      (last ? `<span class="tk"><i>최근 Fail</i><b><span class="num">${giPad(last)}</span>번 · ${esc(FIELDS.find(x => x.key === last.failKey).label)}</b></span>` : '');
  }
  function uploadNow() {
    if (!anySamples() || state.uploaded) return;
    if (state.screen !== 'results') { goResults(); }
    doUpload(document.getElementById('gnb-cta'));
  }

  function renderSerial() {
    app.innerHTML = `<div class="sn-wrap"><section class="card sn-card"><h1>S/N 입력</h1>
      <form id="sn-form" novalidate><div class="sn-field"><label class="sr-only" for="sn-input">S/N</label><input class="sn-input" id="sn-input" placeholder="SN-2026-001234" maxlength="32" autocomplete="off" spellcheck="false" value="${esc(state.serial)}" aria-describedby="sn-err"><p class="sn-err" id="sn-err" role="alert" hidden></p></div>
      <div class="sn-actions"><button type="reset" class="btn btn-xl">Cancel</button><button type="submit" class="btn btn-xl btn-primary">OK ${icon('arrow')}</button></div></form></section></div>`;
    const form = document.getElementById('sn-form'), input = document.getElementById('sn-input'), err = document.getElementById('sn-err'); input.focus();
    form.addEventListener('submit', e => { e.preventDefault(); const v = input.value.trim().toUpperCase(); if (!/^[A-Z0-9-]{6,}$/.test(v)) { err.textContent = '형식이 올바르지 않습니다. 영문·숫자·하이픈 6자 이상으로 입력하세요.'; err.hidden = false; input.setAttribute('aria-invalid', 'true'); input.focus(); return; } state.serial = v; state.screen = 'position'; render(); });
    form.addEventListener('reset', () => { err.hidden = true; input.removeAttribute('aria-invalid'); setTimeout(() => input.focus()); });
  }

  // 2. 위치 선택
  function renderPositions() {
    const done = state.positions.filter(p => p.done).length, selP = state.selected ? state.positions[state.selected - 1] : null;
    const cards = state.positions.map(p => { const slot = p.id === 3 ? 5 : p.id, sel = state.selected === p.id;
      const n = MODES.reduce((a, m) => a + p[m].length, 0), cap = MODES.length * TARGET;
      return `<button type="button" class="pos${sel ? ' is-selected' : ''}${p.done ? ' is-done' : ''}" style="--slot:${slot}" data-pos="${p.id}" aria-label="위치 ${p.id}${p.done ? ' · 완료' : ''}" aria-pressed="${sel}" ${p.done ? 'disabled' : ''}>
        ${p.done ? `<span class="pos-done-badge" aria-hidden="true">${icon('check')}</span>` : ''}
        <span class="pos-big">${p.id}</span>
        <span class="pos-bar" aria-hidden="true"><i style="width:${(n / cap * 100).toFixed(1)}%"></i></span></button>`; }).join('');
    const hint = allDone() ? '<b>세 위치 완료</b>결과에서 Pass/Fail을 확인하고 업로드하세요.' : selP ? `<b>위치 ${selP.id}</b>${MODES.find(m => !modeDone(selP, m))} 모드부터 시작합니다.` : '완료된 위치는 다시 고를 수 없습니다.';
    app.innerHTML = `<div class="head"><div><h1>위치 선택</h1><p>검사할 위치를 고르고 OK를 누르세요.</p></div><div class="head-act"><div class="progress-3" aria-label="위치 완료 ${done}/3">${state.positions.map(p => `<span class="${p.done ? 'on' : ''}"></span>`).join('')}</div><small class="muted num">${done} / 3 완료</small></div></div>
      <div class="pos-grid">${cards}</div>
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
      <div class="card pad map-panel"><div class="box-head"><h3>${icon('grid')}회차 맵<small>${count} / ${TARGET}</small></h3>${runLegend()}</div>
        ${runMap(groups().filter(g => g.pos === p.id && g.mode === state.mode), { live: true, hi: hiSet })}
        <div class="need-wrap">${needSummary(list)}</div></div>
      <div class="card pad"><div class="box-head"><h3>${icon('spark')}항목별 Fail</h3><span class="cap">누르면 그 항목만</span></div>${failBreakdown(base, state.filter)}</div>
    </section>
    <section class="card log" aria-labelledby="log-title"><div class="log-head"><h2 id="log-title">Pass / Fail<span class="sub">${count ? `${shown.length}행 표시${shown.length !== count ? ` · 전체 ${count}행` : ''} · 최신순` : '기록 없음'}</span></h2>
      <div class="head-right">${count ? filterBar(base, state.filter) : ''}${failNav(shown)}<button type="button" class="btn btn-sm" data-action="excel"${count ? '' : ' disabled'}>${icon('download')}Excel</button></div></div>
      <div class="tbl-wrap">${shown.length ? table(shown, { newest: state.filter === 'all' }) : `<div class="tbl-empty">${icon('table')}<p>${count ? '이 조건에 해당하는 회차가 없습니다.' : '▷ 시작을 누르면 1회마다 한 행씩 기록됩니다.'}</p></div>`}</div></section>`;
    bind('start', () => { state.status = 'running'; if (!count) addSample(); startTimer(); render(); });
    bind('pause', () => { stopTimer(); state.status = 'paused'; render(); });
    bind('stop', requestStop);
    bind('excel', () => exportCsv(list, `${state.serial}_pos${p.id}_${state.mode}`));
    app.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { stopTimer(); state.mode = b.dataset.mode; state.status = 'idle'; state.last = null; state.filter = 'issue'; state.jumpTo = null; render(); }));
    document.getElementById('roi-toggle').addEventListener('change', e => { state.showRoi = e.target.checked; render(); });
    wireList(shown);
  }
  function requestStop() {
    stopTimer(); if (state.status === 'running') { state.status = 'paused'; render(); }
    const p = pos();
    const t = tally(MODES.flatMap(m => p[m]));
    openConfirm({ title: `위치 ${p.id} 검사 중지`, desc: `지금까지 ${MODES.map(m => `${m} ${p[m].length}회`).join(', ')}를 수집했고, 그중 ${t.need ? `<b>확인이 필요한 회차가 ${t.need}회</b>(Fail ${t.fail} · 주의 ${t.warn} · OCR 미확인 ${t.ocr})입니다` : '<b>모두 정상</b>입니다'}. 중지하면 위치 ${p.id}은(는) 완료로 표시되고 위치 선택으로 돌아갑니다.`, cancel: '계속 검사', ok: '중지하고 완료 표시', danger: true, action: () => { p.done = true; goPositions(); } });
  }
  function goPositions() { stopTimer(); state.status = 'idle'; state.selected = null; state.screen = 'position'; render(); }
  function goResults() { stopTimer(); state.status = 'idle'; state.screen = 'results'; state.filter = 'issue'; state.jumpTo = null; if (!state.resultsTab) state.resultsTab = 'ALL'; render(); }

  // 26개 태그가 한 화면에 붙으므로 이름 대신 "번호 · 값"으로 줄이고, 항목마다 좌·우를 지정해 겹치지 않게 둔다.
  const TAG_RIGHT = new Set([11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 25, 26]);
  function viewport(sample, o) {
    const pct = (v, b, s) => ((v - b) / s * 100).toFixed(2) + '%';
    const boxes = FIELDS.map(f => {
      const [x0, y0, x1, y1] = f.roi, d = sample?.fields[f.key];
      const v = sample ? verdict(f, sample.fields) : null;
      const cls = !sample ? '' : v === 'fail' ? ' fail' : v === 'warn' || d.conf < 80 ? ' warn' : v === 'none' ? ' rec' : '';
      return `<div class="roi${cls} ${TAG_RIGHT.has(f.n) ? 'right' : 'left'}${o.showRoi ? '' : ' off'}"
        style="left:${pct(x0, VIEW.x, VIEW.w)};top:${pct(y0, VIEW.y, VIEW.h)};width:${((x1 - x0) / VIEW.w * 100).toFixed(2)}%;height:${((y1 - y0) / VIEW.h * 100).toFixed(2)}%"
        title="${f.n}. ${esc(f.label)}${d ? ` = ${esc(d.v)}` : ''}"><span class="tag"><i>${f.n}</i>${d ? esc(d.v) : ''}</span></div>`;
    }).join('');
    return `<div class="viewport${o.running ? ' is-running' : ''}${o.frozen ? ' is-frozen' : ''}" role="img" aria-label="카메라 입력: 장비 서비스모드 화면과 26개 감지 영역"><img src="${IMG.src}" alt="" draggable="false"><div class="hud"><div class="hud-bar"><span>${o.frozen ? 'FAIL FRAME' : o.running ? 'REC' : 'CAM 1'}</span><span>SERVICE MODE · POS ${o.position} · ${esc(o.mode)}${sample ? ` · #${pad(sample.i)} ${sample.t}` : ''}</span></div><div class="scan"></div>${boxes}</div></div>`;
  }
  const strip = sample => RULED.map(f => {
    const d = sample?.fields[f.key], v = sample ? verdict(f, sample.fields) : null, low = d && d.conf < 80;
    const cls = v === 'fail' ? ' fail' : v === 'warn' || low ? ' warn' : '';
    return `<div class="rd${cls}${d ? '' : ' pending'}" title="${f.n}. ${esc(f.label)} · 기준 ${esc(ruleText(f))}"><canvas data-thumb="${f.key}" width="88" height="52" aria-hidden="true"></canvas><div><div class="k"><b>${f.n}</b> ${esc(f.label)}${d ? ` · ${d.conf}%` : ''}</div><div class="v">${d ? `${esc(d.v)}${f.unit ? `<small>${f.unit}</small>` : ''}` : '—'}</div></div></div>`;
  }).join('');
  function stateNote(last, st, done) {
    if (st.status === 'paused') return `<div class="state-note paused">${icon('info')}<span>일시정지 중입니다. 재개하면 이어서 수집하고, 중지를 누르면 이 위치를 완료로 표시합니다.</span></div>`;
    if (done) return `<div class="state-note done">${icon('check')}<span>${esc(st.mode)} ${TARGET}회 수집이 끝났습니다. 다른 모드를 선택하거나 중지로 위치를 마무리하세요.</span></div>`;
    if (last && !last.pass) { const f = FIELDS.find(x => x.key === last.failKey); return `<div class="state-note fail">${icon('alert')}<span><b>Fail</b> · ${f.n}. ${f.label} — ${esc(reason(f, last.fields))}</span></div>`; }
    return `<div class="state-note">${icon('scan')}<span>서비스모드 26개 항목 중 <b>기준이 있는 ${RULED.length}개</b>를 규칙으로 판정합니다. 하나라도 벗어나면 그 회차는 Fail입니다. 나머지 ${FIELDS.length - RULED.length}개는 기록만 합니다.</span></div>`;
  }
  const avgConf = s => Math.round(FIELDS.reduce((a, f) => a + s.fields[f.key].conf, 0) / FIELDS.length);
  function drawThumbs() {
    if (!photo.complete || !photo.naturalWidth) return; const k = photo.naturalWidth / IMG.w;
    document.querySelectorAll('canvas[data-thumb]').forEach(c => { const f = FIELDS.find(x => x.key === c.dataset.thumb); if (!f) return; const [x0, y0, x1, y1] = f.roi, ctx = c.getContext('2d'), m = 5; ctx.fillStyle = '#1a1f25'; ctx.fillRect(0, 0, c.width, c.height); const sw = (x1 - x0) * k, sh = (y1 - y0) * k, sc = Math.min((c.width - m * 2) / sw, (c.height - m * 2) / sh); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(photo, x0 * k, y0 * k, sw, sh, (c.width - sw * sc) / 2, (c.height - sh * sc) / 2, sw * sc, sh * sc); });
  }

  // ── 100회 이상을 한눈에: 회차 맵 · 항목별 Fail · 필터 ──
  const isWarn = s => s.warnKeys.length > 0;
  const refOf = s => `${s.position}-${s.mode}-${s.i}`;
  // 검사 전체를 1~600 한 줄로 센 번호. 화면에서는 이 번호로 부른다.
  const gi = s => (s.position - 1) * MODES.length * TARGET + MODES.indexOf(s.mode) * TARGET + s.i;
  const giPad = s => pad(gi(s), 3);
  const failCount = rows => rows.reduce((n, s) => n + (s.pass ? 0 : 1), 0);
  function queryRows(rows, q) {
    const t = (q || '').trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(s => {
      if (giPad(s).includes(t) || String(gi(s)) === t || pad(s.i).includes(t) || s.t.includes(t)) return true;
      if (`${s.position}·${s.mode}`.toLowerCase().includes(t) || `위치 ${s.position}`.includes(t)) return true;
      if ((s.pass ? 'pass' : 'fail').startsWith(t)) return true;
      return TABLE_FIELDS.some(f => String(s.fields[f.key].v).toLowerCase().includes(t) || (s.failKeys.includes(f.key) && f.label.toLowerCase().includes(t)));
    });
  }
  function filterRows(rows, f) {
    if (f === 'issue') return rows.filter(s => !s.pass || s.ruleWarnKeys.length || s.lowKeys.length);
    if (f === 'fail') return rows.filter(s => !s.pass);
    if (f === 'warn') return rows.filter(s => s.pass && s.ruleWarnKeys.length);
    if (f === 'low') return rows.filter(s => s.pass && !s.ruleWarnKeys.length && s.lowKeys.length);
    if (f && f.startsWith('k:')) { const k = f.slice(2); return rows.filter(s => s.failKeys.includes(k)); }
    return rows;
  }
  function cellTitle(s) {
    const head = `${giPad(s)}번 (${s.position}·${s.mode} ${pad(s.i)}회) · ${s.t}`;
    if (s.pass) return `${head} · Pass${isWarn(s) ? ' · 신뢰도 낮음' : ''}`;
    const f = FIELDS.find(x => x.key === s.failKey);
    return `${head} · Fail · ${f.n}. ${f.label} ${reason(f, s.fields)}${s.failKeys.length > 1 ? ` 외 ${s.failKeys.length - 1}개 항목` : ''}`;
  }
  // ── 1~600 회차 맵 ──
  // 항목을 늘어놓지 않는다. 한 칸이 회차 하나고, 몇 번째 회차가 Fail인지만 보여준다.
  // 한 줄이 위치·모드 하나(100회)라 여섯 줄로 600회가 들어온다.
  const issueOf = s => !s.pass ? 'fail' : s.ruleWarnKeys.length ? 'warn' : s.lowKeys.length ? 'low' : 'pass';
  function runMap(gs, o = {}) {
    const rowFor = g => {
      const by = new Map(g.rows.map(s => [s.i, s]));
      const from = (g.pos - 1) * MODES.length * TARGET + MODES.indexOf(g.mode) * TARGET;
      let cells = '';
      for (let i = 1; i <= TARGET; i++) {
        const s = by.get(i);
        if (!s) { cells += '<i class="rc"></i>'; continue; }
        const k = issueOf(s), n = gi(s);
        const cls = k === 'fail' ? 'bad' : k === 'warn' ? 'warn' : k === 'low' ? 'low' : 'ok';
        const tip = k === 'fail' ? `${n}번 · Fail · ${s.failKeys.map(x => `${BY_KEY[x].n}. ${BY_KEY[x].label}`).join(', ')}`
          : k === 'low' ? `${n}번 · OCR 미확인 · ${s.lowKeys.map(x => BY_KEY[x].label).join(', ')}`
          : k === 'warn' ? `${n}번 · 주의 · ${s.ruleWarnKeys.map(x => BY_KEY[x].label).join(', ')}` : `${n}번 · Pass`;
        const dim = o.hi && !o.hi.has(refOf(s)) ? ' dim' : '';
        const now = o.live && i === g.rows.length ? ' now' : '';
        const tap = k !== 'pass';
        cells += `<i class="rc ${cls}${dim}${now}${tap ? ' tap' : ''}" title="${esc(tip)}"${tap ? ` data-ref="${refOf(s)}" role="button" tabindex="0"` : ''}></i>`;
      }
      const f = failCount(g.rows), low = g.rows.filter(s => s.pass && (s.lowKeys.length || s.ruleWarnKeys.length)).length;
      return `<div class="rrow2">
        <span class="rlab"><b>${esc(g.label)}</b><small class="num">${pad(from + 1)}–${pad(from + TARGET)}</small></span>
        <span class="rcells">${cells}</span>
        <span class="rtail">${f ? `<b class="c-down">${f}</b>` : '<b class="c-ok">0</b>'}${low ? `<i class="c-warn">${low}</i>` : ''}</span></div>`;
    };
    let ruler = '';
    for (let i = 1; i <= TARGET; i++) ruler += `<i class="rt">${i % 10 === 0 ? `<b>${i}</b>` : ''}</i>`;
    return `<div class="runmap-wrap"><div class="runmap">
      <div class="rrow2 is-ruler"><span class="rlab"></span><span class="rcells">${ruler}</span><span class="rtail"><i>Fail · 확인</i></span></div>
      ${gs.map(rowFor).join('')}</div></div>`;
  }
  // 모든 화면이 같은 세 묶음으로 말하도록 한 곳에서 센다.
  const tally = rows => {
    const fail = rows.filter(s => !s.pass).length;
    const warn = rows.filter(s => s.pass && s.ruleWarnKeys.length).length;
    const ocr = rows.filter(s => s.pass && !s.ruleWarnKeys.length && s.lowKeys.length).length;
    return { n: rows.length, fail, warn, ocr, need: fail + warn + ocr, pass: rows.length - fail };
  };
  // 확인 필요 요약 한 줄. 검사 중·위치 선택·결과가 같은 문장을 쓴다.
  function needSummary(rows, o = {}) {
    const t = tally(rows);
    if (!t.n) return `<div class="needbar is-empty">${icon('info')}<span>아직 수집한 회차가 없습니다.</span></div>`;
    if (!t.need) return `<div class="needbar is-ok">${icon('check')}<span><b>${t.n}회 모두 정상</b> · 기준이 있는 ${RULED.length}개 항목이 전부 규칙 안에 있습니다.</span></div>`;
    const bit = (k, label, c, tone) => c ? `<button type="button" class="needchip ${tone}" data-filter="${k}"><i></i>${label}<b>${c}</b></button>` : '';
    return `<div class="needbar">${icon('alert')}<span class="need-l"><b>확인 필요 ${t.need}회</b><small>전체 ${t.n}회 중</small></span>
      <span class="need-r">${bit('fail', 'Fail', t.fail, 'f')}${bit('warn', '주의', t.warn, 'w')}${bit('low', 'OCR 미확인', t.ocr, 'w')}</span></div>`;
  }
  const runLegend = () => '<span class="legend"><i class="rc ok"></i>Pass<i class="rc warn"></i>주의<i class="rc low"></i>OCR 미확인<i class="rc bad"></i>Fail<i class="rc"></i>미수집</span>';

  // 확인이 필요한 회차 번호만 모아 보여준다. 번호를 누르면 그 회차가 열린다.
  function issueList(rows) {
    const fails = rows.filter(s => !s.pass), warns = rows.filter(s => s.pass && s.ruleWarnKeys.length);
    const lows = rows.filter(s => s.pass && !s.ruleWarnKeys.length && s.lowKeys.length);
    const chips = (list, tone, cap = 72) => list.length
      ? `<div class="nchips">${list.slice(0, cap).map(s => `<button type="button" class="nchip ${tone}" data-ref="${refOf(s)}" title="${esc(`${gi(s)}번 · ${s.position}·${s.mode} ${pad(s.i)}회 · ${s.t}`)}">${giPad(s)}</button>`).join('')}${list.length > cap ? `<span class="nmore">외 ${list.length - cap}회</span>` : ''}</div>`
      : '<p class="empty">없습니다.</p>';
    const sec = (key, title, desc, list, tone) => `<div class="isec">
      <div class="ihead"><span class="idot ${tone}"></span><b>${title}</b><span class="icnt${list.length ? ' c-' + tone : ''}">${list.length}회</span>
        <span class="cap">${desc}</span>${list.length ? `<button type="button" class="btn btn-sm" data-filter="${key}">이 회차만 보기</button>` : ''}</div>
      ${chips(list, tone)}</div>`;
    return `${sec('fail', '기준을 벗어남 (Fail)', '기준이 있는 13개 항목 중 하나라도 벗어난 회차', fails, 'down')}
      ${sec('warn', '주의 구간', '에러는 아니지만 기준에 가까워진 회차', warns, 'warn')}
      ${sec('low', 'OCR 미확인', '카메라가 값을 확실히 읽지 못한 회차 — 눈으로 확인이 필요합니다', lows, 'warn')}`;
  }
  // 종이에 적힌 원칙을 그대로 옮겨 놓은 표. 기준이 없는 항목은 '기록만'으로 남겨 둡니다.
  function ruleTable() {
    return `<div class="rules">${FIELDS.map(f => `<div class="rrow${f.rule ? '' : ' is-rec'}">
      <b class="rn">${f.n}</b><span class="rl">${esc(f.label)}</span>
      <span class="rv">${f.rule ? esc(ruleText(f)) : '기록만'}</span>
      ${f.rule && f.rule.note ? `<span class="rnote">${esc(f.rule.note)}</span>` : ''}</div>`).join('')}</div>`;
  }
  // 어느 항목 때문에 Fail 났는지. 100회가 넘어가면 "몇 번째 행"보다 이쪽이 먼저 필요하다.
  function failBreakdown(rows, active) {
    const n = {}; rows.forEach(s => s.failKeys.forEach(k => { n[k] = (n[k] || 0) + 1; }));
    const list = Object.entries(n).sort((a, b) => b[1] - a[1]);
    if (!list.length) return `<p class="brk-empty">${icon('check')}기준값과 다른 회차가 없습니다.</p>`;
    const max = list[0][1];
    return `<div class="brk">${list.map(([k, c]) => { const f = FIELDS.find(x => x.key === k), on = active === 'k:' + k;
      return `<button type="button" class="brk-row${on ? ' is-on' : ''}" data-filter="k:${k}" title="${f.n}. ${esc(f.label)} — 기준 ${esc(ruleText(f))} · ${c}회만 보기"><b class="brk-n2">${f.n}</b><span class="brk-k">${esc(f.label)}<small>${esc(ruleText(f))}</small></span><span class="brk-bar"><i style="width:${(c / max * 100).toFixed(1)}%"></i></span><span class="brk-n">${c}<small>회</small></span></button>`; }).join('')}</div>`;
  }
  function filterBar(rows, active) {
    const n = {
      issue: filterRows(rows, 'issue').length, fail: filterRows(rows, 'fail').length,
      warn: filterRows(rows, 'warn').length, low: filterRows(rows, 'low').length,
    };
    const chip = (v, label, c, cls) => `<button type="button" class="chip${active === v ? ' is-on' : ''}${cls ? ' ' + cls : ''}" data-filter="${v}"${!c && v !== 'all' ? ' disabled' : ''}>${label}<b>${c}</b></button>`;
    const field = active && active.startsWith('k:') ? BY_KEY[active.slice(2)] : null;
    return `<div class="chips">${chip('issue', '확인 필요', n.issue, 'c-issue')}${chip('fail', 'Fail', n.fail, 'c-fail')}${chip('low', 'OCR 미확인', n.low, 'c-warn')}${chip('all', '전체', rows.length)}
      ${field ? `<button type="button" class="chip is-on c-fail" data-filter="issue">${field.n}. ${esc(field.label)}<b>${filterRows(rows, active).length}</b><span class="x">✕</span></button>` : ''}
      ${state.q ? `<button type="button" class="chip is-on c-find" data-clear-q="1">"${esc(state.q)}"<b>${rows.length}</b><span class="x">✕</span></button>` : ''}</div>`;
  }
  const failNav = rows => failCount(rows) ? `<div class="jump"><span>Fail 이동</span><button type="button" class="ibtn" data-jump="prev" aria-label="이전 Fail로">${icon('up')}</button><button type="button" class="ibtn" data-jump="next" aria-label="다음 Fail로">${icon('down')}</button></div>` : '';

  // 회차 × 항목 매트릭스가 "어느 항목이 언제" 를 맡으므로, 표는 회차 단위 로그로 둔다.
  // 26개를 옆으로 늘어놓는 대신 어긋난 항목만 칩으로 요약하고, 나머지는 행을 눌러 상세에서 본다.
  const lowest = s => Math.min(...FIELDS.map(f => s.fields[f.key].conf));
  function table(rows, o = {}) {
    const head = `<tr><th class="c-idx">회차</th><th>시각</th><th class="judge">판정</th><th>기준을 벗어난 항목</th><th class="c-conf">최저 신뢰도</th></tr>`;
    const chip = (f, s, tone) => `<span class="fchip ${tone}"><b>${f.n}</b>${esc(f.label)}<i>${esc(s.fields[f.key].v)}${esc(f.unit || '')}</i></span>`;
    const body = rows.map((s, i) => {
      const cls = [s.pass ? '' : 'is-fail', 'is-clickable', o.newest && i === 0 ? 'is-new' : ''].filter(Boolean).join(' ');
      const low = lowest(s);
      const chips = [...s.failKeys.map(k => chip(BY_KEY[k], s, 'f')), ...s.ruleWarnKeys.map(k => chip(BY_KEY[k], s, 'w'))];
      const lowChips = s.lowKeys.filter(k => !s.failKeys.includes(k) && !s.ruleWarnKeys.includes(k))
        .map(k => `<span class="fchip l"><b>${BY_KEY[k].n}</b>${esc(BY_KEY[k].label)}<i>신뢰도 ${s.fields[k].conf}%</i></span>`);
      return `<tr class="${cls}" data-ref="${refOf(s)}" tabindex="0">
        <td class="idx"><b>${giPad(s)}</b><small>${s.position}·${esc(s.mode)} ${pad(s.i)}</small></td>
        <td class="t">${s.t}</td>
        <td class="judge"><span class="pill ${s.pass ? 'pill-pass' : 'pill-fail'}">${s.pass ? 'Pass' : 'Fail'}</span></td>
        <td class="chips-cell">${chips.length || lowChips.length ? [...chips, ...lowChips].join('') : '<span class="ok-dash">—</span>'}</td>
        <td class="c-conf${low < 80 ? ' low' : ''}">${low}%</td></tr>`;
    }).join('');
    return `<table class="tbl tbl-log"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  }
  // 표·맵 공통 배선: 필터 칩, 항목별 Fail 막대, Fail 칸/행 클릭, Fail 이동 버튼
  function wireList(rows) {
    app.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => { state.filter = b.dataset.filter; state.jumpTo = null; render(); }));
    app.querySelectorAll('[data-clear-q]').forEach(b => b.addEventListener('click', () => { state.q = ''; state.jumpTo = null; render(); }));
    app.querySelectorAll('[data-ref]').forEach(el => {
      const go = () => { const s = findSample(el.dataset.ref); if (s) openFail(s, el.dataset.key); };
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
  const groups = () => state.positions.flatMap(p => MODES.map(m => ({ id: `${p.id}-${m}`, label: `위치 ${p.id} · ${m}`, pos: p.id, mode: m, rows: p[m] })));
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
          <div class="box-head"><h3>${icon('grid')}1 – ${TARGET * 6} 회차 맵<small>${isAll ? '전체' : esc(cur.label)}</small></h3>${runLegend()}</div>
          ${runMap(isAll ? all : all.filter(g => g.id === cur.id), { hi: hiSet })}
        </div>
      </section>
      <section class="board board-1"><div class="card pad"><div class="box-head"><h3>${icon('alert')}확인이 필요한 회차</h3><span class="cap">번호를 누르면 그 회차의 당시 화면이 열립니다</span></div>
        <div class="need-wrap">${needSummary(cur.rows)}</div>${issueList(cur.rows)}</div></section>
      <section class="board board-2"><div class="card pad"><div class="box-head"><h3>${icon('spark')}항목별 Fail</h3><span class="cap">누르면 그 항목만</span></div>${failBreakdown(base, 'all')}</div>${recentFails(flat, 6)}</section>
      <section class="card log">
        <div class="log-head"><h2>${esc(cur.label)}<span class="sub">${shown.length}행 표시${shown.length !== cur.rows.length ? ` · 전체 ${cur.rows.length}행` : ''}</span></h2>
          <span class="upload-state${state.uploaded ? ' ok' : ''}">${state.uploaded ? `${icon('check')}업로드 완료 · ${state.uploaded}` : `${icon('info')}아직 업로드하지 않았습니다`}</span></div>
        <div class="tbl-wrap tall">${shown.length ? table(shown, { showGroup: isAll, mode: isAll ? null : cur.id.split('-')[1] }) : `<div class="tbl-empty">${icon('table')}<p>${cur.rows.length ? '이 조건에 해당하는 회차가 없습니다.' : '이 위치·모드는 수집 기록이 없습니다.'}</p></div>`}</div>
      </section>
      <section class="board board-2">${groupPanel()}<div class="card pad"><div class="box-head"><h3>${icon('list')}판정 기준</h3><span class="cap">서비스모드 ${FIELDS.length}개 중 ${RULED.length}개</span></div>${ruleTable()}</div></section>`;
    app.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { state.resultsTab = b.dataset.tab; state.filter = 'issue'; state.jumpTo = null; render(); }));
    bind('positions', goPositions);
    bind('excel', () => exportCsv(flat, `${state.serial}_results`));
    wireList(shown);
  }
  function doUpload(btn) {
    btn.disabled = true; btn.textContent = '업로드 중…';
    setTimeout(() => { state.uploaded = hms(new Date()); toast('결과를 서버에 업로드했습니다'); render(); }, 1200);
  }

  // Fail 당시 화면
  function openFail(s, focusKey) {
    if (!s) return;
    const bad = s.failKeys.map(k => BY_KEY[k]), warn = s.ruleWarnKeys.map(k => BY_KEY[k]);
    const row = x => {
      const d = s.fields[x.key], v = verdict(x, s.fields), low = d.conf < 80;
      const cls = [v === 'fail' ? 'bad' : v === 'warn' ? 'mid' : '', x.key === focusKey ? 'focus' : ''].filter(Boolean).join(' ');
      return `<tr class="${cls}" ${x.key === focusKey ? 'id="cmp-focus"' : ''}><td class="cn">${x.n}</td><td>${esc(x.label)}</td>
        <td class="v">${esc(d.v)}${x.unit ? `<small>${esc(x.unit)}</small>` : ''}</td>
        <td class="exp">${esc(ruleText(x))}</td><td class="exp${low ? ' low' : ''}">${d.conf}%</td></tr>`;
    };
    const head = bad.length
      ? `<h2 id="fail-title"><span class="pill pill-fail">Fail</span><span class="gno">${giPad(s)}번</span>위치 ${s.position} · ${esc(s.mode)} · ${pad(s.i)}회</h2>
         <ul class="why">${bad.map(f => `<li><b>${f.n}. ${esc(f.label)}</b><span>${esc(reason(f, s.fields))}</span></li>`).join('')}${warn.map(f => `<li class="w"><b>${f.n}. ${esc(f.label)}</b><span>${esc(reason(f, s.fields))}</span></li>`).join('')}</ul>`
      : `<h2 id="fail-title"><span class="pill pill-pass">Pass</span><span class="gno">${giPad(s)}번</span>위치 ${s.position} · ${esc(s.mode)} · ${pad(s.i)}회</h2>
         <p class="sub">기준이 있는 ${RULED.length}개 항목이 모두 규칙 안에 있습니다.</p>`;
    document.getElementById('fail-body').innerHTML = `<div class="fail-view">
      <div class="fail-frame">${viewport(s, { frozen: true, showRoi: true, position: s.position, mode: s.mode })}
        <div class="meta"><span>${giPad(s)}번 · FRAME #${pad(s.i)} · ${s.t}</span><span>POS ${s.position} · ${esc(s.mode)} · S/N ${esc(state.serial)}</span></div></div>
      <div class="fail-side">${head}
        <div class="cmp-wrap"><table class="cmp"><thead><tr><th class="cn">#</th><th>항목</th><th>읽은 값</th><th>기준</th><th>신뢰도</th></tr></thead>
          <tbody>${FIELDS.map(row).join('')}</tbody></table></div>
        <div class="dlg-actions"><button type="button" class="btn" data-dlg="close">닫기</button></div></div></div>`;
    failDlg.querySelector('[data-dlg="close"]').addEventListener('click', () => failDlg.close());
    failDlg.showModal();
    const f = document.getElementById('cmp-focus'); if (f) f.scrollIntoView({ block: 'center' });
  }

  let confirmAction = null;
  function openConfirm({ title, desc, cancel, ok, action, danger }) {
    document.getElementById('confirm-title').textContent = title; document.getElementById('confirm-desc').innerHTML = desc;
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
  document.getElementById('btn-reset').addEventListener('click', () => { stopTimer(); Object.assign(state, { serial: '', selected: null, position: 1, mode: 'MP', status: 'idle', positions: freshPositions(), resultsTab: null, uploaded: null, last: null, screen: 'serial', filter: 'issue', jumpTo: null, q: '' }); render(); });
  const q = new URLSearchParams(location.search);
  if (q.get('preview') === '1') document.body.classList.add('preview');
  if (q.get('screen') && SCREENS.some(s => s[0] === q.get('screen'))) loadFixture(q.get('screen')); else render();
})();
