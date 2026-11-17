// 難しさの調整: レベルアップの回数（1出撃10回前後）と、同じ拠点で負け続けたときの補正（負けるたびに敵が弱くなり、勝つか拠点が変われば戻る）
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const p = await b.newPage({ viewport: { width: 320, height: 180 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(500);
// 上手いボットで拠点1を1回: レベルアップは 8〜12 回
const good = await p.evaluate(() => {
  const T = window.__tk; T.manual(true); T.seed(99); T.save.stage = 1; T.save.runs = 1; T.restart();
  const PR = ['rapid', 'heavy', 'split', 'crit', 'pierce', 'boom', 'bounce', 'orbit', 'salvo', 'armor', 'regen', 'frost', 'rear', 'plate', 'vamp', 'engine', 'mine', 'long', 'magnet', 'scav'];
  let mx = 0, mz = 0, n = 0, s;
  for (let f = 0; f < 60 * 400; f++) {
    if (f % 6 === 0) { const st = T.state(); let vx = -st.x * 0.004, vz = -st.z * 0.004;
      for (const e of st.near) { const dx = st.x - e[0], dz = st.z - e[1], d = Math.hypot(dx, dz) || 1, w = (e[2] >= 2 ? 3 : 1) * 14 / (d * d); vx += dx / d * w; vz += dz / d * w; }
      for (const e of st.foe) { const dx = st.x - e[0], dz = st.z - e[1], d = Math.hypot(dx, dz) || 1; vx += dx / d * 6 / (d * d); vz += dz / d * 6 / (d * d); }
      let g = null, gd = 400; for (const k of st.gear) { const d = (k[0] - st.x) ** 2 + (k[1] - st.z) ** 2; if (d < gd) { gd = d; g = k; } }
      if (g) { const d = Math.sqrt(gd) || 1; vx += (g[0] - st.x) / d * 0.5; vz += (g[1] - st.z) / d * 0.5; }
      const l = Math.hypot(vx, vz); if (l > 0.05) { mx = vx / l; mz = vz / l; } T.input({ mx, mz, auto: true, sp: true }); }
    s = T.step(1);
    if (s === 'levelup') { n++; const ch = T.state().ch; let i = 0, best = 99; ch.forEach((id, j) => { const q = PR.indexOf(id); if (q >= 0 && q < best) { best = q; i = j; } }); T.pick(i); }
    if (s === 'result') break;
  }
  return { n, won: T.state().won, t: Math.round(T.state().t) };
});
ok(good.won && good.n >= 8 && good.n <= 12, 'base 1, good bot: ' + good.n + ' level-ups in ' + good.t + ' s (was 13+)');
// 動かず撃たずに拠点4で負ける → 2回目は補正1、拠点が変わると0
const lose = () => p.evaluate(() => { const T = window.__tk; T.restart(); T.input({ mx: 0, mz: 0, fire: false }); for (let f = 0; f < 60 * 300; f++) { const s = T.step(1); if (s === 'levelup') T.pick(0); if (s === 'result') break; } const e = T.ev.filter(x => x.n === 'end').pop(); return { as: e.as, won: e.won, lose: T.save.lose && Object.assign({}, T.save.lose) }; });
await p.evaluate(() => { const T = window.__tk; T.save.stage = 4; T.save.lose = null; });
const l1 = await lose(), l2 = await lose(), l3 = await lose();
ok(!l1.won && l1.as === 0 && l1.lose.s === 4 && l1.lose.n === 1, 'first loss at base 4: no assist, streak 1');
ok(l2.as === 1 && l3.as === 2 && l3.lose.n === 3, 'assist grows with the losing streak: ' + [l2.as, l3.as]);
await p.evaluate(() => { const T = window.__tk; T.save.stage = 5; T.restart(); });
const other = await p.evaluate(() => { const T = window.__tk; T.input({ mx: 0, mz: 0, fire: false }); for (let f = 0; f < 60 * 300; f++) { const s = T.step(1); if (s === 'levelup') T.pick(0); if (s === 'result') break; } return T.ev.filter(x => x.n === 'end').pop().as; });
ok(other === 0, 'a different base starts without assist');
ok(!errs.length, 'no page errors ' + errs.join('|'));
await b.close(); console.log(fail ? 'FAILED ' + fail : 'all ok');
