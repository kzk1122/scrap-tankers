// 各拠点のボス戦だけを回す: 見た目の確認(SHOT=1)と、技ごとの被弾の集計
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)(process.env.PW || 'playwright');
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: process.env.SHOT ? { width: 960, height: 540 } : { width: 320, height: 180 } });
p.on('pageerror', e => console.log('PAGEERR', e.message));
await p.goto('file://' + process.cwd() + '/dist/index.html'); await p.waitForTimeout(500);
const stages = (process.env.STAGES || '1,2,3,4,5,6,7,8,9,10').split(',').map(Number), SHOT = process.env.SHOT, out = process.env.OUT || '.';
for (const stage of stages) {
  await p.evaluate(({ stage }) => { const T = window.__tk; T.manual(true); T.seed(4242 + stage); T.save.up = { dmg: stage + 2, hp: stage + 2, spd: 1 }; T.save.stage = stage; T.restart(); T.step(30); T.boss(); T.step(80); }, { stage });
  const seen = {}, dmg = {}; let last = 1e4, res = null, shots = 0;
  for (let k = 0; k < 900 && !res; k++) {
    const r = await p.evaluate(({ shot }) => {
      const T = window.__tk; let mx = 0, mz = 0, s, mvs = [];
      for (let f = 0; f < 12; f++) {
        if (f % 6 === 0) { const st = T.state(); let vx = -st.x * 0.004, vz = -st.z * 0.004;
          for (const e of st.near) { const dx = st.x - e[0], dz = st.z - e[1], d = Math.hypot(dx, dz) || 1, w = (e[2] >= 2 ? 3 : 1) * 14 / (d * d); vx += dx / d * w; vz += dz / d * w; }
          for (const e of st.foe) { const dx = st.x - e[0], dz = st.z - e[1], d = Math.hypot(dx, dz) || 1; vx += dx / d * 6 / (d * d); vz += dz / d * 6 / (d * d); }
          const l = Math.hypot(vx, vz); if (l > 0.05) { mx = vx / l; mz = vz / l; } T.input({ mx, mz, auto: true }); }
        s = T.step(1, 1 / 60, shot && f === 11); if (s === 'levelup') { T.pick(0); } const st = T.state(); mvs.push([st.boss && st.boss.mv, st.hp]); if (s === 'result' || s === 'dead' && 0) break;
      }
      const st = T.state(); return { s, mvs, hp: st.hp, boss: st.boss, t: st.t, won: st.won, haz: st.haz };
    }, { shot: !!SHOT });
    for (const [mv, hp] of r.mvs) { const key = mv || 'rest'; if (hp < last) dmg[key] = (dmg[key] || 0) + (last - hp); last = hp; }
    const mv = r.boss && r.boss.mv;
    if (SHOT && mv && (seen[mv] || 0) < 2 && k % 3 === 0) { seen[mv] = (seen[mv] || 0) + 1; await p.screenshot({ path: `${out}/b${stage}-${mv}-${seen[mv]}.png` }); }
    if (r.s === 'result') res = r;
  }
  console.log('stage', stage, res ? (res.won ? 'WIN' : 'LOSE') : 'TIMEOUT', 'dmg by move', JSON.stringify(Object.fromEntries(Object.entries(dmg).map(([k, v]) => [k, Math.round(v)]))));
}
await b.close();
