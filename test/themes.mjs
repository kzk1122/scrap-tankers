// 全テーマの画面を撮って1枚に並べる（引数: 出力先フォルダ）
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const out = process.argv[2] || '.';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 800, height: 450 } }); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(500);
for (let st = 1; st <= 10; st++) {
  const info = await p.evaluate(st => { const T = __tk; T.manual(true); T.seed(40 + st); T.save.stage = st; T.restart(); T.input({ mx: 0.3, mz: st % 2 ? -0.6 : 0.8, auto: true }); T.step(60 * 5, 1 / 60, true); T.step(1, 1 / 60, true); return document.getElementById('time').textContent; }, st);
  await p.screenshot({ path: `${out}/th${st}.png` }); console.log(st, info);
}
console.log('errors:', errs.length ? errs : 'none'); await b.close();
