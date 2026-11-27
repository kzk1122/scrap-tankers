// ゲーム本体: 自機、敵、弾、歯車、波、強化、勝敗
import { THREE, rnd, rr, clamp, angLerp, save, persist, jaEn } from './core.js';
import { scene, geo, MAT, BMAT, EMAT, Inst, burst, ring, addShake, applyTheme, mkTank, moveTracks, tankGeo, fxExplode, fxBlast, fxMuzzle, fxSparks, fxHit, charTank, camIntro, fxWreck, fxShell, fxShock, fxDust, fxSplash, fxAmb, addMark, clearMarks, flash, setWarn, dmgNum, popText } from './gfx.js';
import { themeOf, areaOf } from './themes.js';
import * as W from './world.js';
import { I } from './input.js';
import { sfx, music, musicVol, musicTrack } from './audio.js';
import * as UI from './ui.js';
import { platform } from './platform.js';
import { ev, once, flush } from './metrics.js';
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
  { id: 'crit', max: 4, col: '#ffd23f', ja: ['会心弾', '12% の確率でダメージ 2.5 倍'], en: ['Critical Shells', '12% chance of 2.5x damage'], icon: ic('<path d="M12 2l3 7 7 1-5 5 1.5 7L12 18l-6.5 4L7 15 2 10l7-1z"/>', 1) },
  { id: 'frost', max: 3, col: '#9fe8ff', ja: ['冷凍弾', '当てた敵を遅くする'], en: ['Cryo Shells', 'Hits slow enemies down'], icon: ic('<path d="M12 2v20M3.5 7l17 10M20.5 7l-17 10"/>') },
  { id: 'orbit', max: 3, col: '#d0d6e2', ja: ['回転ノコ', '戦車の周りを刃が回る'], en: ['Saw Blades', 'Blades circle your tank'], icon: ic('<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>') },
  { id: 'vamp', max: 3, col: '#ff6f91', ja: ['回収修理', '敵を倒すと HP 回復'], en: ['Salvage Repair', 'Kills restore HP'], icon: ic('<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 5.5-8 11-8 11z"/>', 1) },
  { id: 'salvo', max: 3, col: '#ff9d3c', ja: ['全方位斉射', '数秒ごとに全方向へ撃つ'], en: ['Nova Salvo', 'Fires in all directions every few seconds'], icon: ic('<circle cx="12" cy="12" r="2.5"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5M5 5l3.5 3.5M15.5 15.5L19 19M19 5l-3.5 3.5M8.5 15.5L5 19"/>') },
  { id: 'scav', max: 3, col: '#f5c542', ja: ['回収屋', 'スクラップ +15%'], en: ['Scavenger', 'Scrap +15%'], icon: ic('<path d="M12 2l8.5 5v10L12 22 3.5 17V7z"/><circle cx="12" cy="12" r="3"/>') },
  { id: 'plate', max: 3, col: '#7fb0c8', ja: ['反応装甲', '受けるダメージ -10%'], en: ['Reactive Armor', 'Damage taken -10%'], icon: ic('<path d="M4 4h16v9c0 4-3.5 6.5-8 8-4.5-1.5-8-4-8-8z"/><path d="M8 10h8M8 14h8"/>') },
  // スクラップ列車の強化
  { id: 'hitch', max: 2, col: '#e0b070', ja: ['連結器', '列車の上限 +3両'], en: ['Coupler', 'Train capacity +3 cars'], icon: ic('<path d="M1 12h5M18 12h5"/><rect x="6" y="7" width="12" height="10" rx="2"/>') },
  { id: 'carfire', max: 4, col: '#ffcf6a', ja: ['車載砲', '車両の連射と威力 +20%'], en: ['Car Guns', 'Cars fire faster, hit harder (+20%)'], icon: ic('<rect x="3" y="11" width="12" height="7" rx="1.5"/><path d="M9 11V8h5l7-2"/>') },
  { id: 'carhp', max: 3, col: '#9fb4c8', ja: ['補強フレーム', '車両の耐久 +40%、全車修理'], en: ['Reinforced Frames', 'Car toughness +40%, repairs all'], icon: ic('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 6l18 12M21 6L3 18"/>') },
  { id: 'loopx', max: 3, col: '#ffd23f', ja: ['重い残骸', '残骸をぶつける・投げる威力 +35%'], en: ['Heavy Scrap', 'Swing & throw damage +35%'], icon: ic('<path d="M12 3a9 9 0 1 0 9 9"/><path d="M21 12l-3-3M21 12l3-3"/><circle cx="12" cy="12" r="2.5"/>', 0) },
];
// 取ると画面で違いが分かる強化（弾が増える・爆発する・跳ねる・刃が回る など）
const VIS = ['split', 'boom', 'bounce', 'orbit', 'salvo', 'rear', 'mine', 'pierce', 'frost'];
// ガレージの永続強化（スクラップで買う）
export const GAR = [
  { k: 'dmg', ja: '火力', en: 'Firepower', d: '+10%' }, { k: 'hp', ja: '装甲', en: 'Armor', d: '+15 HP' }, { k: 'spd', ja: '機動', en: 'Mobility', d: '+4%', d2: '+1%' }];
// Lv10までは1.5倍ずつ、そこから先は1.08倍ずつ（1〜2回の出撃で1段上がるくらい）
export const garCost = lv => Math.round(15 * Math.pow(1.5, Math.min(lv, 10)) * Math.pow(1.08, Math.max(0, lv - 10)));
export const GAR_MAX = 30;

// ---- スクラップ列車 × 磁石クレーン: 倒した敵の残骸を磁石でくっつけて鎖で引く。車両は元の敵の武器で撃つ。
// 曲がると鎖が振り子のように振れ、速くぶつけた残骸ほど痛い。「投げる」でつないだ残骸を群れに投げつけて爆発させる ----
// 車両: 0 機銃車（ドローン・突撃車から）/ 1 砲車（砲手・迫撃車から）/ 2 装甲車（ブルートから。弾を止め、こすると強い）/ 3 爆弾車（自爆車から。敵に触れると爆発）
// hp: 耐久、r: 当たりの半径、hl: 車両の長さの半分（鎖をつなぐ位置）、rng/cd/dm/spd/life: 射程・間隔・威力（自機の弾の何倍か）・弾速・弾の寿命、grind: こすったときの威力、armor: 受けるダメージの倍率
// m: 重さ（振ってぶつけたときの威力の倍率）、fR/fD: 投げたときの爆発の半径と威力（自機の弾の何倍か）
const CT = [
  { hp: 34, r: 0.95, hl: 0.85, rng: 10, cd: 1.0, dm: 0.25, spd: 26, life: 0.45, grind: 0.4, m: 1, fR: 3.4, fD: 6 },
  { hp: 40, r: 1.0, hl: 0.95, rng: 14, cd: 1.6, dm: 0.7, spd: 30, life: 0.55, grind: 0.4, m: 1.1, fR: 3.8, fD: 7 },
  { hp: 110, r: 1.25, hl: 1.25, rng: 8, cd: 1.0, dm: 0.25, spd: 24, life: 0.4, grind: 1.2, armor: 0.35, m: 1.7, fR: 4.2, fD: 9 },
  { hp: 30, r: 1.0, hl: 0.9, rng: 0, cd: 0, dm: 0, grind: 0, bomb: 1, m: 1, fR: 6, fD: 11 },
];
const SALV = { 0: [0, 0.3], 4: [0, 0.3], 1: [1, 0.85], 6: [1, 0.85], 2: [2, 1], 5: [3, 0.75] }; // 敵の種類 → [車両, 残骸を落とす確率]
const L0 = 2.1, GAP = 2.7; // 鎖の長さ: 磁石から1両目まで、車両の間
const CARS = [], SV = [], FL = []; // 連結中の車両（前から順）、落ちている残骸、投げて飛んでいる残骸
const trainMax = () => 8 + 3 * (u.hitch || 0);
let instCB, instCT, instLink, instMark, instRope, instMag, PC = [1, 1, 1];

// 敵: 0 ドローン / 1 砲手 / 2 ブルート / 3 ボス（弾幕）/ 4 突撃車 / 5 自爆車 / 6 迫撃車 / 7 ボス（突進）/ 8 ボス（要塞）
const ET = [
  { hp: 20, sp: 4.6, r: 0.9, dmg: 8, xp: 1, sc: 1, chew: 14, col: 0x8a5cf0 },
  { hp: 34, sp: 3.2, r: 1.0, dmg: 6, xp: 2, sc: 2, chew: 14, col: 0xe0457b, shoot: 2.3 },
  { hp: 130, sp: 2.7, r: 1.5, dmg: 18, xp: 5, sc: 5, chew: 90, col: 0xd9413c },
  { hp: 1100, sp: 2.3, r: 2.7, dmg: 25, xp: 30, sc: 50, chew: 9999, col: 0x2b3158, boss: 1 },
  { hp: 14, sp: 7.2, r: 0.8, dmg: 7, xp: 1, sc: 1, chew: 10, col: 0xb7d43a },
  { hp: 42, sp: 4.1, r: 1.0, dmg: 20, xp: 3, sc: 3, chew: 30, col: 0x19a59a },
  { hp: 48, sp: 2.8, r: 1.05, dmg: 10, xp: 3, sc: 3, chew: 14, col: 0x3a55b8, shoot: 3.8 },
  { hp: 950, sp: 3.0, r: 2.5, dmg: 26, xp: 30, sc: 50, chew: 9999, col: 0x6a1f2e, boss: 2 },
  { hp: 1350, sp: 1.5, r: 3.0, dmg: 25, xp: 30, sc: 50, chew: 9999, col: 0x1f4038, boss: 3 },
];
// 拠点ごとのボス: 機体(k)、順番に出す技(mv)、体力が半分になったとき一度だけ呼ぶ増援(half: [敵の種類, 数])
const BOSS = [
  { k: 3, mv: ['fan3'], half: [0, 3] },
  { k: 7, mv: ['charge', 'fan3'] },
  { k: 8, mv: ['mortar', 'sweep'] },
  { k: 7, mv: ['snipe', 'charge'] },
  { k: 3, mv: ['sweep', 'ring'] },
  { k: 8, mv: ['mortar', 'spiral'], half: [5, 2] },
  { k: 7, mv: ['fan5', 'snipe', 'charge'] },
  { k: 3, mv: ['spiral', 'mortar', 'fan3'] },
  { k: 8, mv: ['sweep', 'mortar', 'snipe'] },
  { k: 7, mv: ['charge', 'fan5', 'mortar', 'ring'], half: [4, 3] },
];
const bossOf = s => BOSS[(s - 1) % BOSS.length];
const H = [], LN = []; // 着弾予告、予告線
// 追加の敵（突撃 / 自爆 / 迫撃）は拠点 2 / 3 / 4 から出る
const XWAVES = [[0, 0, 0], [2, 0, 0], [3, 1, 0], [4, 1, 1], [5, 2, 1], [6, 2, 2]], XFROM = [2, 3, 4];
const WAVES = [[11, 0, 0], [14, 2, 0], [18, 4, 1], [22, 6, 2], [28, 8, 3], [34, 10, 5]];
const WDUR = 26;
export const NWAVE = WAVES.length;

export const G = { state: 'boot' };
export const P = { x: 0, z: 0 };
export const S = {};
const E = [], B = [], K = [], M = [], boomQ = [], SQ = [], WK = [], VQ = [], WKL = [3.6, 6]; // SQ: 必殺技の着弾待ち、WK: 倒した敵の残骸、VQ: 見た目だけの連続爆発
let drone, shield, tankKey = '', logoDone = false; // logoDone: タイトルロゴはページを開いて最初の出撃だけ
let u = {}, TH = null, thKey = '', instFar, instSmall, tank, instE, instT, ESC, instB, instBul, instGear, instHeal, instMine, instSaw, tgtT = 0, tgt = null, pickN = 0, pickT = 0;

