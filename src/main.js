// 起動とメインループ、テスト用の入口
import { diag, seed, save, setDayOff, missing, TARGET } from './core.js';
import * as MT from './meta.js';
import { initGfx, camera, camUpdate, render, updParticles, updRings, adapt, renderer, setQ, quality } from './gfx.js';
import { initInput, pollInput, setLock, relock, I } from './input.js';
import { audioInit, audioPause, musicState, forceMute } from './audio.js';
import { platform } from './platform.js';
import * as MX from './metrics.js';
import { initUi, showPause, showWelcome } from './ui.js';
import { initGame, startRun, begin, update, draw, snapshot, toBoss, pickUp, bank, G, P, TUNE } from './game.js';

const T = { manual: false, time: 0 };
function tick(dt, doRender) {
  if (G.paused) { I.sp = false; if (doRender && ++pzF % 10 === 0) render(); return; } // 一時停止中はたまに描き直すだけ（画面サイズの変更に追従）
  T.time += dt; setLock(G.state === 'play'); pollInput(camera); update(dt);
  if (!doRender) return;
  updParticles(dt); updRings(dt); draw(T.time); camUpdate(P.x, P.z, dt, false, I.touch ? 7 : 28); render();
}
let last = 0, shown = false;
// ---- 一時停止: 画面の外をクリック、タブ切り替え、Esc、P、右上のボタン。再開はクリック・タップか Enter / Space / P ----
let pzAt = 0, pzF = 0;
function pause() {
  if (G.paused || G.state !== 'play') return;
  G.paused = true; G.pzN++; pzAt = performance.now(); I.sp = false;
  setLock(false); audioPause(true); platform.gameplayStop(); showPause(true, I.touch, resume);
}
function resume() {
  if (!G.paused || performance.now() - pzAt < 250) return; // 止めた操作がそのまま再開にならないように
  G.paused = false; I.sp = false; showPause(false); audioPause(document.hidden); platform.gameplayStart(); last = performance.now();
  relock();
}
const autoPause = () => { if (!T.manual && !I.ext) pause(); }; // 自動テストのボットは止めない
function frame(now) {
  requestAnimationFrame(frame);
  try {
    const ms = now - last; last = now; if (T.manual || document.hidden) return;
    tick(Math.min(0.05, Math.max(0.001, ms / 1000)), true); if (ms < 1000 && !G.paused) { adapt(ms); MX.evTime(ms / 1000); }
    if (!shown) { shown = true; platform.loaded(); MX.evTouch(I.touch); MX.once('load', { ms: Math.round(now), q: quality() }); }
  } catch (e) { diag('LOOP ' + e.message); }
}
function welcomeOrStart() { // その日はじめての再訪は「おかえり」画面から。それ以外はすぐ出撃
  const wb = MT.welcome(); startRun(!!wb); camUpdate(0, 0, 0, true);
  if (wb) { MX.ev('welcome', { day: wb.day, sup: wb.arrived || '' }); showWelcome(wb, () => { begin(); relock(); }); }
}
async function boot() {
  try {
    await platform.init(); forceMute(platform.muted()); platform.onMute(forceMute);
    window.addEventListener('keydown', e => { // 入力処理より先に受け取り、再開のキーで必殺技や移動が出ないようにする
      if (e.repeat) return; const k = e.key;
      if (G.paused) { if (k === 'Enter' || k === ' ' || k === 'p' || k === 'P') { e.preventDefault(); e.stopImmediatePropagation(); resume(); } }
      else if (k === 'Escape' || k === 'p' || k === 'P') pause();
    });
    initGfx(document.getElementById('c')); initUi(); initGame(); initInput(audioInit, autoPause);
    document.getElementById('pz').addEventListener('click', e => { e.stopPropagation(); pause(); });
    window.addEventListener('blur', autoPause);
    welcomeOrStart();
    if (TARGET === 'artifact') window.addEventListener('tk-nextday', () => { const S = save; if (S.login) S.login.day--; if (S.supply) S.supply.day--; welcomeOrStart(); }); // 試作版だけ: 翌日の再訪を試す
    const leave = () => { bank(); MX.ev('leave', { st: G.state, run: save.runs, wave: G.wave }); MX.flush(); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { autoPause(); leave(); } audioPause(document.hidden || G.paused); });
    last = performance.now(); requestAnimationFrame(frame);
  } catch (e) { diag('BOOT ' + e.message + '\n' + (renderer ? '' : 'WebGL が使えません')); }
}
// ボットと確認用: 仮想時計で1フレームずつ進める
window.__tk = {
  manual(v) { T.manual = v; }, P, ev: MX.log, platform, day: setDayOff, meta: MT, q(n) { if (n !== undefined) setQ(n, true); return quality(); }, music: musicState, seed, state: snapshot, miss: missing, boss: toBoss, pick: pickUp, restart: startRun, save,
  tune: TUNE, input(o) { I.ext = o; }, pause, resume() { pzAt = 0; resume(); },
  step(n = 1, dt = 1 / 60, doRender = false) { for (let i = 0; i < n; i++) tick(dt, doRender && i === n - 1); return G.state; },
  go() { const b = document.getElementById('go'); if (b && b.onclick) { T.time += 1; } startRun(); },
};
boot();
