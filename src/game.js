// ゲーム本体: 自機、敵、弾、歯車、波、強化、勝敗
import { THREE, rnd, rr, clamp, angLerp, save, persist, jaEn } from './core.js';
import { scene, geo, MAT, BMAT, Inst, burst, ring, addShake, applyTheme, mkTank, moveTracks, tankGeo, fxExplode, fxMuzzle, fxSparks, fxDust, fxSplash, fxAmb, addMark, clearMarks, flash } from './gfx.js';
import { themeOf, areaOf } from './themes.js';
import * as W from './world.js';
import { I } from './input.js';
import { sfx, music, musicVol, musicTrack } from './audio.js';
import * as UI from './ui.js';
import { platform } from './platform.js';
import * as MT from './meta.js';

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
let drone, shield, tankKey = '';
let u = {}, TH = null, thKey = '', instFar, instSmall, tank, instE, instB, instBul, instGear, instHeal, instMine, tgtT = 0, tgt = null, pickN = 0, pickT = 0;

export function initGame() {
  drone = new THREE.Mesh(geo([{ s: [0.7, 0.22, 0.7], p: [0, 0, 0], c: 0xffb21e }, { s: [1.3, 0.06, 0.16], p: [0, 0.16, 0], c: 0x39405c }, { s: [0.16, 0.06, 1.3], p: [0, 0.16, 0], c: 0x39405c }, { s: [0.2, 0.16, 0.5], p: [0, -0.12, 0.3], c: 0x39405c }]), MAT);
  shield = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.09, 6, 28), new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.75 })); shield.rotation.x = Math.PI / 2; shield.position.y = 0.9;
  drone.castShadow = true; drone.visible = shield.visible = false; scene.add(drone); scene.add(shield);
  instE = [
    new Inst(tankGeo(0x7a4fe0, { lite: true, scale: 0.52 }), 140, { shadow: true }),
    new Inst(tankGeo(0xd23a6e, { lite: true, long: true, scale: 0.64 }), 50, { shadow: true }),
    new Inst(tankGeo(0xc8362f, { plow: true, scale: 0.98, tur: 0xe86a58 }), 30, { shadow: true }),
    new Inst(tankGeo(0x2b3158, { twin: true, crown: true, plow: true, scale: 1.8, tur: 0xc23a6a }), 2, { shadow: true }),
  ];
  const ph = () => new THREE.BoxGeometry(1, 1, 1); // テーマごとに setTheme() で差し替える
  instB = [new Inst(ph(), 420, { shadow: true }), new Inst(ph(), 420, { shadow: true }), new Inst(ph(), 120, { shadow: true })];
  instFar = new Inst(ph(), 64, { shadow: true }); instSmall = new Inst(ph(), 240, {});
  instBul = new Inst(new THREE.SphereGeometry(1, 8, 6).scale(0.1, 0.1, 0.6), 420, { mat: BMAT });
  instGear = new Inst(geo([{ s: [0.7, 0.2, 0.7], p: [0, 0, 0], c: 0xffd23f, cyl: 6 }, { s: [0.3, 0.24, 0.3], p: [0, 0, 0], c: 0xb8860b, cyl: 6 }]), 360, {});
  instHeal = new Inst(geo([{ s: [0.9, 0.3, 0.3], p: [0, 0, 0], c: 0x5fe08a }, { s: [0.3, 0.3, 0.9], p: [0, 0, 0], c: 0x5fe08a }]), 20, {});
  instMine = new Inst(geo([{ s: [0.9, 0.22, 0.9], p: [0, 0.11, 0], c: 0x39405c, cyl: 8 }, { s: [0.3, 0.14, 0.3], p: [0, 0.28, 0], c: 0xff5b6b, cyl: 6 }]), 16, {});
  W.setOnBreak(onBreak);
}

