/* Cardinal Gaze — the patient's face, painted on a canvas.
   Face coordinates are millimetres, origin midway between the eyes, +x to screen right, +y down.
   We look at the patient, so the patient's RIGHT eye is on the screen's LEFT.

   The look is built from soft colour washes, a brush-dab texture and paper grain, with fine
   line work for lashes, brows and lid creases. Everything that moves (globe, lids, lashes) is
   drawn each frame; brows, iris and textures are painted once per patient and reused. */
(function (root) {
  'use strict';
  var CG = (root.CG = root.CG || {});
  var DEG = Math.PI / 180, TAU = Math.PI * 2;
  var R_ROT = 11.5;      // how far the pupil travels per unit sine of rotation
  var IRIS_R = 5.95;
  var PIVOT_Y = 4;       // head tilt pivots between the eyes, so both stay in frame
  var BROW = { res: 12, x0: -27, y0: -10, w: 47, h: 18 };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function bez(p0, p1, p2, p3, t) {
    var m = 1 - t;
    return [m * m * m * p0[0] + 3 * m * m * t * p1[0] + 3 * m * t * t * p2[0] + t * t * t * p3[0],
            m * m * m * p0[1] + 3 * m * m * t * p1[1] + 3 * m * t * t * p2[1] + t * t * t * p3[1]];
  }
  function bezTan(p0, p1, p2, p3, t) {
    var m = 1 - t;
    var x = 3 * m * m * (p1[0] - p0[0]) + 6 * m * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
    var y = 3 * m * m * (p1[1] - p0[1]) + 6 * m * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
    var l = Math.sqrt(x * x + y * y) || 1;
    return [x / l, y / l];
  }
  function canvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // skin, mid shadow, deep shadow, highlight, cheek, warm tone of thin periocular skin
  var LOOKS = [
    { id: 'hazel', skin: '#E4B99C', shade: '#BE876A', deep: '#8A5642', light: '#F8DFCB', blush: '#E18C7A', warm: '#C8765F',
      lip: '#C26E66', hair: '#4A2D21', hairLight: '#7A4E38', brow: '#4A2F23', lash: '#1D1210', iris: ['#77783F', '#C2A45A', '#34361C'] },
    { id: 'blue', skin: '#F0D1BC', shade: '#D0A089', deep: '#A4715B', light: '#FDEDE0', blush: '#EBA294', warm: '#D8907C',
      lip: '#CF8580', hair: '#B28855', hairLight: '#D8B682', brow: '#8C6C46', lash: '#35261C', iris: ['#577F9E', '#B3D0DE', '#243F56'] },
    { id: 'brown', skin: '#C7926D', shade: '#9C6949', deep: '#6A422E', light: '#E2B695', blush: '#C67763', warm: '#A7614A',
      lip: '#A85F55', hair: '#1E1816', hairLight: '#43342C', brow: '#221916', lash: '#100B09', iris: ['#69401F', '#9E6D3C', '#2E1A0C'] },
    { id: 'deep', skin: '#8B5B3F', shade: '#643E2A', deep: '#3C2317', light: '#AE7C5C', blush: '#9A513E', warm: '#73412E',
      lip: '#7C4338', hair: '#14100E', hairLight: '#322620', brow: '#14100E', lash: '#090605', iris: ['#492C19', '#734A2A', '#20120A'] },
    { id: 'green', skin: '#EAC3A7', shade: '#C58D70', deep: '#925E48', light: '#FBE3D1', blush: '#E89280', warm: '#CF7F66',
      lip: '#C9736B', hair: '#783A21', hairLight: '#B0623A', brow: '#683420', lash: '#27160F', iris: ['#55805C', '#A9BF7C', '#253F2F'] }
  ];

  /* ---------- textures painted once ---------- */

  var shared = null;
  function sharedTextures() {
    if (shared) return shared;
    var rnd = rng(11), i;
    // brush dabs: broad light and dark touches, tiled, laid over the skin with soft-light
    var S = 512, dabs = canvas(S, S), g = dabs.getContext('2d');
    for (i = 0; i < 230; i++) {
      var x = rnd() * S, y = rnd() * S, r = 14 + rnd() * 52, an = rnd() * Math.PI;
      var col = rnd() > 0.45 ? '255,246,236' : '70,30,18', al = 0.05 + rnd() * 0.08;
      for (var ox = -S; ox <= S; ox += S) for (var oy = -S; oy <= S; oy += S) {
        if (x + ox < -r * 2 || x + ox > S + r * 2 || y + oy < -r * 2 || y + oy > S + r * 2) continue;
        g.save(); g.translate(x + ox, y + oy); g.rotate(an); g.scale(1.9, 0.75);
        var gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, 'rgba(' + col + ',' + al + ')'); gr.addColorStop(1, 'rgba(' + col + ',0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.restore();
      }
    }
    // paper grain
    var N = 128, grain = canvas(N, N), gg = grain.getContext('2d'), img = gg.createImageData(N, N);
    for (i = 0; i < N * N; i++) {
      var v = 128 + (rnd() - 0.5) * 84;
      img.data[i * 4] = v; img.data[i * 4 + 1] = v; img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    gg.putImageData(img, 0, 0);
    shared = { dabs: dabs, grain: grain };
    return shared;
  }

  function makeIris(look) {
    var S = 512, R = S / 2, c = canvas(S, S), g = c.getContext('2d'), rnd = rng(7), i, an, r0, r1;
    g.translate(R, R);
    var grad = g.createRadialGradient(0, 0, R * 0.16, 0, 0, R);
    grad.addColorStop(0, look.iris[1]);
    grad.addColorStop(0.42, look.iris[0]);
    grad.addColorStop(0.86, look.iris[2]);
    grad.addColorStop(1, '#120d0a');
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.lineCap = 'round';
    for (i = 0; i < 260; i++) {             // stromal fibres
      an = rnd() * TAU; r0 = R * (0.2 + rnd() * 0.22); r1 = R * (0.6 + rnd() * 0.36);
      g.strokeStyle = rnd() > 0.48 ? rgba(look.iris[1], 0.1 + rnd() * 0.22) : rgba(look.iris[2], 0.1 + rnd() * 0.24);
      g.lineWidth = 1 + rnd() * 4;
      var wob = (rnd() - 0.5) * 0.1;
      g.beginPath();
      g.moveTo(Math.cos(an) * r0, Math.sin(an) * r0);
      g.quadraticCurveTo(Math.cos(an + wob) * (r0 + r1) / 2, Math.sin(an + wob) * (r0 + r1) / 2, Math.cos(an + wob * 0.4) * r1, Math.sin(an + wob * 0.4) * r1);
      g.stroke();
    }
    for (i = 0; i < 26; i++) {              // crypts
      an = rnd() * TAU; r0 = R * (0.46 + rnd() * 0.3);
      g.fillStyle = rgba(look.iris[2], 0.18 + rnd() * 0.2);
      g.beginPath(); g.ellipse(Math.cos(an) * r0, Math.sin(an) * r0, 4 + rnd() * 9, 2 + rnd() * 4, an, 0, TAU); g.fill();
    }
    g.strokeStyle = rgba(look.iris[1], 0.55);   // collarette
    g.lineWidth = 9;
    g.beginPath();
    for (i = 0; i <= 90; i++) {
      an = (i / 90) * TAU;
      var rr = R * (0.37 + 0.035 * Math.sin(an * 9) + 0.02 * Math.sin(an * 23 + 1));
      if (i) g.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); else g.moveTo(Math.cos(an) * rr, Math.sin(an) * rr);
    }
    g.stroke();
    var limb = g.createRadialGradient(0, 0, R * 0.76, 0, 0, R);   // limbal ring
    limb.addColorStop(0, 'rgba(18,12,9,0)'); limb.addColorStop(0.72, 'rgba(18,12,9,0.5)'); limb.addColorStop(1, 'rgba(18,12,9,0.72)');
    g.fillStyle = limb; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    g.globalCompositeOperation = 'destination-in';                // soft edge where cornea meets sclera
    var edge = g.createRadialGradient(0, 0, R * 0.93, 0, 0, R);
    edge.addColorStop(0, 'rgba(0,0,0,1)'); edge.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = edge; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    return c;
  }

  // One brow, as the patient's right brow: nasal end toward +x. Hairs follow the natural flow —
  // upright at the head, then sweeping toward the tail and converging on the midline.
  function makeBrow(look) {
    var B = BROW, c = canvas(B.w * B.res, B.h * B.res), g = c.getContext('2d'), rnd = rng(23), i;
    var p0 = [15, 2.6], p1 = [7.5, -2.4], p2 = [-7, -5.6], p3 = [-21.5, -0.6];
    function thick(t) { return t < 0.5 ? lerp(4.6, 4, t / 0.5) : 0.5 + 3.5 * (1 - Math.pow((t - 0.5) / 0.5, 1.2)); }
    g.scale(B.res, B.res); g.translate(-B.x0, -B.y0);
    g.lineCap = 'round';
    // soft underpainting: the same shape laid down several times, each pass narrower
    [0.56, 0.47, 0.38, 0.29, 0.2, 0.11].forEach(function (f) {
      g.fillStyle = rgba(look.brow, 0.13);
      g.beginPath();
      for (i = 0; i <= 24; i++) {
        var t = 0.02 + 0.96 * i / 24, p = bez(p0, p1, p2, p3, t), tg = bezTan(p0, p1, p2, p3, t), th = thick(t) * f + 0.15;
        if (i) g.lineTo(p[0] + tg[1] * th, p[1] - tg[0] * th); else g.moveTo(p[0] + tg[1] * th, p[1] - tg[0] * th);
      }
      for (i = 24; i >= 0; i--) {
        var t2 = 0.02 + 0.96 * i / 24, q = bez(p0, p1, p2, p3, t2), tq = bezTan(p0, p1, p2, p3, t2), th2 = thick(t2) * f + 0.15;
        g.lineTo(q[0] - tq[1] * th2, q[1] + tq[0] * th2);
      }
      g.closePath(); g.fill();
    });
    // hairs
    for (i = 0; i < 380; i++) {
      var ht = 0.015 + 0.97 * Math.pow(rnd(), 0.95), u = (rnd() - 0.5) * 0.9;
      var hp = bez(p0, p1, p2, p3, ht), tn = bezTan(p0, p1, p2, p3, ht);
      // tangent runs head -> tail (toward -x); "up" normal has negative y
      var nx = tn[1], ny = -tn[0];
      if (ny > 0) { nx = -nx; ny = -ny; }
      var bx = hp[0] + nx * u * thick(ht), by = hp[1] + ny * u * thick(ht);
      var upMix = clamp(1 - ht / 0.2, 0, 1);                        // upright near the head
      var conv = -u * 0.8;                                          // lean toward the spine
      var dx = tn[0] + nx * conv, dy = tn[1] + ny * conv;
      dx = lerp(dx, -0.45, upMix * 0.85); dy = lerp(dy, -1, upMix * 0.85);
      var dl = Math.sqrt(dx * dx + dy * dy) || 1; dx /= dl; dy /= dl;
      var len = (1.3 + rnd() * 1.5) * (1 - 0.35 * ht) * (1 - 0.3 * upMix);
      var pick = rnd();
      g.strokeStyle = pick < 0.3 ? rgba(look.lash, 0.45 + rnd() * 0.4) : pick > 0.92 ? rgba(look.hairLight, 0.45) : rgba(look.brow, 0.5 + rnd() * 0.45);
      g.lineWidth = 0.13 + rnd() * 0.15;
      var bend = (rnd() - 0.5) * 0.35;
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(bx + dx * len * 0.5 - dy * bend, by + dy * len * 0.5 + dx * bend, bx + dx * len, by + dy * len);
      g.stroke();
    }
    return c;
  }

  function makeLashes(seed) {
    var rnd = rng(seed), up = [], lo = [], i;
    for (i = 0; i < 32; i++) up.push({ t: 0.1 + 0.87 * (i + rnd() * 0.9) / 32, len: 0.75 + rnd() * 0.5, lean: (rnd() - 0.5) * 0.36, curl: 0.25 + rnd() * 0.3, w: 0.13 + rnd() * 0.08 });
    for (i = 0; i < 15; i++) lo.push({ t: 0.06 + 0.74 * (i + rnd() * 0.8) / 15, len: 0.7 + rnd() * 0.6, lean: (rnd() - 0.5) * 0.4 });
    return { up: up, lo: lo };
  }

  /* ---------- the face ---------- */

  function Face(canvasEl) {
    this.canvas = canvasEl;
    this.ctx = canvasEl.getContext('2d');
    this.W = 0; this.H = 0; this.dpr = 1;
    this.eyeScreen = { R: { x: 0, y: 0 }, L: { x: 0, y: 0 } };
    this.eyeLine = 0.47;       // where the eyes sit, as a fraction of the canvas height
    this.lashes = { R: makeLashes(3), L: makeLashes(4) };
    var tex = sharedTextures();
    this.dabs = this.ctx.createPattern(tex.dabs, 'repeat');
    try { this.dabs.setTransform(new DOMMatrix([0.27, 0, 0, 0.27, 0, 0])); } catch (e) { this.dabs = null; }
    this.grain = this.ctx.createPattern(tex.grain, 'repeat');
    this.setLook(LOOKS[0]);
    this.resize();
  }

  Face.prototype.setLook = function (look) {
    this.look = look;
    this.irisTex = makeIris(look);
    this.browTex = makeBrow(look);
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
    this.scale = Math.min(w / 112, h / 58, 9.5);     // px per mm: both eyes with a little margin
    this.cx = w / 2;
    this.cy = h * this.eyeLine;
  };

  // Gaze direction for a point on the canvas (used by the home screen, where the eyes follow the pointer).
  Face.prototype.screenToAngle = function (x, y) {
    return { tx: clamp((this.cx - x) / (this.W / 2) * 36, -40, 40), ty: clamp((this.cy - y) / (this.H / 2) * 26, -30, 30) };
  };

  /* frame: output of Sim.step. view: { bg, head:{yaw,pitch,roll}, light:{x,y}, cover:{R,L} 0..1, seeThrough } */
  Face.prototype.draw = function (frame, view) {
    var ctx = this.ctx, L = this.look, self = this;
    var head = view.head || { yaw: 0, pitch: 0, roll: 0 };
    // step back a little when the head is tilted, so the higher and the lower eye both fit
    var s = this.scale * (1 - 0.22 * Math.abs(Math.sin(head.roll * DEG)));
    this.drawScale = s;
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
      g.addColorStop(0.55, rgba(color, alpha * 0.42));
      g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
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
    // the turn of the head toward the temples
    var eL = P(-77, 0, -52)[0], eR = P(77, 0, -52)[0];
    var side = ctx.createLinearGradient(eL, 0, eR, 0);
    side.addColorStop(0, rgba(L.deep, 0.5)); side.addColorStop(0.1, rgba(L.shade, 0.42)); side.addColorStop(0.26, rgba(L.shade, 0));
    side.addColorStop(0.74, rgba(L.shade, 0)); side.addColorStop(0.9, rgba(L.shade, 0.42)); side.addColorStop(1, rgba(L.deep, 0.5));
    ctx.fillStyle = side; ctx.fillRect(-220, -220, 440, 440);
    glow(P(0, -52, 2), 54, L.light, 0.62, 1.4);            // forehead
    glow(P(0, -19, 6), 13, L.light, 0.3, 1.3);             // glabella
    [-1, 1].forEach(function (sd) {
      glow(P(sd * 42, -29, 0), 15, L.light, 0.28, 1.7);    // brow ridge
      glow(P(sd * 31, -6, -2), 27, L.shade, 0.5, 1.3);     // orbit
      glow(P(sd * 18.5, -5, 2), 11, L.deep, 0.3, 0.85);    // the hollow beside the root of the nose
      glow(P(sd * 12, 13, 8), 30, L.shade, 0.3, 0.3);      // flank of the nose
      glow(P(sd * 38, 21, -5), 15, L.light, 0.34, 1.7);    // top of the cheek
      glow(P(sd * 48, 37, -13), 31, L.blush, 0.36, 1.12);  // cheek
      glow(P(sd * 66, 20, -40), 22, L.warm, 0.2, 0.7);     // temple, cheekbone edge
    });
    glow(P(0, 12, 16), 36, L.light, 0.55, 0.15);           // dorsum of the nose
    glow(P(0, 44, 24), 10, L.light, 0.55, 1);              // tip
    glow(P(0, 43, 22), 15, L.blush, 0.22, 1.2);
    glow(P(0, 57, 14), 10, L.deep, 0.42, 1.9);             // shadow under the tip
    [-1, 1].forEach(function (sd) {
      glow(P(sd * 13.5, 49, 9), 8, L.shade, 0.4, 0.75);    // ala
      var np = P(sd * 7.5, 53.6, 15);
      ctx.save(); ctx.translate(np[0], np[1]); ctx.rotate(sd * 0.32); ctx.scale(1.75, 1);
      var ng = ctx.createRadialGradient(0, 0, 0, 0, 0, 2.3);
      ng.addColorStop(0, rgba(L.lash, 0.78)); ng.addColorStop(0.6, rgba(L.deep, 0.6)); ng.addColorStop(1, rgba(L.deep, 0));
      ctx.fillStyle = ng; ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, TAU); ctx.fill(); ctx.restore();
      ctx.strokeStyle = rgba(L.deep, 0.32); ctx.lineWidth = 0.35;
      ctx.beginPath(); M(P(sd * 13.8, 46.5, 9)); Q(P(sd * 16, 51, 8), P(sd * 12.6, 54.8, 9)); ctx.stroke();
    });
    // mouth
    glow(P(0, 67, 14), 9, L.shade, 0.22, 0.7);
    ctx.fillStyle = L.lip;
    ctx.beginPath();
    M(P(-23, 77, 9)); Q(P(-9, 71, 14), P(0, 74, 15)); Q(P(9, 71, 14), P(23, 77, 9));
    Q(P(0, 92, 14), P(-23, 77, 9));
    ctx.fill();
    glow(P(0, 83, 15), 9, L.light, 0.3, 1.4);
    ctx.strokeStyle = rgba(L.deep, 0.6); ctx.lineWidth = 0.5;
    ctx.beginPath(); M(P(-23, 77, 9)); Q(P(0, 80, 15), P(23, 77, 9)); ctx.stroke();
    // brush texture
    if (this.dabs) {
      ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = this.dabs;
      ctx.fillRect(-220, -220, 440, 440);
      ctx.globalCompositeOperation = 'source-over';
    }
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

    this.drawOccluder(ctx, view);

    // paper grain over the whole painting
    if (this.grain) {
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = this.grain;
      ctx.fillRect(0, 0, this.W, this.H);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
  };

  Face.prototype.drawEye = function (ctx, key, e, light, P, head) {
    var L = this.look, lash = this.lashes[key];
    var n = key === 'R' ? 1 : -1;                 // nasal direction on screen
    var c = P(key === 'R' ? -32 : 32, 0, 0);
    var sxl = Math.cos(head.yaw * DEG) - 0.22 * n * Math.sin(head.yaw * DEG);
    var syl = Math.cos(head.pitch * DEG);
    var i, t, p;

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
    var open = clamp(0.28 + U / 6, -0.6, 1);      // which way the lashes point

    var mc = [n * 15.3, 1.6], lc = [-n * 14.3, -0.8];
    var u1 = [n * 9.8, -U / 0.75 + 0.3], u2 = [-n * 6, -U / 0.75 - 0.45];
    var l1 = [-n * 7.6, Lo / 0.75 + 0.35], l2 = [n * 7.2, Lo / 0.75 - 0.75];
    function upper() { ctx.moveTo(mc[0], mc[1]); ctx.bezierCurveTo(u1[0], u1[1], u2[0], u2[1], lc[0], lc[1]); }
    function lower() { ctx.bezierCurveTo(l1[0], l1[1], l2[0], l2[1], mc[0], mc[1]); }
    function spot(x, y, r, color, alpha, sx, rot) {
      ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); ctx.scale(sx || 1, 1);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(color, alpha)); g.addColorStop(0.55, rgba(color, alpha * 0.42)); g.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
    }

    // the thin, warmer skin around the eye
    var crease = clamp(-(7.6 + 0.42 * (U - 4.2)), -10.6, -3.4);
    spot(-n * 1, crease - 2.2, 12, L.warm, 0.36, 1.7);          // sulcus under the brow
    spot(n * 9.5, crease + 0.5, 6.5, L.deep, 0.3, 1.25);        // deepest toward the nose
    spot(-n * 12, -2, 8, L.warm, 0.22, 1.1);                    // outer corner
    spot(-n * 1.5, Lo + 3.2, 9, L.warm, 0.22, 2);               // under the lower lid
    spot(n * 8.5, Lo + 4.6, 5.5, L.deep, 0.2, 1.7, n * 0.35);   // tear trough

    // brow (lifts when the frontalis compensates for ptosis)
    var by = -15.6 - (e.browLift || 0) - Math.max(0, e.ptosis) * 1.6;
    ctx.save();
    ctx.translate(0, by);
    ctx.scale(n, 1);
    ctx.drawImage(this.browTex, BROW.x0, BROW.y0, BROW.w, BROW.h);
    ctx.restore();

    if (e.bruise) {
      spot(-n * 5, 9, 14, '#6B3A5E', 0.45, 1.5);
      spot(-n * 13, -5, 10, '#7A4A3C', 0.35, 1);
      spot(n * 6, 8, 8, '#8A7A3A', 0.18, 1.4);
    }

    // ---- the globe, seen through the palpebral fissure ----
    ctx.save();
    ctx.beginPath(); upper(); lower(); ctx.closePath(); ctx.clip();
    var sg = ctx.createRadialGradient(-n * 0.5, 0.6, 2, -n * 0.5, 0.6, 17);
    sg.addColorStop(0, '#F8F4EF'); sg.addColorStop(0.55, '#EDE5DC'); sg.addColorStop(1, '#C3B5AA');
    ctx.fillStyle = sg;
    ctx.fillRect(-19, -13, 38, 26);
    spot(mc[0] - n * 1.5, mc[1], 7.5, '#C98678', 0.5, 1);       // nasal conjunctiva
    spot(lc[0], lc[1] + 0.5, 6.5, '#A8958A', 0.4, 1);
    // fine vessels
    ctx.strokeStyle = 'rgba(190,96,84,0.2)'; ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(n * 13, 0.8); ctx.quadraticCurveTo(n * 10.5, -0.4, n * 8.4, 0.6);
    ctx.moveTo(n * 12.6, 2); ctx.quadraticCurveTo(n * 10.4, 2.6, n * 8.8, 2);
    ctx.moveTo(-n * 13, 0.6); ctx.quadraticCurveTo(-n * 11, 1.4, -n * 9.4, 0.5);
    ctx.stroke();
    // plica and caruncle
    spot(n * 12.4, 1.2, 2.3, '#DFA39A', 0.85, 0.8);
    ctx.fillStyle = '#D5847C';
    ctx.beginPath(); ctx.ellipse(n * 13.9, 1.45, 1.9, 1.5, 0, 0, TAU); ctx.fill();
    spot(n * 13.5, 1, 1, '#F8D3CC', 0.85, 1);
    if (e.bruise) spot(-n * 10.5, 2.5, 5.5, '#B3261E', 0.9, 1);

    // iris and pupil
    var pr = clamp(e.pupil, 1.5, 9) * 0.56;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(Math.cos(e.x * DEG), Math.cos(e.y * DEG));
    ctx.rotate(-n * e.t * DEG);
    ctx.drawImage(this.irisTex, -IRIS_R, -IRIS_R, IRIS_R * 2, IRIS_R * 2);
    var pg = ctx.createRadialGradient(0, 0, pr * 0.82, 0, 0, pr * 1.08);
    pg.addColorStop(0, 'rgba(8,6,5,1)'); pg.addColorStop(1, 'rgba(8,6,5,0)');
    ctx.fillStyle = pg;
    ctx.beginPath(); ctx.arc(0, 0, pr * 1.08, 0, TAU); ctx.fill();
    ctx.restore();

    // corneal light reflex of the fixation light (Hirschberg), and the glow it throws into the iris
    var rx = -R_ROT * (0.553 * Math.sin(e.x * DEG) + 0.379 * Math.sin(light.x * DEG)) + n * 0.3;
    var ry = -R_ROT * (0.553 * Math.sin(e.y * DEG) + 0.379 * Math.sin(light.y * DEG));
    spot(ex - (rx - ex) * 0.5 + n * 1.6, ey + 2.6, 3.2, '#FFFFFF', 0.16, 1.2);
    spot(rx, ry, 1.9, '#FFFFFF', 0.5, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.97)';
    ctx.beginPath(); ctx.arc(rx, ry, 0.7, 0, TAU); ctx.fill();

    // shadow cast by the upper lid and lashes
    ctx.strokeStyle = 'rgba(46,22,14,0.08)'; ctx.lineWidth = 6.5;
    ctx.beginPath(); upper(); ctx.stroke();
    ctx.strokeStyle = 'rgba(46,22,14,0.2)'; ctx.lineWidth = 2.8;
    ctx.beginPath(); upper(); ctx.stroke();
    // lower lid margin: the pink waterline with a wet highlight
    ctx.strokeStyle = 'rgba(226,160,148,0.95)'; ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(lc[0], lc[1]); lower(); ctx.stroke();
    ctx.save(); ctx.translate(0, -0.78);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 0.2;
    ctx.beginPath(); ctx.moveTo(lc[0] + n * 4, lc[1] + 1.2); ctx.bezierCurveTo(l1[0], l1[1], l2[0], l2[1], mc[0] - n * 4, mc[1] + 0.6); ctx.stroke();
    ctx.restore();
    ctx.restore();

    // ---- lids ----
    // lid platform: a soft sheen between lash line and crease
    spot(-n * 0.5, (crease - U) / 2 - 0.2, 4.4, L.light, 0.34, 2.7);
    // crease: a soft shadow with a fine line in it
    ctx.beginPath();
    ctx.moveTo(n * 13.6, -1.2);
    ctx.bezierCurveTo(n * 8.5, crease / 0.75 + 1.9, -n * 7, crease / 0.75 + 0.6, -n * 15.8, -2.2);
    ctx.strokeStyle = rgba(L.deep, 0.16); ctx.lineWidth = 1.9; ctx.stroke();
    ctx.strokeStyle = rgba(L.deep, 0.62); ctx.lineWidth = 0.3; ctx.stroke();

    // lower lid: margin, a highlight on the pretarsal roll, and the fold beneath
    ctx.strokeStyle = rgba(L.deep, 0.5); ctx.lineWidth = 0.28;
    ctx.beginPath(); ctx.moveTo(lc[0], lc[1]); lower(); ctx.stroke();
    spot(-n * 1, Lo + 1.5, 4.2, L.light, 0.3, 2.9);
    ctx.beginPath();
    ctx.moveTo(n * 12.4, Lo * 0.55 + 2.6);
    ctx.quadraticCurveTo(-n * 0.5, Lo + 6, -n * 13.5, Lo * 0.45 + 2.2);
    ctx.strokeStyle = rgba(L.deep, 0.1); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = rgba(L.deep, 0.26); ctx.lineWidth = 0.22; ctx.stroke();
    // canthal folds
    ctx.strokeStyle = rgba(L.deep, 0.5); ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.moveTo(mc[0], mc[1]); ctx.lineTo(mc[0] + n * 1.5, mc[1] + 0.7);
    ctx.moveTo(lc[0], lc[1]); ctx.quadraticCurveTo(lc[0] - n * 1.6, lc[1] + 0.1, lc[0] - n * 2.6, lc[1] + 1);
    ctx.stroke();

    // lash line: a dark band that thickens toward the outer third
    var N = 22, edge = [];
    ctx.fillStyle = L.lash;
    ctx.beginPath();
    for (i = 0; i <= N; i++) {
      t = i / N; p = bez(mc, u1, u2, lc, t);
      if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
    }
    for (i = N; i >= 0; i--) {
      t = i / N; p = bez(mc, u1, u2, lc, t);
      var tg = bezTan(mc, u1, u2, lc, t), nx = tg[1], ny = -tg[0];
      if (ny > 0) { nx = -nx; ny = -ny; }
      var th = 0.16 + 0.78 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.72)), 1.4) + (t > 0.9 ? 0.25 : 0);
      edge[i] = [p[0] + nx * th, p[1] + ny * th, nx, ny];
      ctx.lineTo(edge[i][0], edge[i][1]);
    }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = L.lash; ctx.lineWidth = 0.34;          // small outer wing
    ctx.beginPath(); ctx.moveTo(lc[0], lc[1]); ctx.quadraticCurveTo(lc[0] - n * 0.9, lc[1] - 0.3 * open, lc[0] - n * 1.7, lc[1] - 0.9 * open); ctx.stroke();

    // upper lashes: fine, curved, longer and more swept toward the outer corner
    ctx.strokeStyle = L.lash;
    for (i = 0; i < lash.up.length; i++) {
      var h = lash.up[i];
      t = h.t; p = bez(mc, u1, u2, lc, t);
      var growth = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62) * 0.94), 0.8);
      var len = (0.75 + 1.75 * growth) * h.len;
      var lean = (t - 0.14) * 1.5 + h.lean;       // upright at the nose, swept out toward the temple
      var vx = -n * Math.sin(lean) * len, vy = -Math.cos(lean) * len * open;
      var kx = vx * (0.45 + h.curl) - n * 0, ky = vy * (0.5 - h.curl);
      ctx.lineWidth = h.w;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] - 0.2);
      ctx.quadraticCurveTo(p[0] + kx, p[1] + ky, p[0] + vx, p[1] + vy);
      ctx.stroke();
      ctx.lineWidth = h.w * 1.6;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] - 0.2);
      ctx.quadraticCurveTo(p[0] + kx * 0.4, p[1] + ky * 0.4, p[0] + vx * 0.38 + kx * 0.2, p[1] + vy * 0.38 + ky * 0.2);
      ctx.stroke();
    }
    // lower lashes: sparse and short
    ctx.strokeStyle = rgba(L.lash, 0.62);
    for (i = 0; i < lash.lo.length; i++) {
      var g2 = lash.lo[i];
      p = bez(lc, l1, l2, mc, g2.t);
      var ln = (0.45 + 0.6 * Math.sin(Math.PI * (1 - g2.t) * 0.8)) * g2.len;
      var le = (0.5 - g2.t) * 1.1 + g2.lean;
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1] + 0.1);
      ctx.quadraticCurveTo(p[0] - n * Math.sin(le) * ln * 0.3, p[1] + ln * 0.75, p[0] - n * Math.sin(le) * ln, p[1] + ln * 0.95);
      ctx.stroke();
    }
    ctx.restore();
  };

  Face.prototype.drawOccluder = function (ctx, view) {
    var self = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ['R', 'L'].forEach(function (key) {
      var a = view.cover ? view.cover[key] : 0;
      if (a <= 0.01) return;
      var c = self.eyeScreen[key], s = self.drawScale || self.scale, out = key === 'R' ? -1 : 1;
      var ease = 1 - Math.pow(1 - a, 3);
      var x = c.x + out * (1 - ease) * 60 * s, y = c.y + 1 * s;
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = ease;
      ctx.fillStyle = view.seeThrough ? 'rgba(18,24,28,0.66)' : 'rgba(18,22,26,0.98)';
      ctx.beginPath();
      ctx.moveTo(out * 12 * s, 14 * s);
      ctx.lineTo(out * 30 * s, 62 * s);
      ctx.lineTo(out * 39 * s, 58 * s);
      ctx.lineTo(out * 20 * s, 10 * s);
      ctx.closePath(); ctx.fill();
      var g = ctx.createRadialGradient(-out * 6 * s, -6 * s, 2 * s, 0, 0, 25 * s);
      if (view.seeThrough) { g.addColorStop(0, 'rgba(40,52,60,0.4)'); g.addColorStop(1, 'rgba(14,20,24,0.58)'); }
      else { g.addColorStop(0, 'rgba(52,60,66,0.98)'); g.addColorStop(1, 'rgba(14,18,22,0.99)'); }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, 0, 24 * s, 19 * s, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = view.seeThrough ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.ellipse(0, 0, 24 * s - 1, 19 * s - 1, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    });
  };

  CG.Face = Face;
  CG.looks = LOOKS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
