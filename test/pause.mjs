// 一時停止: 画面外クリック(blur)、Pointer Lock を Esc で外す、Esc/P キー、タブ切り替え、右上のボタン。再開と多言語の文言も確かめる
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
import http from 'node:http'; import { readFileSync } from 'node:fs';
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(readFileSync('dist/index.html')); }).listen(0); const port = srv.address().port;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const errs = [];
{ // PC（Pointer Lock はヘッドレスでも動く。最初のクリックで取れないことがあるので、取れたかは条件にしない）
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${port}/?lang=ja`); await p.waitForTimeout(1500); await p.mouse.click(640, 300); await p.waitForTimeout(600);
  const S = () => p.evaluate(() => { const s = window.__tk.state(); return { st: s.state, pz: s.paused, t: s.t, lock: !!document.pointerLockElement, ov: !document.getElementById('pause').hidden }; });
  let s = await S(); ok(s.st === 'play' && !s.pz, 'playing');
  await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForTimeout(100);
  s = await S(); const t0 = s.t; ok(s.pz && s.ov && !s.lock, 'blur pauses and frees the mouse');
  await p.waitForTimeout(600); s = await S(); ok(s.t === t0, 'time is frozen while paused');
  await p.mouse.click(640, 560); await p.waitForTimeout(500); s = await S(); ok(!s.pz && !s.ov && s.t > t0, 'click resumes (lock ' + s.lock + ')');
  if (s.lock) { await p.waitForTimeout(400); await p.evaluate(() => document.exitPointerLock()); await p.waitForTimeout(150); s = await S(); ok(s.pz, 'leaving pointer lock (Esc) pauses'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(200); s = await S(); ok(!s.pz, 'Enter resumes'); }
  await p.evaluate(() => window.__tk.resume()); await p.evaluate(() => document.exitPointerLock()); await p.evaluate(() => window.__tk.resume()); await p.waitForTimeout(300);
  await p.keyboard.press('p'); await p.waitForTimeout(100); s = await S(); ok(s.pz, 'P pauses');
  const sp0 = await p.evaluate(() => window.__tk.state().spN); await p.waitForTimeout(300); await p.keyboard.press(' '); await p.waitForTimeout(200);
  s = await S(); ok(!s.pz && (await p.evaluate(() => window.__tk.state().spN)) === sp0, 'Space resumes without firing the special');
  await p.evaluate(() => { document.exitPointerLock(); window.__tk.resume(); }); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(100); s = await S(); ok(s.pz, 'Esc pauses');
  await p.waitForTimeout(300); await p.keyboard.press('Escape'); await p.waitForTimeout(100); s = await S(); ok(s.pz, 'Esc again stays paused');
  await p.click('#pzmute'); s = await S(); const m = await p.evaluate(() => [window.__tk.save.mute, document.getElementById('pzmute').textContent]); ok(s.pz && m[0] && /OFF/.test(m[1]), 'sound toggle in the pause panel does not resume: ' + m[1]); await p.click('#pzmute');
  await p.click('#resume'); await p.waitForTimeout(200); s = await S(); ok(!s.pz, 'resume button');
  await p.evaluate(() => { document.exitPointerLock(); window.__tk.resume(); }); await p.waitForTimeout(300);
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  s = await S(); ok(s.pz, 'switching tabs pauses');
  await p.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }); await p.waitForTimeout(300);
  s = await S(); ok(s.pz && !(await p.evaluate(() => window.__tk.music().running)), 'coming back stays paused and silent until the player resumes');
  ok(/Esc/.test(await p.evaluate(() => document.getElementById('keys').innerText)), 'key legend shows Esc');
  await p.close();
}
{ // スマホ横持ち: 右上のボタンで止め、画面タップで再開。ボットは止めない
  const p = await b.newPage({ viewport: { width: 740, height: 360 }, hasTouch: true, isMobile: true }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${port}/?lang=ja`); await p.waitForTimeout(1500);
  await p.tap('#pz'); await p.waitForTimeout(100);
  let s = await p.evaluate(() => [window.__tk.state().paused, document.getElementById('pzs').textContent]); ok(s[0] && /タップ/.test(s[1]), 'pause button (touch): ' + s[1]);
  await p.waitForTimeout(300); await p.tap('#pause', { position: { x: 60, y: 60 } }); await p.waitForTimeout(100);
  ok(!(await p.evaluate(() => window.__tk.state().paused)), 'tap anywhere resumes');
  await p.evaluate(() => { window.__tk.input({ mx: 0, mz: 0, auto: true }); window.dispatchEvent(new Event('blur')); }); ok(!(await p.evaluate(() => window.__tk.state().paused)), 'bots are not paused by blur');
  await p.close();
}
{ // 文言
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
  for (const l of ['en', 'es', 'pt', 'ru', 'de', 'fr']) {
    await p.goto(`http://localhost:${port}/?lang=${l}`); await p.waitForTimeout(1000); await p.evaluate(() => window.__tk.pause());
    const t = await p.evaluate(() => ['pzt', 'pzs', 'resume', 'pzmute'].map(id => document.getElementById(id).textContent).concat([...window.__tk.miss].length));
    ok(t[4] === 0, l + ' ' + t.slice(0, 4).join(' | '));
  }
  await p.close();
}
ok(!errs.length, 'no page errors ' + errs.join('|'));
await b.close(); srv.close(); console.log(fail ? 'FAILED ' + fail : 'all ok');
