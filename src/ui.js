// 画面の文字と重ね表示（HUD、強化の3択、結果とガレージ）。値が変わったときだけ DOM を触る
import { jaEn, save, persist, TARGET } from './core.js';
import { themeOf } from './themes.js';
import { sfx, toggleMute, audioInit } from './audio.js';
import { GAR, garCost, GAR_MAX, NWAVE } from './game.js';
import * as MT from './meta.js';
import { ev } from './metrics.js';

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
export function toast(t) { const e = $('toast'); e.textContent = t; replay(e, 'show'); }
export function vignette() { replay($('vig'), 'show'); }
export function hint(html, pulse) { const h = $('hint'); if (!html) { h.hidden = true; return; } if (cache.hint !== html) { cache.hint = html; h.innerHTML = html; } h.classList.toggle('pulse', !!pulse); h.hidden = false; }
// PC では操作方法を常に左下へ出す（スマホでは出さない）
export function legend(show) {
  const k = $('keys'); if (cache.keys === show) return; cache.keys = show; k.hidden = !show;
  if (show && !k.firstChild) k.innerHTML = [['<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>', jaEn('移動', 'Move')], [jaEn('<b>クリック</b>', '<b>Click</b>'), jaEn('その場所へ移動', 'Go there')], [jaEn('<b>マウス</b>', '<b>Mouse</b>'), jaEn('狙う', 'Aim')], [jaEn('<b>射撃</b>', '<b>Fire</b>'), jaEn('自動', 'Auto')], ['<kbd>M</kbd>', jaEn('音', 'Sound')]].map(a => `<span>${a[0]} ${a[1]}</span>`).join('');
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
  drawMap(d);
  let sp = '';
  if (d.arrived) sp = d.arrived === 'scrap' ? jaEn(`補給便が届いた！ <b>スクラップ +${MT.SUP_SCRAP}</b>`, `Supply drop arrived: <b>+${MT.SUP_SCRAP} scrap</b>`) : jaEn(`補給便が届いた！ <b>${MT.pname(d.arrived)}</b> を装備した`, `Supply drop arrived: <b>${MT.pname(d.arrived)}</b> equipped`);
  else if (d.supply) sp = d.supply === 'scrap' ? jaEn(`明日届く補給便: <b>スクラップ ${MT.SUP_SCRAP}</b>`, `Tomorrow's supply drop: <b>${MT.SUP_SCRAP} scrap</b>`) : jaEn(`明日届く補給便: <b>${MT.pname(d.supply)}</b>（${MT.pdesc(d.supply)}）`, `Tomorrow's supply drop: <b>${MT.pname(d.supply)}</b> (${MT.pdesc(d.supply)})`);
  $('supply').hidden = !sp; $('supply').innerHTML = sp; tab = 'up';
  $('go').textContent = d.win ? jaEn(`次の拠点「${d.next}」へ出撃`, `Next base: ${d.next}`) : jaEn('もう一度出撃', 'Deploy again');
  $('go').onclick = () => { if (armed() && resH) { sfx.ui(); ev('again', { s: Math.round((performance.now() - openAt) / 1000) }); resH.go(); } };
  if (TARGET === 'artifact') debugStage(d.win);
  drawAll(); $('res').hidden = false;
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
// 奪還マップ: いまのエリアの 6 拠点と、全体（5 エリア 30 拠点）の進み具合。勝った直後は奪った拠点が塗り変わる
export const AREAS = 5;
function drawMap(d) {
  const got = save.stage - 1, ar = Math.floor(Math.max(0, d.win ? d.stage - 1 : got) / 6), base = ar * 6, tot = AREAS * 6;
  let h = `<div class="mh"><span>${jaEn(`エリア ${ar + 1}`, `Area ${ar + 1}`)}　<b>${jaEn('奪還', 'Reclaimed')} ${Math.max(0, Math.min(6, got - base))} / 6</b></span><span>${jaEn('全体', 'Total')} <b>${Math.min(got, tot)} / ${tot}</b></span></div><div class="mrow"><i class="fill" id="mfill"></i>`;
  for (let i = 1; i <= 6; i++) {
    const st = base + i, th = themeOf(st), g = st <= got, c = st === got + 1;
    h += `<div class="mn${g ? ' got' : c ? ' cur' : ''}${d.win && st === d.stage ? ' flip' : ''}"><u>${g ? '✓' : st}</u>${jaEn(th.ja, th.en.split(' ')[0])}</div>`;
  }
  h += '</div><div class="mar">';
  for (let a = 0; a < AREAS; a++) h += `<s class="${a === ar ? 'now' : ''}"><b style="width:${Math.max(0, Math.min(6, got - a * 6)) / 6 * 100}%"></b></s>`;
  const left = base + 6 - got;
  h += `<span>${got >= tot ? jaEn('全拠点を奪還！', 'All bases reclaimed!') : left <= 0 ? jaEn(`エリア ${ar + 1} を制圧！ 次はエリア ${ar + 2}`, `Area ${ar + 1} secured! Next: Area ${ar + 2}`) : jaEn(`あと ${left} 拠点でエリア ${ar + 1} を制圧`, `${left} more to secure Area ${ar + 1}`)}</span></div>`;
  $('map').innerHTML = h;
  const n = Math.max(0, Math.min(6, got - base)), w = n <= 1 ? 0 : (n - 1) / 5 * 84, f = $('mfill');
  f.style.width = (d.win && n > 1 ? (n - 2) / 5 * 84 : w) + '%'; requestAnimationFrame(() => requestAnimationFrame(() => { f.style.width = w + '%'; }));
}
let tab = 'up', goal = null;
function drawAll() {
  goal = null; drawGarage(); drawParts(); drawDaily();
  const D = MT.daily(), done = D.m.filter(m => m.done).length;
  const canUp = GAR.some(g => save.up[g.k] < GAR_MAX && save.scrap >= garCost(save.up[g.k])), canPt = MT.PARTS.some(p => !MT.owned(p.id) && save.scrap >= p.cost);
  const T = [['up', jaEn('強化', 'Upgrades'), canUp], ['parts', jaEn('パーツ', 'Parts'), canPt], ['daily', jaEn('デイリー ', 'Daily ') + done + '/3', false]];
  $('tabs').innerHTML = T.map(t => `<button class="tb${tab === t[0] ? ' on' : ''}" id="tb_${t[0]}">${t[1]}${t[2] ? '<span class="dot"></span>' : ''}</button>`).join('');
  for (const t of T) { $('tb_' + t[0]).onclick = () => { tab = t[0]; ev('tab', { k: tab }); sfx.ui(); drawAll(); }; $('tab_' + t[0]).hidden = tab !== t[0]; }
  $('total').innerHTML = jaEn('所持 ', 'You have ') + NUT + save.scrap;
  $('goal').textContent = goal ? jaEn(`あと ${goal.c - save.scrap} スクラップで「${goal.ja}」`, `${goal.c - save.scrap} more scrap for ${goal.en}`) : '';
}
function drawGarage() {
  const box = $('gar'); box.innerHTML = '';
  GAR.forEach(g => {
    const lv = save.up[g.k], c = garCost(lv), max = lv >= GAR_MAX, can = !max && save.scrap >= c;
    if (!max && !can && (!goal || c < goal.c)) goal = { c, ja: g.ja + ' Lv ' + (lv + 1), en: g.en + ' Lv ' + (lv + 1) };
    const b = document.createElement('button'); b.className = 'gbtn' + (can ? ' can' : ''); b.id = 'gar_' + g.k; b.disabled = !can;
    b.innerHTML = `<b>${jaEn(g.ja, g.en)} <i>Lv ${lv}</i></b><small>${g.d}</small><span class="cost">${max ? 'MAX' : NUT + c}</span>`;
    b.addEventListener('click', () => { if (resH && resH.buy(g.k)) { ev('buy', { k: g.k, lv: save.up[g.k] }); drawAll(); } });
    box.appendChild(b);
  });
}
function drawParts() {
  const box = $('tab_parts'); box.innerHTML = '';
  for (const [slot, ja, en] of MT.SLOTS) {
    const lab = document.createElement('div'); lab.className = 'plab'; lab.textContent = jaEn(ja, en); box.appendChild(lab);
    const row = document.createElement('div'); row.className = 'prow';
    for (const p of MT.PARTS.filter(q => q.slot === slot)) {
      const own = MT.owned(p.id), on = save.parts[slot] === p.id, lock = p.cost < 0, can = !own && !lock && save.scrap >= p.cost;
      if (!own && !can && !lock && (!goal || p.cost < goal.c)) goal = { c: p.cost, ja: p.ja[0], en: p.en[0] };
      const b = document.createElement('button'); b.className = 'gbtn' + (on ? ' on' : own ? ' own' : can ? ' can' : ''); b.id = 'part_' + p.id; b.disabled = !own && !can;
      b.innerHTML = `<b>${p.col !== undefined ? `<i class="sw" style="background:#${p.col.toString(16).padStart(6, '0')}"></i>` : ''}${MT.pname(p.id)}</b><small>${MT.pdesc(p.id)}</small><span class="cost">${on ? jaEn('装備中', 'Equipped') : own ? jaEn('装備する', 'Equip') : lock ? jaEn('報酬', 'Reward') : NUT + p.cost}</span>`;
      b.addEventListener('click', () => { if (own ? MT.equip(p.id) : MT.buyPart(p.id)) { ev(own ? 'equip' : 'part', { k: p.id }); sfx.buy(); drawAll(); } });
      row.appendChild(b);
    }
    box.appendChild(row);
  }
}
function drawDaily() {
  const D = MT.daily(), ld = MT.loginDay();
  $('tab_daily').innerHTML = `<div class="plab">${jaEn('ログイン報酬（遊んだ日ごとに1つ）', 'Login rewards (one per day you play)')}</div><div class="lg">${MT.LOGIN.map((v, i) => `<span class="${i < ld ? 'got' : ''}${i === ld ? ' nx' : ''}"><small>${jaEn(`${i + 1}日目`, `Day ${i + 1}`)}</small>${i === 6 ? '★' : ''}${NUT}${v}</span>`).join('')}</div><div class="plab">${jaEn('今日のミッション', "Today's missions")}</div>` + D.m.map(m => `<div class="dm${m.done ? ' done' : ''}"><span>${MT.dailyText(m)}</span><span>${m.done ? '✓' : m.p + ' / ' + m.n}　+${MT.DAILY_PAY}</span><div class="bar"><i style="width:${Math.round(m.p / m.n * 100)}%"></i></div></div>`).join('')
    + `<div class="plab" style="text-align:center">${jaEn('3つ達成でボーナス +', 'All three: bonus +')}${MT.DAILY_BONUS}${D.bonus ? ' ✓' : ''}　${jaEn('毎日0時に入れ替わり', 'New missions every day')}</div>`;
}
