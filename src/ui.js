// 画面の文字と重ね表示（HUD、強化の3択、結果とガレージ）。値が変わったときだけ DOM を触る
import { jaEn, save } from './core.js';
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
  wid('hpb', d.hp / d.maxhp); txt('hpn', Math.ceil(d.hp) + ' / ' + d.maxhp);
  wid('xpb', d.xp / d.need); txt('lv', 'Lv ' + d.lvl);
  txt('wave', d.wave >= NWAVE ? 'BOSS' : 'WAVE ' + Math.max(1, d.wave + 1) + ' / ' + NWAVE);
  const s = d.t | 0; txt('time', jaEn('拠点 ', 'Base ') + d.stage + '　' + ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'));
  txt('scr', d.scrap);
}
export function setBoss(f) { const w = $('bossw'); if (f < 0) { if (!w.hidden) w.hidden = true; return; } if (w.hidden) w.hidden = false; wid('bossb', f); }
function replay(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
export function banner(t, big) { const b = $('banner'); b.textContent = t; b.classList.toggle('big', !!big); replay(b, 'show'); }
export function vignette() { replay($('vig'), 'show'); }
export function hint(html) { const h = $('hint'); if (!html) { h.hidden = true; return; } h.innerHTML = html; h.hidden = false; }
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
  $('rsub').textContent = jaEn('拠点 ', 'Base ') + d.stage + '　' + (d.boss ? 'BOSS' : 'WAVE ' + d.wave + ' / ' + NWAVE);
  $('stats').innerHTML = [[jaEn('時間', 'Time'), tm], [jaEn('撃破', 'Kills'), d.kills], [jaEn('レベル', 'Level'), d.lvl]].map(a => `<div><small>${a[0]}</small><b>${a[1]}</b></div>`).join('');
  $('earn').innerHTML = `+${d.earned} ${NUT} ` + jaEn('スクラップを持ち帰った', 'scrap brought home');
  $('gart').textContent = jaEn('ガレージで強化', 'Upgrade in the garage');
  $('go').textContent = d.win ? jaEn('次の拠点へ出撃', 'Attack the next base') : jaEn('もう一度出撃', 'Deploy again');
  $('go').onclick = () => { if (armed() && resH) { sfx.ui(); resH.go(); } };
  drawGarage(); $('res').hidden = false;
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
