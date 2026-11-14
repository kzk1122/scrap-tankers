import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const lang of (process.env.L || 'es,pt,ru,de,fr').split(',')) {
  for (const [dev, vp, touch] of [['sp', { width: 700, height: 340 }, true], ['pc', { width: 960, height: 540 }, false]]) {
    const p = await b.newPage({ viewport: vp, hasTouch: touch }); p.on('pageerror', e => console.log('PAGEERR', lang, e.message));
    await p.goto('file://' + process.cwd() + '/dist/index.html?lang=' + lang); await p.waitForTimeout(400);
    await p.evaluate((touch) => { const T = window.__tk; T.manual(true); T.seed(5); T.save.scrap = 500; T.save.stage = 4; T.save.runs = 0; T.restart(); T.step(20, 1 / 60, true); if (!touch) { T.input(null); } }, touch);
    await p.screenshot({ path: `${process.env.OUT}/i-${lang}-${dev}-play.png` });
    await p.evaluate((touch) => { const T = window.__tk; T.input({ mx: 0.5, mz: 0.3, auto: true, sp: true }); let n = 0; for (let f = 0; f < 60 * 400; f++) { const s = T.step(1, 1 / 60, f % 600 === 0); if (s === 'levelup') { if (n++ === 1) break; T.pick(0); } if (s === 'result') break; } T.step(1, 1 / 60, true); }, touch);
    await p.screenshot({ path: `${process.env.OUT}/i-${lang}-${dev}-lvl.png` });
    await p.evaluate(() => { const T = window.__tk; T.pick(0); T.input({ mx: 0, mz: 0, fire: false }); for (let f = 0; f < 60 * 400; f++) { const s = T.step(1); if (s === 'levelup') T.pick(0); if (s === 'result') break; } T.step(2, 1 / 60, true); });
    await p.screenshot({ path: `${process.env.OUT}/i-${lang}-${dev}-res.png` });
    for (const t of ['parts', 'daily']) { await p.evaluate(t => { const el = [...document.querySelectorAll('#res button')].find(x => x.id.includes(t)) ; if (el) el.click(); }, t); await p.waitForTimeout(100); await p.screenshot({ path: `${process.env.OUT}/i-${lang}-${dev}-${t}.png` }); }
    const miss = await p.evaluate(() => [...window.__tk.miss]); const over = await p.evaluate(() => [...document.querySelectorAll('#res button, #res .plab, #res span, #hud div')].filter(e => e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0).map(e => (e.id || e.className) + ':' + e.textContent.slice(0, 30)).slice(0, 8));
    console.log(lang, dev, 'missing', JSON.stringify(miss), 'overflow', JSON.stringify(over)); await p.close();
  }
}
await b.close();