// 装備中のパーツに合わせて自機のモデルを作り直す
function buildTank() {
  const pt = save.parts, key = pt.hull + pt.turret; if (key === tankKey && tank) return; tankKey = key;
  if (tank) scene.remove(tank.g);
  tank = mkTank(0xd9780f, pt.hull === 'light' ? 0.74 : pt.hull === 'bulk' ? 0.88 : 0.8, { twin: pt.turret === 'twin', short: pt.turret === 'scatter', laser: pt.turret === 'laser', armor: pt.hull === 'bulk', light: pt.hull === 'light' });
}
const TUR = {
  cannon: { n: 1, dm: 1, rm: 1, lm: 1, sm: 1, sp: 0.13, pierce: 0, c: 0 }, twin: { n: 2, dm: 0.65, rm: 1, lm: 1, sm: 1, sp: 0.13, pierce: 0, c: 0 },
  scatter: { n: 5, dm: 0.42, rm: 0.72, lm: 0.6, sm: 1, sp: 0.17, pierce: 0, c: 0 }, laser: { n: 1, dm: 0.8, rm: 0.9, lm: 0.55, sm: 2.1, sp: 0.08, pierce: 3, c: 2 },
};
function swapGeo(inst, parts) { inst.m.geometry.dispose(); inst.m.geometry = geo(parts); }
// 拠点の種類が変わったら、モデル・地面・周囲の景色・小物を入れ替える
function setTheme(stage) {
  TH = themeOf(stage); const key = TH.id + ':' + (TH.id === 'river' ? stage : 0);
  for (const b of W.blocks) { if (b.t === W.CRATE && TH.spin) b.ry = ((b.v * 4) | 0) * Math.PI / 2; if (b.t === W.WALL && TH.tall) b.sy = TH.tall[0] + (TH.tall[1] - TH.tall[0]) * ((b.v * 7.3) % 1); }
  let sd = (stage * 9973 + 7) >>> 0; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  instSmall.begin(); const nS = TH.smallN || 170; // 小物（当たり判定なし）
  for (let i = 0, n = 0; i < nS * 3 && n < nS; i++) { const x = (r() * 2 - 1) * (W.A - 1), z = (r() * 2 - 1) * (W.A - 1); if (W.blockAt(x, z) || W.inWater(x, z)) continue; instSmall.put(x, 0, z, r() * 6.283, 0.8 + r() * 0.7); n++; }
  instSmall.end();
  if (key === thKey) return; thKey = key;
  swapGeo(instB[0], TH.crate()); swapGeo(instB[1], TH.wall()); swapGeo(instB[2], TH.barrel()); swapGeo(instFar, TH.far()); swapGeo(instSmall, TH.small());
  applyTheme(TH, W.feat);
  instFar.begin(); const nF = TH.farN || 46, fs = TH.farS || [1, 1.9], ft = TH.farT; // 柵の外の景色
  for (let i = 0; i < nF; i++) {
    const side = (r() * 4) | 0, d = W.A + 5 + r() * 24, along = (r() * 2 - 1) * (W.A + 24), x = side === 0 ? -d : side === 1 ? d : along, z = side === 2 ? -d : side === 3 ? d * 0.7 : along;
    const c = ft ? ft[(r() * ft.length) | 0] : [1, 1, 1], sc = fs[0] + r() * (fs[1] - fs[0]); instFar.put(x, TH.farY || 0, z, r() * 6.283, sc, sc, c[0], c[1], c[2]);
  }
  instFar.end();
}
function recalc() {
  const pt = save.parts, tu = TUR[pt.turret] || TUR.cannon, hm = pt.hull === 'light' ? [1.18, 0.8] : pt.hull === 'bulk' ? [0.88, 1.45] : [1, 1];
  S.dmg = 10 * (1 + 0.1 * save.up.dmg) * (1 + 0.3 * u.heavy) * tu.dm;
  S.rate = 2.6 * (1 + 0.25 * u.rapid) * tu.rm;
  S.shots = tu.n + u.split; S.spread = tu.sp; S.pierce = u.pierce + tu.pierce; S.bounce = u.bounce; S.rear = u.rear; S.bc = tu.c;
  S.exR = u.boom ? 2.0 + 0.6 * u.boom : 0;
  S.maxhp = Math.round((100 + 15 * save.up.hp) * hm[1]) + 25 * u.armor;
  S.speed = 9.9 * (1 + 0.04 * save.up.spd) * (1 + 0.12 * u.engine) * hm[0];
  S.gear = pt.gear;
  S.mag = 4 * (1 + 0.6 * u.magnet); S.regen = 1.2 * u.regen; S.mine = u.mine + (S.gear === 'mines' ? 1 : 0);
  S.bspd = 30 * (1 + 0.2 * u.long) * tu.sm; S.blife = 0.7 * tu.lm;
}
const need = l => 4 + 3 * (l - 1);

