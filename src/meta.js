// ラン外の要素: パーツ（車体・砲塔・特殊装備）、デイリーミッション、明日届く補給便
import { save, persist, jaEn, today } from './core.js';

export const SLOTS = [['hull', '車体', 'Hull'], ['turret', '砲塔', 'Turret'], ['gear', '特殊装備', 'Gear'], ['paint', 'カラー', 'Paint']];
export const PARTS = [
  { id: 'std', slot: 'hull', cost: 0, ja: ['標準車体', 'バランス型'], en: ['Standard', 'Balanced'] },
  { id: 'light', slot: 'hull', cost: 60, ja: ['軽量車体', '速度 +18%　HP -20%'], en: ['Scout', 'Speed +18%, HP -20%'] },
  { id: 'bulk', slot: 'hull', cost: 150, ja: ['重装車体', 'HP +45%　速度 -12%'], en: ['Fortress', 'HP +45%, speed -12%'] },
  { id: 'cannon', slot: 'turret', cost: 0, ja: ['主砲', '標準の1発'], en: ['Cannon', 'Single shell'] },
  { id: 'twin', slot: 'turret', cost: 80, ja: ['連装砲', '2発同時に撃つ'], en: ['Twin Gun', 'Two shells at once'] },
  { id: 'scatter', slot: 'turret', cost: 160, ja: ['散弾砲', '5発ばらまく　短射程'], en: ['Scatter Gun', '5 pellets, short range'] },
  { id: 'laser', slot: 'turret', cost: 260, ja: ['レーザー砲', '高速で3体つらぬく'], en: ['Laser', 'Fast, pierces 3 enemies'] },
  { id: 'none', slot: 'gear', cost: 0, ja: ['装備なし', '—'], en: ['None', '—'] },
  { id: 'mines', slot: 'gear', cost: 70, ja: ['地雷散布', '最初から地雷をまく'], en: ['Minelayer', 'Drops mines from the start'] },
  { id: 'shield', slot: 'gear', cost: 140, ja: ['シールド', '8秒ごとに1回防ぐ'], en: ['Shield', 'Blocks a hit every 8 s'] },
  { id: 'drone', slot: 'gear', cost: 240, ja: ['僚機ドローン', '近くの敵を自動で撃つ'], en: ['Wing Drone', 'Auto-fires at nearby enemies'] },
  { id: 'orange', slot: 'paint', cost: 0, col: 0xd9780f, ja: ['オレンジ', '標準の塗装'], en: ['Orange', 'Factory paint'] },
  { id: 'olive', slot: 'paint', cost: 40, col: 0x6b7a35, ja: ['オリーブ', '定番の軍用色'], en: ['Olive', 'Classic army green'] },
  { id: 'sand', slot: 'paint', cost: 40, col: 0xc9a66b, ja: ['サンド', '砂漠仕様'], en: ['Sand', 'Desert finish'] },
  { id: 'navy', slot: 'paint', cost: 60, col: 0x2f5fa8, ja: ['ネイビー', '海軍風の青'], en: ['Navy', 'Naval blue'] },
  { id: 'crimson', slot: 'paint', cost: 60, col: 0xb8262b, ja: ['クリムゾン', '目立つ赤'], en: ['Crimson', 'Bold red'] },
  { id: 'snow', slot: 'paint', cost: 80, col: 0xe6ebf0, ja: ['スノー', '雪原仕様の白'], en: ['Snow', 'Winter white'] },
  { id: 'gold', slot: 'paint', cost: 300, col: 0xe8b62a, ja: ['ゴールド', '歴戦の証'], en: ['Gold', 'Veteran finish'] },
];
export const paintCol = () => (part(save.parts.paint) || part('orange')).col;
export const part = id => PARTS.find(p => p.id === id);
export const pname = id => { const p = part(id); return p ? jaEn(p.ja[0], p.en[0]) : ''; };
export const pdesc = id => { const p = part(id); return p ? jaEn(p.ja[1], p.en[1]) : ''; };
export const owned = id => { const p = part(id); return !!p && (p.cost === 0 || !!save.own[id]); };
export function equip(id) { const p = part(id); if (!p || !owned(id)) return false; save.parts[p.slot] = id; persist(); return true; }
export function buyPart(id) {
  const p = part(id); if (!p || owned(id) || save.scrap < p.cost) return false;
  save.scrap -= p.cost; save.own[id] = 1; save.parts[p.slot] = id; persist(); return true;
}

