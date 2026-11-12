// Clinical sanity checks for the motility model. Run with: node test/engine.test.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../src/engine.js');
require('../src/conditions.js');

const { engine: E, conditions: C } = globalThis.CG;
const verbose = process.argv.includes('-v');

const base = { tx: 0, ty: 0, dist: 600, yaw: 0, pitch: 0, roll: 0, cover: null, lidsLifted: true };
const at = (cfg, o) => E.solve(cfg, Object.assign({}, base, o));
const cfgOf = (id, side) => C.byId[id].build(side || 'R');

let passed = 0;
function check(name, fn) {
  try { fn(); passed++; if (verbose) console.log('  ok  ' + name); }
  catch (err) { console.error('FAIL  ' + name + '\n      ' + err.message); process.exitCode = 1; }
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} ± ${tol}, got ${a.toFixed(2)}`);

if (verbose) {
  for (const c of C.list) {
    const cfg = c.build('R');
    const row = [[-30, 0], [0, 0], [30, 0], [0, 25], [0, -25]].map(([tx, ty]) => {
      const s = at(cfg, { tx, ty, dissociate: true });
      return `${s.dev.eso.toFixed(1)}/${s.dev.rHyper.toFixed(1)}`;
    });
    console.log(c.id.padEnd(12), 'eso/Rhyper  L:', row[0], ' P:', row[1], ' R:', row[2], ' U:', row[3], ' D:', row[4]);
  }
}

check('normal: orthotropic in all nine positions, both fixations', () => {
  const cfg = cfgOf('normal');
  for (const tx of [-30, 0, 30]) for (const ty of [-25, 0, 25]) for (const fix of ['R', 'L']) {
    const s = at(cfg, { tx, ty, forceFix: fix, dissociate: true });
    near(s.dev.eso, 0, 0.05); near(s.dev.rHyper, 0, 0.05); near(s.err, 0, 0.05);
    near(s.eyes.R.x, tx, 0.4); near(s.eyes.R.y, ty, 0.05);
  }
});

check('normal: converges at 33 cm and breaks inside the near point', () => {
  const cfg = cfgOf('normal');
  const s = at(cfg, { dist: 33 });
  assert.ok(s.fused); near(s.eyes.R.a, -s.demand / 2, 0.05); near(s.eyes.L.a, -s.demand / 2, 0.05);
  assert.ok(!at(cfg, { dist: 6 }).fused);
});

for (const side of ['R', 'L']) {
  const sg = side === 'R' ? 1 : -1, O = side === 'R' ? 'L' : 'R';

  check(`CN VI ${side}: esotropia, worse in ipsilateral gaze, none contralateral`, () => {
    const cfg = cfgOf('cn6', side);
    const p = at(cfg, {}), ipsi = at(cfg, { tx: sg * 30 }), contra = at(cfg, { tx: -sg * 30 });
    assert.ok(p.dev.eso > 8, 'primary eso ' + p.dev.eso);
    assert.ok(ipsi.dev.eso > p.dev.eso + 8, 'ipsi eso ' + ipsi.dev.eso);
    assert.ok(Math.abs(contra.dev.eso) < 2.5, 'contra eso ' + contra.dev.eso);
    assert.equal(p.fix, O);
    assert.ok(ipsi.eyes[side].a < 12, 'abduction should be limited, got ' + ipsi.eyes[side].a);
  });

  check(`CN VI ${side}: secondary deviation exceeds primary`, () => {
    const cfg = cfgOf('cn6', side);
    const prim = at(cfg, {}), sec = at(cfg, { cover: O });
    assert.equal(sec.fix, side);
    assert.ok(sec.dev.eso > prim.dev.eso + 2, `primary ${prim.dev.eso} secondary ${sec.dev.eso}`);
  });

  check(`CN VI ${side}: habitual face turn restores fusion`, () => {
    const cfg = cfgOf('cn6', side);
    assert.ok(!at(cfg, {}).fused);
    assert.ok(at(cfg, { yaw: cfg.posture.yaw }).fused);
  });

  check(`CN IV ${side}: three-step test`, () => {
    const cfg = cfgOf('cn4', side);
    const hyper = (o) => sg * at(cfg, Object.assign({ dissociate: true }, o)).dev.rHyper;   // + = affected eye higher
    const p = hyper({});
    assert.ok(p > 2, 'primary hyper ' + p);
    assert.ok(hyper({ tx: -sg * 30 }) > p + 1.5, 'worse in contralateral gaze');
    assert.ok(hyper({ tx: sg * 30 }) < p - 1, 'better in ipsilateral gaze');
    assert.ok(hyper({ roll: sg * 30 }) > p + 2, 'worse on ipsilateral tilt');
    assert.ok(hyper({ roll: -sg * 30 }) < p - 2, 'better on contralateral tilt');
    assert.ok(hyper({ tx: -sg * 30, ty: -25 }) > hyper({ tx: -sg * 30, ty: 25 }), 'worst down and contralateral');
    assert.ok(at(cfg, {}).eyes[side].t > 3, 'excyclotorsion');
  });

  check(`CN IV ${side}: habitual posture fuses`, () => {
    const cfg = cfgOf('cn4', side);
    assert.ok(at(cfg, cfg.posture).fused);
    assert.ok(!at(cfg, {}).fused);
  });

  check(`CN III ${side}: down and out, only abduction left`, () => {
    const cfg = cfgOf('cn3p', side);
    const p = at(cfg, {});
    assert.ok(p.eyes[side].a > 10, 'exo ' + p.eyes[side].a);
    assert.ok(p.eyes[side].e < -1, 'hypo ' + p.eyes[side].e);
    assert.ok(at(cfg, { tx: -sg * 30 }).eyes[side].a > 0, 'no adduction past midline');
    assert.ok(at(cfg, { ty: 25 }).eyes[side].e < 5, 'no elevation');
    assert.ok(at(cfg, { tx: sg * 30 }).eyes[side].a > 25, 'abducts');
    assert.equal(at(cfg, { lidsLifted: false }).can[side], false, 'ptosis occludes');
  });

  check(`INO ${side}: adduction lag on gaze, convergence intact`, () => {
    const cfg = cfgOf('ino', side);
    near(at(cfg, { dissociate: true }).dev.eso, 0, 0.3);
    const away = at(cfg, { tx: -sg * 30 });
    assert.ok(away.eyes[side].a > -14, 'adduction limited: ' + away.eyes[side].a);
    assert.ok(away.dev.eso < -12, 'exo on gaze away');
    const nearS = at(cfg, { dist: 20 });
    near(nearS.eyes[side].a, -nearS.demand / 2, 0.3, 'converges');
  });

  check(`One-and-a-half ${side}: only the contralateral eye abducts`, () => {
    const cfg = cfgOf('oneandahalf', side);
    const ipsi = at(cfg, { tx: sg * 30 }), contra = at(cfg, { tx: -sg * 30 });
    assert.ok(Math.abs(ipsi.eyes[side].a) < 4 && ipsi.eyes[O].x * sg < 2, 'no ipsilateral gaze');
    assert.ok(Math.abs(contra.eyes[side].a) < 4, 'ipsilateral eye does not adduct');
    assert.ok(contra.eyes[O].a > 25, 'contralateral eye abducts');
    near(at(cfg, { ty: 25 }).eyes[side].e, 25, 0.5, 'vertical gaze spared');
  });

  check(`Gaze palsy ${side}: conjugate, aligned, not overcome by doll's head`, () => {
    const cfg = cfgOf('gaze', side);
    const s = at(cfg, { tx: sg * 30 });
    assert.ok(s.eyes.R.x * sg < 4 && s.eyes.L.x * sg < 4);
    near(s.dev.eso, 0, 0.2);
    const doll = at(cfg, { yaw: -sg * 25, vorX: sg * 25 });
    assert.ok(doll.eyes.R.x * sg < 4, 'VOR does not help a nuclear lesion');
  });

  check(`Brown ${side}: no elevation in adduction, normal in abduction`, () => {
    const cfg = cfgOf('brown', side);
    assert.ok(at(cfg, { tx: -sg * 25, ty: 25 }).eyes[side].e < 3);
    assert.ok(at(cfg, { tx: sg * 25, ty: 25 }).eyes[side].e > 22);
    near(at(cfg, { dissociate: true }).dev.rHyper, 0, 0.3);
  });

  check(`Duane ${side}: abduction blocked, small primary esotropia`, () => {
    const cfg = cfgOf('duane', side);
    assert.ok(at(cfg, { tx: sg * 30 }).eyes[side].a < 2);
    const p = at(cfg, { dissociate: true }).dev.eso;
    assert.ok(p > 1 && p < 6, 'primary eso ' + p);
    assert.ok(at(cfg, { yaw: cfg.posture.yaw }).fused);
  });

  check(`Orbital floor ${side}: straight in primary, limited up and down`, () => {
    const cfg = cfgOf('blowout', side);
    near(at(cfg, { dissociate: true }).dev.rHyper, 0, 0.2);
    assert.ok(at(cfg, { ty: 25 }).eyes[side].e < 12);
    assert.ok(at(cfg, { ty: -25 }).eyes[side].e > -19);
  });

  check(`TED ${side}: hypotropia, increases in upgaze, big secondary deviation`, () => {
    const cfg = cfgOf('ted', side);
    const hypo = (o) => -sg * at(cfg, Object.assign({ dissociate: true }, o)).dev.rHyper;
    assert.ok(hypo({}) > 2);
    assert.ok(hypo({ ty: 20 }) > hypo({}) + 5);
    assert.ok(hypo({ cover: O }) > hypo({}) + 3);
  });

  check(`MED ${side}: elevation limited in adduction and abduction alike`, () => {
    const cfg = cfgOf('med', side);
    const ad = at(cfg, { tx: -sg * 25, ty: 25 }).eyes[side].e, ab = at(cfg, { tx: sg * 25, ty: 25 }).eyes[side].e;
    assert.ok(ad < 14 && ab < 14, `ad ${ad} ab ${ab}`);
    assert.ok(at(cfg, {}).eyes[side].e < -4);
  });

  check(`Skew ${side}: comitant hypertropia, unchanged by tilt, incyclo of the high eye`, () => {
    const cfg = cfgOf('skew', side);
    const h = (o) => sg * at(cfg, Object.assign({ dissociate: true }, o)).dev.rHyper;
    near(h({}), 6, 0.5); near(h({ tx: 30 }), 6, 0.8); near(h({ tx: -30 }), 6, 0.8);
    near(h({ roll: 30 }), h({ roll: -30 }), 0.5);
    assert.ok(at(cfg, {}).eyes[side].t < 0);
  });
}