export function startRun() {
  W.genWorld(themeOf(save.stage).id, save.stage); setTheme(save.stage); musicTrack(areaOf(save.stage));
  E.length = B.length = K.length = M.length = boomQ.length = 0;
  const sup = MT.supplyTick(); buildTank();
  u = {}; for (const d of UPS) u[d.id] = 0;
  Object.assign(G, { state: 'play', t: 0, wave: -1, wt: 0, queue: [], kills: 0, scrap: 0, banked: 0, lvl: 1, xp: 0, pend: 0, inv: 0, endT: 0, boss: null, stage: save.stage, won: false, dng: 0, dustT: 0, intro: false, first: save.runs === 0 });
  music('calm'); musicVol(1);
  recalc(); Object.assign(P, { x: 0, z: 0, vx: 0, vz: 0, ry: Math.PI, ty: Math.PI, hp: S.maxhp, cd: 0, mineT: 1, recoil: 0, dead: false, sh: 0, da: 0, dcd: 1 });
  tank.g.visible = true; tgt = null; clearMarks(); P.pitch = P.roll = 0; P.markD = 0; P.px = 0; P.pz = 0;
  save.runs++; MT.dailyAdd('runs', 1); persist(); UI.hideAll(); UI.setBoss(-1);
  G.arrived = sup.arrived;
  G.tut = G.first ? 0 : 2; UI.hint(null);
  platform.gameplayStart();
}
// 途中で閉じてもスクラップが消えないよう、区切りごとに保存へ移す
export function bank() { const d = G.scrap - G.banked; if (d > 0) { save.scrap += d; G.banked = G.scrap; persist(); } }

