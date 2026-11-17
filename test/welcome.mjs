// 「おかえり」画面: その日はじめての再訪で、ログイン報酬・届いた補給便・今日のデイリーを見せてから出撃する。初回と同じ日の再訪では出ない
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
import http from 'node:http'; import { readFileSync } from 'node:fs';
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(readFileSync('dist/index.html')); }).listen(0); const port = srv.address().port;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const errs = [], OUT = process.env.OUT;
const day = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000);
// 昨日遊んだ人のセーブ（ログイン2日目まで、レーザー砲の補給便を注文済み）
const yesterday = (extra = {}) => JSON.stringify(Object.assign({ v: 1, scrap: 150, stage: 4, runs: 6, best: 3, up: { dmg: 2, hp: 1, spd: 0 }, own: {}, parts: {}, login: { n: 2, day: day() - 1 }, supply: { id: 'laser', day: day() - 1 } }, extra));
async function open(vp, saveStr, lang = 'ja', touch = false) {
  const ctx = await b.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  if (saveStr) await p.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('scrap_tankers_v1', s); sessionStorage.setItem('seeded', '1'); } }, saveStr);
  await p.goto(`http://localhost:${port}/?lang=${lang}`); await p.waitForTimeout(1200); return p;
}
const W = p => p.evaluate(() => ({ st: window.__tk.state().state, wel: !document.getElementById('wel').hidden, scrap: window.__tk.save.scrap, runs: window.__tk.save.runs, laser: window.__tk.save.parts.turret, ev: window.__tk.ev.map(e => e.n) }));
{ // 初回は出さない
  const p = await open({ width: 1280, height: 720 }, null); const s = await W(p);
  ok(s.st === 'play' && !s.wel, 'first visit starts right away'); await p.context().close();
}
{ // 翌日の再訪（PC）
  const p = await open({ width: 1280, height: 720 }, yesterday()); let s = await W(p);
  ok(s.st === 'hold' && s.wel, 'next-day visit shows the welcome screen and holds the run');
  ok(s.scrap === 150 + 40 && s.laser === 'laser' && s.runs === 6, 'login day 3 (+40) and the laser are received; run not counted yet ' + JSON.stringify([s.scrap, s.laser, s.runs]));
  ok(s.ev.includes('welcome') && !s.ev.includes('start'), 'welcome event, no start event yet');
  const t = await p.evaluate(() => ['welt', 'wels', 'welsup', 'welnx', 'welgo'].map(id => document.getElementById(id).innerText.replace(/\n/g, ' ')));
  console.log('     ' + t.join(' | '));
  ok((await p.evaluate(() => document.querySelectorAll('#weldm .dm').length)) === 3 && (await p.evaluate(() => document.querySelector('#wellg .now').innerText)).includes('40'), 'three missions and today\'s login cell');
  await p.screenshot({ path: OUT + '/wel-pc.png' });
  await p.waitForTimeout(800); s = await W(p); ok(s.st === 'hold', 'still held while the screen is up');
  await p.keyboard.press('Enter'); await p.waitForTimeout(300); s = await W(p);
  ok(s.st === 'play' && !s.wel && s.runs === 7 && s.ev.includes('start'), 'Enter deploys');
  ok(!(await p.evaluate(() => window.__tk.ev.some(e => e.n === 'start') && document.getElementById('toast').textContent.includes('ログイン'))), 'no login toast during the run');
  // 同じ日にもう一度開いても出ない
  await p.reload(); await p.waitForTimeout(1200); s = await W(p); ok(s.st === 'play' && !s.wel, 'same-day reload starts right away');
  await p.context().close();
}
{ // スマホ横・縦と英語
  for (const [name, vp, lang] of [['land', { width: 740, height: 360 }, 'ja'], ['port', { width: 390, height: 780 }, 'ja'], ['small', { width: 360, height: 640 }, 'en']]) {
    const p = await open(vp, yesterday(name === 'small' ? { login: { n: 6, day: day() - 1 }, supply: { id: 'scrap', day: day() - 1 } } : {}), lang, true);
    const r = await p.evaluate(() => { const g = document.getElementById('welgo').getBoundingClientRect(), t = document.getElementById('welt').getBoundingClientRect(); return { top: Math.round(t.top), goBottom: Math.round(g.bottom), vh: innerHeight, miss: [...window.__tk.miss] }; });
    ok(r.top >= 0 && r.goBottom <= r.vh && !r.miss.length, name + ' fits: title ' + r.top + ', button bottom ' + r.goBottom + ' / ' + r.vh + (r.miss.length ? ' missing ' + r.miss : ''));
    await p.screenshot({ path: `${OUT}/wel-${name}.png` });
    await p.waitForTimeout(400); await p.tap('#welgo'); await p.waitForTimeout(200);
    ok((await W(p)).st === 'play', name + ' tap deploys');
    if (name === 'small') { const s = await W(p); ok(s.scrap === 150 + 120 + 120 && (await p.evaluate(() => window.__tk.save.parts.paint)) === 'night', 'day 7: +120, supply scrap +120, Night Ops paint'); }
    await p.context().close();
  }
}
ok(!errs.length, 'no page errors ' + errs.join('|'));
await b.close(); srv.close(); console.log(fail ? 'FAILED ' + fail : 'all ok');
