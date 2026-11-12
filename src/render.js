/* Cardinal Gaze — the patient's face, drawn on a canvas.
   Face coordinates are millimetres, origin midway between the eyes, +x to screen right, +y down.
   We look at the patient, so the patient's RIGHT eye is on the screen's LEFT. */
(function (root) {
  'use strict';
  var CG = (root.CG = root.CG || {});
  var DEG = Math.PI / 180, TAU = Math.PI * 2;
  var R_ROT = 11.5;      // how far the pupil travels per unit sine of rotation
  var IRIS_R = 5.9;
  var PIVOT_Y = 12;      // head tilt pivots just below the eyes, so both stay in frame

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  var LOOKS = [
    { id: 'hazel', skin: '#E3B596', shade: '#B97E61', light: '#F6D8C2', blush: '#E08F80', lip: '#C26E66',
      hair: '#4B2E22', brow: '#4A2F22', lash: '#231612', iris: ['#7B7A45', '#B79A52', '#3D3B22'] },
    { id: 'blue', skin: '#F0D0BC', shade: '#CF9F88', light: '#FBE8DB', blush: '#EBA79C', lip: '#CF8580',
      hair: '#B98D58', brow: '#93714A', lash: '#3A2A20', iris: ['#5E88A6', '#A9C8D9', '#2B4A63'] },
    { id: 'brown', skin: '#C69170', shade: '#99684A', light: '#DDB092', blush: '#C77C68', lip: '#A85F55',
      hair: '#1F1917', brow: '#241B17', lash: '#120D0B', iris: ['#6A4226', '#96683C', '#352010'] },
    { id: 'deep', skin: '#8A5B40', shade: '#63402C', light: '#A77658', blush: '#955444', lip: '#7C4338',
      hair: '#15100E', brow: '#15100E', lash: '#0B0807', iris: ['#4C2F1C', '#70482A', '#24150C'] },
    { id: 'green', skin: '#E9C3A8', shade: '#C28D72', light: '#F8DFCC', blush: '#E59886', lip: '#C9736B',
      hair: '#7A3B22', brow: '#673320', lash: '#2A1912', iris: ['#5D8160', '#A2B878', '#2C4634'] }
  ];

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeIris(look) {
    var c = document.createElement('canvas');
    c.width = c.height = 256;
    var g = c.getContext('2d'), R = 128, rnd = rng(7), i;
    g.translate(R, R);
    var grad = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
    grad.addColorStop(0, look.iris[1]);
    grad.addColorStop(0.5, look.iris[0]);
    grad.addColorStop(0.88, look.iris[2]);
    grad.addColorStop(1, '#17110d');
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, R - 1, 0, TAU); g.fill();
    g.save();
    g.beginPath(); g.arc(0, 0, R - 2, 0, TAU); g.clip();
    for (i = 0; i < 120; i++) {
      var an = rnd() * TAU, r0 = R * (0.26 + rnd() * 0.2), r1 = R * (0.72 + rnd() * 0.24);
      g.strokeStyle = rnd() > 0.5 ? rgba(look.iris[1], 0.16 + rnd() * 0.2) : rgba(look.iris[2], 0.14 + rnd() * 0.2);
      g.lineWidth = 1 + rnd() * 2.6;
      g.beginPath();
      g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0);
      g.lineTo(Math.cos(an + (rnd() - 0.5) * 0.08) * r1, Math.sin(an + (rnd() - 0.5) * 0.08) * r1);
      g.stroke();
    }
    // collarette
    g.strokeStyle = rgba(look.iris[1], 0.5);
    g.lineWidth = 5;
    g.beginPath();
    for (i = 0; i <= 60; i++) {
      var a2 = (i / 60) * TAU, rr = R * (0.4 + 0.03 * Math.sin(a2 * 9) + 0.015 * Math.sin(a2 * 23));
      if (i) g.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr); else g.moveTo(Math.cos(a2) * rr, Math.sin(a2) * rr);
    }
    g.stroke();
    g.restore();
    // limbal ring
    g.strokeStyle = 'rgba(20,14,10,0.55)';
    g.lineWidth = 9;
    g.beginPath(); g.arc(0, 0, R - 6, 0, TAU); g.stroke();
    return c;
  }

  function Face(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 0; this.H = 0; this.dpr = 1;
    this.eyeScreen = { R: { x: 0, y: 0 }, L: { x: 0, y: 0 } };
    this.setLook(LOOKS[0]);
    this.resize();
  }

  Face.prototype.setLook = function (look) {
    this.look = look;
    this.irisTex = makeIris(look);
  };

  Face.prototype.resize = function () {
    var r = this.canvas.getBoundingClientRect();
    var dpr = Math.min(root.devicePixelRatio || 1, 2.5);
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    if (w !== this.W || h !== this.H || dpr !== this.dpr) {
      this.W = w; this.H = h; this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    this.scale = Math.min(w / 128, h / 62, 9);       // px per mm
    this.cx = w / 2;
    this.cy = h * 0.47;                              // the eye line
    // Gaze space. The nine positions sit clear of the eyes: lateral targets beyond the outer
    // canthus, the centre a little below the eye line. Past 30° / 25° the scale is compressed
    // so that a drag to the edge of the screen still reaches the limit of the normal range.
    var sc = this.scale;
    this.padY = this.cy + Math.min(10 * sc, h * 0.09);
    this.h30 = Math.min(54 * sc, w / 2 - 26);
    this.hMax = Math.min(w / 2 - 8, this.h30 + 50);
    this.v25 = Math.max(30, Math.min(33 * sc, this.padY - 66, h - this.padY - 30));
    this.vMax = this.v25 + 18;
  };

  function toPx(a, a1, a2, p1, p2) {
    var m = Math.abs(a), s = a < 0 ? -1 : 1;
    return s * (m <= a1 ? m / a1 * p1 : p1 + (Math.min(m, a2) - a1) / (a2 - a1) * (p2 - p1));
  }
  function toAngle(p, a1, a2, p1, p2) {
    var m = Math.abs(p), s = p < 0 ? -1 : 1;
    return s * (m <= p1 ? m / p1 * a1 : Math.min(a2, a1 + (m - p1) / (p2 - p1) * (a2 - a1)));
  }
  Face.prototype.angleToScreen = function (tx, ty) {
    return { x: this.cx - toPx(tx, 30, 45, this.h30, this.hMax), y: this.padY - toPx(ty, 25, 35, this.v25, this.vMax) };
  };
  Face.prototype.screenToAngle = function (x, y) {
    return { tx: toAngle(this.cx - x, 30, 45, this.h30, this.hMax), ty: toAngle(this.padY - y, 25, 35, this.v25, this.vMax) };
  };

  /* frame: output of Sim.step. view: { bg, head:{yaw,pitch,roll}, light:{x,y}, cover:{R,L} 0..1,
     seeThrough, target:{tx,ty,near,show}, guide:{show,labels} } */
  Face.prototype.draw = function (frame, view) {
    var ctx = this.ctx, s = this.scale, L = this.look, self = this;
    var head = view.head || { yaw: 0, pitch: 0, roll: 0 };
    var sy = Math.sin(head.yaw * DEG), cyw = Math.cos(head.yaw * DEG);
    var sp = Math.sin(head.pitch * DEG), cp = Math.cos(head.pitch * DEG);
    // Pseudo-3D: z is how far a feature stands proud of the eye plane.
    function P(x, y, z) { return [x * cyw - z * sy, y * cp - z * sp]; }
    function M(p) { ctx.moveTo(p[0], p[1]); }
    function C(a, b, c) { ctx.bezierCurveTo(a[0], a[1], b[0], b[1], c[0], c[1]); }
    function Q(a, b) { ctx.quadraticCurveTo(a[0], a[1], b[0], b[1]); }
    function glow(p, r, color, alpha, sx) {
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.scale(sx || 1, 1);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(color, alpha));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = view.bg || '#C9D6DA';
    ctx.fillRect(0, 0, this.W, this.H);

    // turning the head also carries the face a little way across the frame
    var shx = -sy * 20, shy = -sp * 20;
    ctx.save();
    ctx.translate(this.cx, this.cy);
    ctx.scale(s, s);
    ctx.translate(shx, shy);
    ctx.translate(0, PIVOT_Y);
    ctx.rotate(-head.roll * DEG);
    ctx.translate(0, -PIVOT_Y);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // hair behind, neck, ears
    var hb = P(0, -34, -70);
    ctx.fillStyle = L.hair;
    ctx.beginPath(); ctx.ellipse(hb[0], hb[1], 95, 116, 0, 0, TAU); ctx.fill();
    var nk = P(0, 92, -62);
    ctx.fillStyle = L.shade;
    ctx.fillRect(nk[0] - 40, nk[1], 80, 160);
    [-1, 1].forEach(function (sd) {
      var ep = P(sd * 78, 6, -80);
      ctx.fillStyle = L.shade;
      ctx.beginPath(); ctx.ellipse(ep[0], ep[1], 9, 18, sd * 0.12, 0, TAU); ctx.fill();
    });

    function facePath() {
      ctx.beginPath();
      M(P(0, -94, -25));
      C(P(42, -96, -30), P(73, -72, -48), P(75, -25, -52));
      C(P(77, 10, -52), P(73, 46, -48), P(60, 74, -40));
      C(P(48, 98, -25), P(22, 112, -8), P(0, 112, -5));
      C(P(-22, 112, -8), P(-48, 98, -25), P(-60, 74, -40));
      C(P(-73, 46, -48), P(-77, 10, -52), P(-75, -25, -52));
      C(P(-73, -72, -48), P(-42, -96, -30), P(0, -94, -25));
      ctx.closePath();
    }
    ctx.fillStyle = L.skin;
    facePath(); ctx.fill();

    ctx.save();
    facePath(); ctx.clip();
    // side falloff
    var eL = P(-77, 0, -52)[0], eR = P(77, 0, -52)[0];
    var side = ctx.createLinearGradient(eL, 0, eR, 0);
    side.addColorStop(0, rgba(L.shade, 0.6)); side.addColorStop(0.2, rgba(L.shade, 0));
    side.addColorStop(0.8, rgba(L.shade, 0)); side.addColorStop(1, rgba(L.shade, 0.6));
    ctx.fillStyle = side; ctx.fillRect(-200, -200, 400, 400);
    glow(P(0, -50, 2), 48, L.light, 0.55, 1.35);          // forehead
    [-1, 1].forEach(function (sd) {
      glow(P(sd * 33, -6, -2), 27, L.shade, 0.5, 1.25);   // orbit
      glow(P(sd * 12, 13, 8), 30, L.shade, 0.26, 0.32);   // flank of the nose
      glow(P(sd * 33, 14, -2), 12, L.shade, 0.16, 1.7);   // under the eye
      glow(P(sd * 46, 40, -14), 28, L.blush, 0.3, 1.1);   // cheek
    });
    glow(P(0, 16, 16), 30, L.light, 0.42, 0.2);           // dorsum of the nose
    glow(P(0, 45, 24), 9, L.light, 0.5, 1);               // tip
    glow(P(0, 57, 14), 9, L.shade, 0.5, 1.8);             // shadow under the tip
    [-1, 1].forEach(function (sd) {
      var np = P(sd * 7.5, 53.5, 15);
      ctx.fillStyle = rgba(L.lash, 0.55);
      ctx.beginPath(); ctx.ellipse(np[0], np[1], 3.4, 1.9, sd * 0.3, 0, TAU); ctx.fill();
      glow(P(sd * 13, 49, 9), 7, L.shade, 0.3, 0.7);
      ctx.strokeStyle = rgba(L.shade, 0.45); ctx.lineWidth = 0.5;
      ctx.beginPath(); M(P(sd * 13.6, 47, 9)); Q(P(sd * 15.6, 51, 8), P(sd * 12.6, 54.5, 9)); ctx.stroke();
    });
    // mouth
    ctx.fillStyle = L.lip;
    ctx.beginPath();
    M(P(-23, 77, 9)); Q(P(-9, 71, 14), P(0, 74, 15)); Q(P(9, 71, 14), P(23, 77, 9));
    Q(P(0, 92, 14), P(-23, 77, 9));
    ctx.fill();
    ctx.strokeStyle = rgba(L.lash, 0.45); ctx.lineWidth = 0.6;
    ctx.beginPath(); M(P(-23, 77, 9)); Q(P(0, 80, 15), P(23, 77, 9)); ctx.stroke();
    ctx.restore();

    // eyes
    var light = view.light || { x: 0, y: 0 };
    this.drawEye(ctx, 'R', frame.eyes.R, light, P, head);
    this.drawEye(ctx, 'L', frame.eyes.L, light, P, head);

    // fringe and side hair
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    M(P(-82, -10, -52));
    C(P(-74, -60, -34), P(-34, -70, -8), P(6, -64, 0));
    C(P(30, -61, -4), P(64, -58, -30), P(82, -8, -52));
    C(P(100, -60, -70), P(70, -160, -70), P(0, -160, -70));
    C(P(-70, -160, -70), P(-100, -60, -70), P(-82, -10, -52));
    ctx.fill();
    [-1, 1].forEach(function (sd) {
      ctx.beginPath();
      M(P(sd * 78, -30, -50));
      C(P(sd * 86, 10, -56), P(sd * 82, 52, -56), P(sd * 70, 84, -50));
      C(P(sd * 92, 96, -70), P(sd * 104, 40, -80), P(sd * 98, -40, -70));
      ctx.closePath(); ctx.fill();
    });
    ctx.restore();

    // screen position of each eye, for the occluder
    var rr = -head.roll * DEG, cr = Math.cos(rr), sr = Math.sin(rr);
    ['R', 'L'].forEach(function (k) {
      var c = P(k === 'R' ? -32 : 32, 0, 0), yy = c[1] - PIVOT_Y;
      self.eyeScreen[k] = { x: self.cx + s * (shx + c[0] * cr - yy * sr), y: self.cy + s * (shy + c[0] * sr + yy * cr + PIVOT_Y) };
    });

    this.drawOverlay(ctx, frame, view);
  };

  Face.prototype.drawEye = function (ctx, key, e, light, P, head) {
    var L = this.look;
    var n = key === 'R' ? 1 : -1;                 // nasal direction on screen
    var c = P(key === 'R' ? -32 : 32, 0, 0);
    var sxl = Math.cos(head.yaw * DEG) - 0.22 * n * Math.sin(head.yaw * DEG);
    var syl = Math.cos(head.pitch * DEG);
    var i;

    ctx.save();
    ctx.translate(c[0], c[1]);
    ctx.scale(sxl, syl);

    var ex = -R_ROT * Math.sin(e.x * DEG), ey = -R_ROT * Math.sin(e.y * DEG);
    var up = -ey;
    var U = 4.2 + (up > 0 ? up * 0.75 : up * 0.9 * (1 - e.lag)) + e.retraction;
    var Lo = 5.6 + e.lower + (up < 0 ? -up * 0.45 : -up * 0.12);
    if (e.globe === 'proptosis') { U += 0.4; Lo += 0.6; }
    else if (e.globe === 'enophthalmos') { U -= 0.8; Lo -= 0.6; }
    if (e.ptosis > 0) U = lerp(U, -2.8 + Math.min(0, up) * 0.9, e.ptosis);
    else U -= e.ptosis * 3.2;
    if (e.lifted) U = Math.max(U, 4.9 + Math.max(0, up) * 0.75);
    if (e.squeeze) { U -= Math.max(0, U) * 0.42 * e.squeeze; Lo -= Lo * 0.3 * e.squeeze; }
    U = lerp(U, -Lo + 0.3, e.blink);
    U = Math.max(U, -Lo + 0.3);

    var mc = [n * 15.2, 1.5], lc = [-n * 14.3, -0.7];
    var u1 = [n * 9.5, -U / 0.75 + 0.2], u2 = [-n * 6, -U / 0.75 - 0.4];
    var l1 = [-n * 7.5, Lo / 0.75 + 0.3], l2 = [n * 7, Lo / 0.75 - 0.7];
    function upper() { ctx.moveTo(mc[0], mc[1]); ctx.bezierCurveTo(u1[0], u1[1], u2[0], u2[1], lc[0], lc[1]); }
    function lower() { ctx.bezierCurveTo(l1[0], l1[1], l2[0], l2[1], mc[0], mc[1]); }
    function bez(p0, p1, p2, p3, t) {
      var m = 1 - t;
      return [m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
              m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]];
    }
    function spot(x, y, r, color, alpha, sx) {
      ctx.save(); ctx.translate(x, y); ctx.scale(sx || 1, 1);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(color, alpha)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
    }

    // brow (lifts when the frontalis compensates for ptosis)
    var by = -15.6 - (e.browLift || 0) - Math.max(0, e.ptosis) * 1.6;
    ctx.fillStyle = L.brow;
    ctx.beginPath();
    ctx.moveTo(n * 15, by + 1.4);
    ctx.bezierCurveTo(n * 8, by - 3.6, -n * 6, by - 6.6, -n * 22, by - 0.4);
    ctx.bezierCurveTo(-n * 10, by - 3.1, n * 4, by - 0.4, n * 14.4, by + 3.8);
    ctx.closePath(); ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = rgba(L.lash, 0.3); ctx.lineWidth = 0.3;
    for (i = 0; i < 9; i++) {
      var bt = 0.08 + i * 0.1;
      var bp = bez([n * 14.6, by + 2.6], [n * 6, by - 1.9], [-n * 8, by - 4.8], [-n * 21, by - 0.6], bt);
      ctx.beginPath(); ctx.moveTo(bp[0], bp[1] + 1.4); ctx.lineTo(bp[0] - n * 2.4, bp[1] - 1.6); ctx.stroke();
    }
    ctx.restore();

    if (e.bruise) {
      spot(-n * 5, 9, 14, '#6B3A5E', 0.45, 1.5);
      spot(-n * 13, -5, 10, '#7A4A3C', 0.35, 1);
      spot(n * 6, 8, 8, '#8A7A3A', 0.18, 1.4);
    }

    // the globe, seen through the palpebral fissure
    ctx.save();
    ctx.beginPath(); upper(); lower(); ctx.closePath(); ctx.clip();
    ctx.fillStyle = '#F3EFE9';
    ctx.fillRect(-19, -13, 38, 26);
    spot(mc[0], mc[1], 9, '#B9796B', 0.5, 1);
    spot(lc[0], lc[1], 8, '#9C8478', 0.4, 1);
    ctx.fillStyle = '#DB8E86';
    ctx.beginPath(); ctx.ellipse(n * 13.7, 1.3, 2.1, 1.7, 0, 0, TAU); ctx.fill();
    spot(n * 13.2, 0.8, 1.2, '#F6C9C2', 0.8, 1);
    if (e.bruise) spot(-n * 10.5, 2.5, 5.5, '#B3261E', 0.9, 1);

    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(Math.cos(e.x * DEG), Math.cos(e.y * DEG));
    ctx.rotate(-n * e.t * DEG);
    ctx.drawImage(this.irisTex, -IRIS_R, -IRIS_R, IRIS_R * 2, IRIS_R * 2);
    ctx.fillStyle = '#0A0807';
    ctx.beginPath(); ctx.arc(0, 0, clamp(e.pupil, 1.5, 9) * 0.56, 0, TAU); ctx.fill();
    ctx.restore();

    // corneal light reflex of the fixation light (Hirschberg)
    var rx = -R_ROT * (0.553 * Math.sin(e.x * DEG) + 0.379 * Math.sin(light.x * DEG)) + n * 0.3;
    var ry = -R_ROT * (0.553 * Math.sin(e.y * DEG) + 0.379 * Math.sin(light.y * DEG));
    spot(rx, ry, 1.9, '#FFFFFF', 0.55, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.beginPath(); ctx.arc(rx, ry, 0.72, 0, TAU); ctx.fill();

    // shadow cast by the upper lid
    ctx.strokeStyle = 'rgba(52,26,18,0.07)'; ctx.lineWidth = 6;
    ctx.beginPath(); upper(); ctx.stroke();
    ctx.strokeStyle = 'rgba(52,26,18,0.17)'; ctx.lineWidth = 2.8;
    ctx.beginPath(); upper(); ctx.stroke();
    ctx.strokeStyle = 'rgba(120,60,50,0.2)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(lc[0], lc[1]); lower(); ctx.stroke();
    ctx.restore();

    // lid crease and the lid platform
    var crease = clamp(-(7.5 + 0.42 * (U - 4.2)), -10.6, -3.4);
    spot(-n * 1, (crease - U) / 2, 4.6, L.light, 0.3, 2.6);
    ctx.strokeStyle = rgba(L.shade, 0.85); ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.moveTo(n * 13.4, -1.6);
    ctx.bezierCurveTo(n * 8, crease / 0.75 + 1.6, -n * 7, crease / 0.75 + 0.5, -n * 16, -2.6);
    ctx.stroke();

    // lower lid
    ctx.strokeStyle = rgba(L.shade, 0.9); ctx.lineWidth = 0.4;
    ctx.beginPath(); ctx.moveTo(lc[0], lc[1]); lower(); ctx.stroke();
    ctx.strokeStyle = rgba(L.shade, 0.26); ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(n * 12, Lo * 0.6 + 2.2);
    ctx.quadraticCurveTo(-n * 1, Lo + 5.4, -n * 13, Lo * 0.5 + 2);
    ctx.stroke();

    // lash line and lashes
    ctx.strokeStyle = L.lash; ctx.lineWidth = 0.85;
    ctx.beginPath(); upper(); ctx.stroke();
    var open = clamp(0.3 + U / 6, -0.55, 1);
    ctx.lineWidth = 0.3;
    for (i = 0; i < 13; i++) {
      var t = 0.16 + i * 0.064;
      var p = bez(mc, u1, u2, lc, t);
      var len = 1.5 + 2 * t, lean = (t - 0.35) * 1.25;
      var vx = -n * Math.sin(lean) * len, vy = -Math.cos(lean) * len * open;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.quadraticCurveTo(p[0] + vx * 0.3, p[1] + vy * 0.75, p[0] + vx, p[1] + vy);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(L.lash, 0.6); ctx.lineWidth = 0.22;
    for (i = 0; i < 6; i++) {
      var t2 = 0.1 + i * 0.09;
      var p2 = bez(lc, l1, l2, mc, t2);
      ctx.beginPath(); ctx.moveTo(p2[0], p2[1]); ctx.lineTo(p2[0] - n * (0.7 - t2), p2[1] + 1.1); ctx.stroke();
    }
    ctx.restore();
  };

  var YOKES = [
    { tx: 30, ty: 0, r: 'LR', l: 'MR' }, { tx: -30, ty: 0, r: 'MR', l: 'LR' },
    { tx: 30, ty: 25, r: 'SR', l: 'IO' }, { tx: -30, ty: 25, r: 'IO', l: 'SR' },
    { tx: 30, ty: -25, r: 'IR', l: 'SO' }, { tx: -30, ty: -25, r: 'SO', l: 'IR' },
    { tx: 0, ty: 25 }, { tx: 0, ty: -25 }, { tx: 0, ty: 0 }
  ];

  Face.prototype.drawOverlay = function (ctx, frame, view) {
    var self = this, i;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var k = clamp(this.scale / 3.2, 0.9, 1.7);

    if (view.guide && view.guide.show) {
      ctx.font = '600 ' + Math.round(10 * Math.min(k, 1.25)) + 'px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textBaseline = 'middle';
      for (i = 0; i < YOKES.length; i++) {
        var y = YOKES[i], p = this.angleToScreen(y.tx, y.ty);
        ctx.strokeStyle = 'rgba(12,22,28,0.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5 * k, 0, TAU); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5 * k, 0, TAU); ctx.stroke();
        if (view.guide.labels && y.r) {
          var rt = 'R ' + y.r, lt = 'L ' + y.l;
          var wr = ctx.measureText(rt).width, wl = ctx.measureText(lt).width, pad = 5, gap = 7;
          var w = wr + wl + gap + pad * 2, h = 17 * Math.min(k, 1.25);
          var bx = clamp(p.x - w / 2, 4, this.W - w - 4), byy = p.y + (y.ty < 0 ? -h - 9 * k : 9 * k);
          ctx.fillStyle = 'rgba(12,22,28,0.78)';
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(bx, byy, w, h, 4); else ctx.rect(bx, byy, w, h);
          ctx.fill();
          ctx.fillStyle = '#FF9A93'; ctx.fillText(rt, bx + pad, byy + h / 2 + 0.5);
          ctx.fillStyle = '#7FE0AE'; ctx.fillText(lt, bx + pad + wr + gap, byy + h / 2 + 0.5);
        }
      }
    }

    // occluder
    ['R', 'L'].forEach(function (key) {
      var a = view.cover ? view.cover[key] : 0;
      if (a <= 0.01) return;
      var c = self.eyeScreen[key], s = self.scale, out = key === 'R' ? -1 : 1;
      var ease = 1 - Math.pow(1 - a, 3);
      var x = c.x + out * (1 - ease) * 60 * s, y = c.y + 1 * s;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = ease;
      var body = view.seeThrough ? 'rgba(18,28,34,0.5)' : 'rgba(18,26,31,0.97)';
      ctx.fillStyle = view.seeThrough ? 'rgba(18,28,34,0.62)' : 'rgba(18,26,31,0.97)';
      ctx.beginPath();
      ctx.moveTo(out * 12 * s, 14 * s);
      ctx.lineTo(out * 30 * s, 60 * s);
      ctx.lineTo(out * 39 * s, 56 * s);
      ctx.lineTo(out * 20 * s, 10 * s);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 0, 24 * s, 19 * s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = view.seeThrough ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, 24 * s - 1, 19 * s - 1, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    });

    // fixation light
    var tg = view.target;
    if (tg && tg.show) {
      var tp = this.angleToScreen(tg.tx, tg.ty);
      var kk = k * (1 + 0.9 * (tg.near || 0));
      var g = ctx.createRadialGradient(tp.x, tp.y, 0, tp.x, tp.y, 24 * kk);
      g.addColorStop(0, 'rgba(255,250,225,0.85)');
      g.addColorStop(0.35, 'rgba(255,244,200,0.3)');
      g.addColorStop(1, 'rgba(255,244,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, 24 * kk, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(12,22,28,0.7)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, 11 * kk, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#FFFDF2';
      ctx.beginPath(); ctx.arc(tp.x, tp.y, 4.6 * kk, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(12,22,28,0.85)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(tp.x, tp.y, 4.6 * kk, 0, TAU); ctx.stroke();
    }
  };

  CG.Face = Face;
  CG.looks = LOOKS;
  CG.yokes = YOKES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