function startWave(i) {
  G.wave = i; G.wt = 0; G.queue = []; W.compact(); MT.dailyAdd('wave', i + 1);
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
  B.push({ x, z, vx: Math.sin(a) * spd, vz: Math.cos(a) * spd, l: life, dmg, foe, c: foe ? 1 : S.bc, pierce: foe ? 0 : S.pierce, bounce: foe ? 0 : S.bounce, hit: null, dead: false });
}
function shoot() {
  const n = S.shots;
  for (let k = 0; k < n; k++) { const a = P.ty + (k - (n - 1) / 2) * S.spread; bullet(P.x + Math.sin(a) * 2.2, P.z + Math.cos(a) * 2.2, a, false, S.dmg, S.bspd, S.blife); }
  for (let k = 0; k < S.rear; k++) { const a = P.ty + Math.PI + (k - (S.rear - 1) / 2) * 0.2; bullet(P.x + Math.sin(a) * 1.2, P.z + Math.cos(a) * 1.2, a, false, S.dmg, S.bspd, S.blife); }
  P.recoil = 1; sfx.shot(); fxMuzzle(P.x + Math.sin(P.ty) * 2.3, P.z + Math.cos(P.ty) * 2.3, P.ty);
}
function hurtE(e, d, kx, kz) {
  if (e.dead) return; e.hp -= d; e.hitT = 0.1;
  const m = e.k === 3 ? 0 : e.k === 2 ? 0.35 : 1; e.kx += kx * m; e.kz += kz * m;
  if (e.hp <= 0) kill(e);
}
function kill(e) {
  e.dead = true; const d = ET[e.k]; G.kills++; G.scrap += d.sc; MT.dailyAdd('kills', 1); MT.dailyAdd('scrap', d.sc);
  burst(e.x, 0.8, e.z, e.k === 0 ? 8 : e.k === 3 ? 60 : 16, d.col, e.k >= 2 ? 11 : 8, e.k >= 2 ? 0.5 : 0.34, 0.6);
  burst(e.x, 0.8, e.z, 4, 0x2a2d44, 6, 0.3, 0.7); fxExplode(e.x, e.z, e.k === 0 ? 1.5 : e.k === 1 ? 1.9 : e.k === 2 ? 3 : 6);
  if (e.k >= 2) { ring(e.x, e.z, e.r * 2.2); addShake(e.k === 3 ? 1 : 0.3); sfx.boom(true); } else { sfx.boom(false); addShake(0.06); }
  const n = e.k === 3 ? 14 : e.k === 2 ? 3 : 1;
  for (let i = 0; i < n; i++) K.push({ x: e.x + rr(-1, 1) * (n > 1 ? e.r : 0.2), z: e.z + rr(-1, 1) * (n > 1 ? e.r : 0.2), v: e.k === 3 ? 2 : e.k === 2 ? (i === 0 ? 3 : 1) : d.xp, t: 0, heal: false, vac: false });
  if (e.k === 3) win();
}
function explode(x, z, R, d) {
  ring(x, z, R); fxExplode(x, z, R); burst(x, 1, z, 5, 0x4a4f66, 8, 0.36, 0.9);
  addShake(Math.min(0.55, R * 0.07)); sfx.boom(R > 4);
  for (const e of E) { if (e.dead) continue; const dx = e.x - x, dz = e.z - z, dd = Math.hypot(dx, dz); if (dd < R + e.r) { const f = 1 - 0.5 * Math.min(1, dd / R), il = 1 / (dd || 1); hurtE(e, d * f, dx * il * 9, dz * il * 9); } }
  for (let i = 0; i < W.blocks.length; i++) { const b = W.blocks[i]; if (b.hp <= 0) continue; if (Math.hypot(b.x - x, b.z - z) < R + 0.5) W.damageBlock(b, d * 0.8); }
}
function onBreak(b) {
  MT.dailyAdd('crate', 1);
  if (b.t === W.BARREL) { boomQ.push({ x: b.x, z: b.z, t: 0.07 }); return; }
  burst(b.x, 0.9, b.z, b.t === W.CRATE ? 9 : 12, b.t === W.CRATE ? TH.crateFx : TH.wallFx, 7, 0.42, 0.7); sfx.crack(); addShake(0.05); fxDust(b.x, b.z, b.t === W.CRATE ? TH.crateFx : TH.wallFx, 4, 1.5);
  if (b.t === W.CRATE) {
    const q = rnd();
    if (b.gift || q < 0.4) K.push({ x: b.x, z: b.z, v: 1, t: 0, heal: false, vac: false });
    else if (q < 0.47 && P.hp < S.maxhp) K.push({ x: b.x, z: b.z, v: 20, t: 0, heal: true, vac: false });
  }
}
function hurt(d) {
  if (G.inv > 0 || G.state !== 'play') return;
  if (S.gear === 'shield' && P.sh <= 0) { P.sh = 8; G.inv = 0.6; ring(P.x, P.z, 3.2, 0x8fe3ff); burst(P.x, 1, P.z, 10, 0x8fe3ff, 8, 0.3, 0.4); sfx.hit(); return; }
  P.hp -= d * Math.min(1, 0.5 + 0.17 * Math.max(0, G.wave) + 0.15 * (G.stage - 1)); G.inv = 0.45; UI.vignette(); addShake(0.3); sfx.hurt(); burst(P.x, 1, P.z, 5, 0xffb21e, 6, 0.3, 0.4);
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true; G.state = 'dead'; G.endT = 1.3; tank.g.visible = false; fxExplode(P.x, P.z, 5);
    burst(P.x, 1, P.z, 40, 0xffb21e, 12, 0.5, 0.9); burst(P.x, 1, P.z, 16, 0x39405c, 9, 0.5, 1); ring(P.x, P.z, 6); addShake(1); sfx.boom(true); sfx.lose();
    platform.gameplayStop();
  }
}
function win() {
  G.state = 'win'; G.endT = 2.4; G.won = true; G.scrap += 30 + 10 * G.stage; MT.dailyAdd('win', 1); MT.dailyAdd('scrap', 30 + 10 * G.stage); UI.setBoss(-1);
  for (const e of E) if (!e.dead) { e.dead = true; burst(e.x, 0.8, e.z, 8, ET[e.k].col, 8, 0.34, 0.6); fxExplode(e.x, e.z, 1.6); }
  for (const b of B) b.dead = true; for (const k of K) k.vac = true;
  UI.banner(jaEn('拠点を奪還！', 'BASE RECLAIMED!'), true); sfx.win(); platform.gameplayStop(); platform.happyTime();
}
function addXp(v) { G.xp += v; while (G.xp >= need(G.lvl)) { G.xp -= need(G.lvl); G.lvl++; G.pend++; MT.dailyAdd('lvl', G.lvl); } }
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
  const sup = MT.supplyTick(); if (sup.arrived) G.arrived = sup.arrived;
  bank(); if (G.won) { save.stage++; save.best = Math.max(save.best, save.stage); } persist();
  G.state = 'result';
  music('calm'); musicVol(0.45);
  const nx = themeOf(save.stage); UI.showResult({ place: jaEn(TH.ja, TH.en), next: jaEn(nx.ja, nx.en), nextStage: save.stage, win: G.won, stage: G.stage, wave: Math.min(G.wave + 1, NWAVE), boss: G.wave >= NWAVE, t: G.t, kills: G.kills, lvl: G.lvl, earned: G.scrap, arrived: G.arrived, supply: sup.next }, { buy: buyGar, go: startRun }); G.arrived = null;
}
function buyGar(k) {
  const lv = save.up[k], c = garCost(lv); if (lv >= GAR_MAX || save.scrap < c) return false;
  save.scrap -= c; save.up[k]++; persist(); sfx.buy(); return true;
}

