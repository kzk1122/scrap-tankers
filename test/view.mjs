// 視点の切り替え: 見下ろし ⇔ 戦車の後ろから。ボタンと V キー、保存、カメラの位置、キーとスティックがカメラの向き基準になること、押している間に進む向きが回り続けないこと
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
import http from 'node:http'; import { readFileSync } from 'node:fs';
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(readFileSync('dist/index.html')); }).listen(0); const port = srv.address().port;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const errs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
await p.goto(`http://localhost:${port}/?lang=ja`); await p.waitForTimeout(1200);
ok(await p.evaluate(() => !window.__tk.save.view), 'top-down by default');
await p.click('#view'); await p.waitForTimeout(100);
let r = await p.evaluate(() => [window.__tk.save.view, document.getElementById('view').classList.contains('on'), document.getElementById('toast').textContent, JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /tank/i.test(k)) || 'null') || '{}').view]);
ok(r[0] === 1 && r[1] && /後ろ/.test(r[2]) && r[3] === 1, 'button switches to the behind-the-tank view and saves it: ' + r[2]);
await p.keyboard.press('v'); await p.waitForTimeout(100);
r = await p.evaluate(() => [window.__tk.save.view, document.getElementById('toast').textContent]); ok(r[0] === 0 && /見下ろし/.test(r[1]), 'V switches back: ' + r[1]);
await p.keyboard.press('v');
// カメラ: 戦車が東を向いていれば、カメラは戦車の西側の低めの位置にいて東を見る
const cam = () => p.evaluate(() => { const T = window.__tk, c = T.camera; return { x: c.position.x - T.P.x, y: c.position.y, z: c.position.z - T.P.z }; });
await p.evaluate(() => { const T = window.__tk; T.manual(true); T.input(null); T.restart(); T.intro(false); T.P.ry = Math.PI / 2; T.snap(); T.step(1, 1 / 60, true); });
let c = await cam(); ok(c.x < -6 && Math.abs(c.z) < 1 && c.y > 4 && c.y < 12, `behind view: camera sits behind the tank (${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)})`);
// キーを押している間の入力の向き（地面の上の向き）と、離したあとの戦車の向きを見る
const hold = (key, n) => p.evaluate(([key, n]) => { const T = window.__tk; window.dispatchEvent(new KeyboardEvent('keydown', { key })); const out = []; for (let i = 0; i < n; i++) { T.step(1, 1 / 60, i % 6 === 0); if (i % 30 === 0) out.push([T.I.mx, T.I.mz]); } window.dispatchEvent(new KeyboardEvent('keyup', { key })); T.step(1, 1 / 60, false); return { v: out, ry: T.P.ry }; }, [key, n]);
const near = (v, x, z) => Math.abs(v[0] - x) < 0.05 && Math.abs(v[1] - z) < 0.05, f2 = v => v.map(a => a.toFixed(2)).join(',');
let h = await hold('w', 40); ok(near(h.v[0], 1, 0) && near(h.v[1], 1, 0), 'W drives toward where the camera looks (east): ' + f2(h.v[1]));
await p.evaluate(() => { const T = window.__tk; T.P.ry = Math.PI / 2; T.snap(); });
h = await hold('d', 150); ok(h.v.every(v => near(v, 0, 1)), 'holding D keeps one direction (south = camera right) while the camera turns: ' + h.v.map(f2).join(' / '));
const yaw = await p.evaluate(() => { const T = window.__tk; T.input({ mx: 0, mz: 1 }); for (let i = 0; i < 90; i++) T.step(1, 1 / 60, true); T.input(null); T.step(1, 1 / 60, false); const c = T.camera; return Math.atan2(T.P.x - c.position.x, T.P.z - c.position.z); });
ok(Math.abs(yaw) < 0.35, `camera swings round behind the new heading (looks ${yaw.toFixed(2)} rad, south is 0)`);
h = await hold('w', 10); ok(near(h.v[0], 0, 1), 'after letting go, W follows the new camera direction (south): ' + f2(h.v[0]));
// 見下ろしに戻すと、W はいつも画面の上（北）
await p.evaluate(() => document.getElementById('view').click()); await p.evaluate(() => { const T = window.__tk; T.P.ry = Math.PI / 2; T.snap(); T.step(1, 1 / 60, true); });
h = await hold('w', 10); ok(near(h.v[0], 0, -1), 'top-down: W drives north as before: ' + f2(h.v[0]));
c = await cam(); ok(c.y > 20 && c.z > 10, 'top-down camera is back overhead');
// 再読み込みしても選んだ視点のまま
await p.evaluate(() => document.getElementById('view').click()); await p.reload(); await p.waitForTimeout(1200);
r = await p.evaluate(() => [window.__tk.save.view, document.getElementById('view').classList.contains('on')]); ok(r[0] === 1 && r[1], 'the chosen view is kept after reloading');
ok(!errs.length, 'no page errors ' + errs.join(' | '));
await b.close(); srv.close();
console.log(fail ? fail + ' FAILED' : 'all ok'); process.exit(fail ? 1 : 0);
