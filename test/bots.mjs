// ボット計測: 遊び方ごとに複数回まわし、生存時間・到達波・勝敗を1行ずつ出す
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const RUNS = +(process.env.RUNS || 5), MODES = (process.env.MODES || 'idle,pcidle,mash,good').split(',');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 640, height: 360 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(500);
for (const mode of MODES) {
  const rows = [];
  for (let r = 0; r < RUNS; r++) {
    const res = await p.evaluate(({ mode, r, up, stage }) => {
      const T = window.__tk; T.manual(true); T.seed(1000 + r * 77); T.save.up = { dmg: up, hp: up, spd: up }; T.save.stage = stage; T.restart();
      let s, ang = 0, first = -1, lvT = [], hold = 0, mx = 0, mz = 0;
      for (let f = 0; f < 60 * 480; f++) {
        if (f % 6 === 0) {
          const st = T.state();
          if (mode === 'idle') T.input({ mx: 0, mz: 0, auto: true });
          else if (mode === 'pcidle') T.input({ mx: 0, mz: 0, fire: false });
          else if (mode === 'mash') { if (--hold <= 0) { ang = Math.random() * 6.283; hold = 8 + Math.random() * 12; } T.input({ mx: Math.cos(ang), mz: Math.sin(ang), auto: true }); }
          else {
            let vx = -st.x * 0.004, vz = -st.z * 0.004;
            for (const e of st.near) { const dx = st.x - e[0], dz = st.z - e[1], d = Math.hypot(dx, dz) || 1, w = (e[2] >= 2 ? 3 : 1) * 14 / (d * d); vx += dx / d * w; vz += dz / d * w; }
            for (const e of st.foe) { const dx = st.x - e[0], dz = st.z - e[1], d = Math.hypot(dx, dz) || 1; vx += dx / d * 6 / (d * d); vz += dz / d * 6 / (d * d); }
            let g = null, gd = 400; for (const k of st.gear) { const d = (k[0] - st.x) ** 2 + (k[1] - st.z) ** 2; if (d < gd) { gd = d; g = k; } }
            if (g) { const d = Math.sqrt(gd) || 1; vx += (g[0] - st.x) / d * 0.5; vz += (g[1] - st.z) / d * 0.5; }
            const l = Math.hypot(vx, vz); if (l > 0.05) { mx = vx / l; mz = vz / l; } T.input({ mx, mz, auto: true });
          }
        }
        s = T.step(1);
        if (s === 'levelup') { const st = T.state(); if (first < 0) first = st.t; lvT.push(st.t | 0); T.pick(mode === 'good' ? 0 : (Math.random() * 3) | 0); }
        if (s === 'result') break;
      }
      const st = T.state(); return { t: st.t | 0, wave: st.wave + 1, lvl: st.lvl, kills: st.kills, scrap: st.scrap, won: st.won, first: +first.toFixed(1), hp: st.hp | 0 };
    }, { mode, r, up: +(process.env.UP || 0), stage: +(process.env.STAGE || 1) });
    rows.push(res); console.log(mode, JSON.stringify(res));
  }
  const med = k => rows.map(x => x[k]).sort((a, b) => a - b)[rows.length >> 1];
  console.log('==', mode, 'median t', med('t'), 'wave', med('wave'), 'lvl', med('lvl'), 'scrap', med('scrap'), 'first lvup', med('first'), 'wins', rows.filter(x => x.won).length + '/' + RUNS);
}
await b.close();
