/* Cardinal Gaze — ocular motility model. Pure functions, no DOM.

   Angles are degrees in patient coordinates: x > 0 is toward the patient's right, y > 0 is up.
   Per eye, `a` is abduction (+) / adduction (−), `e` is elevation, `t` is excyclotorsion (+).

   The model has three levels, so that the bedside manoeuvres separate them the way they do in clinic:
     1. supranuclear  — scales voluntary gaze only; the vestibulo-ocular reflex bypasses it
     2. nuclear / internuclear — scales conjugate commands (voluntary + VOR), not vergence
     3. plant — six muscles per eye with reciprocal innervation, plus elastic mechanical limits
   The fixing eye sets the innervation (Hering's law); the other eye receives the same command. */
(function (root) {
  'use strict';
  var CG = (root.CG = root.CG || {});
  var DEG = Math.PI / 180;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var K = {
    TONE_H: 15,          // resting horizontal tone, in degrees of rotation it holds
    TONE_V: 15,
    EFFORT_H: 60,        // largest gaze command the patient can generate
    EFFORT_V: 50,
    RANGE: { ab: 48, ad: 50, up: 40, down: 50 },
    OBLIQUE_H: 0.2,      // abducting action of the obliques
    RECTUS_H: 0.2,       // adducting action of the vertical recti (balances the obliques)
    TILT: 4.5,           // vertical effect (deg) of a full head tilt through an unbalanced torsional pair
    IPD_CM: 6.2
  };

  // Reciprocal innervation. agonist(c) − agonist(−c) === c, both stay positive,
  // and the antagonist relaxes exponentially as the eye is driven into the agonist's field.
  function agonist(cmd, tone) {
    return cmd > 0 ? cmd + tone * Math.exp(-cmd / tone) : tone * Math.exp(cmd / tone);
  }

  function makeEye(o) {
    o = o || {};
    return {
      s: Object.assign({ LR: 1, MR: 1, SR: 1, IR: 1, SO: 1, IO: 1 }, o.s),
      fatigable: o.fatigable || null,
      ino: o.ino == null ? null : o.ino,
      vergGain: o.vergGain == null ? 1 : o.vergGain,
      vOffset: o.vOffset || 0,
      tOffset: o.tOffset || 0,
      limits: o.limits || null,
      shoot: o.shoot || 0,
      retract: o.retract || 0,
      lid: Object.assign({ ptosis: 0, fatigue: 0, retraction: 0, lower: 0, lag: 0 }, o.lid),
      browLift: o.browLift || 0,
      pupil: o.pupil || 3.8,
      pupilFixed: !!o.pupilFixed,
      globe: o.globe || 'normal',
      bruise: !!o.bruise,
      vmax: Object.assign({ ab: 520, ad: 520, up: 480, down: 480 }, o.vmax)
    };
  }

  function makeConfig(o) {
    o = o || {};
    return {
      eyes: { R: makeEye(o.R), L: makeEye(o.L) },
      fixPref: o.fixPref || 'alt',
      fusion: Object.assign({ h: 5, v: 2 }, o.fusion),
      suppression: !!o.suppression,
      verg: Object.assign({ bias: 0, gain: 1, max: 40 }, o.verg),
      supra: o.supra ? Object.assign({ up: 1, down: 1, right: 1, left: 1 }, o.supra) : null,
      nuclear: o.nuclear ? Object.assign({ right: 1, left: 1, bias: 0 }, o.nuclear) : null,
      nystagmus: o.nystagmus || [],
      fatigue: o.fatigue || null,
      cogan: !!o.cogan,
      posture: Object.assign({ yaw: 0, pitch: 0, roll: 0 }, o.posture),
      blinkEvery: o.blinkEvery || 4.2
    };
  }

  function strengths(eye, fatigue) {
    if (!fatigue || !eye.fatigable) return eye.s;
    var s = {};
    for (var m in eye.s) s[m] = Math.max(0.05, eye.s[m] - fatigue * (eye.fatigable[m] || 0));
    return s;
  }

  // A limit is a number, or [value when adducted, value when abducted].
  function limitAt(val, a) {
    if (val == null) return null;
    if (typeof val === 'number') return val;
    return lerp(val[0], val[1], clamp((a + 20) / 40, 0, 1));
  }

  function cap1(x) { return x < 1 ? x : 1; }

  /* Where one eye ends up for a given voluntary version command `ver` (world x/y)
     and total vergence command `vg`. */
  function eyePosition(cfg, key, ver, vg, ctx) {
    var eye = cfg.eyes[key];
    var sgn = key === 'R' ? 1 : -1;
    var vx = ver.x, vy = ver.y;
    var sp = cfg.supra;
    if (sp) {
      vx *= vx >= 0 ? sp.right : sp.left;
      vy *= vy >= 0 ? sp.up : sp.down;
    }
    // voluntary and vestibular drives converge on the same motor neurons, which saturate
    var cx = clamp(vx + (ctx.vorX || 0), -K.EFFORT_H, K.EFFORT_H);
    var cy = clamp(vy + (ctx.vorY || 0), -K.EFFORT_V, K.EFFORT_V);
    var nu = cfg.nuclear;
    if (nu) {
      cx *= cx >= 0 ? nu.right : nu.left;
      cx += nu.bias;
    }
    var h = sgn * cx;
    if (eye.ino != null && h < 0) h *= eye.ino;
    h -= (vg / 2) * eye.vergGain;
    var v = cy + eye.vOffset;

    var s = strengths(eye, ctx.fatigue);
    var lr = agonist(h, K.TONE_H), mr = agonist(-h, K.TONE_H);
    var el = agonist(v, K.TONE_V), dp = agonist(-v, K.TONE_V);

    var a = s.LR * lr - s.MR * mr;
    a += K.OBLIQUE_H * ((s.SO - 1) * dp + (s.IO - 1) * el) - K.RECTUS_H * ((s.SR - 1) * el + (s.IR - 1) * dp);
    var L = eye.limits;
    var soft = L && L.soft != null ? L.soft : 0.15;
    if (L) {
      if (L.ab != null && a > L.ab) a = L.ab + (a - L.ab) * soft;
      if (L.ad != null && a < -L.ad) a = -L.ad + (a + L.ad) * soft;
    }
    a = clamp(a, -K.RANGE.ad, K.RANGE.ab);

    // Share of vertical work: obliques dominate in adduction, vertical recti in abduction.
    var wIO = clamp(0.35 - a / 100, 0.1, 0.65), wSR = 1 - wIO;
    var wSO = clamp(0.30 - a / 150, 0.1, 0.5), wIR = 1 - wSO;
    var e = (wSR * s.SR + wIO * s.IO) * el - (wIR * s.IR + wSO * s.SO) * dp;

    // Head tilt: the lower-side eye must intort (SR + SO), the other extort (IO + IR).
    // An unbalanced pair leaks a vertical movement — the Bielschowsky sign.
    var q = clamp(sgn * (ctx.roll || 0) / 30, -1, 1);
    e += K.TILT * q * ((cap1(s.SR) - cap1(s.SO)) - (cap1(s.IO) - cap1(s.IR)));

    if (eye.shoot && a < -12) e += eye.shoot * (-a - 12) * clamp(v / 8 + 0.6, -1, 1);
    if (L) {
      var up = limitAt(L.up, a), dn = limitAt(L.down, a);
      if (up != null && e > up) e = up + (e - up) * soft;
      if (dn != null && e < -dn) e = -dn + (e + dn) * soft;
    }
    e = clamp(e, -K.RANGE.down, K.RANGE.up);

    // Torsion left over when an intorter (SO, SR) or extorter (IO, IR) is missing.
    var t = eye.tOffset + 0.3 * ((1 - s.SO) * dp - (1 - s.IO) * el + (1 - s.SR) * el - (1 - s.IR) * dp);
    return { a: a, e: e, t: t, h: h, v: v };
  }

  function vergenceDemand(distCm) {
    return 2 * Math.atan(K.IPD_CM / 2 / distCm) / DEG;
  }

  function sees(cfg, key, st) {
    if (st.cover === key) return false;
    var lid = cfg.eyes[key].lid;
    if (!st.lidsLifted && lid.ptosis + (st.fatigue || 0) * lid.fatigue >= 0.9) return false;
    return true;
  }

  /* Steady state for a target, head position and cover.
     st: { tx, ty, dist (cm), yaw, pitch, roll, vorX, vorY, cover, lidsLifted, fatigue,
           lastFix, forceFix, dissociate } */
  function solve(cfg, st) {
    var roll = st.roll || 0;
    var cr = Math.cos(roll * DEG), sr = Math.sin(roll * DEG);
    var dx = st.tx - (st.yaw || 0), dy = st.ty - (st.pitch || 0);
    var ox = dx * cr - dy * sr, oy = dx * sr + dy * cr;       // target direction in the head frame
    var demand = vergenceDemand(st.dist || 600);
    var V = cfg.verg;
    var vg = clamp(V.bias + demand * V.gain, -40, V.max);
    var ctx = { vorX: st.vorX || 0, vorY: st.vorY || 0, roll: roll, fatigue: st.fatigue || 0 };
    var req = { R: { a: ox - demand / 2, e: oy }, L: { a: -ox - demand / 2, e: oy } };
    var can = { R: sees(cfg, 'R', st), L: sees(cfg, 'L', st) };

    function attempt(fix) {
      var sgn = fix === 'R' ? 1 : -1;
      var ver = { x: clamp(ox - ctx.vorX, -K.EFFORT_H, K.EFFORT_H), y: clamp(oy - ctx.vorY, -K.EFFORT_V, K.EFFORT_V) };
      var p, ex = 0, ey = 0;
      for (var i = 0; i < 80; i++) {
        p = eyePosition(cfg, fix, ver, vg, ctx);
        ex = req[fix].a - p.a; ey = req[fix].e - p.e;
        if (Math.abs(ex) + Math.abs(ey) < 0.01) break;
        ver.x = clamp(ver.x + 0.8 * sgn * ex, -K.EFFORT_H, K.EFFORT_H);
        ver.y = clamp(ver.y + 0.8 * ey, -K.EFFORT_V, K.EFFORT_V);
      }
      return { fix: fix, ver: ver, err: Math.sqrt(ex * ex + ey * ey) };
    }

    var pref = cfg.fixPref === 'alt' ? (st.lastFix || 'R') : cfg.fixPref;
    var other = pref === 'R' ? 'L' : 'R';
    var sol;
    if (st.forceFix) sol = attempt(st.forceFix);
    else if (can[pref] && !can[other]) sol = attempt(pref);
    else if (!can[pref] && can[other]) sol = attempt(other);
    else {
      sol = attempt(pref);
      if (sol.err > 2.5 && can[other]) {
        var alt = attempt(other);
        if (alt.err < sol.err - 1) sol = alt;
      }
    }

    var fix = sol.fix, non = fix === 'R' ? 'L' : 'R';
    var pF = eyePosition(cfg, fix, sol.ver, vg, ctx);
    var pN = eyePosition(cfg, non, sol.ver, vg, ctx);
    var fused = false;
    if (!st.dissociate && can.R && can.L && sol.err < 1 && demand <= V.max + 0.5) {
      var F = cfg.fusion;
      if (Math.abs(pN.a - req[non].a) <= F.h && Math.abs(pN.e - req[non].e) <= F.v) fused = true;
    }
    if (fused) { pN.a = req[non].a; pN.e = req[non].e; }

    function pack(key, p) {
      var sgn = key === 'R' ? 1 : -1;
      return {
        a: p.a, e: p.e, t: p.t, h: p.h,
        x: sgn * p.a, y: p.e,
        reqX: sgn * req[key].a, reqY: req[key].e,
        errX: sgn * (p.a - req[key].a), errY: p.e - req[key].e
      };
    }
    var eyes = {};
    eyes[fix] = pack(fix, pF);
    eyes[non] = pack(non, pN);
    return {
      fix: fix, fused: fused, can: can, ver: sol.ver, vg: vg, demand: demand, err: sol.err,
      ox: ox, oy: oy, eyes: eyes,
      dev: {
        // + eso / − exo; + right eye higher
        eso: -((eyes.R.a - req.R.a) + (eyes.L.a - req.L.a)),
        rHyper: (eyes.R.e - req.R.e) - (eyes.L.e - req.L.e),
        tR: eyes.R.t, tL: eyes.L.t
      }
    };
  }

  /* ---------- time-stepped simulation: saccades, drifts, nystagmus, lids ---------- */

  function Sim(cfg) { this.cfg = cfg; this.reset(); }

  Sim.prototype.reset = function () {
    this.time = 0;
    this.pos = { R: { x: 0, y: 0, t: 0 }, L: { x: 0, y: 0, t: 0 } };
    this.fatigue = 0;
    this.lastFix = null;
    this.prev = null;
    this.slow = { R: 0, L: 0 };
    this.blinkT = 1.5 + Math.random() * 2;
    this.blinkP = 0;
    this.downT = 0;
    this.twitch = 0;
    this.snap = true;
  };

  Sim.prototype.step = function (dt, input) {
    var cfg = this.cfg, k, i;
    dt = Math.min(dt, 0.05);
    this.time += dt;

    if (cfg.fatigue) {
      var lookingUp = input.ty - (input.pitch || 0) > 10;
      this.fatigue = clamp(this.fatigue + (lookingUp ? dt / cfg.fatigue.rise : -dt / cfg.fatigue.recover), 0, 1);
    }

    var st = {
      tx: input.tx, ty: input.ty, dist: input.dist, yaw: input.yaw, pitch: input.pitch, roll: input.roll,
      vorX: input.vorX, vorY: input.vorY, cover: input.cover, lidsLifted: input.lidsLifted,
      fatigue: this.fatigue, lastFix: this.lastFix
    };
    var sol = solve(cfg, st);
    this.lastFix = sol.fix;
    var non = sol.fix === 'R' ? 'L' : 'R';

    // Decide whether the coming movement is a refixation saccade or a slow fusional/phoric drift.
    var p = this.prev;
    if (p && !this.snap) {
      var jumped = Math.abs(st.tx - p.tx) + Math.abs(st.ty - p.ty) > 4;
      if (jumped) { this.slow.R = 0; this.slow.L = 0; }
      else if (p.fix !== sol.fix || p.fused !== sol.fused || p.cover !== st.cover) {
        var f = sol.eyes[sol.fix], fp = this.pos[sol.fix];
        var fixMoves = Math.abs(f.x - fp.x) + Math.abs(f.y - fp.y) > 1.2;
        if (!fixMoves) this.slow[non] = 0.7;
      }
    }
    this.prev = { tx: st.tx, ty: st.ty, fix: sol.fix, fused: sol.fused, cover: st.cover };

    var vorActive = !!(st.vorX || st.vorY);
    for (i = 0; i < 2; i++) {
      k = i ? 'L' : 'R';
      var g = sol.eyes[k], pos = this.pos[k], eye = cfg.eyes[k], sgn = k === 'R' ? 1 : -1;
      if (this.snap) { pos.x = g.x; pos.y = g.y; pos.t = g.t; continue; }
      var rate = this.slow[k] > 0 ? 5 : 24;
      var ddx = g.x - pos.x, ddy = g.y - pos.y;
      var vm = eye.vmax, boost = vorActive ? 4 : 1;
      var capH = (ddx * sgn > 0 ? vm.ab : vm.ad) * boost * dt;
      var capV = (ddy > 0 ? vm.up : vm.down) * boost * dt;
      var gain = Math.min(1, rate * dt);
      pos.x += clamp(ddx * gain, -capH, capH);
      pos.y += clamp(ddy * gain, -capV, capV);
      pos.t += (g.t - pos.t) * Math.min(1, 10 * dt);
      this.slow[k] = Math.max(0, this.slow[k] - dt);
    }
    this.snap = false;

    // Nystagmus and saccadic intrusions ride on top of the mean position.
    var off = { R: 0, L: 0 }, pulse = 0;
    for (i = 0; i < cfg.nystagmus.length; i++) {
      var n = cfg.nystagmus[i];
      var I = n.when(sol, st);
      if (!(I > 0.03)) continue;
      if (I > 1) I = 1;
      var ph = (this.time * n.freq) % 1;
      if (n.type === 'jerk') {
        // drifts back toward centre, then beats out again
        var w = ph < 0.78 ? -ph / 0.78 : -1 + (ph - 0.78) / 0.22;
        off[n.eye] += n.dirX * n.amp * I * w;
      } else if (n.type === 'convret') {
        var u = ph < 0.16 ? ph / 0.16 : 1 - (ph - 0.16) / 0.84;
        off.R -= n.amp * I * u;
        off.L += n.amp * I * u;
        pulse = Math.max(pulse, I * u);
      } else if (n.type === 'swj') {
        var sq = ph < 0.14 ? n.amp * I : 0;
        off.R += sq; off.L += sq;
      }
    }

    // Blink
    this.blinkT -= dt;
    if (this.blinkT <= 0 && this.blinkP <= 0) {
      this.blinkP = 0.22;
      this.blinkT = cfg.blinkEvery * (0.6 + Math.random() * 0.9);
    }
    var blink = 0;
    if (this.blinkP > 0) {
      this.blinkP -= dt;
      blink = Math.sin(Math.PI * (1 - Math.max(0, this.blinkP) / 0.22));
    }

    // Cogan lid twitch: the lid overshoots on return from sustained downgaze.
    var twitch = 0;
    if (cfg.cogan) {
      if (sol.oy < -12) this.downT += dt;
      else if (sol.oy > -5) {
        if (this.downT > 0.5) this.twitch = 0.5;
        this.downT = 0;
      }
      if (this.twitch > 0) {
        this.twitch -= dt;
        twitch = Math.sin(Math.PI * (1 - Math.max(0, this.twitch) / 0.5)) * 0.45;
      }
    }

    var near = clamp(sol.demand / 35, 0, 1);
    var out = { sol: sol, fatigue: this.fatigue, eyes: {} };
    for (i = 0; i < 2; i++) {
      k = i ? 'L' : 'R';
      var ey = cfg.eyes[k], ps = this.pos[k], sv = sol.eyes[k];
      var x = ps.x + off[k], y = ps.y;
      out.eyes[k] = {
        x: x, y: y, t: ps.t,
        errX: x - sv.reqX, errY: y - sv.reqY,
        pupil: ey.pupilFixed ? ey.pupil : ey.pupil - 1.3 * near,
        ptosis: clamp(ey.lid.ptosis + this.fatigue * ey.lid.fatigue - twitch, -0.3, 1),
        retraction: ey.lid.retraction, lower: ey.lid.lower, lag: ey.lid.lag,
        lifted: !!input.lidsLifted,
        squeeze: clamp(ey.retract * clamp(-sv.h / 30, 0, 1) + 0.25 * pulse, 0, 1),
        blink: blink,
        browLift: ey.browLift,
        covered: input.cover === k,
        seeing: sol.can[k],
        globe: ey.globe, bruise: ey.bruise
      };
    }
    return out;
  };

  /* ---------- derived charts ---------- */

  var HESS_INNER = [[-15, 15], [0, 15], [15, 15], [15, 0], [15, -15], [0, -15], [-15, -15], [-15, 0]];
  var HESS_OUTER = [[-30, 30], [-15, 30], [0, 30], [15, 30], [30, 30], [30, 15], [30, 0], [30, -15],
                    [30, -30], [15, -30], [0, -30], [-15, -30], [-30, -30], [-30, -15], [-30, 0], [-30, 15]];

  // Each eye's field is plotted while the other eye fixes the target points, eyes dissociated.
  function hess(cfg) {
    function field(plotEye) {
      var fixEye = plotEye === 'R' ? 'L' : 'R';
      function at(pt) {
        var s = solve(cfg, { tx: pt[0], ty: pt[1], dist: 600, forceFix: fixEye, dissociate: true, lidsLifted: true });
        return [s.eyes[plotEye].x, s.eyes[plotEye].y];
      }
      return { centre: at([0, 0]), inner: HESS_INNER.map(at), outer: HESS_OUTER.map(at) };
    }
    return { R: field('R'), L: field('L'), innerTargets: HESS_INNER, outerTargets: HESS_OUTER };
  }

  function prism(deg) { return 100 * Math.tan(Math.abs(deg) * DEG); }

  CG.engine = {
    K: K, makeEye: makeEye, makeConfig: makeConfig, eyePosition: eyePosition, solve: solve,
    vergenceDemand: vergenceDemand, Sim: Sim, hess: hess, prism: prism, clamp: clamp, lerp: lerp
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