export function initGame() {
  drone = new THREE.Mesh(geo([{ s: [0.7, 0.22, 0.7], p: [0, 0, 0], c: 0xffb21e }, { s: [1.3, 0.06, 0.16], p: [0, 0.16, 0], c: 0x39405c }, { s: [0.16, 0.06, 1.3], p: [0, 0.16, 0], c: 0x39405c }, { s: [0.2, 0.16, 0.5], p: [0, -0.12, 0.3], c: 0x39405c }]), MAT);
  shield = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.09, 6, 28), new THREE.MeshBasicMaterial({ color: 0x8fe3ff, transparent: true, opacity: 0.75 })); shield.rotation.x = Math.PI / 2; shield.position.y = 0.9;
  drone.castShadow = true; drone.visible = shield.visible = false; scene.add(drone); scene.add(shield);
  // 敵の見た目: [色, 形, 同時に出せる数]。車体と砲塔を分け、砲塔は自機の方を向く
  const ED = [
    [0x7a4fe0, { lite: true, scale: 0.52 }, 140], [0xd23a6e, { lite: true, long: true, scale: 0.64 }, 50], [0xc8362f, { plow: true, scale: 0.98, tur: 0xe86a58 }, 30],
    [0x2b3158, { twin: true, crown: true, plow: true, scale: 1.8, tur: 0xc23a6a, boss: 1 }, 2], [0xb7d43a, { lite: true, light: true, short: true, scale: 0.46 }, 60],
    [0x19a59a, { lite: true, short: true, armor: true, scale: 0.7, tur: 0xff8a2a }, 30], [0x3a55b8, { lite: true, long: true, scale: 0.78, tur: 0x8fa6ff }, 30],
    [0x6a1f2e, { crown: true, plow: true, light: true, scale: 1.65, tur: 0xe8b62a, boss: 2 }, 2], [0x1f4038, { twin: true, crown: true, armor: true, scale: 2.05, tur: 0x3fae8a, boss: 3 }, 2],
  ];
  instE = ED.map(([c, o, n]) => new Inst(tankGeo(c, Object.assign({ part: 'body' }, o)), n, { shadow: true, mat: EMAT }));
  instT = ED.map(([c, o, n]) => new Inst(tankGeo(c, Object.assign({ part: 'tur' }, o)), n, { shadow: true, mat: EMAT }));
  ESC = ED.map(d => d[1].scale);
  instSaw = new Inst(geo([{ s: [1.2, 0.1, 1.2], p: [0, 0, 0], c: 0xd0d6e2, cyl: 8 }, { s: [1.5, 0.06, 0.3], p: [0, 0, 0], c: 0xf4f7fb }, { s: [0.3, 0.06, 1.5], p: [0, 0, 0], c: 0xf4f7fb }]), 4, {});
  const ph = () => new THREE.BoxGeometry(1, 1, 1); // テーマごとに setTheme() で差し替える
  instB = [new Inst(ph(), 420, { shadow: true }), new Inst(ph(), 420, { shadow: true }), new Inst(ph(), 120, { shadow: true })];
  instFar = new Inst(ph(), 64, { shadow: true }); instSmall = new Inst(ph(), 240, {});
  instBul = new Inst(new THREE.SphereGeometry(1, 8, 6).scale(0.1, 0.1, 0.6), 420, { mat: BMAT });
  instGear = new Inst(geo([{ s: [0.7, 0.2, 0.7], p: [0, 0, 0], c: 0xffd23f, cyl: 6 }, { s: [0.3, 0.24, 0.3], p: [0, 0, 0], c: 0xb8860b, cyl: 6 }]), 360, {});
  instHeal = new Inst(geo([{ s: [0.9, 0.3, 0.3], p: [0, 0, 0], c: 0x5fe08a }, { s: [0.3, 0.3, 0.9], p: [0, 0, 0], c: 0x5fe08a }]), 20, {});
  instMine = new Inst(geo([{ s: [0.9, 0.22, 0.9], p: [0, 0.11, 0], c: 0x39405c, cyl: 8 }, { s: [0.3, 0.14, 0.3], p: [0, 0.28, 0], c: 0xff5b6b, cyl: 6 }]), 16, {});
  // 列車の車両: 元の敵の形の車体を錆びた色に、砲塔は自機の塗装の色に（インスタンスの色で塗る）。爆弾車は砲塔の代わりに赤いドラム缶
  const CD = [{ lite: true, short: true, scale: 0.6 }, { lite: true, long: true, scale: 0.68 }, { plow: true, armor: true, scale: 0.84 }, { lite: true, short: true, armor: true, scale: 0.7 }];
  instCB = CD.map(o => new Inst(tankGeo(0x6a5a4a, Object.assign({ part: 'body', eye: false }, o)), 24, { shadow: true }));
  instCT = CD.map((o, i) => new Inst(i === 3 ? geo([{ s: [0.95, 0.95, 0.95], p: [0, 1.15, 0], c: 0xc8362f, cyl: 12 }, { s: [1.0, 0.1, 1.0], p: [0, 1.0, 0], c: 0xffd23f, cyl: 12 }, { s: [1.0, 0.1, 1.0], p: [0, 1.36, 0], c: 0xffd23f, cyl: 12 }, { s: [0.22, 0.12, 0.22], p: [0, 1.68, 0], c: 0x2b2e33, cyl: 8 }]) : tankGeo(0xffffff, Object.assign({ part: 'tur', tur: 0xffffff, eye: false }, o)), 24, { shadow: true }));
  instLink = new Inst(geo([{ s: [0.26, 0.18, 0.5], p: [0, 0, 0], c: 0x9aa0a8 }]), 260, {});
  instMark = new Inst(new THREE.TorusGeometry(1.45, 0.09, 6, 36).rotateX(Math.PI / 2), 12, { mat: BMAT });
  instMag = new Inst(geo([{ s: [1.05, 0.2, 1.05], p: [0, 0.78, 0], c: 0x2b2e33, cyl: 16 }, { s: [1.12, 0.07, 1.12], p: [0, 0.92, 0], c: 0xffd23f, cyl: 16 }, { s: [0.16, 0.45, 0.16], p: [0, 1.15, 0], c: 0x9aa0a8 }]), 2, { shadow: true }); // 戦車の後ろの磁石
  instRope = new Inst(new THREE.BoxGeometry(0.22, 0.03, 0.48), 160, { mat: BMAT });
  W.setOnBreak(onBreak);
}

// 装備中のパーツに合わせて自機のモデルを作り直す
function buildTank() {
  const pt = save.parts, key = pt.hull + pt.turret + pt.paint; if (key === tankKey && tank) return; tankKey = key;
  if (tank) scene.remove(tank.g);
  // 重装車体はひと回り大きく、装甲を厚く見せる（当たり判定はどの車体も同じ）
  tank = mkTank(MT.paintCol(), pt.hull === 'light' ? 0.74 : pt.hull === 'bulk' ? 1.0 : pt.hull === 'assault' ? 0.86 : 0.8, { twin: pt.turret === 'twin', short: pt.turret === 'scatter' || pt.turret === 'blast', long: pt.turret === 'rail', laser: pt.turret === 'laser', armor: pt.hull === 'assault', heavy: pt.hull === 'bulk', light: pt.hull === 'light' });
}
const pt0 = () => save.parts;
const HULL = { std: [1, 1], light: [1.18, 0.8], bulk: [0.88, 1.45], assault: [1.1, 1.25] };
const TUR = {
  blast: { n: 1, dm: 0.9, rm: 0.85, lm: 1, sm: 1, sp: 0.13, pierce: 0, c: 0, boom: 2 }, rail: { n: 1, dm: 1.6, rm: 0.65, lm: 1.5, sm: 1.3, sp: 0.1, pierce: 1, c: 0 },
  cannon: { n: 1, dm: 1, rm: 1, lm: 1, sm: 1, sp: 0.13, pierce: 0, c: 0 }, twin: { n: 2, dm: 0.65, rm: 1, lm: 1, sm: 1, sp: 0.13, pierce: 0, c: 0 },
  scatter: { n: 5, dm: 0.42, rm: 0.72, lm: 0.6, sm: 1, sp: 0.17, pierce: 0, c: 0 }, laser: { n: 1, dm: 0.8, rm: 0.9, lm: 0.55, sm: 2.1, sp: 0.08, pierce: 3, c: 2 },
};
function swapGeo(inst, parts) { inst.m.geometry.dispose(); inst.m.geometry = geo(parts); }
// 拠点の種類が変わったら、モデル・地面・周囲の景色・小物を入れ替える
function setTheme(stage) {
  TH = themeOf(stage); const key = TH.id + ':' + (TH.id === 'river' ? stage : 0);
  for (const b of W.blocks) { if (b.t === W.CRATE && TH.spin) b.ry = ((b.v * 4) | 0) * Math.PI / 2; if (b.t === W.WALL && TH.wspin) b.ry = (((b.v * 40) | 0) % 4) * Math.PI / 2; if (b.t === W.WALL && TH.tall) b.sy = TH.tall[0] + (TH.tall[1] - TH.tall[0]) * ((b.v * 7.3) % 1); }
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
  const pt = save.parts, tu = TUR[pt.turret] || TUR.cannon, hm = HULL[pt.hull] || HULL.std, bm = u.boom + (tu.boom || 0);
  S.dmg = 10 * (1 + 0.1 * save.up.dmg) * (1 + 0.3 * u.heavy) * tu.dm;
  S.rate = 2.6 * (1 + 0.25 * u.rapid) * tu.rm * (pt.gear === 'loader' ? 1.2 : 1);
  S.shots = tu.n + u.split; S.spread = tu.sp; S.pierce = u.pierce + tu.pierce; S.bounce = u.bounce; S.rear = u.rear; S.bc = tu.c;
  S.exR = bm ? 2.0 + 0.6 * bm : 0;
  S.maxhp = Math.round((100 + 15 * save.up.hp) * hm[1]) + 25 * u.armor;
  S.speed = 9.9 * (1 + 0.04 * Math.min(10, save.up.spd) + 0.01 * Math.max(0, save.up.spd - 10)) * (1 + 0.12 * u.engine) * hm[0];
  S.gear = pt.gear;
  S.mag = 4 * (1 + 0.6 * u.magnet) * (pt.gear === 'arm' ? 1.8 : 1); S.regen = 1.2 * u.regen + (pt.gear === 'repair' ? 1.5 : 0); S.mine = u.mine + (S.gear === 'mines' ? 1 : 0);
  S.crit = 0.12 * u.crit; S.frost = u.frost; S.orbit = u.orbit; S.salvo = u.salvo; S.plate = 1 - 0.1 * u.plate;
  S.bspd = 30 * (1 + 0.2 * u.long) * tu.sm; S.blife = 0.7 * tu.lm;
}
// 調整値（ボットの試算から決めた。__tk.tune で試せる）。xq: レベルアップに要る経験値の伸び、hpX / dmX: 拠点3から上乗せする敵の体力と攻撃
// as: 同じ拠点で負けるたびに敵の体力と攻撃を下げる割合（最大 asMax 回ぶん。勝てば戻る）
// horde: 小型の数の倍率、small: 小型（ドローン・突撃車）の体力の倍率（射撃だけでは溶けず、群れがたまって鎖と「投げる」の出番ができる）、carDm: 車両の射撃の倍率
// chFr: 鎖の車両の地面の摩擦（小さいほどよく振れる）、swV: 振った車両が強く当たる速さ、swD: なぎ払いの威力、mag: 磁石が残骸を引き寄せる距離
export const TUNE = { horde: 2.5, small: 3, carDm: 0.6, chFr: 1.4, swV: 6, swD: 0.32, mag: 5, xq: 0.55, hpX: 0.28, dmX: 0.05, e12: 0.92, as: 0.1, asMax: 5 };
const need = l => 4 + 3 * (l - 1) + TUNE.xq * (l - 1) * (l - 1);

