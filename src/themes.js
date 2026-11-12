// 拠点の種類（テーマ）: 地面の色と描き込み、ブロックのモデル、周囲の景色、小物、光。拠点ごとに順番に切り替わる
import { THREE } from './core.js';
const lin = hexes => hexes.map(h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; });
const ONE = [[1, 1, 1]];
const dk = 0x2a2d44;
const wood = (a, b, top) => { const p = [{ s: [1.7, 1.7, 1.7], p: [0, 0.85, 0], c: a }, { s: [1.82, 0.26, 1.82], p: [0, 0.2, 0], c: b }, { s: [1.82, 0.26, 1.82], p: [0, 1.5, 0], c: b }]; if (top) p.push({ s: [1.76, 0.12, 1.76], p: [0, 1.76, 0], c: top }); return p; };
const BARREL = [{ s: [1.3, 1.6, 1.3], p: [0, 0.8, 0], c: 0xe5484d, cyl: 10 }, { s: [1.36, 0.3, 1.36], p: [0, 0.8, 0], c: 0xffd23f, cyl: 10 }];
const tree = (g1, g2) => [{ s: [0.5, 1.2, 0.5], p: [0, 0.6, 0], c: 0x7a5230, cyl: 6 }, { s: [2.2, 1.5, 2.2], p: [0, 1.9, 0], c: g1 }, { s: [1.5, 1.1, 1.5], p: [0, 3.1, 0], c: g2 }];
function building() {
  const p = [{ s: [1.96, 2.4, 1.96], p: [0, 1.2, 0], c: 0xffffff }, { s: [2.04, 0.16, 2.04], p: [0, 2.46, 0], c: 0x9aa3b5 }, { s: [0.7, 0.3, 0.7], p: [0.4, 2.66, -0.3], c: 0x8a93a6 }];
  for (const y of [0.75, 1.7]) for (const o of [-0.46, 0.46]) for (const sgn of [-1, 1]) {
    p.push({ s: [0.44, 0.5, 0.05], p: [o, y, sgn * 0.985], c: 0x4f76b5 }); p.push({ s: [0.05, 0.5, 0.44], p: [sgn * 0.985, y, o], c: 0x4f76b5 });
  }
  return p;
}
function container() {
  const p = [{ s: [1.98, 2.0, 1.98], p: [0, 1.0, 0], c: 0xffffff }, { s: [2.03, 0.12, 2.03], p: [0, 2.03, 0], c: 0xb8b8b8 }, { s: [2.03, 0.12, 2.03], p: [0, 0.06, 0], c: 0xb8b8b8 }];
  for (let k = 0; k < 5; k++) for (const sgn of [-1, 1]) { p.push({ s: [0.12, 1.76, 0.05], p: [-0.72 + 0.36 * k, 1.0, sgn * 1.0], c: 0xcfcfcf }); p.push({ s: [0.05, 1.76, 0.12], p: [sgn * 1.0, 1.0, -0.72 + 0.36 * k], c: 0xcfcfcf }); }
  return p;
}
const ell = (g, c, x, y, rx, ry) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.283); g.fill(); };

