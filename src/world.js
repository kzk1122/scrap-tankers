// 戦場: 2m マスの格子に置く壊せるブロック（木箱・壁・ドラム缶）と当たり判定
import { rnd, clamp } from './core.js';
export const A = 34, CELL = 2, N = 34;
export const CRATE = 0, WALL = 1, BARREL = 2;
const DEF = [{ hp: 20, h: 0.9 }, { hp: 80, h: 1.0 }, { hp: 8, h: 0.7 }];
export const blocks = [];
const grid = new Array(N * N).fill(null);
let onBreak = null;
export function setOnBreak(f) { onBreak = f; }
const ci = v => Math.floor((v + A) / CELL);

// 地形の特徴（川の位置や滑走路）。地面の描き込みと当たり判定の両方が使う
export const feat = { river: null, runway: [-21, -13] };
function put(i, j, t, mode) { // mode: 0 通常 / 1 開始地点の近くにも置く / 2 必ず歯車を落とす
  if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1) return null;
  const k = i + j * N; if (grid[k]) return null;
  const x = (i + 0.5) * CELL - A, z = (j + 0.5) * CELL - A;
  if (!mode && x * x + z * z < 90) return null;
  if (feat.river && Math.abs(z - feat.river.zc(x)) < feat.river.hw + 1.6) return null;
  const b = { t, x, z, h: DEF[t].h, hp: DEF[t].hp, max: DEF[t].hp, hitT: 0, k, gift: mode === 2, v: rnd(), ry: 0, sy: 1 };
  grid[k] = b; blocks.push(b); return b;
}
const rc = () => 2 + (rnd() * (N - 4)) | 0;
function lines(n, t, a, b) { for (let q = 0; q < n; q++) { let i = rc(), j = rc(); const hz = rnd() < 0.5, len = a + (rnd() * (b - a + 1)) | 0; for (let k = 0; k < len; k++) { put(i, j, t, 0); if (hz) i++; else j++; } } }
function blobs(n, t, a, b, mix) { for (let q = 0; q < n; q++) { let i = rc(), j = rc(); const len = a + (rnd() * (b - a + 1)) | 0; for (let k = 0; k < len; k++) { put(i, j, mix && rnd() < mix ? BARREL : t, 0); if (rnd() < 0.5) i += rnd() < 0.5 ? 1 : -1; else j += rnd() < 0.5 ? 1 : -1; } } }
const singles = (n, t) => { for (let q = 0; q < n; q++) put(rc(), rc(), t, 0); };
export function genWorld(theme = 'plains', stage = 1) {
  blocks.length = 0; grid.fill(null); feat.river = null;
  if (theme === 'river') { const off = 13, ph = stage * 1.7, r = { hw: 2.5, bridges: [-15, 11], zc: x => off + 4.5 * Math.sin(x * 0.13 + ph) }; feat.river = r; }
  // 最初の数秒で「撃つと壊れる・誘爆する」を見せる並び
  for (const x of [-3, -1, 1, 3]) put(ci(x), ci(-7), CRATE, 2);
  put(ci(5), ci(-9), BARREL, 1); put(ci(3), ci(-9), CRATE, 2); put(ci(7), ci(-9), CRATE, 2); put(ci(5), ci(-11), CRATE, 2);
  if (theme === 'mountain') { blobs(24, WALL, 2, 6); blobs(36, CRATE, 3, 7); singles(9, BARREL); }
  else if (theme === 'river') { lines(12, WALL, 3, 5); blobs(30, CRATE, 2, 6, 0.1); singles(9, BARREL); }
  else if (theme === 'city') {
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const road = i % 6 >= 4 || j % 6 >= 4, q = rnd();
      if (!road) { if (q < 0.34) put(i, j, WALL, 0); else if (q < 0.4) put(i, j, CRATE, 0); }
      else if (q < 0.075) put(i, j, CRATE, 0); else if (q < 0.09) put(i, j, BARREL, 0);
    }
  }
  else if (theme === 'harbor') { lines(20, WALL, 3, 7); blobs(22, CRATE, 2, 5); blobs(8, BARREL, 2, 3); singles(8, BARREL); }
  else if (theme === 'airport') {
    for (let q = 0; q < 6; q++) { const i0 = rc(), j0 = rc(), w = 4 + (rnd() * 3) | 0, d = 3 + (rnd() * 2) | 0, open = (rnd() * 4) | 0; for (let a = 0; a < w; a++) for (let b = 0; b < d; b++) { const edge = (b === 0 && open !== 0) || (b === d - 1 && open !== 1) || (a === 0 && open !== 2) || (a === w - 1 && open !== 3); if (edge && !(b > 0 && b < d - 1 && a > 0 && a < w - 1)) put(i0 + a, j0 + b, WALL, 0); else if (rnd() < 0.3) put(i0 + a, j0 + b, CRATE, 0); } }
    blobs(18, CRATE, 2, 5); blobs(7, BARREL, 2, 3); singles(6, BARREL);
    for (const b of blocks) if (!b.gift && b.z > feat.runway[0] - 1 && b.z < feat.runway[1] + 1) { b.hp = 0; grid[b.k] = null; } // 滑走路は空ける
    compact();
  }
  else if (theme === 'forest') { blobs(16, WALL, 1, 3); blobs(50, CRATE, 3, 8); singles(9, BARREL); }
  else if (theme === 'desert') { lines(9, WALL, 2, 5); blobs(6, WALL, 3, 6); blobs(22, CRATE, 1, 3); singles(12, BARREL); }
  else if (theme === 'snow') { lines(10, WALL, 2, 5); blobs(10, WALL, 2, 5); blobs(26, CRATE, 1, 4); singles(10, BARREL); }
  else if (theme === 'industry') { lines(10, WALL, 2, 4); blobs(12, WALL, 2, 4); blobs(22, CRATE, 2, 5); blobs(12, BARREL, 2, 4); singles(8, BARREL); }
  else { lines(16, WALL, 3, 6); blobs(30, CRATE, 2, 6, 0.12); singles(10, BARREL); }
}
export function inWater(x, z) {
  const r = feat.river; if (!r || Math.abs(z - r.zc(x)) > r.hw) return false;
  for (const b of r.bridges) if (Math.abs(x - b) < 2.6) return false;
  return true;
}
export function blockAt(x, z) {
  const i = ci(x), j = ci(z); if (i < 0 || j < 0 || i >= N || j >= N) return null;
  const b = grid[i + j * N]; if (!b) return null;
  return (Math.abs(x - b.x) <= b.h && Math.abs(z - b.z) <= b.h) ? b : null;
}
export function damageBlock(b, d) {
  if (b.hp <= 0) return false;
  b.hp -= d; b.hitT = 0.12;
  if (b.hp <= 0) { grid[b.k] = null; if (onBreak) onBreak(b); return true; }
  return false;
}
// 円(e.x,e.z,r)をブロックと外周から押し出す。触れたブロックは touch に渡す
export function pushOut(e, r, touch) {
  const i0 = Math.max(0, ci(e.x - r)), i1 = Math.min(N - 1, ci(e.x + r)), j0 = Math.max(0, ci(e.z - r)), j1 = Math.min(N - 1, ci(e.z + r));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const b = grid[i + j * N]; if (!b) continue;
    const h = b.h, nx = clamp(e.x, b.x - h, b.x + h), nz = clamp(e.z, b.z - h, b.z + h);
    const dx = e.x - nx, dz = e.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) { const d = Math.sqrt(d2), p = (r - d) / d; e.x += dx * p; e.z += dz * p; }
    else { const ox = e.x - b.x, oz = e.z - b.z; if (Math.abs(ox) > Math.abs(oz)) e.x = b.x + (ox < 0 ? -1 : 1) * (h + r); else e.z = b.z + (oz < 0 ? -1 : 1) * (h + r); }
    if (touch) touch(b);
  }
  e.x = clamp(e.x, -A + r, A - r); e.z = clamp(e.z, -A + r, A - r);
}
export function compact() { // 壊れたブロックを配列から外す
  let n = 0; for (let i = 0; i < blocks.length; i++) if (blocks[i].hp > 0) blocks[n++] = blocks[i]; blocks.length = n;
}
