// 実時間・実入力の確認: マウス照準とクリック射撃、強化カードのクリック、結果→ガレージ購入→再出撃、タッチのスティック
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const out = '/tmp/claude-0/-home-user/a7ca0ee4-5ea3-5348-9aa1-0718fb34f43f/scratchpad';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1000, height: 600 } }); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(600);
const S = () => p.evaluate(() => __tk.state());
console.log('hint visible:', await p.evaluate(() => !document.getElementById('hint').hidden));
await p.mouse.move(500, 150); await p.mouse.down(); await p.keyboard.down('w'); await p.waitForTimeout(2500); await p.keyboard.up('w');
let s = await S(); console.log('after W+fire: z', s.z.toFixed(1), 'bullets', s.bullets, 'gears', s.gears, 'lvl', s.lvl);
for (let i = 0; i < 40 && (await S()).state !== 'levelup'; i++) { await p.keyboard.down(i % 2 ? 'a' : 'd'); await p.waitForTimeout(700); await p.keyboard.up(i % 2 ? 'a' : 'd'); }
s = await S(); console.log('state', s.state, 't', s.t.toFixed(1)); await p.mouse.up();
await p.waitForTimeout(500); await p.screenshot({ path: out + '/real-lv.png' });
await p.click('#card1'); s = await S(); console.log('after card click:', s.state, JSON.stringify(s.ups));
// 放置して撃破 → 結果
for (let i = 0; i < 90 && (await S()).state !== 'result'; i++) { if ((await S()).state === 'levelup') await p.keyboard.press('1'); await p.waitForTimeout(1000); }
s = await S(); console.log('result?', s.state, 'scrap', s.scrap, 'saved', await p.evaluate(() => __tk.save.scrap));
await p.waitForTimeout(500); await p.screenshot({ path: out + '/real-res.png' });
const can = await p.evaluate(() => !document.getElementById('gar_dmg').disabled); if (can) await p.click('#gar_dmg');
console.log('garage bought:', can, JSON.stringify(await p.evaluate(() => __tk.save.up)), 'scrap left', await p.evaluate(() => __tk.save.scrap));
await p.click('#go'); s = await S(); console.log('after go:', s.state, 't', s.t.toFixed(1), 'ls', await p.evaluate(() => !!localStorage.getItem('scrap_tankers_v1')));
// タッチのスティック（pointer イベントを直接送る）
await p.evaluate(() => { const ev = (t, x, y) => window.dispatchEvent(new PointerEvent(t, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); ev('pointerdown', 300, 400); ev('pointermove', 380, 400); });
const x0 = (await S()).x; await p.waitForTimeout(1200); s = await S(); console.log('touch drag right: dx', (s.x - x0).toFixed(1), 'joy shown', await p.evaluate(() => !document.getElementById('joy').hidden), 'bullets', s.bullets);
await p.screenshot({ path: out + '/real-touch.png' });
console.log('errors:', errs.length ? errs : 'none'); await b.close();