// hold: 「おかえり」画面の裏で戦場だけ用意し、出撃ボタンで begin() するまで止めておく
export function startRun(hold) {
  W.genWorld(themeOf(save.stage).id, save.stage); setTheme(save.stage); musicTrack(areaOf(save.stage));
  E.length = B.length = K.length = M.length = boomQ.length = H.length = LN.length = SQ.length = WK.length = VQ.length = CARS.length = SV.length = FL.length = 0; setWarn(H, LN);
  if (save.runs >= 1) MT.loginTick(); const sup = MT.supplyTick(); buildTank();
  u = {}; for (const d of UPS) u[d.id] = 0;
  Object.assign(G, { state: hold ? 'hold' : 'play', slowT: 0, t: 0, wave: -1, wt: 0, queue: [], kills: 0, scrap: 0, banked: 0, lvl: 1, xp: 0, pend: 0, inv: 0, endT: 0, boss: null, sp: 0, spN: 0, paused: false, pzN: 0, xpD: Math.sqrt(1 + 0.12 * (save.stage - 1)), stage: save.stage, won: false, home: false, quietT: 0, dng: 0, dustT: 0, intro: false, first: save.runs === 0, salvN: 0, throws: 0, links: 0, crushed: 0, swH: 0, swK: 0 });
  G.as = save.lose && save.lose.s === save.stage ? Math.min(TUNE.asMax, save.lose.n) : 0; // 続けて負けた回数
  music('calm'); musicVol(1);
  recalc(); Object.assign(P, { x: 0, z: 0, vx: 0, vz: 0, ry: Math.PI, ty: Math.PI, hp: S.maxhp, cd: 0, mineT: 1, recoil: 0, dead: false, sh: 0, da: 0, dcd: 1 });
  tank.g.visible = true; charTank(tank, false); tgt = null; { const c = new THREE.Color(MT.paintCol()).lerp(new THREE.Color(0x8a6446), 0.35); PC = [c.r, c.g, c.b]; } P.odo = 0; clearMarks(); P.pitch = P.roll = 0; P.markD = 0; P.px = 0; P.pz = 0;
  UI.hideAll(); UI.setBoss(-1);
  G.arrived = sup.arrived;
  G.tut = G.first ? 0 : 2; UI.hint(null);
  if (!hold) begin();
}
export function begin() {
  G.state = 'play'; save.runs++; MT.dailyAdd('runs', 1); persist();
  camIntro();
  platform.gameplayStart(); ev('start', { run: save.runs, stage: G.stage, parts: [pt0().hull, pt0().turret, pt0().gear].join('/') });
}
// 途中で閉じてもスクラップが消えないよう、区切りごとに保存へ移す
export function bank() { const d = G.scrap - G.banked; if (d > 0) { save.scrap += d; G.banked = G.scrap; persist(); } }