check('Bilateral CN IV: hypertropia reverses with gaze and tilt, V pattern, large torsion', () => {
  const cfg = cfgOf('cn4bi');
  const d = (o) => at(cfg, Object.assign({ dissociate: true }, o)).dev;
  assert.ok(Math.abs(d({}).rHyper) < 1.5);
  assert.ok(d({ tx: -30 }).rHyper > 2 && d({ tx: 30 }).rHyper < -2);
  assert.ok(d({ roll: 30 }).rHyper > 2 && d({ roll: -30 }).rHyper < -2);
  assert.ok(d({ ty: -25 }).eso - d({ ty: 25 }).eso > 6, 'V pattern');
  const dn = d({ ty: -25 });
  assert.ok(dn.tR + dn.tL > 10, 'torsion in downgaze ' + (dn.tR + dn.tL));
});

check('Bilateral CN VI: esotropia increasing to both sides', () => {
  const cfg = cfgOf('cn6bi');
  const p = at(cfg, {}).dev.eso;
  assert.ok(p > 8);
  assert.ok(at(cfg, { tx: 30 }).dev.eso > p + 1.5 && at(cfg, { tx: -30 }).dev.eso > p + 1.5);
});

check('Comitant ET / XT: same angle in all gazes and with either eye fixing', () => {
  for (const [id, sign] of [['et', 1], ['xt', -1]]) {
    const cfg = cfgOf(id);
    for (const tx of [-30, 0, 30]) for (const fix of ['R', 'L']) {
      near(sign * at(cfg, { tx, forceFix: fix }).dev.eso, 16, 0.6, id);
    }
    assert.equal(at(cfg, { cover: 'R', lastFix: 'R' }).fix, 'L');
    assert.equal(at(cfg, { lastFix: 'L' }).fix, 'L', 'alternates: keeps the last fixing eye');
  }
});

