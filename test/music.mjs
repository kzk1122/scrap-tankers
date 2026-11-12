// BGM と体力ゲージの色: 入力後に通常曲が鳴り、体力20%未満で緊迫曲と赤ゲージ、結果画面で通常曲に戻る
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage({ viewport: { width: 900, height: 540 } }); const errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(500);
await p.mouse.click(450, 300); await p.waitForTimeout(800);
const snap = () => p.evaluate(() => ({ m: __tk.music(), cls: document.getElementById('hpbar').className, hp: Math.round(__tk.state().hp), st: __tk.state().state }));
console.log('start', JSON.stringify(await snap()));
const seen = new Set();
for (let i = 0; i < 240; i++) { const s = await snap(); const k = s.cls + ' | ' + s.m.mode + ' | ' + s.st; if (!seen.has(k)) { seen.add(k); console.log(k, 'hp', s.hp); } if (s.st === 'levelup') await p.keyboard.press('1'); if (s.st === 'result') break; await p.waitForTimeout(250); }
await p.waitForTimeout(600); console.log('end', JSON.stringify(await snap()));
console.log('errors:', errs.length ? errs : 'none'); await b.close();
