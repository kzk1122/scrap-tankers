import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const out = process.argv[2] || '/tmp/claude-0/-home-user/a7ca0ee4-5ea3-5348-9aa1-0718fb34f43f/scratchpad';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errs = [];
for (const [name, vp, touch] of [['pc', { width: 1280, height: 720 }, false], ['sp', { width: 390, height: 780 }, true]]) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch, locale: name === 'pc' ? 'ja-JP' : 'en-US' });
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
  p.on('pageerror', e => errs.push(name + ' PAGEERR: ' + e.message));
  await p.goto('file://' + process.cwd() + '/dist/index.html');
  await p.waitForTimeout(800);
  await p.evaluate(() => { __tk.manual(true); __tk.seed(7); __tk.restart(); __tk.input({ mx: 0, mz: -0.4, auto: true }); __tk.step(60 * 6, 1 / 60, true); });
  await p.screenshot({ path: `${out}/${name}-1.png` });
  // 強化の3択が出るまで進める
  const st = await p.evaluate(() => { let s; for (let i = 0; i < 4000; i++) { s = __tk.step(1); if (s !== 'play') break; } __tk.step(0); return __tk.state(); });
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}-2.png` });
  console.log(name, 'levelup at', st.t.toFixed(1), st.state);
  const end = await p.evaluate(() => { let s, n = 0; for (let i = 0; i < 60 * 600; i++) { s = __tk.step(1, 1 / 60, i % 600 === 0); if (s === 'levelup') { __tk.pick(n++ % 3); } if (s === 'result') break; } return __tk.state(); });
  await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}-3.png` });
  console.log(name, JSON.stringify({ state: end.state, t: end.t | 0, wave: end.wave, lvl: end.lvl, kills: end.kills, scrap: end.scrap, won: end.won }));
  const diag = await p.evaluate(() => document.getElementById('diag').textContent); if (diag) errs.push(name + ' DIAG: ' + diag);
  await ctx.close();
}
console.log('errors:', errs.length ? errs : 'none'); await b.close();