check('Convergence insufficiency: straight at distance, exophoria at near, remote near point', () => {
  const cfg = cfgOf('ci');
  near(at(cfg, { dissociate: true }).dev.eso, 0, 0.5);
  const n = at(cfg, { dist: 33 });
  assert.ok(n.fused);
  assert.ok(at(cfg, { dist: 33, cover: 'R' }).dev.eso < -3, 'near exophoria under cover');
  assert.ok(!at(cfg, { dist: 15 }).fused && at(cfg, { dist: 15 }).dev.eso < -6, 'breaks at 15 cm');
});

check('WEBINO: exotropia in primary, neither eye adducts on gaze, no convergence', () => {
  const cfg = cfgOf('webino');
  assert.ok(at(cfg, {}).dev.eso < -8);
  assert.ok(at(cfg, { tx: 30 }).eyes.L.a > -12);
  assert.ok(at(cfg, { tx: -30 }).eyes.R.a > -12);
  assert.ok(at(cfg, { dist: 20 }).dev.eso < -10);
});

check('Parinaud: upgaze lost voluntarily, restored by the doll’s head', () => {
  const cfg = cfgOf('parinaud');
  assert.ok(at(cfg, { ty: 25 }).eyes.R.y < 6);
  near(at(cfg, { ty: -25 }).eyes.R.y, -25, 0.5);
  near(at(cfg, { pitch: -22, vorY: 22 }).eyes.R.y, 22, 1, 'VOR elevates');
});

