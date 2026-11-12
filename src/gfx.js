// 描画: シーン、カメラ、箱を組んだモデル、インスタンス描画、粒子、衝撃波、重い端末向けの自動調整
import { THREE, clamp } from './core.js';
import { A } from './world.js';

export let renderer, scene, camera, light;
let hemi, outer, fence, gtex, gctx, GS = 1024;
export const MAT = new THREE.MeshLambertMaterial({ vertexColors: true });
export const BMAT = new THREE.MeshBasicMaterial({ vertexColors: false });
let pr = 1, prMax = 1, shake = 0, cx = 0, cz = 0;

// parts: {s:[w,h,d], p:[x,y,z], c:色, ry, cyl:角数} を1つのジオメトリにまとめる（頂点カラー）
export function geo(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const p of parts) {
    let g = p.cyl ? new THREE.CylinderGeometry(p.s[0] / 2, (p.s[2] || p.s[0]) / 2, p.s[1], p.cyl) : new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]);
    g = g.toNonIndexed(); if (p.ry) g.rotateY(p.ry); g.translate(p.p[0], p.p[1], p.p[2]);
    const P = g.attributes.position.array, Nn = g.attributes.normal.array; c.set(p.c);
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(Nn[i]); }
    for (let i = 0; i < P.length / 3; i++) col.push(c.r, c.g, c.b);
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

export class Inst {
  constructor(g, n, opt = {}) {
    this.m = new THREE.InstancedMesh(g, opt.mat || MAT, n);
    this.m.frustumCulled = false; this.m.castShadow = !!opt.shadow; this.n = n; this.i = 0;
    this.a = this.m.instanceMatrix.array;
    this.m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
    this.c = this.m.instanceColor.array; this.m.count = 0; scene.add(this.m);
  }
  begin() { this.i = 0; }
  put(x, y, z, ry, s = 1, sy = s, r = 1, g = 1, b = 1) {
    if (this.i >= this.n) return;
    const a = this.a, o = this.i * 16, c = Math.cos(ry) * s, sn = Math.sin(ry) * s;
    a[o] = c; a[o + 1] = 0; a[o + 2] = -sn; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
    a[o + 8] = sn; a[o + 9] = 0; a[o + 10] = c; a[o + 11] = 0; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
    const k = this.i * 3; this.c[k] = r; this.c[k + 1] = g; this.c[k + 2] = b; this.i++;
  }
  end() { this.m.count = this.i; this.m.instanceMatrix.needsUpdate = true; this.m.instanceColor.needsUpdate = true; }
}

