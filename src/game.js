// ゲーム本体: 自機、敵、弾、歯車、波、強化、勝敗
import { THREE, rnd, rr, clamp, angLerp, save, persist, jaEn } from './core.js';
import { scene, geo, MAT, BMAT, Inst, burst, ring, addShake } from './gfx.js';
import * as W from './world.js';
import { I } from './input.js';
import { sfx } from './audio.js';
import * as UI from './ui.js';
import { platform } from './platform.js';

const ic = (d, fill) => `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
// ラン中の強化（3択）。数値は recalc() に集約
export const UPS = [
  { id: 'rapid', max: 6, col: '#ffb21e', ja: ['連射', '発射速度 +25%'], en: ['Rapid Fire', 'Fire rate +25%'], icon: ic('<path d="M3 6l6 6-6 6M9 6l6 6-6 6M15 6l6 6-6 6"/>') },
  { id: 'heavy', max: 6, col: '#ff7a59', ja: ['大口径', 'ダメージ +30%'], en: ['Heavy Shells', 'Damage +30%'], icon: ic('<circle cx="12" cy="12" r="7"/>', 1) },
  { id: 'split', max: 4, col: '#49b8ff', ja: ['分裂砲', '弾を +1 発'], en: ['Split Shot', '+1 shell per shot'], icon: ic('<path d="M12 21v-9M12 12L5 4M12 12l7-8M12 12V3"/>') },
  { id: 'pierce', max: 3, col: '#b58bff', ja: ['貫通弾', '敵を +1 体つらぬく'], en: ['Piercing', 'Pierce +1 enemy'], icon: ic('<path d="M2 12h20M16 6l6 6-6 6M8 5v14"/>') },
  { id: 'boom', max: 4, col: '#ff5b6b', ja: ['炸裂弾', '着弾で爆発（範囲アップ）'], en: ['Explosive', 'Shells explode on hit'], icon: ic('<path d="M12 2l2.5 6.5L21 6l-3.5 6L22 16l-7 .5L12 22l-3-5.5L2 16l4.5-4L3 6l6.5 2.5z"/>', 1) },
  { id: 'armor', max: 5, col: '#5fe08a', ja: ['追加装甲', '最大HP +25、25回復'], en: ['Armor Plating', 'Max HP +25, heal 25'], icon: ic('<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/>') },
  { id: 'engine', max: 4, col: '#ffe14d', ja: ['高出力エンジン', '移動速度 +12%'], en: ['Turbo Engine', 'Move speed +12%'], icon: ic('<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>', 1) },
  { id: 'magnet', max: 3, col: '#ff8ad1', ja: ['マグネット', '歯車を吸う範囲 +60%'], en: ['Magnet', 'Pickup range +60%'], icon: ic('<path d="M5 3v9a7 7 0 0014 0V3h-5v9a2 2 0 01-4 0V3z"/>') },
  { id: 'rear', max: 2, col: '#7fd6c2', ja: ['後方砲', '後ろにも撃つ'], en: ['Rear Gun', 'Also fires backward'], icon: ic('<path d="M12 3v18M6 9l6-6 6 6M6 15l6 6 6-6"/>') },
  { id: 'regen', max: 4, col: '#8be36b', ja: ['修理ドローン', '毎秒 HP +1.2'], en: ['Repair Drone', 'Regen 1.2 HP/s'], icon: ic('<path d="M12 5v14M5 12h14" stroke-width="4"/>') },
  { id: 'bounce', max: 3, col: '#6ad0ff', ja: ['跳弾', '当たると近くの敵へ跳ねる'], en: ['Ricochet', 'Shells bounce to a nearby enemy'], icon: ic('<path d="M2 18L9 6l6 10 7-12"/>') },
  { id: 'mine', max: 4, col: '#ffa24d', ja: ['地雷', '走りながら地雷をまく'], en: ['Mines', 'Drop mines as you drive'], icon: ic('<circle cx="12" cy="13" r="6"/><path d="M12 3v4M4 13H2M22 13h-2M5.5 6.5l2 2M18.5 6.5l-2 2"/>') },
  { id: 'long', max: 3, col: '#c9d4ff', ja: ['長砲身', '射程と弾速 +20%'], en: ['Long Barrel', 'Range & shell speed +20%'], icon: ic('<path d="M3 12h14M13 7l5 5-5 5M21 5v14"/>') },
];
// ガレージの永続強化（スクラップで買う）
export const GAR = [
  { k: 'dmg', ja: '火力', en: 'Firepower', d: '+10%' }, { k: 'hp', ja: '装甲', en: 'Armor', d: '+15 HP' }, { k: 'spd', ja: '機動', en: 'Mobility', d: '+4%' }];
export const garCost = lv => Math.round(15 * Math.pow(1.5, lv));
export const GAR_MAX = 10;

// 敵: 0 ドローン / 1 砲手 / 2 ブルート / 3 ボス
const ET = [
  { hp: 20, sp: 4.6, r: 0.9, dmg: 8, xp: 1, sc: 1, chew: 14, col: 0x8a5cf0 },
  { hp: 34, sp: 3.2, r: 1.0, dmg: 6, xp: 2, sc: 2, chew: 14, col: 0xe0457b, shoot: 2.3 },
  { hp: 130, sp: 2.7, r: 1.5, dmg: 18, xp: 5, sc: 5, chew: 90, col: 0xd9413c },
  { hp: 1100, sp: 2.3, r: 2.7, dmg: 25, xp: 30, sc: 50, chew: 9999, col: 0x2b3158, boss: true },
];
const WAVES = [[8, 0, 0], [14, 2, 0], [18, 4, 1], [22, 6, 2], [28, 8, 3], [34, 10, 5]];
const WDUR = 26;
export const NWAVE = WAVES.length;

export const G = { state: 'boot' };
export const P = { x: 0, z: 0 };
export const S = {};
const E = [], B = [], K = [], M = [], boomQ = [];
let u = {}, hull, turret, instE, instB, instBul, instGear, instHeal, instMine, tgtT = 0, tgt = null, pickN = 0, pickT = 0;

export function initGame() {
  const tr = 0x39405c, bd = 0xffb21e, bd2 = 0xf08a1c;
  hull = new THREE.Mesh(geo([
    { s: [1.5, 0.55, 2.0], p: [0, 0.62, 0], c: bd }, { s: [0.42, 0.56, 2.25], p: [-0.86, 0.3, 0], c: tr }, { s: [0.42, 0.56, 2.25], p: [0.86, 0.3, 0], c: tr },
    { s: [1.1, 0.14, 0.5], p: [0, 0.96, -0.6], c: bd2 }]), MAT);
  turret = new THREE.Mesh(geo([
    { s: [0.98, 0.46, 1.05], p: [0, 1.14, -0.05], c: bd2 }, { s: [0.24, 0.24, 1.35], p: [0, 1.14, 1.0], c: tr }, { s: [0.34, 0.3, 0.3], p: [0, 1.14, 1.72], c: tr },
    { s: [0.36, 0.14, 0.36], p: [0.22, 1.43, -0.2], c: 0xfff0b8 }]), MAT);
  hull.castShadow = turret.castShadow = true; scene.add(hull); scene.add(turret);
  const dk = 0x2a2d44;
  instE = [
    new Inst(geo([{ s: [1.1, 0.45, 1.35], p: [0, 0.5, 0], c: 0x8a5cf0 }, { s: [1.4, 0.4, 0.4], p: [0, 0.3, 0.42], c: dk }, { s: [1.4, 0.4, 0.4], p: [0, 0.3, -0.42], c: dk }, { s: [0.34, 0.3, 0.6], p: [0, 0.55, 0.85], c: 0xffd23f }, { s: [0.5, 0.25, 0.5], p: [0, 0.85, -0.15], c: 0xb89cff }]), 140, { shadow: true }),
    new Inst(geo([{ s: [1.3, 0.5, 1.6], p: [0, 0.58, 0], c: 0xe0457b }, { s: [0.36, 0.5, 1.8], p: [-0.76, 0.28, 0], c: dk }, { s: [0.36, 0.5, 1.8], p: [0.76, 0.28, 0], c: dk }, { s: [0.76, 0.42, 0.76], p: [0, 1.04, -0.1], c: 0xff7aa5 }, { s: [0.2, 0.2, 1.1], p: [0, 1.04, 0.75], c: dk }]), 50, { shadow: true }),
    new Inst(geo([{ s: [2.2, 0.95, 2.4], p: [0, 0.85, 0], c: 0xd9413c }, { s: [0.55, 0.8, 2.7], p: [-1.3, 0.4, 0], c: dk }, { s: [0.55, 0.8, 2.7], p: [1.3, 0.4, 0], c: dk }, { s: [2.9, 1.1, 0.35], p: [0, 0.65, 1.5], c: 0xc9d1e0 }, { s: [1.2, 0.6, 1.0], p: [0, 1.6, -0.5], c: 0xff7b6b }]), 30, { shadow: true }),
    new Inst(geo([{ s: [3.8, 1.2, 4.4], p: [0, 1.1, 0], c: 0x2b3158 }, { s: [0.9, 1.1, 4.9], p: [-2.2, 0.55, 0], c: dk }, { s: [0.9, 1.1, 4.9], p: [2.2, 0.55, 0], c: dk }, { s: [2.3, 1.0, 2.3], p: [0, 2.2, -0.3], c: 0xe0457b }, { s: [0.4, 0.4, 2.6], p: [-0.6, 2.2, 1.9], c: dk }, { s: [0.4, 0.4, 2.6], p: [0.6, 2.2, 1.9], c: dk },
      { s: [0.4, 0.7, 0.4], p: [-0.8, 3.0, -0.3], c: 0xffd23f }, { s: [0.4, 0.9, 0.4], p: [0, 3.1, -0.3], c: 0xffd23f }, { s: [0.4, 0.7, 0.4], p: [0.8, 3.0, -0.3], c: 0xffd23f }, { s: [4.0, 0.25, 0.5], p: [0, 1.3, 2.2], c: 0xe0457b }]), 2, { shadow: true }),
  ];
  const wd = 0xc98d4b, wd2 = 0xa66f36;
  instB = [
    new Inst(geo([{ s: [1.7, 1.7, 1.7], p: [0, 0.85, 0], c: wd }, { s: [1.82, 0.26, 1.82], p: [0, 0.2, 0], c: wd2 }, { s: [1.82, 0.26, 1.82], p: [0, 1.5, 0], c: wd2 }]), 220, { shadow: true }),
    new Inst(geo([{ s: [2, 1.9, 2], p: [0, 0.95, 0], c: 0xcfd6e4 }, { s: [2.04, 0.3, 2.04], p: [0, 1.75, 0], c: 0xaab4c8 }]), 140, { shadow: true }),
    new Inst(geo([{ s: [1.3, 1.6, 1.3], p: [0, 0.8, 0], c: 0xe5484d, cyl: 10 }, { s: [1.36, 0.3, 1.36], p: [0, 0.8, 0], c: 0xffd23f, cyl: 10 }]), 60, { shadow: true }),
  ];
  instBul = new Inst(new THREE.IcosahedronGeometry(0.3, 0), 420, { mat: BMAT });
  instGear = new Inst(geo([{ s: [0.7, 0.2, 0.7], p: [0, 0, 0], c: 0xffd23f, cyl: 6 }, { s: [0.3, 0.24, 0.3], p: [0, 0, 0], c: 0xb8860b, cyl: 6 }]), 360, {});
  instHeal = new Inst(geo([{ s: [0.9, 0.3, 0.3], p: [0, 0, 0], c: 0x5fe08a }, { s: [0.3, 0.3, 0.9], p: [0, 0, 0], c: 0x5fe08a }]), 20, {});
  instMine = new Inst(geo([{ s: [0.9, 0.22, 0.9], p: [0, 0.11, 0], c: 0x39405c, cyl: 8 }, { s: [0.3, 0.14, 0.3], p: [0, 0.28, 0], c: 0xff5b6b, cyl: 6 }]), 16, {});
  W.setOnBreak(onBreak);
}

function recalc() {
  S.dmg = 10 * (1 + 0.1 * save.up.dmg) * (1 + 0.3 * u.heavy);
  S.rate = 2.6 * (1 + 0.25 * u.rapid);
  S.shots = 1 + u.split; S.pierce = u.pierce; S.bounce = u.bounce; S.rear = u.rear;
  S.exR = u.boom ? 2.0 + 0.6 * u.boom : 0;
  S.maxhp = 100 + 15 * save.up.hp + 25 * u.armor;
  S.speed = 9 * (1 + 0.04 * save.up.spd) * (1 + 0.12 * u.engine);
  S.mag = 4 * (1 + 0.6 * u.magnet); S.regen = 1.2 * u.regen; S.mine = u.mine;
  S.bspd = 30 * (1 + 0.2 * u.long); S.blife = 0.7;
}
const need = l => 4 + 3 * (l - 1);

export function startRun() {
  W.genWorld();
  E.length = B.length = K.length = M.length = boomQ.length = 0;
  u = {}; for (const d of UPS) u[d.id] = 0;
  Object.assign(G, { state: 'play', t: 0, wave: -1, wt: 0, queue: [], kills: 0, scrap: 0, banked: 0, lvl: 1, xp: 0, pend: 0, inv: 0, endT: 0, boss: null, stage: save.stage, won: false, first: save.runs === 0 });
  recalc(); Object.assign(P, { x: 0, z: 0, vx: 0, vz: 0, ry: Math.PI, ty: Math.PI, hp: S.maxhp, cd: 0, mineT: 1, recoil: 0, dead: false });
  hull.visible = turret.visible = true; tgt = null;
  save.runs++; persist(); UI.hideAll(); UI.setBoss(-1);
  if (G.first) UI.hint(I.touch ? jaEn('画面をドラッグで移動　攻撃は自動', 'Drag to move. Your tank fires automatically') : jaEn('<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 移動　マウスで狙ってクリックで射撃', '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move. Aim with the mouse, click to fire'));
  else UI.hint(null);
  platform.gameplayStart();
}
// 途中で閉じてもスクラップが消えないよう、区切りごとに保存へ移す
export function bank() { const d = G.scrap - G.banked; if (d > 0) { save.scrap += d; G.banked = G.scrap; persist(); } }

function startWave(i) {
  G.wave = i; G.wt = 0; G.queue = []; W.compact();
  const hpM = 1 + 0.22 * (G.stage - 1), cM = 1 + 0.12 * (G.stage - 1);
  if (i >= NWAVE) { G.queue.push({ t: 1.2, k: 3 }); UI.banner(jaEn('拠点ボス出現！', 'BASE BOSS!'), true); sfx.wave(); G.hpM = hpM; return; }
  const w = WAVES[i];
  for (let k = 0; k < 3; k++) { const n = Math.round(w[k] * cM); for (let j = 0; j < n; j++) G.queue.push({ t: rr(0.3, WDUR * 0.62) * (k === 0 && j < 3 ? 0.15 : 1), k }); }
  G.queue.sort((a, b) => a.t - b.t); G.hpM = hpM;
  UI.banner('WAVE ' + (i + 1) + ' / ' + NWAVE); if (i > 0) sfx.wave();
}
function spawn(k) {
  const d = ET[k], a = rnd() * 6.283, dist = k === 3 ? 22 : rr(19, 26);
  const e = { k, x: clamp(P.x + Math.cos(a) * dist, -W.A + 2, W.A - 2), z: clamp(P.z + Math.sin(a) * dist, -W.A + 2, W.A - 2), hp: d.hp * G.hpM, max: d.hp * G.hpM, r: d.r, ry: 0, kx: 0, kz: 0, cd: rr(1, 2.5), hc: 0, hitT: 0, born: 0, dead: false, c2: 4, strafe: rnd() < 0.5 ? 1 : -1 };
  if (Math.hypot(e.x - P.x, e.z - P.z) < 12) { e.x = clamp(P.x - Math.cos(a) * dist, -W.A + 2, W.A - 2); e.z = clamp(P.z - Math.sin(a) * dist, -W.A + 2, W.A - 2); }
  E.push(e); if (k === 3) { G.boss = e; UI.setBoss(1); }
}
function bullet(x, z, a, foe, dmg, spd, life) {
  if (B.length > 400) return;
  B.push({ x, z, vx: Math.sin(a) * spd, vz: Math.cos(a) * spd, l: life, dmg, foe, pierce: foe ? 0 : S.pierce, bounce: foe ? 0 : S.bounce, hit: null, dead: false });
}
function shoot() {
  const n = S.shots;
  for (let k = 0; k < n; k++) { const a = P.ty + (k - (n - 1) / 2) * 0.13; bullet(P.x + Math.sin(a) * 1.7, P.z + Math.cos(a) * 1.7, a, false, S.dmg, S.bspd, S.blife); }
  for (let k = 0; k < S.rear; k++) { const a = P.ty + Math.PI + (k - (S.rear - 1) / 2) * 0.2; bullet(P.x + Math.sin(a) * 1.2, P.z + Math.cos(a) * 1.2, a, false, S.dmg, S.bspd, S.blife); }
  P.recoil = 1; sfx.shot(); burst(P.x + Math.sin(P.ty) * 1.9, 1.15, P.z + Math.cos(P.ty) * 1.9, 3, 0xfff2a8, 4, 0.22, 0.18, 0.3);
}
function hurtE(e, d, kx, kz) {
  if (e.dead) return; e.hp -= d; e.hitT = 0.1;
  const m = e.k === 3 ? 0 : e.k === 2 ? 0.35 : 1; e.kx += kx * m; e.kz += kz * m;
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.dead = true; const d = ET[e.k]; G.kills++; G.scrap += d.sc;
  burst(e.x, 0.8, e.z, e.k === 0 ? 8 : e.k === 3 ? 60 : 16, d.col, e.k >= 2 ? 11 : 8, e.k >= 2 ? 0.5 : 0.34, 0.6);
  burst(e.x, 0.8, e.z, 4, 0x2a2d44, 6, 0.3, 0.7);
  if (e.k >= 2) { ring(e.x, e.z, e.r * 2.2); addShake(e.k === 3 ? 1 : 0.3); sfx.boom(true); } else { sfx.boom(false); addShake(0.06); }
  const n = e.k === 3 ? 14 : e.k === 2 ? 3 : 1;
  for (let i = 0; i < n; i++) K.push({ x: e.x + rr(-1, 1) * (n > 1 ? e.r : 0.2), z: e.z + rr(-1, 1) * (n > 1 ? e.r : 0.2), v: e.k === 3 ? 2 : e.k === 2 ? (i === 0 ? 3 : 1) : d.xp, t: 0, heal: false, vac: false });
  if (e.k === 3) win();
}
function explode(x, z, R, d) {
  ring(x, z, R); burst(x, 1, z, 16, 0xffa53a, 10, 0.4, 0.5); burst(x, 1, z, 6, 0xfff2a8, 6, 0.3, 0.35); burst(x, 1, z, 6, 0x4a4f66, 6, 0.42, 0.8);
  addShake(Math.min(0.55, R * 0.07)); sfx.boom(R > 4);
  for (const e of E) { if (e.dead) continue; const dx = e.x - x, dz = e.z - z, dd = Math.hypot(dx, dz); if (dd < R + e.r) { const f = 1 - 0.5 * Math.min(1, dd / R), il = 1 / (dd || 1); hurtE(e, d * f, dx * il * 9, dz * il * 9); } }
  for (let i = 0; i < W.blocks.length; i++) { const b = W.blocks[i]; if (b.hp <= 0) continue; if (Math.hypot(b.x - x, b.z - z) < R + 0.5) W.damageBlock(b, d * 0.8); }
}
function onBreak(b) {
  if (b.t === W.BARREL) { boomQ.push({ x: b.x, z: b.z, t: 0.07 }); return; }
  burst(b.x, 0.9, b.z, b.t === W.CRATE ? 9 : 12, b.t === W.CRATE ? 0xc98d4b : 0xcfd6e4, 7, 0.42, 0.7); sfx.crack(); addShake(0.05);
  if (b.t === W.CRATE) {
    const q = rnd();
    if (b.gift || q < 0.4) K.push({ x: b.x, z: b.z, v: 1, t: 0, heal: false, vac: false });
    else if (q < 0.47 && P.hp < S.maxhp) K.push({ x: b.x, z: b.z, v: 20, t: 0, heal: true, vac: false });
  }
}
function hurt(d) {
  if (G.inv > 0 || G.state !== 'play') return;
  P.hp -= d * Math.min(1, 0.5 + 0.17 * Math.max(0, G.wave) + 0.15 * (G.stage - 1)); G.inv = 0.45; UI.vignette(); addShake(0.3); sfx.hurt(); burst(P.x, 1, P.z, 5, 0xffb21e, 6, 0.3, 0.4);
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true; G.state = 'dead'; G.endT = 1.3; hull.visible = turret.visible = false;
    burst(P.x, 1, P.z, 40, 0xffb21e, 12, 0.5, 0.9); burst(P.x, 1, P.z, 16, 0x39405c, 9, 0.5, 1); ring(P.x, P.z, 6); addShake(1); sfx.boom(true); sfx.lose();
    platform.gameplayStop();
  }
}
function win() {
  G.state = 'win'; G.endT = 2.4; G.won = true; G.scrap += 30 + 10 * G.stage; UI.setBoss(-1);
  for (const e of E) if (!e.dead) { e.dead = true; burst(e.x, 0.8, e.z, 8, ET[e.k].col, 8, 0.34, 0.6); }
  for (const b of B) b.dead = true; for (const k of K) k.vac = true;
  UI.banner(jaEn('拠点を奪還！', 'BASE RECLAIMED!'), true); sfx.win(); platform.gameplayStop(); platform.happyTime();
}
function addXp(v) { G.xp += v; while (G.xp >= need(G.lvl)) { G.xp -= need(G.lvl); G.lvl++; G.pend++; } }
function openLevelUp() {
  const pool = UPS.filter(d => u[d.id] < d.max);
  if (!pool.length) { G.pend = 0; P.hp = Math.min(S.maxhp, P.hp + 30); return; }
  const ch = []; while (ch.length < 3 && pool.length) ch.push(pool.splice((rnd() * pool.length) | 0, 1)[0]);
  G.state = 'levelup'; G.choices = ch; sfx.lvl();
  UI.showLevelUp(ch.map(d => ({ name: jaEn(d.ja[0], d.en[0]), desc: jaEn(d.ja[1], d.en[1]), icon: d.icon, col: d.col, lv: u[d.id] + 1, max: d.max })), G.lvl, pickUp);
}
export function pickUp(i) {
  if (G.state !== 'levelup') return; const d = G.choices[i]; if (!d) return;
  u[d.id]++; const hp0 = S.maxhp; recalc(); if (d.id === 'armor') P.hp = Math.min(S.maxhp, P.hp + 25 + (S.maxhp - hp0) * 0);
  G.pend--; G.inv = 0.7; sfx.ui(); UI.hideAll(); ring(P.x, P.z, 4, 0x8fe3ff);
  if (G.pend > 0) openLevelUp(); else G.state = 'play';
}
function showResult() {
  bank(); if (G.won) { save.stage++; save.best = Math.max(save.best, save.stage); } persist();
  G.state = 'result';
  UI.showResult({ win: G.won, stage: G.stage, wave: Math.min(G.wave + 1, NWAVE), boss: G.wave >= NWAVE, t: G.t, kills: G.kills, lvl: G.lvl, earned: G.scrap }, { buy: buyGar, go: startRun });
}
function buyGar(k) {
  const lv = save.up[k], c = garCost(lv); if (lv >= GAR_MAX || save.scrap < c) return false;
  save.scrap -= c; save.up[k]++; persist(); sfx.buy(); return true;
}

function findTarget() { // スマホ用の自動照準: 近い敵 → 近い木箱・ドラム缶
  let best = null, bd = (S.bspd * S.blife + 1) ** 2;
  for (const e of E) { if (e.dead) continue; const d = (e.x - P.x) ** 2 + (e.z - P.z) ** 2; if (d < bd) { bd = d; best = e; } }
  if (best) return best; bd = 81;
  for (const b of W.blocks) { if (b.hp <= 0 || b.t === W.WALL) continue; const d = (b.x - P.x) ** 2 + (b.z - P.z) ** 2; if (d < bd) { bd = d; best = b; } }
  return best;
}

export function update(dt) {
  if (G.state === 'boot' || G.state === 'levelup' || G.state === 'result') return;
  const live = G.state === 'play';
  if (live) G.t += dt;
  if (G.inv > 0) G.inv -= dt;
  // ---- 自機 ----
  if (live) {
    const k = 1 - Math.exp(-14 * dt); P.vx += (I.mx * S.speed - P.vx) * k; P.vz += (I.mz * S.speed - P.vz) * k;
    P.x += P.vx * dt; P.z += P.vz * dt;
    if (I.mx || I.mz) P.ry = angLerp(P.ry, Math.atan2(I.mx, I.mz), 1 - Math.exp(-10 * dt));
    W.pushOut(P, 1.0, null);
    let fire = I.fire, aim = P.ty;
    if (I.touch) {
      tgtT -= dt; if (tgtT <= 0 || !tgt || tgt.dead || tgt.hp <= 0) { tgt = findTarget(); tgtT = 0.15; }
      if (tgt) { aim = Math.atan2(tgt.x - P.x, tgt.z - P.z); fire = true; } else { fire = false; if (I.mx || I.mz) aim = Math.atan2(I.mx, I.mz); }
      P.ty = angLerp(P.ty, aim, 1 - Math.exp(-16 * dt));
    } else { P.ty = Math.atan2(I.ax - P.x, I.az - P.z); }
    P.cd -= dt; if (fire && P.cd <= 0) { P.cd = 1 / S.rate; shoot(); }
    if (S.regen && P.hp < S.maxhp) P.hp = Math.min(S.maxhp, P.hp + S.regen * dt);
    if (S.mine) { P.mineT -= dt; if (P.mineT <= 0 && (I.mx || I.mz)) { P.mineT = 3.2 - 0.4 * S.mine; if (M.length < 14) M.push({ x: P.x, z: P.z, t: 0 }); } }
    if (G.first && (I.touch ? I.moved : (I.moved && I.fired)) && G.t > 2) { G.first = false; UI.hint(null); }
  }
  P.recoil = Math.max(0, P.recoil - dt * 9);
  // ---- 波 ----
  if (live) {
    if (G.wave < 0) { if (G.t > 1.2) startWave(0); }
    else {
      G.wt += dt;
      while (G.queue.length && G.queue[0].t <= G.wt) { const q = G.queue.shift(); if (E.length < 135) spawn(q.k); else { q.t = G.wt + 0.5; G.queue.push(q); break; } }
      if (G.wave < NWAVE) {
        const clear = !G.queue.length && !E.length && G.wt > 2;
        if (G.wave < NWAVE - 1 ? (G.wt > WDUR || clear) : (clear || G.wt > WDUR + 8)) startWave(G.wave + 1);
      }
    }
  }
  // ---- 敵 ----
  for (let i = 0; i < E.length; i++) {
    const e = E[i]; if (e.dead) continue; const d = ET[e.k];
    e.born += dt; if (e.hitT > 0) e.hitT -= dt; if (e.hc > 0) e.hc -= dt;
    let dx = P.x - e.x, dz = P.z - e.z; const dist = Math.hypot(dx, dz) || 1; dx /= dist; dz /= dist;
    let mx = dx, mz = dz;
    if (e.k === 1) { if (dist < 8) { mx = -dx; mz = -dz; } else if (dist < 13) { mx = -dz * e.strafe; mz = dx * e.strafe; } }
    if (!live) { mx = mz = 0; }
    const dk = Math.exp(-6 * dt); e.kx *= dk; e.kz *= dk;
    e.x += (mx * d.sp + e.kx) * dt; e.z += (mz * d.sp + e.kz) * dt;
    e.ry = angLerp(e.ry, e.k === 1 || e.k === 3 ? Math.atan2(dx, dz) : Math.atan2(mx || dx, mz || dz), 1 - Math.exp(-8 * dt));
    W.pushOut(e, e.r, b => W.damageBlock(b, d.chew * dt));
    if (!live) continue;
    if (e.k === 1) { e.cd -= dt; if (e.cd <= 0 && dist < 19) { e.cd = d.shoot; bullet(e.x + dx * 1.2, e.z + dz * 1.2, Math.atan2(dx, dz), true, d.dmg, 11, 2.4); } }
    if (e.k === 3) {
      e.cd -= dt; if (e.cd <= 0) { e.cd = 2.6; const o = rnd() * 6.283, n = 10 + Math.min(8, G.stage * 2); for (let j = 0; j < n; j++) bullet(e.x, e.z, o + j / n * 6.283, true, 8, 9, 3.2); sfx.hit(); }
      e.c2 -= dt; if (e.c2 <= 0) { e.c2 = 6.5; for (let j = 0; j < 4; j++) { spawn(0); const s = E[E.length - 1]; s.x = e.x + rr(-3, 3); s.z = e.z + rr(-3, 3); } }
      UI.setBoss(e.hp / e.max);
    }
    if (dist < e.r + 1.0 && e.hc <= 0) { e.hc = 0.7; hurt(d.dmg); e.kx -= dx * 9; e.kz -= dz * 9; }
  }
  for (let i = 0; i < E.length; i++) { // 敵どうしの押し合い
    const a = E[i]; if (a.dead) continue;
    for (let j = i + 1; j < E.length; j++) {
      const b = E[j]; if (b.dead) continue; const dx = b.x - a.x, dz = b.z - a.z, r = a.r + b.r; if (dx > r || dx < -r || dz > r || dz < -r) continue;
      const d2 = dx * dx + dz * dz; if (d2 >= r * r || d2 < 1e-6) continue; const d = Math.sqrt(d2), p = (r - d) / d * 0.5;
      const wa = a.k === 3 ? 0 : b.k === 3 ? 2 : 1, wb = 2 - wa; a.x -= dx * p * wa; a.z -= dz * p * wa; b.x += dx * p * wb; b.z += dz * p * wb;
    }
  }
  // ---- 弾 ----
  for (let i = 0; i < B.length; i++) {
    const b = B[i]; if (b.dead) continue;
    b.l -= dt; if (b.l <= 0) { b.dead = true; continue; }
    b.x += b.vx * dt; b.z += b.vz * dt;
    if (Math.abs(b.x) > W.A || Math.abs(b.z) > W.A) { b.dead = true; continue; }
    const blk = W.blockAt(b.x, b.z);
    if (blk) {
      b.dead = true; burst(b.x, 1.1, b.z, 3, blk.t === W.CRATE ? 0xc98d4b : blk.t === W.WALL ? 0xcfd6e4 : 0xe5484d, 5, 0.22, 0.3);
      W.damageBlock(blk, b.foe ? 4 : b.dmg); if (!b.foe) { sfx.hit(); if (S.exR) explode(b.x, b.z, S.exR, b.dmg * 0.6); }
      continue;
    }
    if (b.foe) { if (live && (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < 1.1) { b.dead = true; hurt(b.dmg); } continue; }
    for (let j = 0; j < E.length; j++) {
      const e = E[j]; if (e.dead || e.born < 0.15) continue; const dx = e.x - b.x, dz = e.z - b.z, r = e.r + 0.35;
      if (dx * dx + dz * dz > r * r || (b.hit && b.hit.includes(e))) continue;
      const sp = Math.hypot(b.vx, b.vz); hurtE(e, b.dmg, b.vx / sp * 4, b.vz / sp * 4); sfx.hit();
      burst(b.x, 1.1, b.z, 3, 0xfff2a8, 5, 0.2, 0.25);
      if (S.exR) explode(b.x, b.z, S.exR, b.dmg * 0.6);
      if (b.bounce > 0) {
        let n = null, nd = 144; for (const o of E) { if (o.dead || o === e || (b.hit && b.hit.includes(o))) continue; const q = (o.x - b.x) ** 2 + (o.z - b.z) ** 2; if (q < nd) { nd = q; n = o; } }
        if (n) { b.bounce--; (b.hit || (b.hit = [])).push(e); const a = Math.atan2(n.x - b.x, n.z - b.z); b.vx = Math.sin(a) * sp; b.vz = Math.cos(a) * sp; b.l = Math.max(b.l, 0.45); break; }
      }
      if (b.pierce > 0) { b.pierce--; (b.hit || (b.hit = [])).push(e); } else b.dead = true;
      break;
    }
  }
  // ---- 地雷・誘爆 ----
  for (let i = M.length - 1; i >= 0; i--) {
    const m = M[i]; m.t += dt; if (m.t < 0.4) continue;
    for (const e of E) { if (e.dead) continue; if ((e.x - m.x) ** 2 + (e.z - m.z) ** 2 < (e.r + 0.9) ** 2) { M.splice(i, 1); explode(m.x, m.z, 3.2 + 0.4 * S.mine, 35 * (S.dmg / 10)); break; } }
  }
  for (let i = boomQ.length - 1; i >= 0; i--) { const q = boomQ[i]; q.t -= dt; if (q.t <= 0) { boomQ.splice(i, 1); explode(q.x, q.z, 5, 70); } }
  // ---- 歯車・回復 ----
  pickT -= dt; if (pickT <= 0) pickN = 0;
  for (let i = K.length - 1; i >= 0; i--) {
    const k = K[i]; k.t += dt; const dx = P.x - k.x, dz = P.z - k.z, d = Math.hypot(dx, dz) || 1;
    if (!P.dead && (k.vac || d < S.mag)) { k.vac = true; const sp = Math.min(34, 12 + k.t * 30) * dt; k.x += dx / d * sp; k.z += dz / d * sp; }
    if (!P.dead && d < 1.2) {
      if (k.heal) { P.hp = Math.min(S.maxhp, P.hp + k.v); sfx.heal(); } else { addXp(k.v); sfx.pick(pickN++); pickT = 0.6; }
      K[i] = K[K.length - 1]; K.pop();
    } else if (k.t > 40 && !k.vac) { K[i] = K[K.length - 1]; K.pop(); }
  }
  // ---- 後始末 ----
  let n = 0; for (let i = 0; i < E.length; i++) if (!E[i].dead) E[n++] = E[i]; E.length = n;
  n = 0; for (let i = 0; i < B.length; i++) if (!B[i].dead) B[n++] = B[i]; B.length = n;
  for (const b of W.blocks) if (b.hitT > 0) b.hitT -= dt;
  if (G.state === 'play' && G.pend > 0) openLevelUp();
  if (G.state === 'dead' || G.state === 'win') { G.endT -= dt; if (G.endT <= 0) showResult(); }
}

export function draw(time) {
  hull.position.set(P.x, 0, P.z); hull.rotation.y = P.ry;
  const rc = P.recoil * 0.22; turret.position.set(P.x - Math.sin(P.ty) * rc, 0, P.z - Math.cos(P.ty) * rc); turret.rotation.y = P.ty;
  const blink = G.inv > 0 && ((time * 14) | 0) % 2 === 0; if (!P.dead) hull.visible = turret.visible = !blink;
  for (const it of instE) it.begin();
  for (const e of E) { const s = Math.min(1, e.born * 3.5) * (e.hitT > 0 ? 1.12 : 1), c = e.hitT > 0 ? 2.6 : 1; instE[e.k].put(e.x, 0, e.z, e.ry, s, s, c, c, c); }
  for (const it of instE) it.end();
  for (const it of instB) it.begin();
  for (const b of W.blocks) { if (b.hp <= 0) continue; const s = b.hitT > 0 ? 0.9 : 1, c = 0.6 + 0.4 * (b.hp / b.max); instB[b.t].put(b.x, 0, b.z, 0, s, b.hitT > 0 ? 1.08 : 1, c, c, c); }
  for (const it of instB) it.end();
  instBul.begin(); for (const b of B) { if (b.foe) instBul.put(b.x, 1.15, b.z, 0, 1.15, 1.15, 1, 0.22, 0.55); else instBul.put(b.x, 1.15, b.z, 0, 1, 1, 1, 0.93, 0.4); } instBul.end();
  instGear.begin(); instHeal.begin();
  for (const k of K) { const y = 0.55 + Math.sin(time * 5 + k.x) * 0.12; if (k.heal) instHeal.put(k.x, y + 0.2, k.z, time * 2, 1.2); else instGear.put(k.x, y, k.z, time * 3 + k.z, k.v > 1 ? 1.5 : 1); }
  instGear.end(); instHeal.end();
  instMine.begin(); for (const m of M) instMine.put(m.x, 0, m.z, 0, Math.min(1, m.t * 4)); instMine.end();
  UI.hud({ hp: P.hp, maxhp: S.maxhp, xp: G.xp, need: need(G.lvl), lvl: G.lvl, wave: G.wave, t: G.t, scrap: save.scrap + G.scrap - G.banked, stage: G.stage });
}
// テストとボット用の状態
export function snapshot() {
  return { state: G.state, t: G.t, wave: G.wave, lvl: G.lvl, hp: P.hp, maxhp: S.maxhp, kills: G.kills, scrap: G.scrap, enemies: E.length, bullets: B.length, gears: K.length, x: P.x, z: P.z, won: G.won, stage: G.stage, ups: Object.assign({}, u),
    near: E.slice().sort((a, b) => ((a.x - P.x) ** 2 + (a.z - P.z) ** 2) - ((b.x - P.x) ** 2 + (b.z - P.z) ** 2)).slice(0, 6).map(e => [e.x, e.z, e.k]),
    foe: B.filter(b => b.foe && (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < 64).slice(0, 8).map(b => [b.x, b.z]),
    gear: K.slice(0, 40).map(k => [k.x, k.z]) };
}