check('PSP: downgaze worst, overcome by the doll’s head', () => {
  const cfg = cfgOf('psp');
  const dn = at(cfg, { ty: -30 }).eyes.R.y, up = at(cfg, { ty: 30 }).eyes.R.y;
  assert.ok(dn > -8, 'downgaze ' + dn);
  assert.ok(up < 20 && up > 10, 'upgaze ' + up);
  near(at(cfg, { pitch: 25, vorY: -25 }).eyes.R.y, -25, 1, 'VOR depresses');
});

check('CPEO: globally limited, aligned, not helped by VOR', () => {
  const cfg = cfgOf('cpeo');
  const s = at(cfg, { tx: 30, ty: 20 });
  assert.ok(Math.abs(s.eyes.R.x) < 26 && Math.abs(s.eyes.L.x) < 26 && s.eyes.R.y < 22);
  near(s.dev.eso, 0, 1.5); near(s.dev.rHyper, 0, 1);
  assert.ok(Math.abs(at(cfg, { yaw: -30, vorX: 30 }).eyes.R.x) < 26);
});

check('Myasthenia: deviation and ptosis grow with fatigue', () => {
  const cfg = cfgOf('mg');
  const fresh = at(cfg, { dissociate: true }), tired = at(cfg, { dissociate: true, fatigue: 1 });
  assert.ok(Math.abs(tired.dev.rHyper) > Math.abs(fresh.dev.rHyper) + 2);
  const sim = new E.Sim(cfg);
  let f;
  for (let i = 0; i < 400; i++) f = sim.step(0.03, Object.assign({}, base, { ty: 25 }));
  assert.ok(f.eyes.R.ptosis > 0.7, 'ptosis after sustained upgaze ' + f.eyes.R.ptosis);
});

check('Sim: cover test in esotropia shows an outward refixation and alternation', () => {
  const sim = new E.Sim(cfgOf('et'));
  const run = (n, o) => { let f; for (let i = 0; i < n; i++) f = sim.step(0.016, Object.assign({}, base, o)); return f; };
  let f = run(30, {});
  near(f.eyes.R.x, 0, 0.3); near(f.eyes.L.x, 16, 0.5);       // right eye fixing, left eye turned in
  f = run(60, { cover: 'R' });
  near(f.eyes.L.x, 0, 0.3); near(f.eyes.R.x, -16, 0.5);
  f = run(60, {});
  near(f.eyes.L.x, 0, 0.3, 'left keeps fixing after uncovering');
});

check('Sim: phoria recovers slowly, saccades are fast', () => {
  const sim = new E.Sim(cfgOf('ci'));
  const run = (n, o) => { let f; for (let i = 0; i < n; i++) f = sim.step(0.016, Object.assign({}, base, { dist: 33 }, o)); return f; };
  run(30, {});
  let f = run(90, { cover: 'L' });
  const out = f.eyes.L.errX;
  assert.ok(out < -3, 'covered eye drifts out: ' + out);
  f = run(3, {});
  assert.ok(f.eyes.L.errX < out * 0.5, 'still recovering after 50 ms');
  f = run(120, {});
  near(f.eyes.L.errX, 0, 0.3);
});

check('Hess: the paretic field is smaller, the other larger', () => {
  const h = E.hess(cfgOf('cn6', 'R'));
  const width = (f) => f.outer[6][0] - f.outer[14][0];
  assert.ok(width(h.R) < 50, 'right field ' + width(h.R));
  assert.ok(width(h.L) > 62, 'left field ' + width(h.L));
});

check('Every condition builds for both sides and solves without NaN', () => {
  for (const c of C.list) for (const side of ['R', 'L']) {
    const cfg = c.build(side);
    for (const tx of [-40, 0, 40]) for (const ty of [-32, 0, 32]) for (const cover of [null, 'R', 'L']) for (const roll of [-30, 0, 30]) {
      const s = at(cfg, { tx, ty, cover, roll, lidsLifted: false });
      for (const k of ['R', 'L']) assert.ok(Number.isFinite(s.eyes[k].x + s.eyes[k].y + s.eyes[k].t), c.id);
    }
    assert.ok(C.sites[c.site], c.id + ' site');
    assert.ok(c.signs.length >= 4 && c.history && c.summary && c.localise && c.pitfall, c.id + ' text');
  }
});

console.log(`${passed} checks passed` + (process.exitCode ? ', some FAILED' : ''));
