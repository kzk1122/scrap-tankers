// 計測イベントと CrazyGames SDK のつなぎ込みを、偽の SDK と偽の受け口で確かめる
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)(process.env.PW);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
import http from 'node:http'; import { readFileSync } from 'node:fs';
const posts = [];
const srv = http.createServer((q, r) => {
  if (q.method === 'POST') { let d = ''; q.on('data', c => d += c); q.on('end', () => { try { posts.push(JSON.parse(d)); } catch (e) { /* noop */ } r.end('ok'); }); return; }
  try { r.setHeader('content-type', 'text/html'); r.end(readFileSync(new URL('../dist' + q.url.split('?')[0], import.meta.url))); } catch (e) { r.statusCode = 404; r.end(); }
}).listen(0); await new Promise(r => srv.once('listening', r));
const root = `http://localhost:${srv.address().port}/`; let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };
const play = p => p.evaluate(() => { const T = __tk; T.q(4); T.manual(true); T.input({ mx: 0.6, mz: 0.2, auto: true }); for (let i = 0; i < 60 * 240 && T.step(1) !== 'result'; i++) if (T.state().state === 'levelup') T.pick(0); T.step(1, 1 / 60, true); return T.state().state; });
{ // 1) site: イベントが貯まり、/api/ev へ送られる
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(root + 'index.html'); await p.waitForTimeout(1500);
  await play(p); await p.waitForTimeout(600);
  const names = (await p.evaluate(() => __tk.ev.map(e => e.n)));
  const lv = await p.evaluate(() => __tk.state().lvl);
  for (const n of ['load', 'start', 'move', 'kill', 'end'].concat(lv > 1 ? ['lvl'] : [])) ok(names.includes(n), 'event ' + n);
  const sent = posts.flatMap(x => x.evs.map(e => e.n)); ok(sent.includes('end') && posts[0].id && posts[0].sid, 'beacon sent: ' + posts.length + ' posts, ' + sent.length + ' events');
  console.log('   load ms', (await p.evaluate(() => __tk.ev.find(e => e.n === 'load'))).ms, '| end', JSON.stringify(await p.evaluate(() => __tk.ev.find(e => e.n === 'end'))));
  ok(!errs.length, 'site no errors ' + errs.join('|')); await p.close();
}
{ // 2) cg: 偽 SDK。保存の読み込み、gameplay 通知、消音
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.route('https://sdk.crazygames.com/**', r => r.fulfill({ contentType: 'text/javascript', body: `
    window.__cg = { calls: [], data: { scrap_tankers_v1: JSON.stringify({ v: 1, scrap: 777, stage: 3, runs: 9, best: 3, up: { dmg: 2, hp: 1, spd: 0 }, own: { twin: 1 }, parts: { turret: 'twin' } }) }, ls: [] };
    const c = n => (...a) => { __cg.calls.push(n); };
    window.CrazyGames = { SDK: { environment: 'crazygames', init: async () => { __cg.calls.push('init'); },
      game: { settings: { muteAudio: true }, gameplayStart: c('gameplayStart'), gameplayStop: c('gameplayStop'), happytime: c('happytime'), loadingStart: c('loadingStart'), loadingStop: c('loadingStop'), addSettingsChangeListener: f => __cg.ls.push(f) },
      data: { getItem: k => __cg.data[k] || null, setItem: (k, v) => { __cg.data[k] = v; __cg.calls.push('setItem'); } },
      user: { getUser: async () => ({ username: 'Tester', profilePictureUrl: '' }) } } };` }));
  await p.goto(root + 'cg/index.html'); await p.waitForTimeout(1500);
  const s = await p.evaluate(() => ({ scrap: __tk.save.scrap, stage: __tk.save.stage, tur: __tk.save.parts.turret, paint: __tk.save.parts.paint, calls: __cg.calls.slice(), muted: __tk.platform.muted(), user: __tk.platform.user }));
  ok(s.scrap === 777 && s.stage === 3 && s.tur === 'twin' && s.paint === 'orange', 'save loaded from SDK data ' + JSON.stringify([s.scrap, s.stage, s.tur]));
  ok(['init', 'loadingStart', 'loadingStop', 'gameplayStart'].every(n => s.calls.includes(n)), 'sdk calls ' + s.calls.join(','));
  ok(s.muted && s.user && s.user.name === 'Tester', 'muteAudio respected, user read');
  await play(p); const c2 = await p.evaluate(() => ({ calls: __cg.calls, saved: JSON.parse(__cg.data.scrap_tankers_v1).runs }));
  ok(c2.calls.includes('gameplayStop') && c2.calls.includes('setItem') && c2.saved >= 10, 'gameplayStop + progress written to SDK (runs ' + c2.saved + ')');
  ok(!errs.length, 'cg no errors ' + errs.join('|')); await p.close();
}
{ // 3) cg ビルドを CrazyGames の外で開いても（SDK 無効・読み込み失敗）遊べる
  const p = await b.newPage({ viewport: { width: 900, height: 600 } }); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); await p.route('https://sdk.crazygames.com/**', r => r.abort());
  await p.goto(root + 'cg/index.html'); await p.waitForTimeout(1200);
  ok((await p.evaluate(() => __tk.state().state)) === 'play' && !errs.length, 'cg build runs without the SDK'); await p.close();
}
await b.close(); srv.close(); process.exit(fail ? 1 : 0);