export function initGfx(canvas) {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  prMax = Math.min(window.devicePixelRatio || 1, 2); pr = prMax; renderer.setPixelRatio(pr);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x2f6f5e);
  camera = new THREE.PerspectiveCamera(45, 1, 1, 200);
  hemi = new THREE.HemisphereLight(0xffffff, 0x7fae8a, 1.25); scene.add(hemi);
  light = new THREE.DirectionalLight(0xfff1d0, 1.9); light.castShadow = true;
  light.shadow.mapSize.set(1024, 1024); const sc = light.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 80;
  light.shadow.bias = -0.0015; scene.add(light); scene.add(light.target);
  // 地面: アリーナ全体を1枚のキャンバスに描く（テーマごとに applyTheme で描き直す）
  let coarse = false; try { coarse = matchMedia('(pointer:coarse)').matches; } catch (e) { /* noop */ }
  GS = coarse ? 1024 : 2048;
  const cv = document.createElement('canvas'); cv.width = cv.height = GS; gctx = cv.getContext('2d');
  gtex = new THREE.CanvasTexture(cv); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(A * 2, A * 2).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.receiveShadow = true; scene.add(ground);
  outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x3b8468 })); outer.position.y = -0.05; outer.receiveShadow = true; scene.add(outer);
  const t = 1.2, L = A * 2 + t * 2, w = 0xffffff;
  fence = new THREE.Mesh(geo([
    { s: [L, 1.4, t], p: [0, 0.7, -A - t / 2], c: w }, { s: [L, 1.4, t], p: [0, 0.7, A + t / 2], c: w },
    { s: [t, 1.4, L], p: [-A - t / 2, 0.7, 0], c: w }, { s: [t, 1.4, L], p: [A + t / 2, 0.7, 0], c: w }]), new THREE.MeshLambertMaterial({ color: 0x56688f }));
  fence.castShadow = true; scene.add(fence);
  initParticles(); initRings(); resize();
  window.addEventListener('resize', resize);
}
// テーマ（拠点の種類）の色・光・地面の絵を反映する
export function applyTheme(th, feat) {
  scene.background.set(th.bg); outer.material.color.set(th.outer); fence.material.color.set(th.fence);
  hemi.color.set(th.sky); hemi.groundColor.set(th.gnd); hemi.intensity = th.hemiI; light.color.set(th.sun); light.intensity = th.sunI;
  const g = gctx, S = GS, u = S / (2 * A), X = x => (x + A) * u;
  let sd = (th.i * 7919 + 13) >>> 0; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  g.setLineDash([]); g.fillStyle = th.g1; g.fillRect(0, 0, S, S); g.fillStyle = th.g2;
  for (let j = 0; j < 34; j++) for (let i = 0; i < 34; i++) if ((i + j) & 1) g.fillRect(i * 2 * u, j * 2 * u, 2 * u, 2 * u);
  for (let i = 0; i < 1100; i++) { g.fillStyle = i & 1 ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'; g.beginPath(); g.ellipse(r() * S, r() * S, (0.15 + r() * 0.6) * u, (0.12 + r() * 0.4) * u, 0, 0, 6.283); g.fill(); }
  if (th.paint) th.paint(g, { u, X, S, r, feat, A });
  gtex.needsUpdate = true;
}
export function resize() {
  const w = window.innerWidth, h = window.innerHeight; if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.fov = camera.aspect >= 1 ? 45 : 55; camera.updateProjectionMatrix();
}
export function addShake(a) { shake = Math.min(1.2, shake + a); }
export function camUpdate(px, pz, dt, snap) {
  const k = snap ? 1 : 1 - Math.exp(-7 * dt); cx += (px - cx) * k; cz += (pz - cz) * k;
  const H = camera.aspect >= 1 ? 27 : 40; shake *= Math.exp(-9 * dt);
  const sx = (Math.random() - 0.5) * shake, sz = (Math.random() - 0.5) * shake;
  camera.position.set(cx + sx, H, cz + H * 0.52 + sz); camera.lookAt(cx + sx, 0, cz - 1 + sz);
  light.position.set(cx - 14, 30, cz + 12); light.target.position.set(cx, 0, cz); light.target.updateMatrixWorld();
}
export function render() { renderer.render(scene, camera); }

// 1.5秒ごとの平均フレーム時間で解像度と影を落とす（下げるのは速く、戻すのはゆっくり）
let accT = 0, accN = 0, good = 0;
export function adapt(ms) {
  accT += ms; accN++; if (accT < 1500) return;
  const avg = accT / accN; accT = 0; accN = 0;
  if (avg > 24) { good = 0; if (pr > 0.7) { pr = Math.max(0.7, pr * 0.82); renderer.setPixelRatio(pr); resize(); render(); } else if (renderer.shadowMap.enabled) { renderer.shadowMap.enabled = false; light.castShadow = false; } }
  else if (avg < 15 && pr < prMax) { if (++good >= 4) { good = 0; pr = Math.min(prMax, pr * 1.12); renderer.setPixelRatio(pr); resize(); render(); } }
}

// ---- 粒子（箱のインスタンス） ----
const PN = 700, parts = []; let pInst; const tc = new THREE.Color(), ccache = new Map();
function rgb(hex) { let c = ccache.get(hex); if (!c) { tc.set(hex); c = [tc.r, tc.g, tc.b]; ccache.set(hex, c); } return c; }
function initParticles() { pInst = new Inst(new THREE.BoxGeometry(1, 1, 1), PN, { mat: BMAT }); }
export function burst(x, y, z, n, hex, spd, size, life, up = 1) {
  if (parts.length > PN - 40) n = Math.ceil(n / 3);
  const c = rgb(hex);
  for (let i = 0; i < n && parts.length < PN; i++) {
    const a = Math.random() * 6.283, v = spd * (0.35 + Math.random() * 0.65);
    parts.push({ x, y, z, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: (2 + Math.random() * 6) * up, l: life * (0.6 + Math.random() * 0.6), m: life, s: size * (0.6 + Math.random() * 0.8), r: c[0], g: c[1], b: c[2], ry: a });
  }
}
export function updParticles(dt) {
  pInst.begin();
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.l -= dt; if (p.l <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.vy -= 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < p.s / 2) { p.y = p.s / 2; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
    const s = p.s * clamp(p.l / p.m * 2, 0, 1); pInst.put(p.x, p.y, p.z, p.ry, s, s, p.r, p.g, p.b);
  }
  pInst.end();
}
// ---- 衝撃波の輪 ----
const rings = []; let ringI = 0;
function initRings() {
  const g = new THREE.RingGeometry(0.8, 1, 36).rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; m.position.y = 0.15; scene.add(m); rings.push({ m, t: 1, R: 1 }); }
}
export function ring(x, z, R, hex = 0xffe9a8) { const r = rings[ringI++ % rings.length]; r.t = 0; r.R = R; r.m.position.x = x; r.m.position.z = z; r.m.material.color.set(hex); r.m.visible = true; }
export function updRings(dt) {
  for (const r of rings) { if (!r.m.visible) continue; r.t += dt * 3.2; if (r.t >= 1) { r.m.visible = false; continue; } const s = r.R * (0.25 + 0.75 * Math.sqrt(r.t)); r.m.scale.set(s, 1, s); r.m.material.opacity = 0.85 * (1 - r.t); }
}
