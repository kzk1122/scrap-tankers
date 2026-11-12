// 起動とメインループ、テスト用の入口
import { diag, seed, save, setDayOff } from './core.js';
import * as MT from './meta.js';
import { initGfx, camera, camUpdate, render, updParticles, updRings, adapt, renderer, setQ, quality } from './gfx.js';
import { initInput, pollInput, I } from './input.js';
import { audioInit, audioPause, musicState } from './audio.js';
import { initUi } from './ui.js';
import { initGame, startRun, update, draw, snapshot, pickUp, bank, G, P } from './game.js';

const T = { manual: false, time: 0 };
function tick(dt, doRender) {
  T.time += dt; pollInput(camera); update(dt);
  if (!doRender) return;
  updParticles(dt); updRings(dt); draw(T.time); camUpdate(P.x, P.z, dt, false); render();
}
let last = 0;
function frame(now) {
  requestAnimationFrame(frame);
  try {
    const ms = now - last; last = now; if (T.manual || document.hidden) return;
    tick(Math.min(0.05, Math.max(0.001, ms / 1000)), true); if (ms < 1000) adapt(ms);
  } catch (e) { diag('LOOP ' + e.message); }
}
function boot() {
  try {
    initGfx(document.getElementById('c')); initUi(); initGame(); initInput(audioInit);
    startRun(); camUpdate(0, 0, 0, true);
    window.addEventListener('pagehide', bank);
    document.addEventListener('visibilitychange', () => { if (document.hidden) bank(); audioPause(document.hidden); });
    last = performance.now(); requestAnimationFrame(frame);
  } catch (e) { diag('BOOT ' + e.message + '\n' + (renderer ? '' : 'WebGL が使えません')); }
}
// ボットと確認用: 仮想時計で1フレームずつ進める
window.__tk = {
  manual(v) { T.manual = v; }, day: setDayOff, meta: MT, q(n) { if (n !== undefined) setQ(n, true); return quality(); }, music: musicState, seed, state: snapshot, pick: pickUp, restart: startRun, save,
  input(o) { I.ext = o; },
  step(n = 1, dt = 1 / 60, doRender = false) { for (let i = 0; i < n; i++) tick(dt, doRender && i === n - 1); return G.state; },
  go() { const b = document.getElementById('go'); if (b && b.onclick) { T.time += 1; } startRun(); },
};
boot();
