// 基地に戻る: 一時停止の画面から2回押すと出撃をやめて結果とガレージへ。スクラップは持ち帰り、連敗の数は変えない。パーツの欄が開く
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
import http from 'node:http'; import { readFileSync } from 'node:fs';
const srv = http.createServer((q, r) => { r.setHeader('content-type', 'text/html'); r.end(readFileSync('dist/index.html')); }).listen(0); const port = srv.address().port;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let fail = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const errs = [];
for (const lang of ['ja', 'en']) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:${port}/?lang=${lang}`); await p.waitForTimeout(1200);
  const S = () => p.evaluate(() => { const T = window.__tk, $ = id => document.getElementById(id); return { st: T.G.state, pz: T.G.paused, ov: !$('pause').hidden, hb: $('pzhome').textContent, ask: $('pzhome').classList.contains('ask'), res: !$('res').hidden, title: $('rtitle').textContent, cls: $('rtitle').className, parts: !$('tab_parts').hidden, scrap: T.save.scrap, lose: JSON.stringify(T.save.lose), earned: T.G.scrap }; });
  // 少し戦ってスクラップを集める。連敗が2回ある状態にしておく
  const s0 = await p.evaluate(() => { const T = window.__tk; T.manual(true); T.seed(5); T.save.lose = { s: T.save.stage, n: 2 }; T.restart();
    for (let f = 0; f < 60 * 25; f++) { T.input({ mx: Math.cos(f / 80), mz: Math.sin(f / 80), auto: true }); const s = T.step(1); if (s === 'levelup') T.pick(0); if (s !== 'play' && s !== 'levelup') break; }
    T.input(null); return { scrap: T.save.scrap, st: T.G.state }; });
  await p.evaluate(() => window.__tk.pause()); await p.waitForTimeout(100);
  let s = await S(); ok(s0.st === 'play' && s.pz && s.ov && s.hb === (lang === 'ja' ? '基地に戻る' : 'Return to HQ'), `${lang}: pause panel shows "${s.hb}"`);
  await p.evaluate(() => document.getElementById('pzhome').click()); await p.waitForTimeout(100);
  s = await S(); ok(s.pz && s.ov && s.ask && !s.res, `${lang}: first press only asks: "${s.hb}"`);
  // 外をクリックすると再開し、次の一時停止では元の文言に戻る
  await p.waitForTimeout(300); await p.evaluate(() => document.getElementById('pause').click()); await p.waitForTimeout(100);
  s = await S(); ok(!s.pz && !s.ov && s.st === 'play', `${lang}: tapping outside still resumes`);
  await p.evaluate(() => window.__tk.pause()); await p.waitForTimeout(100); s = await S(); ok(!s.ask && s.hb === (lang === 'ja' ? '基地に戻る' : 'Return to HQ'), `${lang}: the question resets on the next pause`);
  await p.evaluate(() => document.getElementById('pzhome').click()); await p.evaluate(() => document.getElementById('pzhome').click()); await p.waitForTimeout(200);
  s = await S(); const end = await p.evaluate(() => window.__tk.ev.filter(e => e.n === 'end').pop());
  ok(s.st === 'result' && !s.pz && !s.ov && s.res, `${lang}: second press goes to the result and garage`);
  ok(s.title === (lang === 'ja' ? '基地に戻った' : 'Back at HQ') && /home/.test(s.cls), `${lang}: title "${s.title}" (${s.cls})`);
  ok(s.parts, `${lang}: the parts tab is open`);
  ok(s.earned > 0 && s.scrap === s0.scrap + s.earned, `${lang}: scrap brought home ${s0.scrap} + ${s.earned} = ${s.scrap}`);
  ok(s.lose === JSON.stringify({ s: 1, n: 2 }) || JSON.parse(s.lose).n === 2, `${lang}: the losing streak is unchanged ${s.lose}`);
  ok(end && end.home === 1 && end.won === 0, `${lang}: end event marks the return ${JSON.stringify(end)}`);
  // パーツを付け替えて出撃し直せる
  const r = await p.evaluate(() => { const T = window.__tk; T.save.own.light = 1; T.meta.equip('light'); T.go(); return [T.G.state, T.G.home, T.save.parts.hull]; });
  ok((r[0] === 'play' || r[0] === 'hold') && r[1] === false && r[2] === 'light', `${lang}: redeploy with new parts: ${r.join(' ')}`);
  await p.close();
}
ok(!errs.length, 'no page errors ' + errs.join(' | '));
await b.close(); srv.close();
console.log(fail ? fail + ' FAILED' : 'all ok'); process.exit(fail ? 1 : 0);