function startWave(i) {
  G.wave = i; G.wt = 0; G.queue = []; W.compact(); MT.dailyAdd('wave', i + 1);
  const s3 = Math.max(0, G.stage - 2), hpM = (1 + 0.22 * (G.stage - 1) + TUNE.hpX * s3) * (G.stage <= 2 ? TUNE.e12 : 1) * (1 - TUNE.as * G.as), cM = 1 + 0.12 * (G.stage - 1);
  if (i >= NWAVE) { G.queue.push({ t: 1.2, k: bossOf(G.stage).k }); UI.banner(jaEn('拠点ボス出現！', 'BASE BOSS!'), true); sfx.wave(); G.hpM = hpM; return; }
  const w = WAVES[i].slice(); for (let k = 0; k < 3; k++) if (G.stage >= XFROM[k]) w[0] -= XWAVES[i][k]; // 追加の敵のぶんドローンを減らす
  for (let k = 0; k < 3; k++) { const n = Math.round(w[k] * cM * (k === 0 ? TUNE.horde : 1)); for (let j = 0; j < n; j++) G.queue.push({ t: rr(0.3, WDUR * 0.62) * (k === 0 && j < 3 ? 0.15 : 1), k }); }
  for (let k = 0; k < 3; k++) if (G.stage >= XFROM[k]) { const n = Math.round(XWAVES[i][k] * cM); for (let j = 0; j < n; j++) G.queue.push({ t: rr(2, WDUR * 0.7), k: 4 + k }); }
  G.queue.sort((a, b) => a.t - b.t); G.hpM = hpM;
  UI.banner('WAVE ' + (i + 1) + ' / ' + NWAVE); if (i > 0) sfx.wave();
}
export function spawnAt(k, x, z, ry = 0) { spawn(k); const e = E[E.length - 1]; e.x = x; e.z = z; e.ry = e.ta = ry; e.born = 1; e.drop = 0; H.length = 0; return e; } // 掲載画像の撮影用
const smallM = () => 1 + (TUNE.small - 1) * Math.min(1, (Math.max(0, G.wave) + 1) / 3); // 小型の硬さは最初の2つの波で少しずつ上げる
function spawn(k) {
  const d = ET[k], a = rnd() * 6.283, dist = d.boss ? 8.5 : rr(19, 26); // ボスは画面の中（自機から少し離れた所）に降りる
  const e = { k, x: clamp(P.x + Math.cos(a) * dist, -W.A + 2, W.A - 2), z: clamp(P.z + Math.sin(a) * dist, -W.A + 2, W.A - 2), hp: d.hp * G.hpM * (k === 0 || k === 4 ? smallM() : 1), max: d.hp * G.hpM * (k === 0 || k === 4 ? smallM() : 1), r: d.r, ry: 0, kx: 0, kz: 0, cd: rr(1, 2.5), hc: 0, hitT: 0, born: 0, dead: false, c2: 4, strafe: rnd() < 0.5 ? 1 : -1, mv: null, mi: 0, rest: 1.6, hold: 0, dash: 0 };
  if (!d.boss && Math.hypot(e.x - P.x, e.z - P.z) < 12) { e.x = clamp(P.x - Math.cos(a) * dist, -W.A + 2, W.A - 2); e.z = clamp(P.z - Math.sin(a) * dist, -W.A + 2, W.A - 2); }
  if (d.boss) { e.drop = DROP; H.push({ x: e.x, z: e.z, t: 0, T: DROP, r: e.r * 1.5, dmg: d.dmg }); } // ボスは予告円の上に空から降ってくる
  E.push(e); if (d.boss) { G.boss = e; UI.setBoss(1); }
}
const DROP = 1.2;
function land(e) { // ボスの着地: 衝撃波、土ぼこり、揺れ。下敷きの障害物は壊れる
  addShake(1.1); sfx.boom(true); fxShock(e.x, e.z, e.r * 1.6, 0xffa36b); burst(e.x, 0.5, e.z, 16, TH.dust, 10, 0.34, 0.8, 1.2);
  for (const b of W.blocks) if (b.hp > 0 && Math.hypot(b.x - e.x, b.z - e.z) < e.r + 1.2) W.damageBlock(b, 1e4);
}
// ボスの技。技と技のあいだに休みを入れ、体力が半分を切ると休みが短くなる
function bossAI(e, dt, dx, dz) {
  const def = bossOf(G.stage), rage = e.hp < e.max * 0.5, a = Math.atan2(dx, dz), mzx = e.x + dx * 2.6, mzz = e.z + dz * 2.6;
  UI.setBoss(e.hp / e.max);
  if (rage && !e.called) {
    e.called = true; ring(e.x, e.z, 7, 0xff5b6b); sfx.wave();
    if (def.half) for (let j = 0; j < def.half[1]; j++) { spawn(def.half[0]); const s = E[E.length - 1]; s.x = e.x + rr(-4, 4); s.z = e.z + rr(-4, 4); }
  }
  if (!e.mv) { e.rest -= dt; if (e.rest > 0) return; e.mv = def.mv[e.mi++ % def.mv.length]; e.mt = 0; e.n = 0; e.cd = 0; }
  e.mt += dt; const t = e.mt; let done = false;
  if (e.mv === 'fan3' || e.mv === 'fan5') { // 狙った扇形の弾を3回
    const n = e.mv === 'fan5' ? 2 : 1;
    if (t >= 0.3 + 0.5 * e.n) { e.n++; for (let j = -n; j <= n; j++) bullet(mzx, mzz, a + j * 0.2, true, 9, 12, 2.6); fxMuzzle(mzx, mzz, a, 0xff3a7a); sfx.hit(); }
    done = e.n >= 3;
  } else if (e.mv === 'charge') { // 止まって狙い（予告線）→ 一直線に突進
    if (e.n === 0) { e.n = 1; ring(e.x, e.z, 5, 0xff5b6b); }
    if (e.n === 1) { e.hold = 0.1; if (t < 0.6) e.ca = a; LN.push({ x: e.x, z: e.z, a: e.ca, len: 14, w: e.r * 1.7, p: t / 0.85 }); if (t >= 0.85) { e.n = 2; e.dash = 0.75; e.dx = Math.sin(e.ca); e.dz = Math.cos(e.ca); sfx.wave(); } }
    else done = e.dash <= 0;
  } else if (e.mv === 'snipe') { // 細い予告線のあとに速い弾。3発
    const ph = t - e.n * 1.05; e.hold = 0.1;
    if (ph < 0.45) e.ca = a;
    if (ph < 0.78) { if (ph > 0) LN.push({ x: e.x, z: e.z, a: e.ca, len: 34, w: 0.45, p: ph / 0.78 }); }
    else { e.n++; const sx = e.x + Math.sin(e.ca) * 2.6, sz = e.z + Math.cos(e.ca) * 2.6; bullet(sx, sz, e.ca, true, 11, 30, 1.2); fxMuzzle(sx, sz, e.ca, 0xff3a7a); sfx.hit(); }
    done = e.n >= 3;
  } else if (e.mv === 'mortar') { // 地面に予告の円 → 少し遅れて着弾
    if (t >= e.n * 1.25 && e.n < (rage ? 3 : 2)) {
      e.n++; sfx.wave();
      for (let j = 0; j < 3; j++) { const o = j === 0 ? [P.x, P.z] : j === 1 ? [P.x + P.vx * 0.7, P.z + P.vz * 0.7] : [P.x + rr(-6, 6), P.z + rr(-6, 6)]; H.push({ x: o[0], z: o[1], t: -j * 0.12, T: 1.15, r: 3, dmg: 15 }); }
    }
    done = t > (rage ? 3 : 2) * 1.25;
  } else if (e.mv === 'sweep') { // 弾の列で左右になぎ払う（往復）
    if (e.n === 0) { e.n = 1; e.ca = a; e.sd = rnd() < 0.5 ? 1 : -1; }
    e.hold = 0.1; e.cd -= dt; const q = t / 1.5, ang = e.ca + e.sd * (q < 1 ? -1 + 2 * q : 3 - 2 * q);
    if (e.cd <= 0) { e.cd = 0.14; bullet(e.x + Math.sin(ang) * 2.6, e.z + Math.cos(ang) * 2.6, ang, true, 8, 11, 2.6); }
    done = q >= 2;
  } else if (e.mv === 'spiral') { // 短いらせん弾
    e.cd -= dt; if (e.cd <= 0) { e.cd = 0.17; e.sa = (e.sa || 0) + 0.37; for (let j = 0; j < 2; j++) bullet(e.x, e.z, e.sa + j * Math.PI, true, 7, 7.5, 3.4); }
    done = t > 2.4;
  } else if (e.mv === 'ring') { // すき間のある輪を2回。すき間へ動けば避けられる
    if (t >= e.n * 0.95) { e.n++; const n = 16, gap = a + rr(0.5, 0.9) * (rnd() < 0.5 ? 1 : -1); for (let j = 0; j < n; j++) { const an = j / n * 6.283; if (Math.abs(Math.atan2(Math.sin(an - gap), Math.cos(an - gap))) < 0.55) continue; bullet(e.x, e.z, an, true, 8, 9, 3.2); } sfx.hit(); }
    done = e.n >= 2;
  }
  if (done) { e.mv = null; e.rest = rage ? 0.8 : 1.3; }
}
function bullet(x, z, a, foe, dmg, spd, life) {
  if (B.length > 400) return;
  B.push({ x, z, vx: Math.sin(a) * spd, vz: Math.cos(a) * spd, l: life, dmg, foe, c: foe ? 1 : S.bc, pierce: foe ? 0 : S.pierce, bounce: foe ? 0 : S.bounce, hit: null, dead: false });
}
function shoot() {
  const n = S.shots;
  const cr = () => S.dmg * (S.crit && rnd() < S.crit ? 2.5 : 1);
  const d0 = Math.max(2.2, tank.mz - 0.15); // 弾は砲口から（大きい車体でも砲身の途中から出ないように）
  for (let k = 0; k < n; k++) { const a = P.ty + (k - (n - 1) / 2) * S.spread; bullet(P.x + Math.sin(a) * d0, P.z + Math.cos(a) * d0, a, false, cr(), S.bspd, S.blife); }
  for (let k = 0; k < S.rear; k++) { const a = P.ty + Math.PI + (k - (S.rear - 1) / 2) * 0.2; bullet(P.x + Math.sin(a) * 1.2, P.z + Math.cos(a) * 1.2, a, false, S.dmg, S.bspd, S.blife); }
  P.recoil = 1; sfx.shot(); fxMuzzle(P.x + Math.sin(P.ty) * (tank.mz + 0.1), P.z + Math.cos(P.ty) * (tank.mz + 0.1), P.ty);
}
// ---- 必殺技: 敵を倒すとゲージがたまり、満タンで大砲撃（時間ではたまらない） ----
// 1体につき 経験値×3.5%（小型1、砲手2、自爆車と迫撃車3、大型5）。ボスは体力を全部削って80%
function charge(v) { if (G.state === 'play') G.sp = Math.min(1, G.sp + v / Math.min(3.5, 1 + 0.35 * G.spN)); } // 使うたびに少したまりにくくなる
function special() {
  if (G.state !== 'play') return;
  if (CARS.length >= 2) { fling(); return; } // 列車があるときは「投げる」（ゲージは要らない）
  if (G.sp < 1) return;
  G.sp = 0; G.spN++; ev('sp', { s: Math.round(G.t), n: G.spN }); if (!save.sp1) { save.sp1 = 1; persist(); }
  const a = P.ty, auto = I.touch || I.auto, far = auto ? (tgt && !tgt.dead ? Math.min(22, Math.hypot(tgt.x - P.x, tgt.z - P.z)) : 11) : clamp(Math.hypot(I.ax - P.x, I.az - P.z), 5, 22);
  const x = P.x + Math.sin(a) * far, z = P.z + Math.cos(a) * far, mx = P.x + Math.sin(a) * 2.6, mz = P.z + Math.cos(a) * 2.6;
  P.recoil = 2.2; G.inv = Math.max(G.inv, 0.5); addShake(0.5); sfx.special(); flash(mx, mz, 9, 0x8fe3ff);
  fxMuzzle(mx, mz, a, 0x8fe3ff); fxShell(mx, mz, x, z, 0.2, 0x8fe3ff); burst(mx, 1.4, mz, 12, 0x8fe3ff, 12, 0.3, 0.5); ring(P.x, P.z, 5, 0x8fe3ff);
  for (const b of B) if (b.foe && (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < 144) b.dead = true; // 近くの敵弾を消す
  SQ.push({ x, z, t: 0.2, R: 6.5, d: S.dmg * 9 });
  for (let j = 0; j < 4; j++) { const q = j / 4 * 6.283 + rr(-0.4, 0.4), r = rr(3.5, 6); SQ.push({ x: x + Math.sin(q) * r, z: z + Math.cos(q) * r, t: 0.42 + j * 0.09, R: 4, d: S.dmg * 3 }); }
}
function wreck(e) { // 残骸。ときどき砲塔が吹き飛んで横に落ちる
  const sc = ESC[e.k], pop = !ET[e.k].boss && rnd() < 0.7, a = rnd() * 6.283, v = 3.4 * sc;
  WK.push({ k: e.k, x: e.x, z: e.z, ry: e.ry + rr(-0.35, 0.35), ta: e.ta ?? e.ry, t: 0, st: 0, big: !!ET[e.k].boss || e.k === 2, pop, tx: 0, ty: 0, tz: 0, vx: Math.sin(a) * v, vz: Math.cos(a) * v, vy: pop ? rr(7.5, 10) : 0, land: -0.9 * sc });
  if (WK.length > 28) WK.shift();
}
// ---- スクラップ列車 ----
const carMax = k => CT[k].hp * (1 + 0.4 * (u.carhp || 0)) * (1 + 0.06 * save.up.hp);
function dropSalv(e) { // 倒した敵が残骸を落とす（その出撃で最初の1体は必ず）。落としたら true
  const sv = SALV[e.k]; if (!sv || (G.salvN > 0 && rnd() > sv[1])) return false;
  G.salvN++; SV.push({ k: sv[0], x: e.x, z: e.z, ry: e.ry, t: 0 }); if (SV.length > 10) SV.shift(); return true;
}
function attach(sv) { // 残骸を最後尾に連結する。満車なら全車を少し直す
  ring(sv.x, sv.z, 2.4, 0xffd23f); fxSparks(sv.x, sv.z, 8, 0xffd23f); burst(sv.x, 0.9, sv.z, 8, 0xffd23f, 7, 0.24, 0.45);
  if (CARS.length >= trainMax()) { for (const c of CARS) c.hp = Math.min(c.max, c.hp + c.max * 0.35); popText(sv.x, sv.z, jaEn('修理', 'REPAIR'), '#8be36b', false); sfx.heal(); return; }
  const mx = carMax(sv.k); CARS.push({ k: sv.k, x: sv.x, z: sv.z, vx: 0, vz: 0, ry: sv.ry, ta: sv.ry, hp: mx, max: mx, cd: 0.4, hitT: 0, dead: false });
  G.links++; sfx.buy(); popText(sv.x, sv.z, jaEn('連結！', 'LINKED!'), '#ffd23f', false); once('link', { s: Math.round(G.t) }); if (!save.link1) { save.link1 = 1; persist(); }
}
function carHurt(c, d) { if (c.dead) return; c.hp -= d * (CT[c.k].armor || 1) * eDm(); c.hitT = 0.12; if (c.hp <= 0) carDie(c); }
function carDie(c, quiet) {
  c.dead = true; fxExplode(c.x, c.z, c.k === 2 ? 3 : 2.3); burst(c.x, 0.8, c.z, 10, 0x8a6446, 9, 0.26, 0.7, 1.2, 0.4); if (!quiet) { sfx.boom(false); addShake(0.15); }
  if (CT[c.k].bomb) { explode(c.x, c.z, 4.6 + 0.4 * (u.loopx || 0), S.dmg * 8); ring(c.x, c.z, 6, 0xff5b6b); flash(c.x, c.z, 7, 0xff6a3a); }
}
// 鎖の根もと（戦車の後ろの磁石）
function anchor() { const s = 1.35 * tank.sc / 0.8; return [P.x - Math.sin(P.ry) * s, P.z - Math.cos(P.ry) * s]; }
// 鎖: 位置で解く簡単な物理。車両は慣性で動き、鎖の長さだけは超えない。戦車が曲がると後ろの車両が振り子のように振れる
function updChain(dt) {
  const fr = Math.exp(-TUNE.chFr * dt), [ax, az] = anchor(), n = CARS.length;
  for (const c of CARS) { c.ox = c.x; c.oz = c.z; c.x += c.vx * fr * dt; c.z += c.vz * fr * dt; }
  for (let it = 0; it < 6; it++) {
    for (let i = 0; i < n; i++) {
      const c = CARS[i], p = i ? CARS[i - 1] : null, px = p ? p.x : ax, pz = p ? p.z : az, L = i ? GAP : L0, dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz) || 1e-4;
      if (d <= L && d >= L * 0.7) continue; const e = (d - (d > L ? L : L * 0.7)) / d; // 鎖は伸びない。縮みすぎも押し返す
      if (p) { c.x -= dx * e * 0.5; c.z -= dz * e * 0.5; p.x += dx * e * 0.5; p.z += dz * e * 0.5; } else { c.x -= dx * e; c.z -= dz * e; }
    }
    for (let i = 0; i < n; i++) { // 戦車の車体と、離れた車両どうしは重ならない
      const c = CARS[i]; { const dx = c.x - P.x, dz = c.z - P.z, d = Math.hypot(dx, dz) || 1e-4, m = 1.9; if (d < m) { c.x += dx / d * (m - d); c.z += dz / d * (m - d); } }
      for (let j = i + 2; j < n; j++) { const o = CARS[j], dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz) || 1e-4, m = 1.9; if (d < m) { const q = (m - d) / d * 0.5; o.x += dx * q; o.z += dz * q; c.x -= dx * q; c.z -= dz * q; } }
    }
  }
  for (let i = 0; i < n; i++) {
    const c = CARS[i], ps = Math.hypot(c.x - c.ox, c.z - c.oz) / dt;
    W.pushOut(c, CT[c.k].r * 0.85, ps > 9 ? b => { if (b.t !== W.WALL) W.damageBlock(b, 999); } : null); // 速くぶつけた木箱やドラム缶は壊れる
    c.vx = (c.x - c.ox) / dt; c.vz = (c.z - c.oz) / dt; const sp = Math.hypot(c.vx, c.vz); if (sp > 40) { c.vx *= 40 / sp; c.vz *= 40 / sp; }
    const p = i ? CARS[i - 1] : null, px = p ? p.x : ax, pz = p ? p.z : az; c.ry = angLerp(c.ry, Math.atan2(px - c.x, pz - c.z), 1 - Math.exp(-12 * dt)); // 引っぱられる方を向く
  }
}
function updTrain(dt, live) {
  // 落ちている残骸: 近いと磁石で引き寄せ、触れると連結。14秒で消える（最後の3秒は点滅）
  const [ax, az] = anchor();
  for (let i = SV.length - 1; i >= 0; i--) {
    const v = SV[i]; v.t += dt; if (v.t > 14) { SV.splice(i, 1); continue; } if (!live) continue;
    const q = (P.x - v.x) ** 2 + (P.z - v.z) ** 2; if (q < 2.5 * 2.5) { SV.splice(i, 1); attach(v); continue; }
    if (q < TUNE.mag * TUNE.mag) { const k = Math.min(1, dt * 5); v.x += (ax - v.x) * k; v.z += (az - v.z) * k; v.ry += dt * 4; if (rnd() < dt * 12) fxSparks(v.x, v.z, 1, 0x8fe3ff); }
  }
  for (let i = FL.length - 1; i >= 0; i--) { // 投げた残骸: 弧を描いて飛び、着地で爆発
    const f = FL[i]; f.t += dt; const q = Math.min(1, f.t / f.T);
    if (f.e && !f.e.dead && q < 0.75) { const k = Math.min(1, dt * 8); f.x1 += (f.e.x - f.x1) * k; f.z1 += (f.e.z - f.z1) * k; } // 狙った敵を少し追う
    f.x = f.x0 + (f.x1 - f.x0) * q; f.z = f.z0 + (f.z1 - f.z0) * q; f.y = 4 * f.h * q * (1 - q); f.ry += f.spin * dt;
    if (rnd() < dt * 30) burst(f.x, f.y + 0.7, f.z, 1, 0x4a4d5c, 1.5, 0.3, 0.5, 0.6, 0.3);
    if (q >= 1) { FL.splice(i, 1); landScrap(f); }
  }
  if (!CARS.length) return;
  updChain(dt);
  const k = 1 - Math.exp(-14 * dt), cf = 1 + 0.2 * (u.carfire || 0), cdm = cf * TUNE.carDm;
  for (let i = 0; i < CARS.length; i++) {
    const c = CARS[i]; if (c.hitT > 0) c.hitT -= dt;
    const d = CT[c.k]; if (!live || !d.rng) { c.ta = angLerp(c.ta, c.ry, k); continue; }
    if (c.tg && (c.tg.dead || (c.tg.x - c.x) ** 2 + (c.tg.z - c.z) ** 2 > d.rng * d.rng)) c.tg = null;
    c.cd -= dt * cf;
    if (c.cd <= 0) { // 近い敵を探して撃つ
      let best = null, bd = d.rng * d.rng; for (const e of E) { if (e.dead || e.drop > 0) continue; const q = (e.x - c.x) ** 2 + (e.z - c.z) ** 2; if (q < bd) { bd = q; best = e; } }
      c.tg = best;
      if (best) { c.cd = d.cd; const a = Math.atan2(best.x - c.x, best.z - c.z), m = d.hl + 0.4; c.ta = a; bullet(c.x + Math.sin(a) * m, c.z + Math.cos(a) * m, a, false, S.dmg * d.dm * cdm, d.spd, d.life); fxMuzzle(c.x + Math.sin(a) * m, c.z + Math.cos(a) * m, a); if (c.k === 1) sfx.shot(); }
      else c.cd = 0.2;
    }
    c.ta = angLerp(c.ta, c.tg ? Math.atan2(c.tg.x - c.x, c.tg.z - c.z) : c.ry, 1 - Math.exp(-10 * dt));
  }
  // 敵と車両: 押し返す。速く振った車両は強く当たって吹き飛ばす（重い車両ほど痛い）。ゆっくりだとこすれて、車両も削られる。ボスは押し返せない
  if (live) for (const c of CARS) {
    const d = CT[c.k]; if (c.dead) continue; const sp = Math.hypot(c.vx, c.vz);
    for (const e of E) {
      if (e.dead || e.drop > 0) continue; const dx = e.x - c.x, dz = e.z - c.z, r = e.r + d.r; if (dx > r || dx < -r || dz > r || dz < -r) continue;
      const d2 = dx * dx + dz * dz; if (d2 >= r * r) continue; const dd = Math.sqrt(d2) || 1, ed = ET[e.k];
      if (!ed.boss) { e.x += dx / dd * (r - dd); e.z += dz / dd * (r - dd); }
      if (d.bomb) { carDie(c); break; }
      if (sp > TUNE.swV && (e.sw || 0) <= G.t) { // なぎ払い
        e.sw = G.t + 0.3; const dm = S.dmg * TUNE.swD * d.m * (sp - TUNE.swV * 0.5) * (1 + 0.35 * (u.loopx || 0)), kb = Math.min(14, sp) / sp;
        hurtE(e, dm, c.vx * kb, c.vz * kb, sp > 14); G.swH++; if (e.dead) G.swK++;
        fxSparks((e.x + c.x) / 2, (e.z + c.z) / 2, sp > 14 ? 7 : 4, 0xffd23f); sfx.hit(); if (sp > 14) addShake(0.08); c.vx *= 0.85; c.vz *= 0.85; continue;
      }
      if ((e.cc || 0) > G.t) continue; e.cc = G.t + 0.6;
      if (e.k === 5) { carHurt(c, ed.dmg * 1.2); kill(e); if (c.dead) break; continue; }
      carHurt(c, ed.dmg * (ed.boss ? 1 : 0.6)); hurtE(e, S.dmg * d.grind, dx / dd * 5, dz / dd * 5); fxSparks((e.x + c.x) / 2, (e.z + c.z) / 2, 3); if (c.dead) break;
    }
  }
  if (CARS.some(c => c.dead)) { let n = 0; for (const c of CARS) if (!c.dead) CARS[n++] = c; CARS.length = n; }
}
// 投げる（車両が2両以上のときの必殺。ゲージは要らない）: 磁石を切って、つないだ残骸を全部まとめて群れに投げつける。着地ごとに爆発
function packAt() { // 自機の近く（18以内）でいちばん密な群れの中心
  let best = null, bn = 0; const L = E.filter(e => !e.dead && e.drop <= 0 && (e.x - P.x) ** 2 + (e.z - P.z) ** 2 < 324);
  for (const a of L) { let n = 0, x = 0, z = 0; for (const b of L) if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 < 30) { n++; x += b.x; z += b.z; } if (n > bn) { bn = n; best = [x / n, z / n]; } }
  return best;
}
function flingAt() { // 投げる先: PCで照準ありならカーソル（4〜22）、それ以外はいちばん密な群れ → 狙っている敵 → 前方
  if (!I.touch && !I.auto && !I.ext) { const dx = I.ax - P.x, dz = I.az - P.z, d = Math.hypot(dx, dz) || 1, r = clamp(d, 4, 22); return [P.x + dx / d * r, P.z + dz / d * r]; }
  const c = packAt(); if (c) return c; if (tgt && !tgt.dead) return [tgt.x, tgt.z]; return [P.x + Math.sin(P.ry) * 10, P.z + Math.cos(P.ry) * 10];
}
function fling() {
  const [tx, tz] = flingAt(), n = CARS.length, v = { n, left: n, kills: 0, x: tx, z: tz };
  const near = E.filter(e => !e.dead && e.drop <= 0 && (e.x - tx) ** 2 + (e.z - tz) ** 2 < 49).sort((a, b) => ((a.x - tx) ** 2 + (a.z - tz) ** 2) - ((b.x - tx) ** 2 + (b.z - tz) ** 2));
  CARS.forEach((c, i) => { // 1両ずつ別の敵を狙う。敵が足りなければ印のまわりに散らす
    const e = i < near.length ? near[i] : null, a = rnd() * 6.283, r = i ? rr(1, 3) : 0, x1 = e ? e.x : tx + Math.sin(a) * r, z1 = e ? e.z : tz + Math.cos(a) * r, d = Math.hypot(x1 - c.x, z1 - c.z);
    FL.push({ k: c.k, x: c.x, z: c.z, y: 0, x0: c.x, z0: c.z, x1, z1, e, t: 0, T: 0.42 + d / 45 + i * 0.06, h: 2.5 + d * 0.16, ry: c.ry, spin: rr(8, 13) * (rnd() < 0.5 ? -1 : 1), v });
  });
  const [ax, az] = anchor(); CARS.length = 0; G.throws++; P.recoil = 1.6;
  ring(ax, az, 3, 0x8fe3ff); fxSparks(ax, az, 10, 0x8fe3ff); flash(ax, az, 6, 0x8fe3ff); sfx.special(); addShake(0.25);
  ev('sp', { s: Math.round(G.t), th: 1, cars: n }); once('throw', { s: Math.round(G.t), cars: n });
}
function landScrap(f) {
  const d = CT[f.k], v = f.v, R = d.fR * (1 + 0.04 * Math.min(10, v.n)), dm = S.dmg * d.fD * (1 + 0.06 * (v.n - 1)) * (1 + 0.35 * (u.loopx || 0)), x = f.x1, z = f.z1;
  for (const e of E) {
    if (e.dead || e.drop > 0) continue; const dx = e.x - x, dz = e.z - z, q = dx * dx + dz * dz; if (q > (R + e.r) ** 2) continue;
    const dd = Math.sqrt(q) || 1, boss = ET[e.k].boss, hd = dm * (boss ? 0.6 : 1); e.crush = !boss && hd >= e.hp; hurtE(e, hd, dx / dd * 7, dz / dd * 7, true); e.crush = false; if (e.dead) v.kills++;
  }
  for (const b of W.blocks) if (b.hp > 0 && b.t !== W.WALL && (b.x - x) ** 2 + (b.z - z) ** 2 < R * R) W.damageBlock(b, 999); // 木箱やドラム缶も壊れる（ドラム缶は誘爆）
  const col = d.bomb ? 0xff5b6b : 0xffd23f;
  fxExplode(x, z, R * 0.75); fxBlast(x, z, R / 3); fxShock(x, z, R * 1.5, col); flash(x, z, 6 + R, d.bomb ? 0xff6a3a : 0xffc040); burst(x, 1, z, 14, 0x8a6446, 11, 0.32, 0.8, 1.2, 0.5);
  addShake(d.bomb ? 0.45 : 0.25); sfx.boom(true);
  if (--v.left > 0) return; // 最後の1両が落ちたら、まとめて倒した数を出す
  G.crushed += v.kills; if (v.kills >= 2) popText(v.x, v.z, '×' + v.kills + ' ' + jaEn('まとめて撃破！', 'CRUSHED!')); if (v.kills >= 5) G.slowT = Math.max(G.slowT, 0.25);
  if (v.kills && !save.th1) { save.th1 = 1; persist(); }
}
function hurtE(e, d, kx, kz, big) {
  if (e.dead || e.drop > 0) return; if (ET[e.k].boss) charge(Math.min(d, e.hp) / e.max * 0.8); e.hp -= d; e.hitT = 0.1;
  if (e.crush) { } else if (!big && e.dn && e.dn.t < 0.12 && !e.dn.big) { e.dn.v += Math.max(1, Math.round(d)); e.dn.t = 0; } else e.dn = dmgNum(e.x, e.z, d, big); // ダメージの数字（続けざまの命中はまとめる）
  const m = ET[e.k].boss ? 0 : e.k === 2 ? 0.35 : 1; e.kx += kx * m; e.kz += kz * m;
  if (e.hp <= 0) kill(e);
}
function kill(e) { // 投げた残骸で倒すと歯車が倍、スクラップ +1
  e.dead = true; const d = ET[e.k]; if (e.crush && !d.boss) { K.push({ x: e.x, z: e.z, v: d.xp, t: 0, heal: false, vac: false }); G.scrap++; } G.kills++; if (!d.boss && !e.crush) charge(d.xp * 0.035); once('kill', { s: Math.round(G.t) }); { const bx = d.sc * 0.15 * u.scav, sc = d.sc + Math.floor(bx) + (rnd() < bx % 1 ? 1 : 0); G.scrap += sc; MT.dailyAdd('scrap', sc); } MT.dailyAdd('kills', 1);
  const bs = !!d.boss, big = bs || e.k === 2, sm = e.k === 0 || e.k === 4;
  const R = sm ? 2.5 : bs ? 6 : e.k === 2 || e.k === 5 ? 3.8 : 3; // 爆発の大きさ（倒した手応えが出るよう、敵の見た目より大きめ）
  burst(e.x, 0.8, e.z, sm ? 12 : bs ? 46 : 18, d.col, big ? 12 : 10, bs ? 0.4 : big ? 0.34 : 0.26, 0.8, 1.3, 0.35);
  burst(e.x, 0.8, e.z, bs ? 14 : 5, 0x4a4d5c, bs ? 10 : 8, bs ? 0.44 : 0.24, 0.9, 1.3, 0.6); fxExplode(e.x, e.z, R); fxBlast(e.x, e.z, R / 3); if (!dropSalv(e)) wreck(e);
  if (!bs) { VQ.push({ x: e.x + rr(-0.9, 0.9), z: e.z + rr(-0.9, 0.9), t: rr(0.08, 0.14), R: R * 0.55, quiet: true }); if (!sm) VQ.push({ x: e.x + rr(-1.2, 1.2), z: e.z + rr(-1.2, 1.2), t: rr(0.2, 0.28), R: R * 0.45, quiet: true }); } // 遅れて小さな誘爆
  if (bs) G.slowT = 0.9;
  if (bs) for (let j = 0; j < 7; j++) { const a = j * 2.4; VQ.push({ x: e.x + Math.sin(a) * e.r * rr(0.4, 1.1), z: e.z + Math.cos(a) * e.r * rr(0.4, 1.1), t: 0.15 + j * 0.17, R: j === 6 ? 4.5 : rr(2, 3.2) }); }
  ring(e.x, e.z, e.r * 2.8, 0xffd08a); if (big || e.k === 5) { ring(e.x, e.z, e.r * 4); addShake(bs ? 1 : 0.35); sfx.boom(true); } else { sfx.boom(false); addShake(0.13); }
  if (e.k === 5) explode(e.x, e.z, 3.4, 30); // 自爆車は倒すと周りの敵を巻き込む
  if (u.vamp && !P.dead) P.hp = Math.min(S.maxhp, P.hp + 0.5 * u.vamp);
  const n = bs ? 14 : e.k === 2 ? 3 : 1;
  for (let i = 0; i < n; i++) K.push({ x: e.x + rr(-1, 1) * (n > 1 ? e.r : 0.2), z: e.z + rr(-1, 1) * (n > 1 ? e.r : 0.2), v: bs ? 2 : e.k === 2 ? (i === 0 ? 3 : 1) : d.xp, t: 0, heal: false, vac: false });
  if (bs) win();
}
export function explode(x, z, R, d) {
  ring(x, z, R); fxExplode(x, z, R); burst(x, 1, z, 5, 0x4a4f66, 8, 0.3, 0.9, 1, 0.6);
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
// 敵の攻撃の強さ: 序盤の波は弱め、拠点3から上乗せ、続けて負けると弱める
const eDm = () => Math.min(1, 0.5 + 0.17 * Math.max(0, G.wave) + 0.15 * (G.stage - 1)) * (1 + TUNE.dmX * Math.max(0, G.stage - 2)) * (1 - TUNE.as * G.as);
function hurt(d) {
  if (G.inv > 0 || G.state !== 'play') return;
  if (S.gear === 'shield' && P.sh <= 0) { P.sh = 8; G.inv = 0.6; ring(P.x, P.z, 3.2, 0x8fe3ff); burst(P.x, 1, P.z, 10, 0x8fe3ff, 8, 0.3, 0.4); sfx.hit(); return; }
  P.hp -= d * S.plate * eDm(); G.inv = 0.45; UI.vignette(); addShake(0.3); sfx.hurt(); burst(P.x, 1, P.z, 5, 0xffb21e, 6, 0.3, 0.4);
  if (P.hp <= 0) {
    P.hp = 0; P.dead = true; G.state = 'dead'; G.endT = 1.3; G.slowT = 0.6; tank.g.visible = true; charTank(tank, true); WK.push({ k: -1, x: P.x, z: P.z, t: 0.3, st: 0, big: true }); fxExplode(P.x, P.z, 5);
    burst(P.x, 1, P.z, 40, 0xffb21e, 12, 0.5, 0.9); burst(P.x, 1, P.z, 16, 0x39405c, 9, 0.5, 1); ring(P.x, P.z, 6); addShake(1); sfx.boom(true); sfx.lose();
    for (let i = 0; i < CARS.length; i++) VQ.push({ x: CARS[i].x, z: CARS[i].z, t: 0.25 + i * 0.12, R: CARS[i].k === 2 ? 3.2 : 2.4 }); CARS.length = 0;
    platform.gameplayStop();
  }
}
function win() {
  G.state = 'win'; G.endT = 2.4; G.won = true; G.scrap += 30 + 10 * G.stage; MT.dailyAdd('win', 1); MT.dailyAdd('scrap', 30 + 10 * G.stage); UI.setBoss(-1);
  for (const e of E) if (!e.dead) { e.dead = true; burst(e.x, 0.8, e.z, 7, ET[e.k].col, 8, 0.26, 0.7, 1, 0.3); fxExplode(e.x, e.z, 1.6); wreck(e); }
  for (const b of B) b.dead = true; for (const k of K) k.vac = true; H.length = 0;
  UI.banner(jaEn('拠点を奪還！', 'BASE RECLAIMED!'), true); sfx.win(); platform.gameplayStop(); platform.happyTime();
}
function addXp(v) { G.xp += v / G.xpD; // 後の拠点は敵が多いぶん1体の経験値を割り引き、レベルアップの回数をそろえる
  while (G.xp >= need(G.lvl)) { G.xp -= need(G.lvl); G.lvl++; G.pend++; MT.dailyAdd('lvl', G.lvl); } }
function openLevelUp() {
  const pool = UPS.filter(d => u[d.id] < d.max);
  if (!pool.length) { G.pend = 0; P.hp = Math.min(S.maxhp, P.hp + 30); return; }
  const ch = [], take = list => { while (ch.length < 3 && list.length) { const d = list.splice((rnd() * list.length) | 0, 1)[0]; ch.push(d); pool.splice(pool.indexOf(d), 1); } };
  if (G.lvl <= 3) take(pool.filter(d => VIS.includes(d.id))); // 最初の2回は、選ぶと見た目が変わる強化だけを出す（手応えがすぐ分かるように）
  take(pool.slice());
  G.state = 'levelup'; G.choices = ch; sfx.lvl(); once('lvl', { s: Math.round(G.t) });
  UI.showLevelUp(ch.map(d => ({ name: jaEn(d.ja[0], d.en[0]), desc: jaEn(d.ja[1], d.en[1]), icon: d.icon, col: d.col, lv: u[d.id] + 1, max: d.max })), G.lvl, pickUp);
}
export function pickUp(i) {
  if (G.state !== 'levelup') return; const d = G.choices[i]; if (!d) return;
  u[d.id]++; const hp0 = S.maxhp; recalc(); if (d.id === 'armor') P.hp = Math.min(S.maxhp, P.hp + 25 + (S.maxhp - hp0) * 0); if (d.id === 'carhp') for (const c of CARS) { c.max = carMax(c.k); c.hp = c.max; }
  G.pend--; G.inv = 0.7; sfx.ui(); UI.hideAll(); ring(P.x, P.z, 4, 0x8fe3ff);
  if (G.pend > 0) openLevelUp(); else G.state = 'play';
}
// 基地に戻る（一時停止の画面から）: 出撃をやめて結果とガレージへ。集めたスクラップは持ち帰り、やられたわけではないので連敗の数には入れない
export function retreat() { if (G.state !== 'play') return false; G.home = true; platform.gameplayStop(); showResult(); return true; } // 自動の一時停止からだと gameplayStop がまだなのでここで送る（2回目は platform が無視する）
function showResult() {
  MT.loginTick(); const sup = MT.supplyTick(); if (sup.arrived) G.arrived = sup.arrived;
  let unl = []; bank(); save.lose = G.won ? null : G.home ? save.lose : { s: G.stage, n: (save.lose && save.lose.s === G.stage ? save.lose.n : 0) + 1 }; if (G.won) { save.stage++; if (save.stage > save.best) { save.best = save.stage; unl = MT.unlockedAt(save.best); } } persist();
  G.state = 'result';
  ev('end', { run: save.runs, stage: G.stage, wave: G.wave, sp: G.spN, pz: G.pzN, as: G.as, won: G.won ? 1 : 0, home: G.home ? 1 : 0, s: Math.round(G.t), lvl: G.lvl, kills: G.kills, throws: G.throws, links: G.links, crushed: G.crushed, swk: G.swK, x: Math.round(P.x), z: Math.round(P.z), sup: sup.next || '' }); if (G.won) once('win', { run: save.runs }); flush();
  music('calm'); musicVol(0.45);
  const nx = themeOf(save.stage); UI.showResult({ place: jaEn(TH.ja, TH.en), next: jaEn(nx.ja, nx.en), nextStage: save.stage, win: G.won, home: G.home, stage: G.stage, wave: Math.min(G.wave + 1, NWAVE), boss: G.wave >= NWAVE, t: G.t, kills: G.kills, lvl: G.lvl, earned: G.scrap, arrived: G.arrived, supply: sup.next, unlocked: unl }, { buy: buyGar, go: startRun }); G.arrived = null;
}
function buyGar(k) {
  const lv = save.up[k], c = garCost(lv); if (lv >= GAR_MAX || save.scrap < c) return false;
  save.scrap -= c; save.up[k]++; persist(); sfx.buy(); return true;
}

// 初回の案内: 「動く → 撃つ」を1つずつ、できるまで消さない（PC）。スマホは動くまで
function tutorial() {
  if (I.moved) once('move', { s: Math.round(G.t), by: I.touch ? 'touch' : I.auto ? 'mouse' : 'keys' });
  if (G.tut >= 2) return;
  if (I.touch) { if (I.moved && G.t > 3) { G.tut = 2; UI.hint(null); } else UI.hint(UI.ICON.drag + jaEn('ドラッグで移動　攻撃は自動', 'Drag to move. Firing is automatic'), true); return; }
  if (G.tut === 0) { if (I.moved) { G.tut = 1; G.tutT = G.t; } else UI.hint(UI.ICON.mouse + (I.lock ? jaEn('マウスを動かした方向へ進む　<b>クリックで止まる</b>', 'Move the mouse to steer. <b>Click to stop</b>') : jaEn('マウスを動かすと戦車がついてくる', 'Move the mouse. Your tank follows')), true); }
  if (G.tut === 1) { if (G.kills >= 2 && G.t - G.tutT > 2) { G.tut = 2; UI.hint(null); } else UI.hint(UI.ICON.aim + (I.auto ? jaEn('射撃は自動　動き回って敵をかわそう', 'Firing is automatic. Keep moving!') : jaEn('マウスで狙う　射撃は自動', 'Aim with the mouse. Firing is automatic')), G.kills < 1); }
}
// 列車の案内（一度投げて倒すまで）: 磁石で残骸をつかむ → 曲がって振る → 投げる
function trainTut() {
  if (G.tut < 2) return; if (save.th1) { if (!G.tutL) { G.tutL = 1; UI.hint(null); } return; } // 一度投げて倒したら案内を消す
  if (!CARS.length) { if (SV.length) UI.hint(UI.ICON.link + jaEn('光る残骸に近づくと、磁石でくっつく', 'Get close to a glowing wreck. Your magnet grabs it'), true); else UI.hint(null); return; }
  if (CARS.length < 2) { UI.hint(UI.ICON.link + jaEn('曲がると鎖が振れて敵をなぎ払う　もう1両で「投げる」', 'Turn to swing the chain into enemies. One more car unlocks THROW'), false); return; }
  UI.hint(UI.ICON.loop + (I.touch ? jaEn('「投げる」ボタンで、残骸を黄色い印に投げつける', 'Tap THROW to hurl your wrecks at the yellow mark') : jaEn('<kbd>Space</kbd> か右クリックで、残骸を黄色い印に投げつける', 'Press <kbd>Space</kbd> or right-click to hurl your wrecks at the yellow mark')), true);
}
// ドラム缶に触れると磁石でくっつき、爆弾車になる
const grab = b => { if (b.t === W.BARREL && b.hp > 0 && G.state === 'play' && CARS.length < trainMax()) { W.take(b); attach({ k: 3, x: b.x, z: b.z, ry: rnd() * 6.283 }); } };
function findTarget() { // スマホ用の自動照準: 近い敵 → 近い木箱・ドラム缶
  let best = null, bd = (S.bspd * S.blife + 1) ** 2;
  for (const e of E) { if (e.dead || e.drop > 0) continue; const d = (e.x - P.x) ** 2 + (e.z - P.z) ** 2; if (d < bd) { bd = d; best = e; } }
  if (best) return best; bd = 81;
  for (const b of W.blocks) { if (b.hp <= 0 || b.t === W.WALL) continue; const d = (b.x - P.x) ** 2 + (b.z - P.z) ** 2; if (d < bd) { bd = d; best = b; } }
  return best;
}

export function update(dt) {
  if (G.state === 'boot' || G.state === 'hold' || G.state === 'levelup' || G.state === 'result') return;
  const live = G.state === 'play';
  if (live) G.t += dt;
  if (G.inv > 0) G.inv -= dt;
  // 体力が赤（20%未満）の間は緊迫曲。回復しても少しの間は続けて、曲が細かく切り替わらないようにする
  if (live) { if (P.hp / S.maxhp < 0.2) G.dng = 2.5; else if (G.dng > 0) G.dng -= dt; music(G.dng > 0 ? 'danger' : 'calm'); musicVol(1); }
  else { music('calm'); musicVol(0.45); }
  // ---- 自機 ----
  if (live) {
    const wet = W.inWater(P.x, P.z), spd = S.speed * (wet ? 0.62 : 1);
    { const k = 1 - Math.exp(-(I.touch ? 14 : I.mx || I.mz ? 30 : 13) * dt); P.vx += (I.mx * spd - P.vx) * k; P.vz += (I.mz * spd - P.vz) * k; }
    if (I.mx || I.mz) { G.dustT -= dt; if (G.dustT <= 0) { G.dustT = 0.07; const bx = P.x - Math.sin(P.ry) * 1.1, bz = P.z - Math.cos(P.ry) * 1.1; if (wet) { fxSplash(bx, bz, 2); if (rnd() < 0.2) ring(P.x, P.z, 2.2, 0x9fd8ff); } else fxDust(bx, bz, TH.dust, 1); } }
    { const hr = P.hp / S.maxhp; if (hr < 0.3) { G.smkT = (G.smkT || 0) - dt; if (G.smkT <= 0) { G.smkT = 0.13; fxWreck(P.x, P.z, hr < 0.15 ? 0.5 : 1.3, false); } } } // 体力が少ないと自機から煙と炎
    const ax0 = P.vx0 || 0, az0 = P.vz0 || 0, acx = (P.vx - ax0) / dt, acz = (P.vz - az0) / dt, fw = acx * Math.sin(P.ry) + acz * Math.cos(P.ry), sd = acx * Math.cos(P.ry) - acz * Math.sin(P.ry), kt = 1 - Math.exp(-8 * dt);
    P.pitch += (clamp(-fw * 0.006, -0.09, 0.09) - P.pitch) * kt; P.roll += (clamp(sd * 0.006, -0.08, 0.08) - P.roll) * kt; P.vx0 = P.vx; P.vz0 = P.vz;
    fxAmb(TH.amb, P.x, P.z, dt);
    P.x += P.vx * dt; P.z += P.vz * dt; if (I.mx || I.mz) P.ry = angLerp(P.ry, Math.atan2(I.mx, I.mz), 1 - Math.exp(-10 * dt)); W.pushOut(P, 1.0, grab);
    if (I.click) { I.click = false; if (I.dest) ring(I.dest.x, I.dest.z, 1.5, 0x8fe3ff); }
    { const mv = Math.hypot(P.x - P.px, P.z - P.pz); P.odo += mv; P.px = P.x; P.pz = P.z; I.px = P.x; I.pz = P.z; if (I.dest && mv < spd * dt * 0.2) { P.stuck = (P.stuck || 0) + dt; if (P.stuck > 0.5) I.dest = null; } else P.stuck = 0; if (mv < 2) { moveTracks(tank, mv); P.markD += mv; if (wet) P.markD = 0; else if (P.markD > 0.55) { addMark(P.x, P.z, P.ry, P.markD + 0.05); P.markD = 0; } } }
    let fire = I.ext ? I.fire : true, aim = P.ty; // PC も射撃は自動（狙いはマウス）。ボットだけ撃つかどうかを指定できる
    if (I.touch || I.auto) {
      tgtT -= dt; if (tgtT <= 0 || !tgt || tgt.dead || tgt.hp <= 0) { tgt = findTarget(); tgtT = 0.15; }
      if (tgt) { aim = Math.atan2(tgt.x - P.x, tgt.z - P.z); fire = true; } else { fire = false; if (I.mx || I.mz) aim = Math.atan2(I.mx, I.mz); }
      P.ty = angLerp(P.ty, aim, 1 - Math.exp(-16 * dt));
    } else { P.ty = Math.atan2(I.ax - P.x, I.az - P.z); }
    P.cd -= dt; if (fire && P.cd <= 0) { P.cd = 1 / S.rate; shoot(); }
    if (S.salvo) { P.sv = (P.sv || 0) - dt; if (P.sv <= 0) { P.sv = 6.5 - S.salvo; const n = 8 + 4 * S.salvo; for (let j = 0; j < n; j++) bullet(P.x, P.z, j / n * 6.283, false, S.dmg * 0.7, S.bspd * 0.8, S.blife); ring(P.x, P.z, 3, 0xff9d3c); } }
    if (S.orbit) { P.oa = (P.oa || 0) + dt * 3.4; for (let j = 0; j < S.orbit; j++) { const a = P.oa + j / S.orbit * 6.283, ox = P.x + Math.sin(a) * 3.3, oz = P.z + Math.cos(a) * 3.3; for (const e of E) { if (e.dead || e.sawT > G.t) continue; const r = e.r + 0.7; if ((e.x - ox) ** 2 + (e.z - oz) ** 2 < r * r) { e.sawT = G.t + 0.35; hurtE(e, S.dmg * 0.8, (e.x - P.x) * 0.6, (e.z - P.z) * 0.6); fxSparks(ox, oz, 3); } } } }
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
    tutorial(); trainTut();
    if (G.t >= G.quietT) { const fr = MT.takeFresh(); if (fr) { UI.toast(fr); sfx.buy(); } }
  }
  P.recoil = Math.max(0, P.recoil - dt * 9);
  // ---- 波 ----
  if (live) {
    if (G.wave < 0) { // 出撃直後: その回の最初はタイトルロゴ（知らせはロゴが消えてから）、それ以外は拠点名
      if (!G.intro && G.t > 0.15) { G.intro = true; if (!logoDone) { logoDone = true; G.quietT = G.t + 2.7; UI.logo(jaEn('敵の波をしのいで、拠点を取り返せ！', 'Survive the waves. Reclaim the base!')); } else UI.banner(jaEn('拠点 ', 'Base ') + G.stage + '　' + jaEn(TH.ja, TH.en), true); }
      if (G.t > 2.1) startWave(0);
    }
    if (G.arrived && G.intro && G.t >= G.quietT) { UI.toast(G.arrived === 'scrap' ? jaEn('補給便が届いた　スクラップ +', 'Supply drop arrived: scrap +') + MT.SUP_SCRAP : jaEn('補給便が届いた　', 'Supply drop arrived: ') + MT.pname(G.arrived) + jaEn(' を装備', ' equipped')); sfx.buy(); G.arrived = null; }
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
    if (e.drop > 0) { e.drop -= dt; if (e.drop <= 0) land(e); continue; }
    e.born += dt; if (e.hitT > 0) e.hitT -= dt; if (e.hc > 0) e.hc -= dt;
    let dx = P.x - e.x, dz = P.z - e.z; const dist = Math.hypot(dx, dz) || 1; dx /= dist; dz /= dist;
    let mx = dx, mz = dz;
    // 体当たりの敵は、自機より近い車両があればそちらに群がる（列がおとりになり、輪を閉じると巻き込める）
    if (!d.boss && e.k !== 1 && e.k !== 6 && CARS.length) {
      if ((e.tgT = (e.tgT || 0) - dt) <= 0) { e.tgT = 0.35; e.tc = null; let bd = dist * dist * 0.75; for (const c of CARS) { const q = (c.x - e.x) ** 2 + (c.z - e.z) ** 2; if (q < bd) { bd = q; e.tc = c; } } }
      if (e.tc && !e.tc.dead) { const cx = e.tc.x - e.x, cz = e.tc.z - e.z, cd = Math.hypot(cx, cz) || 1; mx = cx / cd; mz = cz / cd; } else e.tc = null;
    }
    if (e.k === 1) { if (dist < 8) { mx = -dx; mz = -dz; } else if (dist < 13) { mx = -dz * e.strafe; mz = dx * e.strafe; } }
    else if (e.k === 6) { if (dist < 12) { mx = -dx; mz = -dz; } else if (dist < 17) { mx = -dz * e.strafe * 0.6; mz = dx * e.strafe * 0.6; } }
    else if (e.k === 4) { const w = Math.sin(e.born * 4.5 + e.cd) * 0.75; mx = dx - dz * w; mz = dz + dx * w; }
    let esm = e.slow > 0 ? (e.slow -= dt, d.boss ? 0.8 : 0.55) : 1;
    if (d.boss) {
      if (live) bossAI(e, dt, dx, dz);
      if (e.dash > 0) { e.dash -= dt; mx = e.dx; mz = e.dz; esm *= 16 / d.sp; }
      else if (e.hold > 0) { e.hold -= dt; mx = mz = 0; }
    }
    if (!live) { mx = mz = 0; }
    const dk = Math.exp(-6 * dt); e.kx *= dk; e.kz *= dk;
    const es = d.sp * esm * (W.feat.river && W.inWater(e.x, e.z) ? 0.7 : 1);
    e.x += (mx * es + e.kx) * dt; e.z += (mz * es + e.kz) * dt;
    e.ry = angLerp(e.ry, e.k === 1 || e.k === 6 || (d.boss && !(e.dash > 0)) ? Math.atan2(dx, dz) : Math.atan2(mx || dx, mz || dz), 1 - Math.exp(-8 * dt));
    e.ta = angLerp(e.ta ?? e.ry, d.boss && e.ca !== undefined && (e.mv === 'snipe' || e.mv === 'charge') ? e.ca : Math.atan2(dx, dz), 1 - Math.exp(-7 * dt)); // 砲塔は自機（ボスは狙っている向き）を向く
    W.pushOut(e, e.r, b => W.damageBlock(b, d.chew * dt));
    if (!live) continue;
    if (e.k === 1) { e.cd -= dt; if (e.cd <= 0 && dist < 19) { e.cd = d.shoot; fxMuzzle(e.x + dx * 1.3, e.z + dz * 1.3, Math.atan2(dx, dz), 0xff3a7a); bullet(e.x + dx * 1.2, e.z + dz * 1.2, Math.atan2(dx, dz), true, d.dmg, 11, 2.4); } }
    if (e.k === 6) { e.cd -= dt; if (e.cd <= 0 && dist < 26) { e.cd = d.shoot; const a = Math.atan2(dx, dz); fxMuzzle(e.x + dx * 1.5, e.z + dz * 1.5, a, 0x6f8cff); bullet(e.x + dx * 1.4, e.z + dz * 1.4, a, true, d.dmg, 14, 2.3); } }
    if (dist < e.r + 1.0 && e.hc <= 0) { e.hc = 0.7; hurt(d.dmg); e.kx -= dx * 9; e.kz -= dz * 9; if (e.k === 5) { kill(e); continue; } }
  }
  for (let i = 0; i < E.length; i++) { // 敵どうしの押し合い
    const a = E[i]; if (a.dead) continue;
    for (let j = i + 1; j < E.length; j++) {
      const b = E[j]; if (b.dead) continue; const dx = b.x - a.x, dz = b.z - a.z, r = a.r + b.r; if (dx > r || dx < -r || dz > r || dz < -r) continue;
      const d2 = dx * dx + dz * dz; if (d2 >= r * r || d2 < 1e-6) continue; const d = Math.sqrt(d2), p = (r - d) / d * 0.5;
      const wa = ET[a.k].boss ? 0 : ET[b.k].boss ? 2 : 1, wb = 2 - wa; a.x -= dx * p * wa; a.z -= dz * p * wa; b.x += dx * p * wb; b.z += dz * p * wb;
    }
  }
  updTrain(dt, live);
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
    if (b.foe) { if (live && (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < 1.1) { b.dead = true; hurt(b.dmg); } else for (const c of CARS) { const r = CT[c.k].r; if (!c.dead && (b.x - c.x) ** 2 + (b.z - c.z) ** 2 < r * r) { b.dead = true; carHurt(c, b.dmg); fxSparks(b.x, b.z, 2); break; } } continue; }
    for (let j = 0; j < E.length; j++) {
      const e = E[j]; if (e.dead || e.born < 0.15) continue; const dx = e.x - b.x, dz = e.z - b.z, r = e.r + 0.35;
      if (dx * dx + dz * dz > r * r || (b.hit && b.hit.includes(e))) continue;
      const sp = Math.hypot(b.vx, b.vz); if (S.frost) e.slow = 1 + 0.6 * S.frost; const crit = b.dmg > S.dmg * 1.5; if (crit) ring(e.x, e.z, 1.6, 0xffd23f); hurtE(e, b.dmg, b.vx / sp * 4, b.vz / sp * 4, crit); sfx.hit();
      fxHit(b.x, b.z);
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
  if (live && I.sp) special(); I.sp = false;
  for (let i = SQ.length - 1; i >= 0; i--) { const q = SQ[i]; q.t -= dt; if (q.t <= 0) { SQ.splice(i, 1); explode(q.x, q.z, q.R, q.d); flash(q.x, q.z, q.R, 0xffd08a); burst(q.x, 1, q.z, q.R > 6 ? 30 : 10, 0xffb21e, 13, 0.42, 0.8, 1, 0.7); if (q.R > 6) { addShake(0.8); fxShock(q.x, q.z, q.R, 0x8fe3ff); } } }
  for (let i = boomQ.length - 1; i >= 0; i--) { const q = boomQ[i]; q.t -= dt; if (q.t <= 0) { boomQ.splice(i, 1); explode(q.x, q.z, 5, 70); } }
  for (let i = VQ.length - 1; i >= 0; i--) { const q = VQ[i]; q.t -= dt; if (q.t <= 0) { VQ.splice(i, 1); fxExplode(q.x, q.z, q.R); if (q.quiet) { burst(q.x, 1, q.z, 4, 0x4a4d5c, 8, 0.22, 0.7, 1.2, 0.7); continue; } burst(q.x, 1, q.z, 8, 0x4a4d5c, 10, 0.32, 0.9, 1.3, 0.7); addShake(q.R > 4 ? 0.7 : 0.25); sfx.boom(q.R > 4); if (q.R > 4) ring(q.x, q.z, 9); } }
  for (let i = WK.length - 1; i >= 0; i--) { const w = WK[i], L = w.big ? WKL[1] : WKL[0]; w.t += dt; if (w.t > L) { WK.splice(i, 1); continue; } if (w.pop && w.vy !== 0) { w.vy -= 22 * dt; w.tx += w.vx * dt; w.tz += w.vz * dt; w.ty += w.vy * dt; w.ta += dt * 7; if (w.ty <= w.land && w.vy < 0) { w.ty = w.land; w.vy = 0; } } if ((w.st -= dt) <= 0 && w.t < L - 1.1) { w.st = w.big ? 0.1 : 0.17; fxWreck(w.x, w.z, w.t, w.big); } }
  for (let i = H.length - 1; i >= 0; i--) { // 着弾
    const h = H[i]; h.t += dt; if (h.t < h.T) continue; H.splice(i, 1);
    fxExplode(h.x, h.z, h.r); ring(h.x, h.z, h.r * 1.4, 0xff5b6b); sfx.boom(false); addShake(0.15);
    if ((P.x - h.x) ** 2 + (P.z - h.z) ** 2 < (h.r + 0.4) ** 2) hurt(h.dmg);
  }
  setWarn(H, LN); LN.length = 0;
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
  for (const it of instE) it.begin(); for (const it of instT) it.begin();
  for (const e of E) { const fall = e.drop > 0, s = fall ? 1 : Math.min(1, e.born * 3.5) * (e.hitT > 0 ? 1.12 : 1), c = e.hitT > 0 ? 2.6 : 1, y = fall ? (e.drop / DROP) ** 2 * 34 : 0; instE[e.k].put(e.x, y, e.z, e.ry, s, s, c, c, c); instT[e.k].put(e.x, y, e.z, e.ta ?? e.ry, s, s, c, c, c); }
  for (const w of WK) { // 残骸: 赤熱から黒く冷え、最後は地面に沈む
    if (w.k < 0) continue; // 自機の残骸は自機のモデルを焦がして使う
    const L = w.big ? WKL[1] : WKL[0], f = clamp((w.t - L + 1.1) / 1.1, 0, 1), h = clamp(1 - w.t / 1.2, 0, 1), y = -f * f * (w.big ? 2.4 : 1.2), r = 0.09 + 2.4 * h * h, g = 0.085 + 0.7 * h * h, b = 0.085;
    instE[w.k].put(w.x, y, w.z, w.ry, 1, 0.8, r, g, b); instT[w.k].put(w.x + w.tx, y + w.ty - (w.pop ? 0 : 0.12 * ESC[w.k]), w.z + w.tz, w.ta, 1, 0.85, r, g, b);
  }
  for (const it of instE) it.end(); for (const it of instT) it.end();
  // 列車: 車両、鎖、落ちている残骸とその目印
  for (const it of instCB) it.begin(); for (const it of instCT) it.begin(); instLink.begin(); instMark.begin(); instMag.begin();
  if (!P.dead) { const [mx, mz] = anchor(), g = 1 + (FL.length ? 1.5 : 0); instMag.put(mx, 0, mz, P.ry, 1, 1, g, g, g); }
  let lx = P.x - Math.sin(P.ry) * 1.35 * tank.sc / 0.8, lz = P.z - Math.cos(P.ry) * 1.35 * tank.sc / 0.8, li = 0;
  for (const c of CARS) {
    const h = c.hitT > 0 ? 2.4 : 1, w = c.hp / c.max < 0.35 ? 0.6 : 1; instCB[c.k].put(c.x, 0, c.z, c.ry, 1, 1, h * w, h * w, h * w);
    if (c.k === 3) instCT[3].put(c.x, 0, c.z, c.ry, 1, 1, h, h, h); else instCT[c.k].put(c.x, 0, c.z, c.ta, 1, 1, PC[0] * h, PC[1] * h, PC[2] * h);
    const hl = CT[c.k].hl, fx = c.x + Math.sin(c.ry) * hl, fz = c.z + Math.cos(c.ry) * hl, dx = fx - lx, dz = fz - lz, L = Math.hypot(dx, dz), n = Math.max(1, Math.round(L / 0.38)), a = Math.atan2(dx, dz);
    for (let j = 0; j < n; j++) { const f = (j + 0.5) / n; instLink.put(lx + dx * f, 0.6, lz + dz * f, a, li & 1 ? 0.75 : 1.1, li++ & 1 ? 1.6 : 0.8); }
    lx = c.x - Math.sin(c.ry) * hl; lz = c.z - Math.cos(c.ry) * hl;
  }
  for (const v of SV) {
    if (v.t > 11 && ((v.t * 7) | 0) % 2 === 0) continue; const g = 0.2, p = 1 + 0.12 * Math.sin(time * 6 + v.x), b = 1 + 0.35 * Math.sin(time * 6 + v.x);
    instCB[v.k].put(v.x, 0, v.z, v.ry, 1, 0.92, g, g * 0.9, g * 0.82); instCT[v.k].put(v.x, 0, v.z, v.ry + 0.5, 1, 0.92, g, g, g); instMark.put(v.x, 0.12, v.z, 0, p, 1, 1.5 * b, 1.05 * b, 0.12 * b);
  }
  for (const f of FL) { const s = 1 + f.y * 0.07; instCB[f.k].put(f.x, f.y, f.z, f.ry, s, s, 1, 1, 1); if (f.k === 3) instCT[3].put(f.x, f.y, f.z, f.ry, s, s, 1, 1, 1); else instCT[f.k].put(f.x, f.y, f.z, f.ry, s, s, PC[0], PC[1], PC[2]); } // 投げて飛んでいる残骸
  instRope.begin();
  if (CARS.length >= 2 && !P.dead && G.state === 'play') { // 投げる先の印（黄色い点線の円と十字）
    if ((G.planT = (G.planT || 0) - 1 / 60) <= 0 || !G.plan) { G.planT = 0.1; G.plan = flingAt(); }
    const [cx, cz] = G.plan, R = 3.2, n = 26, b = 1.3 * (1 + 0.25 * Math.sin(time * 7));
    for (let i = 0; i < n; i++) { const a = i / n * 6.283 + time * 0.8; instRope.put(cx + Math.sin(a) * R, 0.07, cz + Math.cos(a) * R, a + Math.PI / 2, 1, 1, 2.2 * b, 1.6 * b, 0.25 * b); }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + time * 0.8; for (const r of [1.0, 1.6]) instRope.put(cx + Math.sin(a) * r, 0.07, cz + Math.cos(a) * r, a, 1, 1, 2.2 * b, 1.6 * b, 0.25 * b); }
  }
  instRope.end();
  for (const it of instCB) it.end(); for (const it of instCT) it.end(); instLink.end(); instMark.end(); instMag.end();
  for (const it of instB) it.begin();
  for (const b of W.blocks) { if (b.hp <= 0) continue; const s = b.hitT > 0 ? 0.9 : 1, c = 0.6 + 0.4 * (b.hp / b.max), tl = b.t === W.CRATE ? TH.tc : b.t === W.WALL ? TH.tw : null, tn = tl ? tl[(b.v * tl.length) | 0] : null; instB[b.t].put(b.x, 0, b.z, b.ry, s, (b.hitT > 0 ? 1.08 : 1) * b.sy, tn ? c * tn[0] : c, tn ? c * tn[1] : c, tn ? c * tn[2] : c); }
  for (const it of instB) it.end();
  instBul.begin(); for (const b of B) { const ry = Math.atan2(b.vx, b.vz); if (b.foe) instBul.put(b.x, 1.15, b.z, ry, 1.3, 1.3, 2.0, 0.22, 0.75); else if (b.c === 2) instBul.put(b.x, 1.15, b.z, ry, 1.5, 1.5, 0.5, 1.9, 2.3); else instBul.put(b.x, 1.15, b.z, ry, 1, 1, 1.9, 1.05, 0.25); } instBul.end();
  instGear.begin(); instHeal.begin();
  for (const k of K) { const y = 0.55 + Math.sin(time * 5 + k.x) * 0.12; if (k.heal) instHeal.put(k.x, y + 0.2, k.z, time * 2, 1.2); else instGear.put(k.x, y, k.z, time * 3 + k.z, k.v > 1 ? 1.5 : 1); }
  instGear.end(); instHeal.end();
  instSaw.begin(); for (let j = 0; j < S.orbit && !P.dead; j++) { const a = (P.oa || 0) + j / S.orbit * 6.283; instSaw.put(P.x + Math.sin(a) * 3.3, 1, P.z + Math.cos(a) * 3.3, time * 14, 1); } instSaw.end();
  instMine.begin(); for (const m of M) instMine.put(m.x, 0, m.z, 0, Math.min(1, m.t * 4)); instMine.end();
  UI.legend(!I.touch, I.lock, CARS.length >= 2);
  UI.hud({ hp: P.hp, maxhp: S.maxhp, xp: G.xp, need: need(G.lvl), lvl: G.lvl, wave: G.wave, t: G.t, scrap: save.scrap + G.scrap - G.banked, cars: CARS.length, cap: trainMax(), stage: G.stage, place: jaEn(TH.ja, TH.en), sp: CARS.length >= 2 ? 1 : G.sp, spHint: G.state === 'play' && G.sp >= 1 && !save.sp1 && CARS.length < 2, fling: CARS.length >= 2 });
}
// テストとボット用の状態
function aimPt() { // 予告線のうち自機にいちばん近い点（ボットが線から離れるため）
  const e = G.boss; if (!e || e.dead || (e.mv !== 'snipe' && e.mv !== 'charge') || e.ca === undefined || e.dash > 0) return [];
  const sx = Math.sin(e.ca), sz = Math.cos(e.ca), t = Math.max(0, (P.x - e.x) * sx + (P.z - e.z) * sz), x = e.x + sx * t, z = e.z + sz * t;
  return (x - P.x) ** 2 + (z - P.z) ** 2 < 9 ? [[x, z]] : [];
}
export const carsV = () => CARS.map(c => Math.hypot(c.vx, c.vz)); // 確認用: 車両の速さ
export function giveCars(ks) { for (const k of ks) { const mx = carMax(k); const [ax, az] = anchor(); CARS.push({ k, x: ax - Math.sin(P.ry) * GAP * CARS.length, z: az - Math.cos(P.ry) * GAP * CARS.length, vx: 0, vz: 0, ry: P.ry, ta: P.ry, hp: mx, max: mx, cd: 0.4, hitT: 0, dead: false }); } } // 確認用: 車両をすぐ連結する
export function toBoss() { for (const e of E) e.dead = true; E.length = 0; G.wave = NWAVE - 1; G.wt = 0; startWave(NWAVE); }
export function snapshot() {
  return { state: G.state, paused: !!G.paused, sp: G.sp, spN: G.spN, t: G.t, wave: G.wave, lvl: G.lvl, hp: P.hp, maxhp: S.maxhp, kills: G.kills, scrap: G.scrap, enemies: E.length, bullets: B.length, gears: K.length, x: P.x, z: P.z, won: G.won, stage: G.stage, ups: Object.assign({}, u),
    ch: G.state === 'levelup' ? G.choices.map(d => d.id) : [],
    near: E.slice().sort((a, b) => ((a.x - P.x) ** 2 + (a.z - P.z) ** 2) - ((b.x - P.x) ** 2 + (b.z - P.z) ** 2)).slice(0, 6).map(e => [e.x, e.z, e.k]),
    foe: B.filter(b => b.foe && (b.x - P.x) ** 2 + (b.z - P.z) ** 2 < 64).slice(0, 8).map(b => [b.x, b.z]).concat(H.map(h => [h.x, h.z]), aimPt()),
    boss: G.boss && !G.boss.dead ? { mv: G.boss.mv, hp: G.boss.hp / G.boss.max } : null, haz: H.length,
    swarm: (() => { let x = 0, z = 0, n = 0; for (const e of E) if (!e.dead && (e.x - P.x) ** 2 + (e.z - P.z) ** 2 < 400) { x += e.x; z += e.z; n++; } return n ? [x / n, z / n, n] : null; })(),
    gear: K.slice(0, 40).map(k => [k.x, k.z]), cars: CARS.length, cap: trainMax(), sv: SV.map(v => [v.x, v.z]), throws: G.throws, crushed: G.crushed, links: G.links, swh: G.swH, swk: G.swK, fl: FL.length };
}
