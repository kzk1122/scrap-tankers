// 掲載用の紹介動画の素材: 実際のゲームをボットに遊ばせ、1コマずつ撮る（30fps）。つなぎと書き出しは tools/promo.sh
// 使い方: node build.mjs site && PW=<playwright> OUT=<出力先> FMT=land|port SEG=0|1|2 [SEC=6] node tools/promo.mjs
// 場面ごとにブラウザを立て直す（止めた時計で大量に描くと swiftshader のメモリが増えるため）
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW);
import { mkdirSync } from 'node:fs';
const FMT = process.env.FMT || 'land', SEG = +(process.env.SEG || 0), SEC = +(process.env.SEC || 6), OUT = process.env.OUT;
// 撮影サイズ: 横 1920x1080 / 縦 1080x1620（2:3）。画面の大きさは実機に近い CSS ピクセルにして倍率で解像度を出す
const VP = { land: [960, 540, 2], port: [720, 1080, 1.5] }[FMT];
// 場面: 拠点（見た目が変わる）、前もって進める秒数（その間にレベルアップで強化がつく）、ボス戦にするか、後ろからの視点にするか、
// 撮る前に磁石でつないでおく残骸（cars）、「ぶっ放す」を押す時刻（sp）。撮影中は経験値を0にしてレベルアップの画面を出さない
const SCENES = [
  { stage: 1, pre: 40, seed: 11, cars: [0, 1, 0, 2, 1], sp: 3.6 },
  { stage: 5, pre: 60, seed: 23, boss: true, cars: [1, 2, 0, 3, 1, 0], sp: 2.2 },
  { stage: 8, pre: 90, seed: 37, view: 1, cars: [1, 0, 2, 1, 3], sp: 3.0 },
];
const S = SCENES[SEG]; const dir = `${OUT}/${FMT}-${SEG}`; mkdirSync(dir, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: VP[0], height: VP[1] }, deviceScaleFactor: VP[2], hasTouch: true });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html?lang=en&me=1'); await p.waitForTimeout(800);
// 文字の案内（操作のヒント）は動画に要らないので消す。HUD はそのまま
await p.addStyleTag({ content: '#hint,#sptip,#keys,#pz{display:none !important}' });
await p.evaluate((S) => {
  const T = window.__tk; T.manual(true); T.q(4); T.seed(S.seed);
  Object.assign(T.save, { stage: S.stage, best: Math.max(T.save.best || 1, S.stage), runs: 12, up: { dmg: S.stage, hp: S.stage, spd: 2 } });
  T.restart(); if (S.view) T.view(1);
  // 上手いボット（test/bots.mjs の good と同じ考え方: 敵から離れ、弾を避け、歯車を拾う）
  let mx = 0, mz = 0; const PR = ['rapid', 'split', 'boom', 'heavy', 'orbit', 'pierce', 'bounce', 'salvo', 'crit', 'frost', 'armor', 'regen'];
  window.__bot = (sp) => {
    const st = T.state();
    if (st.state === 'levelup') { let bi = 0, bp = 99; (st.ch || []).forEach((id, i) => { const q = PR.indexOf(id); if (q >= 0 && q < bp) { bp = q; bi = i; } }); T.pick(bi); return; }
    let vx = -st.x * 0.004, vz = -st.z * 0.004;
    for (const e of st.near) { const dx = st.x - e[0], dz = st.z - e[1], d = Math.hypot(dx, dz) || 1, w = (e[2] >= 2 ? 3 : 1) * 14 / (d * d); vx += dx / d * w; vz += dz / d * w; }
    for (const e of st.foe) { const dx = st.x - e[0], dz = st.z - e[1], d = Math.hypot(dx, dz) || 1; vx += dx / d * 6 / (d * d); vz += dz / d * 6 / (d * d); }
    let g = null, gd = 400; for (const k of st.gear) { const d = (k[0] - st.x) ** 2 + (k[1] - st.z) ** 2; if (d < gd) { gd = d; g = k; } }
    if (g) { const d = Math.sqrt(gd) || 1; vx += (g[0] - st.x) / d * 0.5; vz += (g[1] - st.z) / d * 0.5; }
    if (st.cars < st.cap) { let v = null, vd = 400; for (const k of st.sv) { const d = (k[0] - st.x) ** 2 + (k[1] - st.z) ** 2; if (d < vd) { vd = d; v = k; } } if (v) { const d = Math.sqrt(vd) || 1; vx += (v[0] - st.x) / d * 0.9; vz += (v[1] - st.z) / d * 0.9; } } // 光る残骸を拾いに行く
    if (window.__orb) { // 撮影中は広場を大きく回る（鎖が弧を描いて振れ、群れが後ろについてくる）。近すぎる敵だけ避ける
      const o = window.__orb, dx = st.x - o.x, dz = st.z - o.z, d = Math.hypot(dx, dz) || 1, rc = (o.R - d) / o.R * 1.6;
      vx = -dz / d * o.dir + dx / d * rc; vz = dx / d * o.dir + dz / d * rc;
      for (const e of st.near) { const ex = st.x - e[0], ez = st.z - e[1], ed = Math.hypot(ex, ez) || 1; if (ed < 4) { vx += ex / ed * 4 / (ed * ed); vz += ez / ed * 4 / (ed * ed); } }
    }
    const l = Math.hypot(vx, vz); if (l > 0.05) { mx = vx / l; mz = vz / l; } T.input({ mx, mz, auto: true, sp: !!sp });
  };
  // 前もって進める（描かない）。死なないように体力を戻し続け、強化を数回取らせる
  for (let f = 0; f < 60 * S.pre; f++) { if (f % 6 === 0) window.__bot(false); T.P.hp = Math.max(T.P.hp, 60); const s = T.step(1); if (s === 'result') break; }
  if (S.boss) { T.boss(); for (let f = 0; f < 60 * 4; f++) { if (f % 6 === 0) window.__bot(false); T.step(1); } }
  if (S.cars) { // 広場の中ほどへ移して残骸をつなぎ、回りながら鎖がなじむまで少し進める
    const st = T.state(), R = S.R || 11; T.P.x = R; T.P.z = 0; T.P.vx = T.P.vz = 0; T.P.ry = Math.PI; window.__orb = { x: 0, z: 0, R, dir: 1 };
    T.cars(S.cars.slice(0, Math.max(0, st.cap - st.cars))); for (let f = 0; f < 90; f++) { if (f % 6 === 0) window.__bot(false); T.P.hp = Math.max(T.P.hp, 60); T.step(1); }
  }
  T.G.sp = 1; T.snap();
}, S);
const N = Math.round(SEC * 30); console.log(FMT, SEG, 'frames', N);
for (let i = 0; i < N; i++) {
  // 1コマ = 1/30 秒を1回で進めて描く（粒子は描くときだけ進むので、描かないステップを挟むと遅く見える）
  await p.evaluate(([i, sp]) => { const T = window.__tk; T.P.hp = Math.max(T.P.hp, 40); T.G.xp = 0; if (i % 2 === 0) window.__bot(sp && Math.abs(i / 30 - sp) < 0.04); T.step(1, 1 / 30, true); if (T.state().state === 'levelup') { window.__bot(false); T.step(1, 1 / 30, true); } }, [i, S.sp || 0]);
  await p.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.png` });
}
await b.close();
