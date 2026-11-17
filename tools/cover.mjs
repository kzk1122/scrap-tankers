// 掲載用カバー画像: ゲームの描画で場面を組み、低いカメラで撮ってタイトルを重ねる
// 使い方: node build.mjs site && PW=<playwright> OUT=<出力先> FMT=land|port|sq [ST=3] [PREVIEW=1] node tools/cover.mjs
// 出力は2倍の大きさ（cover-<FMT>-raw.png）。縮小して 1920x1080 / 800x1200 / 800x800 にする。爆発は乱数なので毎回少し違う
// 太陽は -x,-z 側にあるので、場面は「設計上の座標」を180度回して置き、カメラは太陽側から撮る（順光）
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW);
const FMT = process.env.FMT || 'land', OUT = process.env.OUT, PRE = !!process.env.PREVIEW, ST = +(process.env.ST || 3);
const SIZE = { land: [1920, 1080], port: [800, 1200], sq: [800, 800] }[FMT];
const SCENE = {
  hero: [2.2, 0.5, -1.85],
  foes: [[0, -2.5, -5.5, 1.0], [1, -7.5, -6, 1.3], [4, 5, -8.5, -0.3], [6, -9, -11, 1.0], [0, -4, -12.5, 0.6]],
  boss: [0.8, -12.5, 0.3],
  kill: [0.2, -3.6],
  booms: [[8, -6, -14, 2.6], [20, 5, -15, 3], [40, -1.6, -3.0, 1.4], [45, -3.2, -10.5, 3.2]],
  cam: { land: { p: [1.0, 5.6, 9.2], t: [-2.2, 0.9, -4] }, port: { p: [2.4, 7.4, 10.8], t: [1.3, 1.0, -5.5] }, sq: { p: [2.4, 7.0, 9.8], t: [1.4, 0.6, -5.5] } }[FMT],
};
if (process.env.CAM) SCENE.cam = JSON.parse(process.env.CAM);
if (FMT === 'sq') { SCENE.boss = [5.2, -8.0, -0.5]; SCENE.foes[2] = [4, -1, -9.5, 0.2]; } // 正方形はタイトルの下にボスが隠れないよう右へ
if (process.env.BOSS) SCENE.boss = JSON.parse(process.env.BOSS);
if (process.env.FOE2) SCENE.foes[2] = JSON.parse(process.env.FOE2);
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: Math.round(SIZE[0] / (PRE ? 2 : 4)), height: Math.round(SIZE[1] / (PRE ? 2 : 4)) }, deviceScaleFactor: PRE ? 1 : 2 });
const p = await ctx.newPage(); p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html?lang=en'); await p.waitForTimeout(600);
await p.evaluate(([S, ST]) => {
  const T = window.__tk, M = (x, z) => [-x, -z], A = r => r + Math.PI; // 180度回す
  T.manual(true); T.q(0); T.seed(77); T.save.stage = ST; T.save.runs = 3; T.save.up = { dmg: 0, hp: 60, spd: 0 }; T.restart();
  T.input({ mx: 0, mz: 0, fire: false }); T.step(2); T.G.hpM = 1;
  T.cam({ p: [-S.cam.p[0], S.cam.p[1], -S.cam.p[2]], t: [-S.cam.t[0], S.cam.t[1], -S.cam.t[2]] });
  const BK = [3, 3, 7, 8, 7, 3, 8][ST] || 8, L = [[BK, ...S.boss]].concat(S.foes.map(f => f));
  window.__cvE = L.map(([k, x, z, r]) => { const [mx, mz] = M(x, z), e = T.spawn(k, mx, mz, A(r)); return [e, mx, mz]; });
  const [hx, hz] = M(S.hero[0], S.hero[1]), [bx, bz] = M(S.boss[0], S.boss[1]);
  window.__hold = () => { const T = window.__tk; T.P.x = hx; T.P.z = hz; T.P.ry = A(S.hero[2]); T.P.ty = Math.atan2(bx - hx, bz - hz); T.P.hp = 999; T.G.inv = 0; for (const [e, x, z] of window.__cvE) { e.x = x; e.z = z; e.cd = 99; e.rest = 99; e.mv = null; e.hold = 0; e.dash = 0; } };
  window.__hold();
  window.__tl = [[0, () => { const [x, z] = M(...S.kill); T.spawn(0, x, z, 1); T.boom(x, z, 1.2, 9999); }]].concat(S.booms.map(([f, x, z, R]) => [f, () => { const [mx, mz] = M(x, z); T.boom(mx, mz, R, 0); }]));
}, [SCENE, ST]);
for (let f = 0; f < 52; f++) await p.evaluate((f) => { const T = window.__tk; for (const [at, fn] of window.__tl) if (at === f) fn(); T.input({ mx: 0, mz: 0, auto: true }); window.__hold(); T.step(1, 1 / 60, true); }, f);
await p.addStyleTag({ content: `#app > *:not(#c){display:none !important} body > *:not(#app):not(#cvt){display:none !important}
  #cvt{position:fixed;left:0;right:0;display:flex;flex-direction:column;pointer-events:none;font-family:'Inter Display','Inter',sans-serif;font-weight:900;line-height:.86;z-index:99}
  #cvt .w{position:relative;display:inline-block;transform:skewX(-9deg);letter-spacing:.01em}
  #cvt .w .bk{position:absolute;left:0;top:0;color:#1b130c;-webkit-text-stroke:.17em #1b130c;filter:drop-shadow(0 .07em 0 #1b130c) drop-shadow(0 .12em .18em rgba(0,0,0,.55))}
  #cvt .w .fr{position:relative;background:linear-gradient(180deg,#fff6b8 0%,#ffd23f 38%,#ff9a1f 70%,#e8551a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  #cvt .w2 .fr{background:linear-gradient(180deg,#f4f7fb 0%,#c9d3e3 45%,#8d9ab2 80%,#5d6880 100%);-webkit-background-clip:text;background-clip:text}` });
await p.evaluate((FMT) => {
  const d = document.createElement('div'); d.id = 'cvt';
  const w = (t, c) => `<div class="w ${c}"><span class="bk">${t}</span><span class="fr">${t}</span></div>`;
  d.innerHTML = w('SCRAP', 'w1') + w('TANKERS', 'w2');
  const st = { land: 'top:7%;left:5%;right:auto;align-items:flex-start;font-size:17vh', port: 'top:5%;align-items:center;font-size:15vw', sq: 'top:4%;align-items:center;font-size:13vw' }[FMT];
  d.setAttribute('style', st); document.body.appendChild(d);
}, FMT);
if (!PRE) { await p.setViewportSize({ width: SIZE[0], height: SIZE[1] }); await p.waitForTimeout(800); }
await p.evaluate(() => { const T = window.__tk; for (let i = 0; i < 2; i++) { window.__hold(); T.step(1, 1 / 60, true); } });
await p.screenshot({ timeout: 300000, path: `${OUT}/cover-${FMT}${PRE ? '-pre' : '-raw'}.png` });
await b.close();
