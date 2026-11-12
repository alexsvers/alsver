/* Cardinal Gaze — screens, examination tools, quiz and progress. */
(function () {
  'use strict';
  var CG = window.CG, E = CG.engine, C = CG.conditions, V = CG.viz;
  var clamp = E.clamp;
  var ZERO = { yaw: 0, pitch: 0, roll: 0 };

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function pressed(el, on) { (typeof el === 'string' ? $(el) : el).setAttribute('aria-pressed', on ? 'true' : 'false'); }

  /* ---------- per-viewer storage (progress and display options) ---------- */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('cg.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('cg.' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  function freshStats() { return { cases: 0, points: 0, max: 0, right: 0, streak: 0, best: 0, per: {} }; }
  var stats = Object.assign(freshStats(), store.get('stats', null) || {});
  var opts = Object.assign({ seeThrough: true, labels: false }, store.get('opts', null) || {});

  /* ---------- theme colour for the canvas backdrop ---------- */
  var stageBg = '#C7D5D9';
  function readTheme() {
    var v = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim();
    if (v) stageBg = v;
  }
  readTheme();
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTheme);
    new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  } catch (e) { /* older browsers keep the first reading */ }

  /* ---------- state ---------- */
  var state = {
    screen: 'home', mode: null, cond: null, side: 'R', cfg: null, sim: null, frame: null,
    tab: 'info', quiz: null,
    input: { tx: 0, ty: 0, dist: 600, cover: null, lids: false },
    headSel: { tilt: 0, doll: false, dollYaw: 0, dollPitch: 0, habitual: false },
    baseA: { yaw: 0, pitch: 0, roll: 0 }, dollA: { yaw: 0, pitch: 0 },
    coverAnim: { R: 0, L: 0 }, lastCase: null
  };

  var stage = $('#stage');
  var face = new CG.Face(stage);
  var diplo = new V.DiploView($('#diplo'));
  var hero = { face: new CG.Face($('#heroCanvas')), sim: new E.Sim(C.byId.normal.build('R')), tx: 0, ty: 0, moved: -1e9 };
  hero.face.setLook(CG.looks[4]);
  var reduceMotion = false;
  try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* default */ }

  function show(name) {
    state.screen = name;
    $$('.screen').forEach(function (el) { el.hidden = el.id !== name; });
    if (name === 'home') { updateHome(); hero.face.resize(); }
    if (name === 'progress') renderProgress();
    if (name === 'exam') face.resize();
  }

  /* ---------- home ---------- */
  function updateHome() {
    var s = stats;
    $('#homeStats').textContent = s.cases
      ? s.cases + (s.cases === 1 ? ' case, ' : ' cases, ') + Math.round(100 * s.right / s.cases) + '% correct, streak ' + s.streak
      : 'No cases yet';
  }
  $('#home').addEventListener('pointermove', function (ev) {
    var r = hero.face.canvas.getBoundingClientRect();
    var a = hero.face.screenToAngle(ev.clientX - r.left, ev.clientY - r.top);
    hero.tx = a.tx; hero.ty = a.ty; hero.moved = performance.now();
  });
  function heroFrame(dt, now) {
    var tx = hero.tx, ty = hero.ty;
    if (now - hero.moved > 2500) {
      if (reduceMotion) { tx = 0; ty = 0; }
      else { var t = now / 1000; tx = 24 * Math.sin(t * 0.55); ty = 11 * Math.sin(t * 0.83 + 1); }
    }
    var f = hero.sim.step(dt, { tx: tx, ty: ty, dist: 600, yaw: 0, pitch: 0, roll: 0, cover: null, lidsLifted: false });
    hero.face.draw(f, { bg: stageBg, head: ZERO, light: { x: f.sol.ox, y: f.sol.oy }, target: { show: false }, guide: { show: false } });
  }

  /* ---------- condition picker ---------- */
  function conditionGrid(attr, withShort) {
    var h = '';
    C.groups.forEach(function (g) {
      h += '<p class="group-title">' + esc(g.name) + '</p><div class="cond-grid">';
      C.list.forEach(function (c) {
        if (c.group !== g.id) return;
        h += '<button class="cond" ' + attr + '="' + c.id + '"><b>' + esc(c.name) + '</b>' +
             (withShort ? '<small>' + esc(c.short) + '</small>' : '') + '</button>';
      });
      h += '</div>';
    });
    return h;
  }
  $('#pickerBody').innerHTML = conditionGrid('data-cond', true);
  $('#pickerBody').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-cond]');
    if (!b) return;
    state.quiz = null;
    startExam('textbook', C.byId[b.dataset.cond], 'R', CG.looks[Math.floor(Math.random() * CG.looks.length)]);
  });

  /* ---------- starting an examination ---------- */
  function hasPosture(cfg) { var p = cfg.posture; return !!(p.yaw || p.pitch || p.roll); }
  function postureText(p) {
    var a = [];
    if (Math.abs(p.yaw) >= 4) a.push('face turned to the ' + (p.yaw > 0 ? 'right' : 'left'));
    if (Math.abs(p.roll) >= 4) a.push('head tilted to the ' + (p.roll > 0 ? 'right' : 'left'));
    if (Math.abs(p.pitch) >= 4) a.push(p.pitch > 0 ? 'chin up' : 'chin down');
    return a.join(', ');
  }

  function loadPatient(cond, side) {
    state.cond = cond; state.side = side;
    state.cfg = cond.build(side);
    state.sim = new E.Sim(state.cfg);
    var hp = hasPosture(state.cfg), p = state.cfg.posture;
    state.input = { tx: 0, ty: 0, dist: 600, cover: null, lids: false };
    state.headSel = { tilt: 0, doll: false, dollYaw: 0, dollPitch: 0, habitual: hp };
    state.baseA = hp ? { yaw: p.yaw, pitch: p.pitch, roll: p.roll } : { yaw: 0, pitch: 0, roll: 0 };
    state.dollA = { yaw: 0, pitch: 0 };
    state.coverAnim = { R: 0, L: 0 };
    $('#distRange').value = 0;
    $('#subHead').hidden = true; $('#subNear').hidden = true;
  }

  function startExam(mode, cond, side, look) {
    state.mode = mode;
    loadPatient(cond, side);
    face.setLook(look);
    $('#sheet').hidden = true;
    $('#exam').classList.remove('panel-open');
    show('exam');
    setTab('info', false);
    updateChrome();
  }

  /* ---------- examination chrome ---------- */
  function fmtDist(d) { return d >= 100 ? (Math.round(d / 10) / 10) + ' m' : Math.round(d) + ' cm'; }
  function distFromSlider(v) { return 600 * Math.pow(5 / 600, v / 100); }
  function sliderFromDist(d) { return 100 * Math.log(d / 600) / Math.log(5 / 600); }

  function updateChrome() {
    var hs = state.headSel, inp = state.input, cfg = state.cfg, q = state.quiz;
    var reveal = state.mode === 'textbook' || (q && q.done);
    $('#examTitle').textContent = reveal ? state.cond.name : 'Patient ' + q.n;
    $('#tabInfo').textContent = reveal ? 'Findings' : 'Diagnose';
    pressed('#btnCoverR', inp.cover === 'R');
    pressed('#btnCoverL', inp.cover === 'L');
    pressed('#btnLids', inp.lids);
    pressed('#btnHead', !$('#subHead').hidden || hs.tilt !== 0 || hs.doll);
    pressed('#btnNear', !$('#subNear').hidden || inp.dist < 500);
    $$('#subHead .seg').forEach(function (b) {
      var k = b.dataset.head;
      pressed(b, k === 'tiltR' ? hs.tilt === 1 : k === 'tiltL' ? hs.tilt === -1 : k === 'doll' ? hs.doll :
        k === 'habit' ? hs.habitual : (!hs.tilt && !hs.habitual && !hs.dollYaw && !hs.dollPitch));
    });
    $('#segHabit').hidden = !hasPosture(cfg);
    $$('#subNear .seg').forEach(function (b) { pressed(b, Math.abs(inp.dist - Number(b.dataset.dist)) < 1); });
    $('#distOut').textContent = fmtDist(inp.dist);

    var chips = [];
    if (hs.habitual && hasPosture(cfg)) chips.push('Habitual posture: ' + postureText(cfg.posture));
    if (hs.tilt) chips.push('Head tilted to the ' + (hs.tilt > 0 ? 'right' : 'left') + ' shoulder');
    if (hs.doll) {
      var dy = Math.round(hs.dollYaw), dp = Math.round(hs.dollPitch), turn = [];
      if (Math.abs(dy) >= 3) turn.push('turned ' + (dy > 0 ? 'right ' : 'left ') + Math.abs(dy) + '°');
      if (Math.abs(dp) >= 3) turn.push('chin ' + (dp > 0 ? 'up ' : 'down ') + Math.abs(dp) + '°');
      chips.push('Doll’s head: ' + (turn.length ? turn.join(', ') : 'drag to turn the head'));
    }
    if (inp.dist < 500) chips.push('Target at ' + fmtDist(inp.dist));
    if (inp.lids) chips.push('Lids lifted');
    $('#chips').innerHTML = chips.map(function (c) { return '<span class="chip">' + esc(c) + '</span>'; }).join('');
  }

  function setTab(tab, open) {
    state.tab = tab;
    if (open) $('#exam').classList.add('panel-open');
    $$('.tabs [role="tab"]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'); });
    $('#paneInfo').hidden = tab !== 'info';
    $('#paneView').hidden = tab !== 'view';
    $('#paneHess').hidden = tab !== 'hess';
    if (tab === 'info') renderInfo();
    if (tab === 'hess') renderHess();
    face.resize();
  }
  $$('.tabs [role="tab"]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab, false); }); });
  $$('.top-tab').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab, true); }); });
  $('#panelClose').addEventListener('click', function () { $('#exam').classList.remove('panel-open'); face.resize(); });
  $('#btnClose').addEventListener('click', function () { show(state.mode === 'textbook' ? 'picker' : 'home'); });

  /* ---------- tools ---------- */
  function toggleCover(k) { state.input.cover = state.input.cover === k ? null : k; updateChrome(); }
  $('#btnCoverR').addEventListener('click', function () { toggleCover('R'); });
  $('#btnCoverL').addEventListener('click', function () { toggleCover('L'); });
  $('#btnLids').addEventListener('click', function () { state.input.lids = !state.input.lids; updateChrome(); });
  $('#btnHead').addEventListener('click', function () {
    $('#subHead').hidden = !$('#subHead').hidden; $('#subNear').hidden = true; updateChrome();
  });
  $('#btnNear').addEventListener('click', function () {
    $('#subNear').hidden = !$('#subNear').hidden; $('#subHead').hidden = true; updateChrome();
  });
  $('#subHead').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-head]');
    if (!b) return;
    var hs = state.headSel, k = b.dataset.head;
    if (k === 'tiltR' || k === 'tiltL') {
      var want = k === 'tiltR' ? 1 : -1;
      hs.tilt = hs.tilt === want ? 0 : want;
      hs.habitual = false;
    } else if (k === 'straight') {
      hs.tilt = 0; hs.habitual = false; hs.dollYaw = 0; hs.dollPitch = 0;
    } else if (k === 'doll') {
      hs.doll = !hs.doll; hs.dollYaw = 0; hs.dollPitch = 0;
      if (hs.doll) { hs.habitual = false; state.input.tx = 0; state.input.ty = 0; }
    } else if (k === 'habit') {
      hs.habitual = true; hs.tilt = 0; hs.doll = false; hs.dollYaw = 0; hs.dollPitch = 0;
    }
    updateChrome();
  });
  $('#subNear').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-dist]');
    if (!b) return;
    state.input.dist = Number(b.dataset.dist);
    $('#distRange').value = Math.round(sliderFromDist(state.input.dist));
    updateChrome();
  });
  $('#distRange').addEventListener('input', function () {
    state.input.dist = distFromSlider(Number(this.value));
    updateChrome();
  });

  // The fixation light: drag for pursuit, tap elsewhere for a saccade. In doll's head mode a drag turns the head.
  var drag = null;
  function stagePoint(ev) { var r = stage.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
  function setTarget(pt) { var a = face.screenToAngle(pt.x, pt.y); state.input.tx = a.tx; state.input.ty = a.ty; }
  stage.addEventListener('pointerdown', function (ev) {
    if (ev.button > 0 || !state.sim) return;
    try { stage.setPointerCapture(ev.pointerId); } catch (e) { /* not capturable */ }
    var pt = stagePoint(ev);
    drag = { id: ev.pointerId, x0: pt.x, y0: pt.y, yaw0: state.headSel.dollYaw, pitch0: state.headSel.dollPitch };
    if (!state.headSel.doll) setTarget(pt);
    ev.preventDefault();
  });
  stage.addEventListener('pointermove', function (ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    var pt = stagePoint(ev), hs = state.headSel;
    if (hs.doll) {
      hs.dollYaw = clamp(drag.yaw0 - (pt.x - drag.x0) * 0.3, -32, 32);
      hs.dollPitch = clamp(drag.pitch0 - (pt.y - drag.y0) * 0.3, -25, 25);
    } else setTarget(pt);
  });
  function endDrag(ev) {
    if (!drag || ev.pointerId !== drag.id) return;
    drag = null;
    if (state.headSel.doll) { updateChrome(); return; }
    var inp = state.input, best = null, bd = 5.5;
    CG.yokes.forEach(function (y) {
      var d = Math.abs(y.tx - inp.tx) + Math.abs(y.ty - inp.ty);
      if (d < bd) { bd = d; best = y; }
    });
    if (best) { inp.tx = best.tx; inp.ty = best.ty; }
  }
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  document.addEventListener('keydown', function (ev) {
    if (state.screen !== 'exam' || !$('#sheet').hidden || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    var d = { ArrowLeft: [5, 0], ArrowRight: [-5, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] }[ev.key];
    if (!d) return;
    state.input.tx = clamp(state.input.tx + d[0], -40, 40);
    state.input.ty = clamp(state.input.ty + d[1], -32, 32);
    ev.preventDefault();
  });

  /* ---------- panel: findings / diagnose ---------- */
  function textbookHTML(c, side, pickSide) {
    function f(t) { return esc(C.fill(t, side)); }
    var h = '';
    if (pickSide && c.sided) {
      h += '<div class="sidepick" role="group" aria-label="Affected side">' +
        '<button data-side="R" aria-pressed="' + (side === 'R') + '">Right side</button>' +
        '<button data-side="L" aria-pressed="' + (side === 'L') + '">Left side</button></div>';
    }
    h += '<h3>' + esc(c.name) + '</h3>';
    h += '<p class="summary">' + f(c.summary) + '</p>';
    h += '<p class="label">What to find</p><ul class="findings">' +
      c.signs.map(function (s) { return '<li>' + f(s) + '</li>'; }).join('') + '</ul>';
    h += '<p class="label">Where and why</p><p>' + f(c.localise) + '</p>';
    h += '<p class="label">Do not confuse with</p><p>' + f(c.pitfall) + '</p>';
    return h;
  }

  var SIDE_NAME = { R: 'Right', L: 'Left', B: 'Both sides, or not lateralised' };

  function resultHTML(q) {
    var c = state.cond, r = q.result;
    function row(ok, main, yours) {
      return '<div><span class="tick ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓' : '✕') + '</span><dd>' + esc(main) +
        (ok ? '' : '<small>You answered: ' + esc(yours) + '</small>') + '</dd></div>';
    }
    var sideTruth = SIDE_NAME[r.sideTruth] + (c.sided && c.sideNote ? ' (' + c.sideNote + ')' : '');
    var h = '<div class="result">';
    h += '<div class="score"><b>' + r.score + '</b><span>of 5 points' + (stats.streak > 1 ? ' · streak ' + stats.streak : '') + '</span></div>';
    h += '<dl class="marks">';
    h += row(r.dxOk, c.name, C.byId[q.dx].name);
    h += row(r.sideOk, sideTruth, SIDE_NAME[q.side]);
    h += row(r.siteOk, C.sites[c.site], C.sites[q.site]);
    h += '</dl>';
    if (q.hess) h += '<p class="note">Hess chart opened before answering: 1 point deducted.</p>';
    h += '<div class="btn-row"><button class="btn" data-act="next">Next patient</button></div>';
    h += '<p class="note">The patient is still here. Go back over the signs below.</p>';
    h += '</div>';
    return h;
  }

  function renderInfo() {
    var el = $('#paneInfo'), c = state.cond, q = state.quiz;
    if (state.mode === 'textbook') el.innerHTML = textbookHTML(c, state.side, true);
    else if (q.done) el.innerHTML = resultHTML(q) + textbookHTML(c, state.side, false);
    else {
      el.innerHTML = '<div class="history"><p class="label">History</p><p>' + esc(c.history) + '</p></div>' +
        '<p class="muted">Examine first: reflexes, cover test, nine positions, then whatever the findings call for. ' +
        'When you are ready, commit to a diagnosis, a side and a site.</p>' +
        '<div class="btn-row"><button class="btn" data-act="answer">Make the diagnosis</button></div>';
    }
    el.scrollTop = 0;
  }
  $('#paneInfo').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-side],[data-act]');
    if (!b) return;
    if (b.dataset.side) {
      if (b.dataset.side === state.side) return;
      loadPatient(state.cond, b.dataset.side);
      updateChrome(); renderInfo();
    } else if (b.dataset.act === 'answer') openSheet();
    else if (b.dataset.act === 'next') newCase();
  });

  function renderHess() {
    var el = $('#paneHess'), q = state.quiz;
    if (state.mode === 'diagnose' && !q.done && !q.hess) {
      el.innerHTML = '<div class="locked"><p><b>The Hess chart is a strong hint.</b></p>' +
        '<p class="muted">Opening it before you answer costs 1 of the 5 points for this patient.</p>' +
        '<button class="btn small" data-act="hess">Show the Hess chart</button></div>';
      return;
    }
    el.innerHTML = V.hessSVG(state.cfg) +
      '<p class="note">Each field is plotted with the other eye fixing and the eyes dissociated. ' +
      'A field that is squeezed in one direction marks the limited muscle; the matching bulge in the other field is its overacting yoke.</p>';
  }
  $('#paneHess').addEventListener('click', function (ev) {
    if (!ev.target.closest('[data-act="hess"]')) return;
    state.quiz.hess = true;
    renderHess();
  });

  var viewTick = 0;
  function updateView(frame, now) {
    var st = diplo.update(frame, state.cfg);
    if (now - viewTick < 120) return;
    viewTick = now;
    var d = V.describe(frame.sol), msg;
    if (st === 'mono') {
      var e = frame.eyes;
      if (!e.R.seeing && !e.L.seeing) msg = 'Neither eye sees the target';
      else {
        var k = e.R.seeing ? 'L' : 'R';
        msg = (k === 'R' ? 'Right' : 'Left') + ' eye ' + (state.input.cover === k ? 'covered' : 'behind its lid') + ': one image';
      }
    } else if (st === 'single') msg = 'Single vision';
    else if (st === 'suppress') msg = 'Misaligned, but one image is suppressed: no diplopia';
    else {
      var bits = [];
      if (d.hKind) bits.push(d.hKind === 'eso' ? 'uncrossed' : 'crossed');
      if (d.vKind) bits.push((d.vKind === 'R' ? 'right' : 'left') + ' eye’s image lower');
      msg = 'Double vision' + (bits.length ? ': ' + bits.join(', ') : '');
    }
    $('#dState').textContent = msg;
    $('#roH').textContent = d.h; $('#roV').textContent = d.v; $('#roT').textContent = d.t;
  }

  $('#optSee').checked = opts.seeThrough;
  $('#optLabels').checked = opts.labels;
  $('#optSee').addEventListener('change', function () { opts.seeThrough = this.checked; store.set('opts', opts); });
  $('#optLabels').addEventListener('change', function () { opts.labels = this.checked; store.set('opts', opts); });

  /* ---------- diagnose ---------- */
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pickCase() {
    var pool = C.list.filter(function (c) { return c.id !== state.lastCase; });
    var weights = pool.map(function (c) {
      var p = stats.per[c.id];
      if (!p || !p.seen) return 3;
      return 1 + 2.5 * (1 - p.right / p.seen);
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * total;
    for (var i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  }
  function newCase() {
    var c = pickCase();
    state.lastCase = c.id;
    var others = shuffle(Object.keys(C.sites).filter(function (k) { return k !== c.site; })).slice(0, 3);
    state.quiz = { n: stats.cases + 1, done: false, step: 0, dx: null, side: null, site: null, hess: false,
      siteOpts: shuffle(others.concat([c.site])), result: null };
    startExam('diagnose', c, c.sided ? (Math.random() < 0.5 ? 'R' : 'L') : 'R',
      CG.looks[Math.floor(Math.random() * CG.looks.length)]);
  }

  function openSheet() { state.quiz.step = 0; renderSheet(); $('#sheet').hidden = false; }
  function renderSheet() {
    var q = state.quiz, h = '';
    $('#sheetSteps').textContent = (q.step + 1) + ' of 3';
    if (q.step === 0) {
      $('#sheetTitle').textContent = 'Your diagnosis';
      h = conditionGrid('data-dx', false);
    } else if (q.step === 1) {
      $('#sheetTitle').textContent = 'Side';
      h = '<p class="q">Which side is affected?</p>' +
        '<p class="muted">Give the affected eye. For a brainstem lesion give the side of the lesion; for a skew deviation, the higher eye.</p>' +
        '<div class="opt-list">' + ['R', 'L', 'B'].map(function (k) {
          return '<button class="opt" data-qside="' + k + '">' + SIDE_NAME[k] + '</button>';
        }).join('') + '</div>';
    } else {
      $('#sheetTitle').textContent = 'Site';
      h = '<p class="q">Where is the problem?</p><p class="muted">Pick the structure that explains the findings.</p>' +
        '<div class="opt-list">' + q.siteOpts.map(function (k) {
          return '<button class="opt" data-site="' + k + '">' + esc(C.sites[k]) + '</button>';
        }).join('') + '</div>';
    }
    if (q.step > 0) h += '<button class="backlink" data-back="1">Back one step</button>';
    $('#sheetBody').innerHTML = h;
    $('#sheetBody').scrollTop = 0;
    if (q.dx && q.step === 0) { var b = $('[data-dx="' + q.dx + '"]', $('#sheetBody')); if (b) pressed(b, true); }
  }
  $('#sheetBody').addEventListener('click', function (ev) {
    var q = state.quiz, b = ev.target.closest('[data-dx],[data-qside],[data-site],[data-back]');
    if (!b) return;
    if (b.dataset.back) q.step--;
    else if (b.dataset.dx) { q.dx = b.dataset.dx; q.step = 1; }
    else if (b.dataset.qside) { q.side = b.dataset.qside; q.step = 2; }
    else if (b.dataset.site) { q.site = b.dataset.site; finishCase(); return; }
    renderSheet();
  });
  $('#sheetClose').addEventListener('click', function () { $('#sheet').hidden = true; });

  function finishCase() {
    var q = state.quiz, c = state.cond;
    var sideTruth = c.sided ? state.side : 'B';
    var r = { dxOk: q.dx === c.id, sideOk: q.side === sideTruth || q.side === c.sideAlso, siteOk: q.site === c.site, sideTruth: sideTruth };
    r.score = Math.max(0, (r.dxOk ? 3 : 0) + (r.sideOk ? 1 : 0) + (r.siteOk ? 1 : 0) - (q.hess ? 1 : 0));
    q.result = r; q.done = true;
    stats.cases++; stats.points += r.score; stats.max += 5;
    if (r.dxOk) { stats.right++; stats.streak++; stats.best = Math.max(stats.best, stats.streak); }
    else stats.streak = 0;
    var p = stats.per[c.id] || (stats.per[c.id] = { seen: 0, right: 0 });
    p.seen++; if (r.dxOk) p.right++;
    store.set('stats', stats);
    $('#sheet').hidden = true;
    updateChrome();
    setTab('info', true);
  }

  /* ---------- progress ---------- */
  function renderProgress() {
    var s = stats, h = '';
    h += '<div class="tiles">' +
      '<div class="tile"><b>' + s.cases + '</b><span>cases examined</span></div>' +
      '<div class="tile"><b>' + (s.cases ? Math.round(100 * s.right / s.cases) + '%' : '–') + '</b><span>diagnoses correct</span></div>' +
      '<div class="tile"><b>' + s.points + '<small> / ' + s.max + '</small></b><span>points</span></div>' +
      '<div class="tile"><b>' + s.streak + '</b><span>current streak, best ' + s.best + '</span></div></div>';
    if (!s.cases) h += '<p class="empty">Nothing yet. Every patient you finish in Diagnose is counted here, and the conditions you miss come up more often.</p>';
    var rows = C.list.map(function (c) { var p = s.per[c.id] || { seen: 0, right: 0 }; return { c: c, seen: p.seen, right: p.right }; });
    rows.sort(function (a, b) {
      if (!a.seen !== !b.seen) return a.seen ? -1 : 1;
      if (!a.seen) return 0;
      return a.right / a.seen - b.right / b.seen;
    });
    h += '<p class="group-title">By condition, weakest first</p><div class="ptable">';
    rows.forEach(function (r) {
      var pct = r.seen ? Math.round(100 * r.right / r.seen) : 0;
      h += '<div class="prow' + (r.seen ? '' : ' unseen') + '"><span>' + esc(r.c.name) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="display:block;width:' + pct + '%"></span></span>' +
        '<span class="num">' + (r.seen ? r.right + ' / ' + r.seen : 'not seen') + '</span></div>';
    });
    h += '</div>';
    if (s.cases) h += '<div class="confirm" id="resetBox"><button class="btn ghost small" data-act="reset">Reset progress</button></div>';
    $('#progressBody').innerHTML = h;
  }
  $('#progressBody').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'reset') {
      $('#resetBox').innerHTML = '<span>Erase all progress on this device?</span>' +
        '<button class="btn small" data-act="erase">Erase</button><button class="btn ghost small" data-act="keep">Keep</button>';
    } else if (b.dataset.act === 'erase') {
      stats = freshStats(); store.set('stats', stats); renderProgress();
    } else if (b.dataset.act === 'keep') renderProgress();
  });

  /* ---------- navigation ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-go]');
    if (!b) return;
    var go = b.dataset.go;
    if (go === 'textbook') show('picker');
    else if (go === 'diagnose') newCase();
    else show(go);
  });

  /* ---------- frame loop ---------- */
  var last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;
    if (document.hidden) return;
    if (state.screen === 'home') { heroFrame(dt, now); return; }
    if (state.screen !== 'exam' || !state.sim) return;

    var hs = state.headSel, inp = state.input, p = state.cfg.posture;
    var base = hs.habitual ? p : ZERO;
    var bt = { yaw: base.yaw, pitch: base.pitch, roll: hs.tilt ? hs.tilt * 30 : base.roll };
    var rb = Math.min(1, dt * 7), rd = Math.min(1, dt * 16);
    state.baseA.yaw += (bt.yaw - state.baseA.yaw) * rb;
    state.baseA.pitch += (bt.pitch - state.baseA.pitch) * rb;
    state.baseA.roll += (bt.roll - state.baseA.roll) * rb;
    state.dollA.yaw += (hs.dollYaw - state.dollA.yaw) * rd;
    state.dollA.pitch += (hs.dollPitch - state.dollA.pitch) * rd;
    var head = { yaw: state.baseA.yaw + state.dollA.yaw, pitch: state.baseA.pitch + state.dollA.pitch, roll: state.baseA.roll };

    var frame = state.sim.step(dt, {
      tx: inp.tx, ty: inp.ty, dist: inp.dist, yaw: head.yaw, pitch: head.pitch, roll: head.roll,
      vorX: -state.dollA.yaw, vorY: -state.dollA.pitch, cover: inp.cover, lidsLifted: inp.lids
    });
    state.frame = frame;
    ['R', 'L'].forEach(function (k) {
      var want = inp.cover === k ? 1 : 0;
      state.coverAnim[k] += clamp(want - state.coverAnim[k], -dt * 6, dt * 6);
    });
    face.draw(frame, {
      bg: stageBg, head: head, light: { x: frame.sol.ox, y: frame.sol.oy },
      cover: state.coverAnim, seeThrough: opts.seeThrough,
      target: { show: true, tx: inp.tx, ty: inp.ty, near: clamp(sliderFromDist(inp.dist) / 100, 0, 1) },
      guide: { show: true, labels: opts.labels }
    });
    if (state.tab === 'view' && !$('#paneView').hidden) updateView(frame, now);
  }

  try {
    var ro = new ResizeObserver(function () { face.resize(); hero.face.resize(); });
    ro.observe(stage); ro.observe(hero.face.canvas);
  } catch (e) {
    window.addEventListener('resize', function () { face.resize(); hero.face.resize(); });
  }

  show('home');
  requestAnimationFrame(tick);

  // test hook
  CG.app = { state: state, startExam: startExam, newCase: newCase, show: show, setTab: setTab };
})();
