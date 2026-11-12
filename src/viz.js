/* Cardinal Gaze — the Hess chart and the patient's own view of the target. */
(function (root) {
  'use strict';
  var CG = (root.CG = root.CG || {});
  var E = CG.engine;

  function f1(n) { return (Math.round(n * 10) / 10).toFixed(1); }

  /* Hess chart. Each field is plotted in the patient's own left/right, so the temporal
     side of the right eye's field is on the right. */
  function hessSVG(cfg) {
    var h = E.hess(cfg);
    var F = 150, k = F / 64, top = 30, W = 360, H = top + F + 16;
    var muscles = {
      R: { tl: 'IO', tr: 'SR', l: 'MR', r: 'LR', bl: 'SO', br: 'IR' },
      L: { tl: 'SR', tr: 'IO', l: 'LR', r: 'MR', bl: 'IR', br: 'SO' }
    };
    function field(key, x0) {
      var cx = x0 + F / 2, cy = top + F / 2, cls = key === 'R' ? 're' : 'le', m = muscles[key], s = '', d;
      function X(deg) { return f1(cx + Math.max(-32, Math.min(32, deg)) * k); }
      function Y(deg) { return f1(cy - Math.max(-32, Math.min(32, deg)) * k); }
      function poly(pts) { return pts.map(function (p) { return X(p[0]) + ',' + Y(p[1]); }).join(' '); }
      s += '<rect class="h-bg" x="' + x0 + '" y="' + top + '" width="' + F + '" height="' + F + '" rx="4"/>';
      for (d = -30; d <= 30; d += 5) {
        var c = d === 0 ? 'h-grid h-axis' : 'h-grid';
        s += '<line class="' + c + '" x1="' + X(d) + '" y1="' + Y(-32) + '" x2="' + X(d) + '" y2="' + Y(32) + '"/>';
        s += '<line class="' + c + '" x1="' + X(-32) + '" y1="' + Y(d) + '" x2="' + X(32) + '" y2="' + Y(d) + '"/>';
      }
      s += '<polygon class="h-norm" points="' + poly(h.innerTargets) + '"/>';
      s += '<polygon class="h-norm" points="' + poly(h.outerTargets) + '"/>';
      s += '<polygon class="h-field h-' + cls + '" points="' + poly(h[key].outer) + '"/>';
      s += '<polygon class="h-field h-inner h-' + cls + '" points="' + poly(h[key].inner) + '"/>';
      h[key].inner.concat(h[key].outer, [h[key].centre]).forEach(function (p) {
        s += '<circle class="h-dot h-' + cls + '" cx="' + X(p[0]) + '" cy="' + Y(p[1]) + '" r="1.7"/>';
      });
      s += '<text class="h-title h-' + cls + '" x="' + cx + '" y="11" text-anchor="middle">' +
           (key === 'R' ? 'Right eye' : 'Left eye') + '</text>';
      s += '<text class="h-sub" x="' + cx + '" y="22" text-anchor="middle">' +
           (key === 'R' ? 'left eye fixing' : 'right eye fixing') + '</text>';
      var yt = top + 9, yb = top + F - 4, xl = x0 + 4, xr = x0 + F - 4;
      s += '<text class="h-mus" x="' + xl + '" y="' + yt + '">' + m.tl + '</text>';
      s += '<text class="h-mus" x="' + xr + '" y="' + yt + '" text-anchor="end">' + m.tr + '</text>';
      s += '<text class="h-mus" x="' + xl + '" y="' + (cy - 3) + '">' + m.l + '</text>';
      s += '<text class="h-mus" x="' + xr + '" y="' + (cy - 3) + '" text-anchor="end">' + m.r + '</text>';
      s += '<text class="h-mus" x="' + xl + '" y="' + yb + '">' + m.bl + '</text>';
      s += '<text class="h-mus" x="' + xr + '" y="' + yb + '" text-anchor="end">' + m.br + '</text>';
      return s;
    }
    return '<svg class="hess" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Hess chart of both eyes">' +
      field('L', 14) + field('R', W - 14 - F) +
      '<text class="h-sub" x="' + (W / 2) + '" y="' + (H - 3) + '" text-anchor="middle">dashed: normal 15° and 30° fields</text>' +
      '</svg>';
  }

  /* What the patient sees. Two targets:
       light — a bar of light, one image per eye (red is the right eye, green the left)
       w4d   — the Worth 4 dot lights through red-green glasses: the right eye (red lens) sees the red
               light and the white one as red; the left eye (green lens) sees the two green lights and
               the white one as green. */
  function DiploView(el) {
    var W = 360, H = 150, s = '', d;
    this.cx = W / 2; this.cy = H / 2; this.mode = 'light';
    function grid(cls, k) {
      var g = '<g class="' + cls + '">';
      for (d = -25; d <= 25; d += 5) if (Math.abs(d * k) < W / 2 - 6) g += '<line class="d-grid" x1="' + (W / 2 + d * k) + '" y1="6" x2="' + (W / 2 + d * k) + '" y2="' + (H - 6) + '"/>';
      for (d = -10; d <= 10; d += 5) if (Math.abs(d * k) < H / 2 - 6) g += '<line class="d-grid" x1="6" y1="' + (H / 2 + d * k) + '" x2="' + (W - 6) + '" y2="' + (H / 2 + d * k) + '"/>';
      return g + '</g>';
    }
    s += '<svg class="diplo" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="The target as the patient sees it">';
    s += '<rect class="d-bg" x="0" y="0" width="' + W + '" height="' + H + '" rx="10"/>';
    s += grid('d-g-light', 6.2) + grid('d-g-w4d', 9);
    s += '<text class="d-side" x="10" y="' + (H - 9) + '">patient’s left</text>';
    s += '<text class="d-side" x="' + (W - 10) + '" y="' + (H - 9) + '" text-anchor="end">patient’s right</text>';
    s += '<g class="d-img d-le"><rect x="-23" y="-3.2" width="46" height="6.4" rx="3.2"/></g>';
    s += '<g class="d-img d-re"><rect x="-23" y="-3.2" width="46" height="6.4" rx="3.2"/></g>';
    s += '<g class="d-img d-one"><rect x="-23" y="-3.2" width="46" height="6.4" rx="3.2"/></g>';
    ['lLeft d-le', 'lRight d-le', 'lBot d-le', 'rTop d-re', 'rBot d-re', 'fBot d-one'].forEach(function (c) {
      s += '<circle class="d-dot ' + c + '" r="6.5"/>';
    });
    s += '</svg>';
    el.innerHTML = s;
    this.el = el;
    this.gR = el.querySelector('g.d-re');
    this.gL = el.querySelector('g.d-le');
    this.gOne = el.querySelector('g.d-one');
    this.dots = {};
    var self = this;
    ['lLeft', 'lRight', 'lBot', 'rTop', 'rBot', 'fBot'].forEach(function (n) { self.dots[n] = el.querySelector('.' + n); });
    this.setMode('light');
  }

  DiploView.prototype.setMode = function (mode) {
    this.mode = mode;
    this.k = mode === 'w4d' ? 9 : 6.2;
    this.el.querySelector('.d-g-light').style.display = mode === 'w4d' ? 'none' : '';
    this.el.querySelector('.d-g-w4d').style.display = mode === 'w4d' ? '' : 'none';
  };

  // Returns { state } — 'mono' (one eye sees), 'single', 'suppress' or 'double' — plus, for the
  // Worth 4 dot target, how many lights of each colour the patient reports.
  DiploView.prototype.update = function (frame, cfg, distCm) {
    var sol = frame.sol, fixKey = sol.fix, f = frame.eyes[fixKey], self = this, k = this.k, n;
    function img(key) {
      var e = frame.eyes[key], sgn = key === 'R' ? 1 : -1, fs = fixKey === 'R' ? 1 : -1;
      return { x: -(e.errX - f.errX), y: -(e.errY - f.errY), rot: -sgn * e.t + fs * f.t };
    }
    function hide(el) { el.style.display = 'none'; }
    var R = img('R'), L = img('L');
    var seeR = frame.eyes.R.seeing, seeL = frame.eyes.L.seeing;
    var sep = Math.abs(R.x - L.x) + Math.abs(R.y - L.y), tilt = Math.abs(R.rot - L.rot);
    var state;
    if (!seeR || !seeL) state = 'mono';
    else if (sep < 0.5 && tilt < 2) state = 'single';
    else if (cfg.suppression) state = 'suppress';
    else state = 'double';
    var showR = state === 'double' || (state === 'mono' && seeR) || (state === 'suppress' && fixKey === 'R');
    var showL = state === 'double' || (state === 'mono' && seeL) || (state === 'suppress' && fixKey === 'L');
    var zero = { x: 0, y: 0, rot: 0 };
    if (state !== 'double') { R = zero; L = zero; }

    if (this.mode === 'light') {
      for (n in this.dots) hide(this.dots[n]);
      var bar = function (g, im, on) {
        g.style.display = on ? '' : 'none';
        if (!on) return;
        var x = Math.max(-26, Math.min(26, im.x)), y = Math.max(-10, Math.min(10, im.y));
        g.setAttribute('transform', 'translate(' + f1(self.cx + x * k) + ' ' + f1(self.cy - y * k) + ') rotate(' + f1(im.rot) + ')');
      };
      bar(this.gR, R, state === 'double');
      bar(this.gL, L, state === 'double');
      bar(this.gOne, zero, state !== 'double' && (seeR || seeL));
      return { state: state };
    }

    hide(this.gR); hide(this.gL); hide(this.gOne);
    var h = Math.max(1.3, Math.min(3.2, 3 * 33 / (distCm || 600)));       // half the height of the diamond, degrees
    var limX = 19 - h, limY = 7.4 - h;
    var rad = f1(Math.max(3.4, Math.min(6.5, h * k * 0.42)));          // smaller lights for the distance target
    var dot = function (name, im, px, py, on) {
      var el = self.dots[name];
      el.style.display = on ? '' : 'none';
      if (!on) return;
      el.setAttribute('r', rad);
      var a = -im.rot * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
      var x = Math.max(-limX, Math.min(limX, im.x)) + px * c - py * sn;
      var y = Math.max(-limY, Math.min(limY, im.y)) + px * sn + py * c;
      el.setAttribute('cx', f1(self.cx + x * k)); el.setAttribute('cy', f1(self.cy - y * k));
    };
    var fused = state === 'single';
    dot('rTop', R, 0, h, showR || fused);
    dot('rBot', R, 0, -h, showR && !fused);
    dot('lLeft', L, -h, 0, showL || fused);
    dot('lRight', L, h, 0, showL || fused);
    dot('lBot', L, 0, -h, showL && !fused);
    dot('fBot', zero, 0, -h, fused);
    return { state: state, red: fused ? 1 : (showR ? 2 : 0), green: fused ? 2 : (showL ? 3 : 0), lights: fused ? 4 : (showR ? 2 : 0) + (showL ? 3 : 0) };
  };

  /* Readout of the current deviation, the way a prism cover measurement would report it. */
  function describe(sol) {
    var d = sol.dev, out = { h: 'None', v: 'None', t: 'None', hKind: '', vKind: '' };
    if (Math.abs(d.eso) >= 0.4) {
      out.hKind = d.eso > 0 ? 'eso' : 'exo';
      out.h = Math.round(E.prism(d.eso)) + 'Δ ' + out.hKind;
    }
    if (Math.abs(d.rHyper) >= 0.4) {
      out.vKind = d.rHyper > 0 ? 'R' : 'L';
      out.v = Math.round(E.prism(d.rHyper)) + 'Δ ' + out.vKind + ' hyper';
    }
    var parts = [];
    if (Math.abs(d.tR) >= 1.5) parts.push('R ' + Math.round(Math.abs(d.tR)) + '° ' + (d.tR > 0 ? 'ex' : 'in'));
    if (Math.abs(d.tL) >= 1.5) parts.push('L ' + Math.round(Math.abs(d.tL)) + '° ' + (d.tL > 0 ? 'ex' : 'in'));
    if (parts.length) out.t = parts.join(', ');
    return out;
  }

  CG.viz = { hessSVG: hessSVG, DiploView: DiploView, describe: describe };
})(typeof globalThis !== 'undefined' ? globalThis : this);
