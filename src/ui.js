// 画面の文字と重ね表示（HUD、強化の3択、結果とガレージ）。値が変わったときだけ DOM を触る
import { jaEn, save, persist, TARGET } from './core.js';
import { themeOf } from './themes.js';
import { sfx, toggleMute, audioInit } from './audio.js';
import { GAR, garCost, GAR_MAX, NWAVE } from './game.js';

const $ = id => document.getElementById(id);
const cache = {};
function txt(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
function wid(id, f) { const v = Math.round(Math.max(0, Math.min(1, f)) * 200) / 2; if (cache[id] !== v) { cache[id] = v; $(id).style.width = v + '%'; } }
const NUT = '<span class="nut"></span>';
let pickCb = null, resH = null, openAt = 0;
const armed = () => performance.now() - openAt > 380; // 連打で誤って選ばないための待ち

export function initUi() {
  $('mute').addEventListener('click', () => { audioInit(); $('mute').classList.toggle('off', toggleMute()); });
  $('mute').classList.toggle('off', save.mute);
  window.addEventListener('keydown', e => {
    if (!$('lvl').hidden && armed() && e.key >= '1' && e.key <= '3') { if (pickCb) pickCb(+e.key - 1); }
    else if (!$('res').hidden && armed() && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (resH) resH.go(); }
    else if (e.key === 'm' || e.key === 'M') $('mute').click();
  });
}
export function hud(d) {
  const r = d.hp / d.maxhp, lvl = r < 0.2 ? 'crit' : r < 0.5 ? 'warn' : ''; if (cache.hpc !== lvl) { cache.hpc = lvl; $('hpbar').className = 'bar hp ' + lvl; }
  wid('hpb', d.hp / d.maxhp); txt('hpn', Math.ceil(d.hp) + ' / ' + d.maxhp);
  wid('xpb', d.xp / d.need); txt('lv', 'Lv ' + d.lvl);
  txt('wave', d.wave >= NWAVE ? 'BOSS' : 'WAVE ' + Math.max(1, d.wave + 1) + ' / ' + NWAVE);
  const s = d.t | 0; txt('time', jaEn('拠点 ', 'Base ') + d.stage + ' ' + d.place + '　' + ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'));
  txt('scr', d.scrap);
}
export function setBoss(f) { const w = $('bossw'); if (f < 0) { if (!w.hidden) w.hidden = true; return; } if (w.hidden) w.hidden = false; wid('bossb', f); }
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
export function banner(t, big) { const b = $('banner'); b.textContent = t; b.classList.toggle('big', !!big); replay(b, 'show'); }
export function vignette() { replay($('vig'), 'show'); }
export function hint(html, pulse) { const h = $('hint'); if (!html) { h.hidden = true; return; } if (cache.hint !== html) { cache.hint = html; h.innerHTML = html; } h.classList.toggle('pulse', !!pulse); h.hidden = false; }
// PC では操作方法を常に左下へ出す（スマホでは出さない）
export function legend(show) {
  const k = $('keys'); if (cache.keys === show) return; cache.keys = show; k.hidden = !show;
  if (show && !k.firstChild) k.innerHTML = [['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', jaEn('移動', 'Move')], [jaEn('<b>マウス</b>', '<b>Mouse</b>'), jaEn('狙う', 'Aim')], [jaEn('<b>クリック長押し</b>', '<b>Hold click</b>'), jaEn('射撃', 'Fire')], ['<kbd>M</kbd>', jaEn('音', 'Sound')]].map(a => `<span>${a[0]} ${a[1]}</span>`).join('');
}
export function hideAll() { $('lvl').hidden = true; $('res').hidden = true; pickCb = null; resH = null; }

export function showLevelUp(ch, lvl, cb) {
  pickCb = cb; openAt = performance.now();
  $('lvlt').textContent = 'LEVEL UP!  Lv ' + lvl; $('lvls').textContent = jaEn('強化を1つ選ぶ', 'Choose one upgrade');
  const box = $('cards'); box.innerHTML = '';
  ch.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'card'; b.id = 'card' + i; b.style.setProperty('--c', c.col);
    b.innerHTML = `<span class="ico">${c.icon}</span><span class="ct"><b>${c.name}</b><small>${c.desc}</small></span><span class="clv">${c.lv >= c.max ? 'MAX' : 'Lv ' + c.lv}</span><span class="key">${i + 1}</span>`;
    b.addEventListener('click', () => { if (armed() && pickCb) pickCb(i); });
    box.appendChild(b);
  });
  $('lvl').hidden = false;
}

