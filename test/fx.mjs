// 戦闘の演出: ボスは空から降りてくる間は無敵で、着地の予告円がある。ボスを倒すと少しスローモーション。演出つきで描画してもエラーが出ない
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const p = await b.newPage({ viewport: { width: 480, height: 270 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(500);
const r = await p.evaluate(() => {
  const T = window.__tk, o = {}; T.manual(true); T.seed(5); T.save.stage = 2; T.save.runs = 2; T.save.up = { dmg: 0, hp: 40, spd: 0 }; T.restart();
  T.input({ mx: 0, mz: 0, fire: false }); T.step(30); T.boss(); T.step(74);
  const e = T.G.boss; o.falling = !!e && e.drop > 0; o.haz = T.state().haz; o.dist = e && Math.hypot(e.x - T.P.x, e.z - T.P.z);
  const hp0 = e.hp; T.boom(e.x, e.z, 3, 9999); o.immune = e.hp === hp0 && !e.dead;
  T.step(80); o.landed = !(e.drop > 0); o.hazGone = T.state().haz === 0;
  // ボスを倒すとスローモーション: 実時間 0.5 秒でゲーム内は 0.25 秒未満しか進まない
  T.boom(e.x, e.z, 3, 1e6); o.won = T.state().won; const t0 = T.G.endT; o.slow = T.G.slowT > 0; T.step(30, 1 / 60, true);
  o.slowDt = t0 - T.G.endT; return o;
});
ok(r.falling && r.haz >= 1, 'boss starts in the air with a landing warning circle');
ok(r.dist > 6 && r.dist < 11, 'boss lands near the player, on screen: ' + (r.dist || 0).toFixed(1));
ok(r.immune, 'boss cannot be hurt while falling');
ok(r.landed && r.hazGone, 'boss lands and the warning circle is gone');
ok(r.won && r.slow && r.slowDt > 0.05 && r.slowDt < 0.25, 'killing the boss slows time briefly: ' + r.slowDt.toFixed(2) + ' s of game time in 0.5 s');
// 敵を倒して残骸が出る場面と自機の撃破を描画する
const d = await p.evaluate(() => {
  const T = window.__tk; T.save.stage = 3; T.restart(); T.input({ mx: 0, mz: 0, fire: false }); T.step(2); T.G.hpM = 1;
  for (let i = 0; i < 6; i++) T.spawn(i % 2 ? 1 : 0, Math.cos(i) * 6, Math.sin(i) * 6, 0);
  T.boom(0, 0, 9, 9999); for (let f = 0; f < 90; f++) T.step(1, 1 / 60, f % 3 === 0);
  T.P.hp = 1; T.G.inv = 0; T.spawn(5, T.P.x + 1, T.P.z, 0); for (let f = 0; f < 120 && T.state().state === 'play'; f++) T.step(1, 1 / 60, true);
  return { st: T.state().state, hp: T.P.hp };
});
ok(d.st === 'dead' || d.st === 'result', 'player wreck scene renders: ' + d.st);
await p.evaluate(() => { const T = window.__tk; T.restart(); T.step(3, 1 / 60, true); });
ok(!errs.length, 'no page errors ' + errs.join('|'));
await b.close(); console.log(fail ? 'FAILED ' + fail : 'all ok');