// 初回の案内: 「動く → 撃つ」を1つずつ、できるまで消さない（PC）。スマホは動くまで
function tutorial() {
  if (G.tut >= 2) return;
  if (I.touch) { if (I.moved && G.t > 3) { G.tut = 2; UI.hint(null); } else UI.hint(jaEn('画面をドラッグで移動　攻撃は自動', 'Drag to move. Your tank fires automatically'), true); return; }
  if (G.tut === 0) { if (I.moved) { G.tut = 1; G.tutT = G.t; } else UI.hint(jaEn('クリックした場所へ移動　<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> キーでも動ける', 'Click where you want to go, or move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>'), true); }
  if (G.tut === 1) { if (G.kills >= 2 && G.t - G.tutT > 2) { G.tut = 2; UI.hint(null); } else UI.hint(I.auto ? jaEn('狙いと射撃は自動　押しっぱなしで追いかける', 'Aiming and firing are automatic. Hold the button to keep following') : jaEn('マウスで狙う　射撃は自動', 'Aim with the mouse. Your tank fires automatically'), G.kills < 1); }
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
  // 体力が赤（20%未満）の間は緊迫曲。回復しても少しの間は続けて、曲が細かく切り替わらないようにする
  if (live) { if (P.hp / S.maxhp < 0.2) G.dng = 2.5; else if (G.dng > 0) G.dng -= dt; music(G.dng > 0 ? 'danger' : 'calm'); musicVol(1); }
  else { music('calm'); musicVol(0.45); }
  // ---- 自機 ----
  if (live) {
    const wet = W.inWater(P.x, P.z), spd = S.speed * (wet ? 0.62 : 1);
    const k = 1 - Math.exp(-14 * dt); P.vx += (I.mx * spd - P.vx) * k; P.vz += (I.mz * spd - P.vz) * k;
    if (I.mx || I.mz) { G.dustT -= dt; if (G.dustT <= 0) { G.dustT = 0.07; const bx = P.x - Math.sin(P.ry) * 1.1, bz = P.z - Math.cos(P.ry) * 1.1; if (wet) { fxSplash(bx, bz, 2); if (rnd() < 0.2) ring(P.x, P.z, 2.2, 0x9fd8ff); } else fxDust(bx, bz, TH.dust, 1); } }
    const ax0 = P.vx0 || 0, az0 = P.vz0 || 0, acx = (P.vx - ax0) / dt, acz = (P.vz - az0) / dt, fw = acx * Math.sin(P.ry) + acz * Math.cos(P.ry), sd = acx * Math.cos(P.ry) - acz * Math.sin(P.ry), kt = 1 - Math.exp(-8 * dt);
    P.pitch += (clamp(-fw * 0.006, -0.09, 0.09) - P.pitch) * kt; P.roll += (clamp(sd * 0.006, -0.08, 0.08) - P.roll) * kt; P.vx0 = P.vx; P.vz0 = P.vz;
    fxAmb(TH.amb, P.x, P.z, dt);
    P.x += P.vx * dt; P.z += P.vz * dt;
    if (I.mx || I.mz) P.ry = angLerp(P.ry, Math.atan2(I.mx, I.mz), 1 - Math.exp(-10 * dt));
    W.pushOut(P, 1.0, null);
    if (I.click) { I.click = false; if (I.dest) ring(I.dest.x, I.dest.z, 1.5, 0x8fe3ff); }
    { const mv = Math.hypot(P.x - P.px, P.z - P.pz); P.px = P.x; P.pz = P.z; I.px = P.x; I.pz = P.z; if (I.dest && mv < spd * dt * 0.2) { P.stuck = (P.stuck || 0) + dt; if (P.stuck > 0.5) I.dest = null; } else P.stuck = 0; if (mv < 2) { moveTracks(tank, mv); P.markD += mv; if (wet) P.markD = 0; else if (P.markD > 0.55) { addMark(P.x, P.z, P.ry, P.markD + 0.05); P.markD = 0; } } }
    let fire = I.ext ? I.fire : true, aim = P.ty; // PC も射撃は自動（狙いはマウス）。ボットだけ撃つかどうかを指定できる
    if (I.touch || I.auto) {
      tgtT -= dt; if (tgtT <= 0 || !tgt || tgt.dead || tgt.hp <= 0) { tgt = findTarget(); tgtT = 0.15; }
      if (tgt) { aim = Math.atan2(tgt.x - P.x, tgt.z - P.z); fire = true; } else { fire = false; if (I.mx || I.mz) aim = Math.atan2(I.mx, I.mz); }
      P.ty = angLerp(P.ty, aim, 1 - Math.exp(-16 * dt));
    } else { P.ty = Math.atan2(I.ax - P.x, I.az - P.z); }
    P.cd -= dt; if (fire && P.cd <= 0) { P.cd = 1 / S.rate; shoot(); }
    if (S.regen && P.hp < S.maxhp) P.hp = Math.min(S.maxhp, P.hp + S.regen * dt);
    if (S.mine) { P.mineT -= dt; if (P.mineT <= 0 && (I.mx || I.mz)) { P.mineT = 3.2 - 0.4 * S.mine; if (M.length < 14) M.push({ x: P.x, z: P.z, t: 0 }); } }
    if (P.sh > 0) P.sh -= dt;
    if (S.gear === 'drone') {
      P.da += dt * 1.6; P.dcd -= dt;
      if (P.dcd <= 0) {
        P.dcd = 0.25; const ox = P.x + Math.cos(P.da) * 2.3, oz = P.z + Math.sin(P.da) * 2.3; let n = null, nd = 225;
        for (const e of E) { if (e.dead) continue; const q = (e.x - ox) ** 2 + (e.z - oz) ** 2; if (q < nd) { nd = q; n = e; } }
        if (n) { P.dcd = 0.85; bullet(ox, oz, Math.atan2(n.x - ox, n.z - oz), false, S.dmg * 0.6, 30, 0.6); }
      }
    }
    tutorial();
    const fr = MT.takeFresh(); if (fr) { UI.toast(fr); sfx.buy(); }
  }
  P.recoil = Math.max(0, P.recoil - dt * 9);
  // ---- 波 ----
  if (live) {
    if (G.wave < 0) { if (!G.intro && G.t > 0.15) { G.intro = true; if (G.arrived) { UI.toast(G.arrived === 'scrap' ? jaEn('補給便が届いた　スクラップ +', 'Supply drop arrived: scrap +') + MT.SUP_SCRAP : jaEn('補給便が届いた　', 'Supply drop arrived: ') + MT.pname(G.arrived) + jaEn(' を装備', ' equipped')); sfx.buy(); G.arrived = null; } UI.banner(jaEn('拠点 ', 'Base ') + G.stage + '　' + jaEn(TH.ja, TH.en), true); } if (G.t > 2.1) startWave(0); }
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
    const es = d.sp * (W.feat.river && W.inWater(e.x, e.z) ? 0.7 : 1);
    e.x += (mx * es + e.kx) * dt; e.z += (mz * es + e.kz) * dt;
    e.ry = angLerp(e.ry, e.k === 1 || e.k === 3 ? Math.atan2(dx, dz) : Math.atan2(mx || dx, mz || dz), 1 - Math.exp(-8 * dt));
    W.pushOut(e, e.r, b => W.damageBlock(b, d.chew * dt));
    if (!live) continue;
    if (e.k === 1) { e.cd -= dt; if (e.cd <= 0 && dist < 19) { e.cd = d.shoot; fxMuzzle(e.x + dx * 1.3, e.z + dz * 1.3, Math.atan2(dx, dz), 0xff3a7a); bullet(e.x + dx * 1.2, e.z + dz * 1.2, Math.atan2(dx, dz), true, d.dmg, 11, 2.4); } }
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
      b.dead = true; burst(b.x, 1.1, b.z, 2, blk.t === W.CRATE ? TH.crateFx : blk.t === W.WALL ? TH.wallFx : 0xe5484d, 5, 0.22, 0.3); if (!b.foe) fxSparks(b.x, b.z, 3);
      W.damageBlock(blk, b.foe ? 4 : b.dmg); if (!b.foe) { sfx.hit(); if (S.exR) explode(b.x, b.z, S.exR, b.dmg * 0.6); }
      continue;
    }
    if (b.foe) { if (live && (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < 1.1) { b.dead = true; hurt(b.dmg); } continue; }
    for (let j = 0; j < E.length; j++) {
      const e = E[j]; if (e.dead || e.born < 0.15) continue; const dx = e.x - b.x, dz = e.z - b.z, r = e.r + 0.35;
      if (dx * dx + dz * dz > r * r || (b.hit && b.hit.includes(e))) continue;
      const sp = Math.hypot(b.vx, b.vz); hurtE(e, b.dmg, b.vx / sp * 4, b.vz / sp * 4); sfx.hit();
      fxSparks(b.x, b.z, 4);
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
  tank.g.position.set(P.x, 0, P.z); tank.g.rotation.y = P.ry; tank.tilt.rotation.x = P.pitch - P.recoil * 0.03 * Math.cos(P.ty - P.ry); tank.tilt.rotation.z = P.roll; tank.tur.rotation.y = P.ty - P.ry; tank.brl.position.z = -P.recoil * 0.28;
  const blink = G.inv > 0 && ((time * 14) | 0) % 2 === 0; if (!P.dead) tank.g.visible = !blink;
  drone.visible = S.gear === 'drone' && !P.dead; if (drone.visible) { drone.position.set(P.x + Math.cos(P.da) * 2.3, 2.3 + Math.sin(time * 4) * 0.12, P.z + Math.sin(P.da) * 2.3); drone.rotation.y = time * 9; }
  shield.visible = S.gear === 'shield' && !P.dead && P.sh <= 0; if (shield.visible) { shield.position.x = P.x; shield.position.z = P.z; shield.rotation.z = time * 1.5; }
  for (const it of instE) it.begin();
  for (const e of E) { const s = Math.min(1, e.born * 3.5) * (e.hitT > 0 ? 1.12 : 1), c = e.hitT > 0 ? 2.6 : 1; instE[e.k].put(e.x, 0, e.z, e.ry, s, s, c, c, c); }
  for (const it of instE) it.end();
  for (const it of instB) it.begin();
  for (const b of W.blocks) { if (b.hp <= 0) continue; const s = b.hitT > 0 ? 0.9 : 1, c = 0.6 + 0.4 * (b.hp / b.max), tl = b.t === W.CRATE ? TH.tc : b.t === W.WALL ? TH.tw : null, tn = tl ? tl[(b.v * tl.length) | 0] : null; instB[b.t].put(b.x, 0, b.z, b.ry, s, (b.hitT > 0 ? 1.08 : 1) * b.sy, tn ? c * tn[0] : c, tn ? c * tn[1] : c, tn ? c * tn[2] : c); }
  for (const it of instB) it.end();
  instBul.begin(); for (const b of B) { const ry = Math.atan2(b.vx, b.vz); if (b.foe) instBul.put(b.x, 1.15, b.z, ry, 1.3, 1.3, 2.0, 0.22, 0.75); else if (b.c === 2) instBul.put(b.x, 1.15, b.z, ry, 1.5, 1.5, 0.5, 1.9, 2.3); else instBul.put(b.x, 1.15, b.z, ry, 1, 1, 1.9, 1.05, 0.25); } instBul.end();
  instGear.begin(); instHeal.begin();
  for (const k of K) { const y = 0.55 + Math.sin(time * 5 + k.x) * 0.12; if (k.heal) instHeal.put(k.x, y + 0.2, k.z, time * 2, 1.2); else instGear.put(k.x, y, k.z, time * 3 + k.z, k.v > 1 ? 1.5 : 1); }
  instGear.end(); instHeal.end();
  instMine.begin(); for (const m of M) instMine.put(m.x, 0, m.z, 0, Math.min(1, m.t * 4)); instMine.end();
  UI.legend(!I.touch);
  UI.hud({ hp: P.hp, maxhp: S.maxhp, xp: G.xp, need: need(G.lvl), lvl: G.lvl, wave: G.wave, t: G.t, scrap: save.scrap + G.scrap - G.banked, stage: G.stage, place: jaEn(TH.ja, TH.en) });
}
// テストとボット用の状態
export function snapshot() {
  return { state: G.state, t: G.t, wave: G.wave, lvl: G.lvl, hp: P.hp, maxhp: S.maxhp, kills: G.kills, scrap: G.scrap, enemies: E.length, bullets: B.length, gears: K.length, x: P.x, z: P.z, won: G.won, stage: G.stage, ups: Object.assign({}, u),
    near: E.slice().sort((a, b) => ((a.x - P.x) ** 2 + (a.z - P.z) ** 2) - ((b.x - P.x) ** 2 + (b.z - P.z) ** 2)).slice(0, 6).map(e => [e.x, e.z, e.k]),
    foe: B.filter(b => b.foe && (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < 64).slice(0, 8).map(b => [b.x, b.z]),
    gear: K.slice(0, 40).map(k => [k.x, k.z]) };
}