export const THEMES = [
  { id: 'plains', ja: '平原', en: 'Plains', g1: '#93d481', g2: '#88cb77', bg: 0x2f6f5e, outer: 0x3b8468, fence: 0x56688f, sky: 0xffffff, gnd: 0x7fae8a, hemiI: 1.25, sun: 0xfff1d0, sunI: 1.9, dust: 0xb9d89a, crateFx: 0xc98d4b, wallFx: 0xcfd6e4,
    crate: () => wood(0xc98d4b, 0xa66f36), tc: ONE,
    wall: () => [{ s: [2, 1.9, 2], p: [0, 0.95, 0], c: 0xcfd6e4 }, { s: [2.04, 0.3, 2.04], p: [0, 1.75, 0], c: 0xaab4c8 }], tw: ONE,
    far: () => tree(0x4fa85a, 0x62bd6a), small: () => [{ s: [0.12, 0.34, 0.12], p: [0, 0.17, 0], c: 0x5fae58 }, { s: [0.12, 0.26, 0.12], p: [0.16, 0.13, 0.08], c: 0x6fbe66 }, { s: [0.18, 0.12, 0.18], p: [0, 0.4, 0], c: 0xffe66d }],
    paint(g, k) { for (let i = 0; i < 16; i++) ell(g, 'rgba(176,146,92,.32)', k.r() * k.S, k.r() * k.S, (2 + k.r() * 3.5) * k.u, (1.5 + k.r() * 2.5) * k.u); for (let i = 0; i < 220; i++) ell(g, ['#ffffff', '#ffe66d', '#ffb3d1'][i % 3], k.r() * k.S, k.r() * k.S, 0.13 * k.u, 0.13 * k.u); } },
  { id: 'mountain', ja: '山岳', en: 'Mountain', g1: '#a7b995', g2: '#9db08b', bg: 0x8fa3b5, outer: 0x77877a, fence: 0x6b6f7c, sky: 0xeaf4ff, gnd: 0x8f9a8a, hemiI: 1.3, sun: 0xf2f6ff, sunI: 1.7, dust: 0xc9cfc0, crateFx: 0x2f7d4f, wallFx: 0x9aa0a8,
    crate: () => [{ s: [0.36, 0.8, 0.36], p: [0, 0.4, 0], c: 0x7a5230, cyl: 6 }, { s: [0.06, 1.5, 1.9], p: [0, 1.5, 0], c: 0x2f7d4f, cyl: 7 }, { s: [0.03, 1.2, 1.4], p: [0, 2.4, 0], c: 0x3a9160, cyl: 7 }, { s: [0.02, 0.5, 0.62], p: [0, 3.02, 0], c: 0xf4f8ff, cyl: 7 }], tc: lin([0xffffff, 0xdff0df, 0xf0ffe8]),
    wall: () => [{ s: [1.8, 1.3, 1.7], p: [0, 0.65, 0], c: 0x9aa0a8, ry: 0.2 }, { s: [1.2, 0.9, 1.3], p: [0.25, 1.5, -0.1], c: 0xb4bac2, ry: 0.6 }, { s: [0.9, 0.7, 0.9], p: [-0.55, 0.35, 0.6], c: 0x858b94, ry: 0.9 }], tw: lin([0xffffff, 0xe6e6ec, 0xfff8ee]),
    far: () => [{ s: [0.1, 9, 9], p: [0, 4.5, 0], c: 0x7d8794, cyl: 6 }, { s: [0.05, 3.2, 3.3], p: [0, 7.5, 0], c: 0xf4f8ff, cyl: 6 }], farN: 34, farS: [0.9, 2.2],
    small: () => [{ s: [0.5, 0.3, 0.4], p: [0, 0.15, 0], c: 0x8d939c, ry: 0.5 }, { s: [0.3, 0.2, 0.3], p: [0.3, 0.1, 0.2], c: 0xa9afb8 }],
    paint(g, k) { for (let i = 0; i < 20; i++) ell(g, 'rgba(122,112,100,.4)', k.r() * k.S, k.r() * k.S, (2 + k.r() * 4) * k.u, (1.5 + k.r() * 3) * k.u); for (let i = 0; i < 22; i++) { const e = k.r() < 0.6; ell(g, 'rgba(255,255,255,.8)', e ? (k.r() < 0.5 ? k.r() * 0.2 : 0.8 + k.r() * 0.2) * k.S : k.r() * k.S, k.r() * k.S, (1.5 + k.r() * 4) * k.u, (1.2 + k.r() * 3) * k.u); } } },
  { id: 'river', ja: '川', en: 'River', g1: '#8fd18a', g2: '#84c77f', bg: 0x2f6f5e, outer: 0x3f8f63, fence: 0x7a5a3a, sky: 0xffffff, gnd: 0x7fbf9a, hemiI: 1.3, sun: 0xfff6dc, sunI: 1.85, dust: 0xb9d89a, crateFx: 0xd9b36a, wallFx: 0xb7b2a6,
    crate: () => wood(0xd9b36a, 0xb58a45), tc: ONE,
    wall: () => [{ s: [2, 1.5, 2], p: [0, 0.75, 0], c: 0xb7b2a6 }, { s: [2.05, 0.3, 2.05], p: [0, 1.6, 0], c: 0x6fae5a }, { s: [0.7, 0.3, 0.7], p: [0.3, 1.85, -0.2], c: 0x7fbe6a }], tw: lin([0xffffff, 0xeeeeea]),
    far: () => tree(0x3f9a55, 0x57b566), small: () => [{ s: [0.08, 0.9, 0.08], p: [0, 0.45, 0], c: 0x4f9a4a }, { s: [0.08, 0.7, 0.08], p: [0.14, 0.35, 0.05], c: 0x5fae58 }, { s: [0.1, 0.2, 0.1], p: [0, 0.95, 0], c: 0x8a5a30 }],
    paint(g, k) {
      const rv = k.feat.river; if (!rv) return; const line = (w, c, dash) => { g.strokeStyle = c; g.lineWidth = w * k.u; g.setLineDash(dash || []); g.beginPath(); for (let x = -k.A; x <= k.A; x += 0.5) { const X = k.X(x), Z = k.X(rv.zc(x)); if (x === -k.A) g.moveTo(X, Z); else g.lineTo(X, Z); } g.stroke(); g.setLineDash([]); };
      line(rv.hw * 2 + 2, '#e3d39a'); line(rv.hw * 2, '#4aa8e0'); line(rv.hw * 1.1, '#63b8ec'); line(0.25, 'rgba(255,255,255,.6)', [1.2 * k.u, 2.4 * k.u]);
      for (const bx of rv.bridges) { const z = rv.zc(bx), h = rv.hw + 1.4; g.fillStyle = '#b98a4e'; g.fillRect(k.X(bx - 2.6), k.X(z - h), 5.2 * k.u, 2 * h * k.u); g.fillStyle = 'rgba(90,60,30,.5)'; for (let q = -h; q < h; q += 0.7) g.fillRect(k.X(bx - 2.6), k.X(z + q), 5.2 * k.u, 0.08 * k.u); g.fillStyle = '#8a6234'; g.fillRect(k.X(bx - 2.75), k.X(z - h), 0.3 * k.u, 2 * h * k.u); g.fillRect(k.X(bx + 2.45), k.X(z - h), 0.3 * k.u, 2 * h * k.u); }
    } },
  { id: 'city', ja: '市街地', en: 'City', g1: '#6d7483', g2: '#676e7d', bg: 0x39424f, outer: 0x4b5563, fence: 0x8a93a6, sky: 0xf2f4ff, gnd: 0x7a8090, hemiI: 1.35, sun: 0xffe6c0, sunI: 1.75, dust: 0xa9afba, crateFx: 0xd9d9d9, wallFx: 0xd8d2c4,
    crate: () => [{ s: [1.75, 0.5, 0.95], p: [0, 0.52, 0], c: 0xffffff }, { s: [0.9, 0.42, 0.85], p: [-0.1, 0.97, 0], c: 0xbfe3ff }, { s: [0.36, 0.36, 0.2], p: [0.55, 0.2, 0.46], c: 0x222222 }, { s: [0.36, 0.36, 0.2], p: [-0.55, 0.2, 0.46], c: 0x222222 }, { s: [0.36, 0.36, 0.2], p: [0.55, 0.2, -0.46], c: 0x222222 }, { s: [0.36, 0.36, 0.2], p: [-0.55, 0.2, -0.46], c: 0x222222 }, { s: [0.08, 0.16, 0.7], p: [0.88, 0.58, 0], c: 0xfff7c0 }],
    tc: lin([0xe5484d, 0x3b7dd8, 0xffc83a, 0xf4f4f4, 0x4fb37a, 0x2a2d44]), spin: true,
    wall: building, tw: lin([0xf2e6cf, 0xe9c9b8, 0xc9d9ec, 0xe6e6e6, 0xd9c7a6]), tall: [0.85, 1.6],
    far: () => { const p = [{ s: [5, 14, 5], p: [0, 7, 0], c: 0xffffff }, { s: [5.2, 0.4, 5.2], p: [0, 14.2, 0], c: 0x9aa3b5 }]; for (let y = 2; y < 13; y += 2.2) for (const sgn of [-1, 1]) { p.push({ s: [4, 1, 0.1], p: [0, y, sgn * 2.52], c: 0x4f76b5 }); p.push({ s: [0.1, 1, 4], p: [sgn * 2.52, y, 0], c: 0x4f76b5 }); } return p; }, farN: 30, farS: [0.7, 1.3], farT: lin([0xe9e2d2, 0xc9d9ec, 0xd9d9d9, 0xe9c9b8]),
    small: () => [{ s: [0.02, 0.5, 0.4], p: [0, 0.25, 0], c: 0xff7a2a, cyl: 8 }, { s: [0.5, 0.06, 0.5], p: [0, 0.03, 0], c: 0xff7a2a }, { s: [0.2, 0.08, 0.27], p: [0, 0.3, 0], c: 0xffffff, cyl: 8 }], smallN: 60,
    paint(g, k) {
      for (let bi = 0; bi < 6; bi++) for (let bj = 0; bj < 6; bj++) { const x0 = bi * 12 - k.A, z0 = bj * 12 - k.A; g.fillStyle = '#a3a9b5'; g.fillRect(k.X(x0 - 0.3), k.X(z0 - 0.3), 8.6 * k.u, 8.6 * k.u); g.fillStyle = '#8f96a4'; g.fillRect(k.X(x0 + 0.2), k.X(z0 + 0.2), 7.6 * k.u, 7.6 * k.u); }
      g.fillStyle = '#f4f4f4'; for (let r = 0; r < 6; r++) { const c = r * 12 + 10 - k.A; for (let t = -k.A; t < k.A; t += 3) { g.fillRect(k.X(c - 0.09), k.X(t), 0.18 * k.u, 1.5 * k.u); g.fillRect(k.X(t), k.X(c - 0.09), 1.5 * k.u, 0.18 * k.u); } }
      for (let r = 0; r < 6; r++) for (let q = 0; q < 6; q++) { const cx = r * 12 + 10 - k.A, cz = q * 12 + 10 - k.A; g.fillStyle = '#6d7483'; g.fillRect(k.X(cx - 2), k.X(cz - 2), 4 * k.u, 4 * k.u); g.fillStyle = 'rgba(244,244,244,.85)'; for (let s = -1.7; s < 1.8; s += 0.7) { g.fillRect(k.X(cx + s), k.X(cz - 3.1), 0.35 * k.u, 1 * k.u); g.fillRect(k.X(cx + s), k.X(cz + 2.1), 0.35 * k.u, 1 * k.u); g.fillRect(k.X(cx - 3.1), k.X(cz + s), 1 * k.u, 0.35 * k.u); g.fillRect(k.X(cx + 2.1), k.X(cz + s), 1 * k.u, 0.35 * k.u); } }
    } },
  { id: 'harbor', ja: '港', en: 'Harbor', g1: '#9da6b0', g2: '#959ea9', bg: 0x2f7fb5, outer: 0x2f7fb5, fence: 0x4a5670, sky: 0xfff4e6, gnd: 0x6f9ab5, hemiI: 1.25, sun: 0xffd9a8, sunI: 2.0, dust: 0xc4cad2, crateFx: 0xc98d4b, wallFx: 0xd9d9d9,
    crate: () => wood(0xc98d4b, 0xa66f36, 0x2f8f9d), tc: ONE,
    wall: container, tw: lin([0xd9473f, 0x3b7dd8, 0x3fa66b, 0xe8a23a, 0x9aa1ad, 0x2f8f9d]),
    far: () => [{ s: [3.2, 1.6, 9], p: [0, 0.5, 0], c: 0xb5403a }, { s: [3.3, 0.3, 9.1], p: [0, 1.4, 0], c: 0xf0f0f0 }, { s: [2.4, 2, 2.4], p: [0, 2.5, -2.6], c: 0xf4f4f4 }, { s: [0.9, 1.6, 0.9], p: [0, 4.2, -2.6], c: 0x2a2d44, cyl: 8 }, { s: [1.8, 1.2, 1.8], p: [0, 2.1, 1.2], c: 0x3b7dd8 }, { s: [1.8, 1.2, 1.8], p: [0, 2.1, 3.1], c: 0xe8a23a }], farN: 12, farS: [1, 1.6], farY: -0.3,
    small: () => [{ s: [0.36, 0.5, 0.36], p: [0, 0.25, 0], c: 0x39405c, cyl: 8 }, { s: [0.46, 0.14, 0.46], p: [0, 0.55, 0], c: 0xffd23f, cyl: 8 }], smallN: 50,
    paint(g, k) {
      const z0 = k.A - 13; g.fillStyle = '#b08a5a'; g.fillRect(0, k.X(z0), k.S, 13 * k.u); g.fillStyle = 'rgba(80,55,30,.45)'; for (let x = -k.A; x < k.A; x += 0.8) g.fillRect(k.X(x), k.X(z0), 0.08 * k.u, 13 * k.u);
      for (let x = -k.A; x < k.A; x += 2) { g.fillStyle = (x / 2) & 1 ? '#ffd23f' : '#2a2d44'; g.fillRect(k.X(x), k.X(z0 - 0.4), 2 * k.u, 0.4 * k.u); }
      g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 0.14 * k.u; for (let i = 0; i < 14; i++) { const x = -k.A + 3 + k.r() * (2 * k.A - 16), z = -k.A + 3 + k.r() * (2 * k.A - 26); g.strokeRect(k.X(x), k.X(z), 8 * k.u, 4 * k.u); g.strokeRect(k.X(x + 4), k.X(z), 0, 4 * k.u); }
      for (let i = 0; i < 12; i++) ell(g, 'rgba(40,50,70,.18)', k.r() * k.S, k.r() * k.S * 0.8, (1 + k.r() * 2) * k.u, (0.8 + k.r() * 1.6) * k.u);
    } },
  { id: 'airport', ja: '空港', en: 'Airport', g1: '#808a99', g2: '#7a8493', bg: 0x86c5e8, outer: 0x74b86c, fence: 0x9aa3b5, sky: 0xffffff, gnd: 0x8a93a6, hemiI: 1.4, sun: 0xffffff, sunI: 1.9, dust: 0xb4bac6, crateFx: 0xdfe5ee, wallFx: 0xd4d7dd,
    crate: () => [{ s: [1.8, 0.2, 1.8], p: [0, 0.12, 0], c: 0x39405c }, { s: [1.7, 1.45, 1.7], p: [0, 0.95, 0], c: 0xe9eef5 }, { s: [1.74, 0.34, 1.74], p: [0, 1.0, 0], c: 0xffffff }], tc: lin([0xff9a9a, 0x9ac4ff, 0xffe08a, 0xa8e6b8]),
    wall: () => { const p = [{ s: [2, 1.3, 2], p: [0, 0.65, 0], c: 0xd4d7dd }]; for (let i = 0; i < 4; i++) p.push({ s: [0.5, 0.14, 2.02], p: [-0.75 + 0.5 * i, 1.37, 0], c: i % 2 ? 0xffffff : 0xe5484d }); return p; }, tw: ONE,
    far: () => [{ s: [1.7, 1.7, 10], p: [0, 2.2, 0], c: 0xf4f6fa }, { s: [1.2, 1.2, 1.4], p: [0, 2.2, 5.5], c: 0xdfe5ee }, { s: [12, 0.3, 2.4], p: [0, 2, 0.6], c: 0xe9eef5 }, { s: [4.4, 0.25, 1.3], p: [0, 2.6, -4.3], c: 0xe9eef5 }, { s: [0.3, 2.4, 1.6], p: [0, 3.9, -4.3], c: 0xe5484d }, { s: [1.72, 0.4, 7], p: [0, 2.5, 0.5], c: 0x4f76b5 }, { s: [0.5, 1.2, 0.5], p: [-2.4, 0.9, 0.6], c: 0x39405c }, { s: [0.5, 1.2, 0.5], p: [2.4, 0.9, 0.6], c: 0x39405c }], farN: 9, farS: [1, 1.3],
    small: () => [{ s: [0.22, 0.16, 0.22], p: [0, 0.08, 0], c: 0x39405c }, { s: [0.14, 0.12, 0.14], p: [0, 0.2, 0], c: 0x6fd0ff }], smallN: 70,
    paint(g, k) {
      const [a, b] = k.feat.runway; g.fillStyle = '#4a515f'; g.fillRect(0, k.X(a), k.S, (b - a) * k.u); g.fillStyle = '#f4f4f4'; g.fillRect(0, k.X(a + 0.3), k.S, 0.2 * k.u); g.fillRect(0, k.X(b - 0.5), k.S, 0.2 * k.u);
      const m = (a + b) / 2; for (let x = -k.A + 12; x < k.A - 12; x += 7) g.fillRect(k.X(x), k.X(m - 0.2), 4 * k.u, 0.4 * k.u);
      for (const sx of [-k.A + 1.5, k.A - 6.5]) for (let q = a + 0.9; q < b - 1; q += 0.9) g.fillRect(k.X(sx), k.X(q), 5 * k.u, 0.5 * k.u);
      g.strokeStyle = '#ffd23f'; g.lineWidth = 0.22 * k.u; g.beginPath(); g.moveTo(k.X(-12), k.X(b)); g.lineTo(k.X(-12), k.X(18)); g.arcTo(k.X(-12), k.X(24), k.X(-6), k.X(24), 6 * k.u); g.lineTo(k.X(22), k.X(24)); g.moveTo(k.X(14), k.X(b)); g.lineTo(k.X(14), k.X(24)); g.stroke();
      g.lineWidth = 0.18 * k.u; for (const c of [[0, 6], [-22, 12], [22, 4]]) { g.beginPath(); g.arc(k.X(c[0]), k.X(c[1]), 3.2 * k.u, 0, 6.283); g.stroke(); }
      g.fillStyle = '#f4f4f4'; g.font = `900 ${4.2 * k.u}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.save(); g.translate(k.X(-k.A + 9.5), k.X(m)); g.rotate(Math.PI / 2); g.fillText('09', 0, 0); g.restore(); g.save(); g.translate(k.X(k.A - 9.5), k.X(m)); g.rotate(-Math.PI / 2); g.fillText('27', 0, 0); g.restore();
    } },
  { id: 'forest', ja: '森林', en: 'Forest', g1: '#6fae62', g2: '#67a55b', bg: 0x244f3a, outer: 0x2f6b45, fence: 0x6a4a2c, sky: 0xe8ffe8, gnd: 0x5f8f5a, hemiI: 1.2, sun: 0xfff0c8, sunI: 1.7, dust: 0x9fc98a, crateFx: 0x3f9a55, wallFx: 0x8d7a5c,
    crate: () => [{ s: [0.5, 1.0, 0.5], p: [0, 0.5, 0], c: 0x7a5230, cyl: 6 }, { s: [1.9, 1.3, 1.9], p: [0, 1.6, 0], c: 0x3f9a55 }, { s: [1.3, 1.0, 1.3], p: [0.1, 2.6, -0.1], c: 0x57b566 }], tc: lin([0xffffff, 0xe0f5d0, 0xfff5c8, 0xd8f0e0]),
    wall: () => [{ s: [1.9, 1.5, 1.9], p: [0, 0.75, 0], c: 0x8d7a5c, cyl: 9 }, { s: [1.6, 0.14, 1.6], p: [0, 1.56, 0], c: 0xd9c08f, cyl: 9 }, { s: [0.9, 0.1, 0.9], p: [0, 1.66, 0], c: 0xb89a66, cyl: 9 }, { s: [0.7, 0.4, 0.5], p: [0.8, 0.2, 0.5], c: 0x6fae5a }], tw: lin([0xffffff, 0xf0e6d8]),
    far: () => tree(0x2f8548, 0x3f9a55), farN: 60, farS: [1.2, 2.6],
    small: () => [{ s: [0.14, 0.24, 0.14], p: [0, 0.12, 0], c: 0xf4ecd8, cyl: 6 }, { s: [0.1, 0.16, 0.4], p: [0, 0.3, 0], c: 0xe5484d, cyl: 7 }],
    paint(g, k) { for (let i = 0; i < 30; i++) ell(g, 'rgba(40,80,40,.28)', k.r() * k.S, k.r() * k.S, (2 + k.r() * 5) * k.u, (2 + k.r() * 4) * k.u); for (let i = 0; i < 14; i++) ell(g, 'rgba(150,120,70,.35)', k.r() * k.S, k.r() * k.S, (1.5 + k.r() * 3) * k.u, (1 + k.r() * 2) * k.u); for (let i = 0; i < 160; i++) ell(g, ['#ffe66d', '#d7ffb0', '#ffffff'][i % 3], k.r() * k.S, k.r() * k.S, 0.12 * k.u, 0.12 * k.u); } },
  { id: 'desert', ja: '砂漠', en: 'Desert', g1: '#ecd596', g2: '#e6ce8c', bg: 0xe9c98a, outer: 0xdcc07e, fence: 0xb58a55, sky: 0xfff6e0, gnd: 0xd9b878, hemiI: 1.35, sun: 0xfff0c0, sunI: 2.1, dust: 0xe9d7a6, crateFx: 0x5fae58, wallFx: 0xd9b36a,
    crate: () => [{ s: [0.6, 1.9, 0.6], p: [0, 0.95, 0], c: 0x5fae58, cyl: 8 }, { s: [0.36, 0.36, 0.7], p: [0, 1.1, 0.5], c: 0x5fae58 }, { s: [0.34, 0.8, 0.34], p: [0, 1.5, 0.8], c: 0x6fbe66, cyl: 8 }, { s: [0.7, 0.3, 0.3], p: [-0.5, 0.8, 0], c: 0x5fae58 }, { s: [0.3, 0.6, 0.3], p: [-0.8, 1.1, 0], c: 0x6fbe66, cyl: 8 }, { s: [0.2, 0.16, 0.2], p: [0, 1.96, 0], c: 0xff8ad1 }], tc: lin([0xffffff, 0xe8ffd8]), spin: true,
    wall: () => [{ s: [2, 1.2, 2], p: [0, 0.6, 0], c: 0xd9b36a }, { s: [1.7, 0.7, 1.7], p: [0, 1.55, 0], c: 0xe6c47e }, { s: [2.04, 0.12, 2.04], p: [0, 1.2, 0], c: 0xb58a45 }, { s: [0.5, 0.4, 0.5], p: [-0.5, 2.1, 0.5], c: 0xcfa65a }], tw: lin([0xffffff, 0xf5e6c8, 0xffe9c0]),
    far: () => [{ s: [0.1, 9, 15], p: [0, 4.5, 0], c: 0xdcb46a, cyl: 4, ry: Math.PI / 4 }], farN: 9, farS: [0.7, 1.6],
    small: () => [{ s: [0.5, 0.24, 0.4], p: [0, 0.12, 0], c: 0xb89a66, ry: 0.4 }, { s: [0.08, 0.3, 0.08], p: [0.3, 0.15, 0.1], c: 0x9a8a4a }, { s: [0.08, 0.22, 0.08], p: [0.38, 0.11, 0], c: 0x9a8a4a }],
    paint(g, k) { g.strokeStyle = 'rgba(190,150,80,.35)'; g.lineWidth = 0.3 * k.u; for (let i = 0; i < 46; i++) { const x = k.r() * k.S, y = k.r() * k.S, w = (4 + k.r() * 8) * k.u; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y - (0.8 + k.r()) * k.u, x + w, y); g.stroke(); } for (let i = 0; i < 14; i++) ell(g, 'rgba(255,240,200,.4)', k.r() * k.S, k.r() * k.S, (2 + k.r() * 4) * k.u, (1.2 + k.r() * 2) * k.u); } },
  { id: 'snow', ja: '雪原', en: 'Snowfield', g1: '#eef4fb', g2: '#e4ecf6', bg: 0xa9c4dc, outer: 0xdbe6f2, fence: 0x7a8aa6, sky: 0xffffff, gnd: 0xc4d6ec, hemiI: 1.2, sun: 0xeaf4ff, sunI: 1.5, dust: 0xffffff, crateFx: 0xf4f8ff, wallFx: 0xa8dcf5,
    crate: () => [{ s: [1.5, 1.0, 1.5], p: [0, 0.5, 0], c: 0xffffff, cyl: 9 }, { s: [1.1, 0.8, 1.1], p: [0, 1.3, 0], c: 0xf4f8ff, cyl: 9 }, { s: [0.75, 0.6, 0.75], p: [0, 1.95, 0], c: 0xffffff, cyl: 9 }, { s: [0.12, 0.12, 0.4], p: [0, 1.95, 0.5], c: 0xff8a2a }, { s: [0.9, 0.1, 0.9], p: [0, 2.3, 0], c: 0x2a2d44, cyl: 9 }, { s: [0.55, 0.4, 0.55], p: [0, 2.5, 0], c: 0x2a2d44, cyl: 9 }, { s: [1.0, 0.14, 1.0], p: [0, 1.68, 0], c: 0xe5484d, cyl: 9 }], tc: ONE, spin: true,
    wall: () => [{ s: [2, 1.6, 2], p: [0, 0.8, 0], c: 0xa8dcf5 }, { s: [1.5, 0.5, 1.5], p: [0.1, 1.85, -0.1], c: 0xc9ecfb }, { s: [2.04, 0.2, 2.04], p: [0, 1.6, 0], c: 0xffffff }], tw: lin([0xffffff, 0xe8f6ff]),
    far: () => [{ s: [0.1, 9, 9], p: [0, 4.5, 0], c: 0xb9c9dc, cyl: 6 }, { s: [0.05, 5, 5.2], p: [0, 6.6, 0], c: 0xffffff, cyl: 6 }], farN: 30, farS: [0.9, 2.2],
    small: () => [{ s: [0.6, 0.26, 0.5], p: [0, 0.13, 0], c: 0xffffff, ry: 0.3 }, { s: [0.3, 0.2, 0.3], p: [0.3, 0.1, 0.2], c: 0xf0f6ff }],
    paint(g, k) { for (let i = 0; i < 16; i++) ell(g, 'rgba(150,200,240,.45)', k.r() * k.S, k.r() * k.S, (2 + k.r() * 5) * k.u, (1.5 + k.r() * 3) * k.u); for (let i = 0; i < 26; i++) ell(g, 'rgba(255,255,255,.9)', k.r() * k.S, k.r() * k.S, (1.5 + k.r() * 3) * k.u, (1 + k.r() * 2) * k.u); } },
  { id: 'industry', ja: '工業地帯', en: 'Industrial Zone', g1: '#85807c', g2: '#7e7975', bg: 0x4a3f3a, outer: 0x5a524c, fence: 0x4a4f5c, sky: 0xffe9d6, gnd: 0x7a6f66, hemiI: 1.25, sun: 0xffc890, sunI: 1.9, dust: 0xa39a90, crateFx: 0x8a93a6, wallFx: 0xb0b6c0,
    crate: () => [{ s: [1.7, 1.5, 1.7], p: [0, 0.85, 0], c: 0x8a93a6 }, { s: [1.8, 0.14, 1.8], p: [0, 0.1, 0], c: 0x7a5230 }, { s: [1.76, 0.2, 1.76], p: [0, 1.2, 0], c: 0xffd23f }, { s: [1.76, 0.2, 1.76], p: [0, 0.5, 0], c: 0x5a6274 }], tc: lin([0xffffff, 0xe6ecf5, 0xfff0d8]),
    wall: () => [{ s: [1.9, 2.3, 1.9], p: [0, 1.15, 0], c: 0xb0b6c0, cyl: 12 }, { s: [1.96, 0.24, 1.96], p: [0, 1.6, 0], c: 0xb5623a, cyl: 12 }, { s: [1.96, 0.24, 1.96], p: [0, 0.5, 0], c: 0x8a93a6, cyl: 12 }, { s: [0.6, 0.3, 1.5], p: [0, 2.45, 0], c: 0x9aa1ad, cyl: 12 }, { s: [0.3, 2.2, 0.3], p: [0.95, 1.1, 0.5], c: 0xe8a23a, cyl: 6 }], tw: lin([0xffffff, 0xe8e2d8, 0xd8e2ea]), tall: [0.85, 1.25],
    far: () => { const p = [{ s: [6, 4, 8], p: [0, 2, 0], c: 0x8a8580 }, { s: [6.2, 0.4, 8.2], p: [0, 4.2, 0], c: 0x6a6560 }]; for (let i = 0; i < 5; i++) p.push({ s: [1.3, 2.2, 1.6], p: [1, 6.1 + i * 2.2, -2], c: i % 2 ? 0xf4f4f4 : 0xe5484d, cyl: 10 }); p.push({ s: [1.3, 9, 1.3], p: [-1.6, 8.5, 2], c: 0x9a9590, cyl: 10 }); return p; }, farN: 22, farS: [0.8, 1.4],
    small: () => [{ s: [0.3, 0.4, 0.3], p: [0, 0.2, 0], c: 0x6a7388, cyl: 8 }, { s: [0.5, 0.08, 0.5], p: [0, 0.44, 0], c: 0xe5484d, cyl: 8 }], smallN: 60,
    paint(g, k) {
      g.strokeStyle = 'rgba(40,36,34,.35)'; g.lineWidth = 0.1 * k.u; for (let t = -k.A; t <= k.A; t += 6) { g.beginPath(); g.moveTo(k.X(t), 0); g.lineTo(k.X(t), k.S); g.moveTo(0, k.X(t)); g.lineTo(k.S, k.X(t)); g.stroke(); }
      for (let i = 0; i < 9; i++) { const x = -k.A + 4 + k.r() * (2 * k.A - 18), z = -k.A + 4 + k.r() * (2 * k.A - 14), w = 6 + k.r() * 6, h = 4 + k.r() * 4; g.save(); g.beginPath(); g.rect(k.X(x), k.X(z), w * k.u, h * k.u); g.clip(); for (let q = -h; q < w + h; q += 1.4) { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(k.X(x + q), k.X(z)); g.lineTo(k.X(x + q + 0.7), k.X(z)); g.lineTo(k.X(x + q + 0.7 - h), k.X(z + h)); g.lineTo(k.X(x + q - h), k.X(z + h)); g.fill(); } g.restore(); g.fillStyle = '#85807c'; g.fillRect(k.X(x + 0.5), k.X(z + 0.5), (w - 1) * k.u, (h - 1) * k.u); }
      for (let i = 0; i < 22; i++) ell(g, 'rgba(25,22,30,.4)', k.r() * k.S, k.r() * k.S, (0.8 + k.r() * 2.4) * k.u, (0.6 + k.r() * 1.6) * k.u);
    } },
];
// 拠点の並び（10種類を順番に）。最初は見通しのよい平原から
const ORDER = ['plains', 'forest', 'river', 'mountain', 'snow', 'desert', 'city', 'industry', 'harbor', 'airport'];
THEMES.forEach((t, i) => { t.i = i; t.barrel = () => BARREL; });
export const themeOf = stage => THEMES.find(t => t.id === ORDER[(stage - 1) % ORDER.length]);
export const areaOf = stage => Math.floor((stage - 1) / 6); // エリア（6拠点ごと）。曲はエリア単位で変える