// ---- 補給便: 注文した翌日以降に届く。待ち時間で遊びを止めるものではなく、翌日のおまけ ----
const SUP = ['laser', 'drone', 'bulk', 'shield', 'scatter', 'twin', 'light', 'mines'];
export const SUP_SCRAP = 120;
// 戻り値 { arrived: 届いたパーツid か 'scrap' か null, next: 明日届くもの }
export function supplyTick() {
  const t = today(); let arrived = null;
  if (save.supply && t > save.supply.day) {
    arrived = save.supply.id;
    if (arrived !== 'scrap' && !owned(arrived)) { save.own[arrived] = 1; save.parts[part(arrived).slot] = arrived; } else { arrived = 'scrap'; save.scrap += SUP_SCRAP; }
    save.supply = null;
  }
  if (!save.supply && save.runs >= 1) save.supply = { id: SUP.find(id => !owned(id)) || 'scrap', day: t };
  persist(); return { arrived, next: save.supply ? save.supply.id : null };
}

// ---- デイリーミッション: 日付から決まる3つ。達成した瞬間にスクラップが入る ----
export const DAILY_PAY = 30, DAILY_BONUS = 60;
const POOL = [
  { id: 'kills', n: [60, 90, 120], ja: n => `敵を ${n} 体撃破`, en: n => `Destroy ${n} enemies` },
  { id: 'runs', n: [3, 4], ja: n => `${n} 回出撃`, en: n => `Deploy ${n} times` },
  { id: 'win', n: [1, 2], ja: n => `拠点を ${n} つ奪還`, en: n => `Reclaim ${n} base${n > 1 ? 's' : ''}` },
  { id: 'lvl', n: [8, 10], max: true, ja: n => `1回の出撃で Lv ${n} に到達`, en: n => `Reach Lv ${n} in one run` },
  { id: 'crate', n: [25, 40], ja: n => `障害物を ${n} 個壊す`, en: n => `Break ${n} obstacles` },
  { id: 'scrap', n: [150, 250], ja: n => `スクラップを ${n} 集める`, en: n => `Collect ${n} scrap` },
  { id: 'wave', n: [4, 5], max: true, ja: n => `WAVE ${n} に到達`, en: n => `Reach wave ${n}` },
];
const fresh = [];
export function daily() {
  const t = today();
  if (!save.daily || save.daily.day !== t) {
    let s = (t * 2654435761) >>> 0; const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const pool = POOL.slice(), m = [];
    while (m.length < 3) { const d = pool.splice((r() * pool.length) | 0, 1)[0]; m.push({ id: d.id, n: d.n[(r() * d.n.length) | 0], p: 0, done: false }); }
    save.daily = { day: t, m, bonus: false };
  }
  return save.daily;
}
export const dailyText = m => { const d = POOL.find(x => x.id === m.id); return jaEn(d.ja(m.n), d.en(m.n)); };
export function dailyAdd(id, v) {
  const D = daily();
  for (const m of D.m) {
    if (m.id !== id || m.done) continue; const d = POOL.find(x => x.id === id);
    m.p = Math.min(m.n, d.max ? Math.max(m.p, v) : m.p + v);
    if (m.p >= m.n) { m.done = true; save.scrap += DAILY_PAY; fresh.push(jaEn('デイリー達成 ', 'Daily done ') + dailyText(m) + '　+' + DAILY_PAY); }
  }
  if (!D.bonus && D.m.every(m => m.done)) { D.bonus = true; save.scrap += DAILY_BONUS; fresh.push(jaEn('デイリー全達成ボーナス', 'All dailies bonus') + '　+' + DAILY_BONUS); persist(); }
}
export const takeFresh = () => fresh.shift();