export function showResult(d, h) {
  resH = h; openAt = performance.now();
  const s = d.t | 0, tm = ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0');
  $('rtitle').textContent = d.win ? jaEn('拠点を奪還！', 'Base reclaimed!') : jaEn('撃破された…', 'Tank destroyed');
  $('rtitle').className = 'rtitle ' + (d.win ? 'win' : 'lose');
  $('rsub').textContent = jaEn('拠点 ', 'Base ') + d.stage + ' ' + d.place + '　' + (d.boss ? 'BOSS' : 'WAVE ' + d.wave + ' / ' + NWAVE);
  $('stats').innerHTML = [[jaEn('時間', 'Time'), tm], [jaEn('撃破', 'Kills'), d.kills], [jaEn('レベル', 'Level'), d.lvl]].map(a => `<div><small>${a[0]}</small><b>${a[1]}</b></div>`).join('');
  $('earn').innerHTML = `+${d.earned} ${NUT} ` + jaEn('スクラップを持ち帰った', 'scrap brought home');
  $('gart').textContent = jaEn('ガレージで強化', 'Upgrade in the garage');
  $('go').textContent = d.win ? jaEn(`次の拠点「${d.next}」へ出撃`, `Next base: ${d.next}`) : jaEn('もう一度出撃', 'Deploy again');
  $('go').onclick = () => { if (armed() && resH) { sfx.ui(); resH.go(); } };
  if (TARGET === 'artifact') debugStage(d.win);
  drawGarage(); $('res').hidden = false;
}
// 試作版だけ：勝たなくても全拠点を見られるようにする拠点えらび
function debugStage(win) {
  let el = $('dbg');
  if (!el) { el = document.createElement('div'); el.id = 'dbg'; el.style.cssText = 'margin-top:10px;display:flex;gap:10px;justify-content:center;align-items:center;font-size:13px;opacity:.85'; $('go').after(el); }
  const draw = () => {
    const th = themeOf(save.stage);
    el.innerHTML = `<button id="dbgL" style="padding:6px 12px">◀</button><span>${jaEn('試作用 拠点えらび', 'Test: pick base')} ${save.stage} ${jaEn(th.ja, th.en)}</span><button id="dbgR" style="padding:6px 12px">▶</button>`;
    $('dbgL').onclick = () => mv(-1); $('dbgR').onclick = () => mv(1);
    $('go').textContent = jaEn(`拠点 ${save.stage}「${th.ja}」へ出撃`, `Deploy to base ${save.stage}: ${th.en}`);
  };
  const mv = d => { save.stage = Math.max(1, Math.min(60, save.stage + d)); persist(); draw(); };
  draw();
}
function drawGarage() {
  const box = $('gar'); box.innerHTML = ''; let goal = null;
  GAR.forEach(g => {
    const lv = save.up[g.k], c = garCost(lv), max = lv >= GAR_MAX, can = !max && save.scrap >= c;
    if (!max && !can && (!goal || c < goal.c)) goal = { c, g, lv };
    const b = document.createElement('button'); b.className = 'gbtn' + (can ? ' can' : ''); b.id = 'gar_' + g.k; b.disabled = !can;
    b.innerHTML = `<b>${jaEn(g.ja, g.en)} <i>Lv ${lv}</i></b><small>${g.d}</small><span class="cost">${max ? 'MAX' : NUT + c}</span>`;
    b.addEventListener('click', () => { if (resH && resH.buy(g.k)) drawGarage(); });
    box.appendChild(b);
  });
  $('total').innerHTML = jaEn('所持 ', 'You have ') + NUT + save.scrap;
  $('goal').textContent = goal ? jaEn(`あと ${goal.c - save.scrap} スクラップで「${goal.g.ja}」Lv ${goal.lv + 1}`, `${goal.c - save.scrap} more scrap for ${goal.g.en} Lv ${goal.lv + 1}`) : '';
}
