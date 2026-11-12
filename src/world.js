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

function put(i, j, t, mode) { // mode: 0 通常 / 1 開始地点の近くにも置く / 2 必ず歯車を落とす
  if (i < 1 || j < 1 || i >= N - 1 || j >= N - 1) return null;
  const k = i + j * N; if (grid[k]) return null;
  const x = (i + 0.5) * CELL - A, z = (j + 0.5) * CELL - A;
  if (!mode && x * x + z * z < 90) return null;
  const b = { t, x, z, h: DEF[t].h, hp: DEF[t].hp, max: DEF[t].hp, hitT: 0, k, gift: mode === 2 };
  grid[k] = b; blocks.push(b); return b;
}
export function genWorld() {
  blocks.length = 0; grid.fill(null);
  // 最初の数秒で「撃つと壊れる・誘爆する」を見せる並び
  for (const x of [-3, -1, 1, 3]) put(ci(x), ci(-7), CRATE, 2);
  put(ci(5), ci(-9), BARREL, 1); put(ci(3), ci(-9), CRATE, 2); put(ci(7), ci(-9), CRATE, 2); put(ci(5), ci(-11), CRATE, 2);
  for (let n = 0; n < 16; n++) { // 壁の列
    let i = 2 + (rnd() * (N - 4)) | 0, j = 2 + (rnd() * (N - 4)) | 0; const hz = rnd() < 0.5, len = 3 + (rnd() * 4) | 0;
    for (let k = 0; k < len; k++) { put(i, j, WALL, 0); if (hz) i++; else j++; }
  }
  for (let n = 0; n < 30; n++) { // 木箱のかたまり
    let i = 2 + (rnd() * (N - 4)) | 0, j = 2 + (rnd() * (N - 4)) | 0; const len = 2 + (rnd() * 5) | 0;
    for (let k = 0; k < len; k++) { put(i, j, rnd() < 0.12 ? BARREL : CRATE, 0); if (rnd() < 0.5) i += rnd() < 0.5 ? 1 : -1; else j += rnd() < 0.5 ? 1 : -1; }
  }
  for (let n = 0; n < 10; n++) put(2 + (rnd() * (N - 4)) | 0, 2 + (rnd() * (N - 4)) | 0, BARREL, 0);
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
