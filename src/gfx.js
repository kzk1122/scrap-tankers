// 描画: 質感のある光と影、後処理（光のにじみ・色調整）、インスタンス描画、戦車モデル、粒子、草、水。
// 素材はすべてコードで生成する。重い端末では adapt() が段階的に画質を落とす
import { THREE, clamp } from './core.js';
import { A, blockAt, inWater } from './world.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export let renderer, scene, camera, light;
let hemi, outer, fence, ground, gtex, gctx, GS = 1024, composer, bloom, grade, noiseCv, coarse = false;
let shake = 0, cx = 0, cz = 0;
const R = Math.random, rr = (a, b) => a + R() * (b - a), lerp = (a, b, t) => a + (b - a) * t;
const SUN = new THREE.Vector3(-0.62, 0.58, -0.53).normalize();
const U = { t: { value: 0 }, cloud: { value: null }, tank: { value: new THREE.Vector3() } };

// ---------- ノイズとテクスチャ ----------
const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vn(x, y, P) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = a => ((a % P) + P) % P, x0 = w(xi), x1 = w(xi + 1), y0 = w(yi), y1 = w(yi + 1);
  return lerp(lerp(hash(x0, y0), hash(x1, y0), u), lerp(hash(x0, y1), hash(x1, y1), u), v);
}
function fbm(x, y, o, P) { let a = 0.5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x, y, P); n += a; a *= 0.5; x = x * 2 + 17; y = y * 2 + 31; P *= 2; } return s / n; }
function canvasOf(S, fn) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data;
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i += 4) { const p = fn(x / S, y / S, x, y); d[i] = p[0] * 255; d[i + 1] = p[1] * 255; d[i + 2] = p[2] * 255; d[i + 3] = (p[3] === undefined ? 1 : p[3]) * 255; }
  g.putImageData(im, 0, 0); return c;
}
const texOf = (S, fn) => new THREE.CanvasTexture(canvasOf(S, fn));
function normalTex(S, hfn, str) {
  const h = new Float32Array(S * S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = hfn(x / S, y / S);
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  const t = texOf(S, (u, v, x, y) => { const dx = (at(x + 1, y) - at(x - 1, y)) * str, dy = (at(x, y + 1) - at(x, y - 1)) * str, l = Math.hypot(dx, dy, 1); return [-dx / l * 0.5 + 0.5, dy / l * 0.5 + 0.5, 1 / l * 0.5 + 0.5]; });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// 標準マテリアルに「雲の影・表面のむら・草の風」を足す
function patch(mat, o = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = U.t; sh.uniforms.uCloud = U.cloud; sh.uniforms.uTank = U.tank;
    sh.vertexShader = 'uniform float uT; uniform vec3 uTank; varying vec3 vCW;\n' + (o.wind ? 'attribute float aH;\n' : '') + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.wind ? `
        vec2 ip = instanceMatrix[3].xz; float ph = ip.x*0.35 + ip.y*0.27; float w = sin(uT*1.7+ph) + 0.5*sin(uT*3.3+ph*1.7);
        float k = aH*aH; transformed.x += w*0.1*k; transformed.z += w*0.06*k;
        vec2 aw = ip - uTank.xz; float dd = length(aw); float push = smoothstep(2.4,0.6,dd)*aH; transformed.xz += aw/(dd+0.001)*push*0.5; transformed.y -= push*0.3;` : ''))
      .replace('#include <project_vertex>', '#include <project_vertex>\n vec4 cwp = vec4(transformed,1.);\n#ifdef USE_INSTANCING\n cwp = instanceMatrix*cwp;\n#endif\n vCW = (modelMatrix*cwp).xyz;');
    sh.fragmentShader = 'uniform float uT; uniform sampler2D uCloud; varying vec3 vCW;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n float cl = texture2D(uCloud, vCW.xz*0.011 + uT*vec2(0.012,0.006)).r; diffuseColor.rgb *= mix(0.66,1.05,smoothstep(0.38,0.6,cl));'
        + (o.detail ? ` diffuseColor.rgb *= ${o.detail === 2 ? '0.86 + 0.28' : '0.8 + 0.4'}*texture2D(uCloud, (vCW.xz + vCW.y*vec2(0.37,0.61))*0.19).g;` : ''));
  };
  mat.customProgramCacheKey = () => 'p' + (o.wind ? 1 : 0) + (o.detail || 0);
  return mat;
}
export const MAT = patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.74, metalness: 0.06 }), { detail: 2 });
export const BMAT = new THREE.MeshBasicMaterial({ vertexColors: false });

// parts: {s:[w,h,d], p:[x,y,z], c:色, ry, cyl:角数} を1つのジオメトリにまとめる（頂点カラー）。大きい箱は角を丸める
function pushGeo(out, g, c) {
  g = g.index ? g.toNonIndexed() : g; const P = g.attributes.position.array, Nn = g.attributes.normal.array;
  for (let i = 0; i < P.length; i++) { out.pos.push(P[i]); out.nor.push(Nn[i]); }
  for (let i = 0; i < P.length / 3; i++) out.col.push(c.r, c.g, c.b);
  g.dispose();
}
function finish(o) {
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(o.pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(o.nor, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(o.col, 3));
  return out;
}
export function geo(parts) {
  const o = { pos: [], nor: [], col: [] }, c = new THREE.Color();
  for (const p of parts) {
    const mn = Math.min(p.s[0], p.s[1], p.s[2]);
    const g = p.cyl ? new THREE.CylinderGeometry(p.s[0] / 2, (p.s[2] || p.s[0]) / 2, p.s[1], p.cyl) : mn >= 0.5 ? new RoundedBoxGeometry(p.s[0], p.s[1], p.s[2], 1, Math.min(0.09, mn * 0.12)) : new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]);
    if (p.ry) g.rotateY(p.ry); g.translate(p.p[0], p.p[1], p.p[2]); c.set(p.c); if (p.e) c.multiplyScalar(p.e); pushGeo(o, g, c); // e: 明るさ倍率（窓の明かりなど、光のにじみに乗る）
  }
  return finish(o);
}

export class Inst {
  constructor(g, n, opt = {}) {
    this.m = new THREE.InstancedMesh(g, opt.mat || MAT, n);
    this.m.frustumCulled = false; this.m.castShadow = !!opt.shadow; this.m.receiveShadow = !!opt.shadow; this.n = n; this.i = 0;
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

// ---------- 戦車モデル ----------
const shp = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; };
const ex = (pts, d, bev) => new THREE.ExtrudeGeometry(shp(pts), { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, steps: 1 });
const TR = 0.3, TLEN = 2.5, TPER = 2 * TLEN + 2 * Math.PI * TR, lp = { z: 0, y: 0, a: 0 };
function loop(s, out) { // 履帯の輪（横から見た長円）の上の点。s は 0..1
  let d = ((s % 1) + 1) % 1 * TPER;
  if (d < TLEN) { out.z = -TLEN / 2 + d; out.y = 2 * TR + 0.02; out.a = 0; } else if ((d -= TLEN) < Math.PI * TR) { const a = d / TR; out.z = TLEN / 2 + Math.sin(a) * TR; out.y = TR + 0.02 + Math.cos(a) * TR; out.a = a; }
  else if ((d -= Math.PI * TR) < TLEN) { out.z = TLEN / 2 - d; out.y = 0.02; out.a = Math.PI; } else { const a = (d - TLEN) / TR + Math.PI; out.z = -TLEN / 2 + Math.sin(a) * TR; out.y = TR + 0.02 + Math.cos(a) * TR; out.a = a; }
}
const cylX = (r, w, n, x, y, z) => new THREE.CylinderGeometry(r, r, w, n).rotateZ(Math.PI / 2).translate(x, y, z);
const cylZ = (r0, r1, l, n, y, z) => new THREE.CylinderGeometry(r0, r1, l, n).rotateX(Math.PI / 2).translate(0, y, z);
// 部品を「塗装」「鋼」「ゴム」「光るところ」に分けて返す。o: {lite: 軽量版, twin: 2連砲, plow: 排土板, crown: ボス飾り, long: 長砲身}
function tankParts(o = {}) {
  const n = o.lite ? 8 : 14, paint = [], steel = [], rubber = [], glow = [];
  paint.push(ex([[-1.3, 0.38], [1.2, 0.38], [1.5, 0.62], [1.0, 1.0], [-1.15, 1.0], [-1.38, 0.78]], 1.34, 0.06).translate(0, 0, -0.67).rotateY(-Math.PI / 2));
  paint.push(new THREE.BoxGeometry(1.1, 0.1, 0.85).translate(0, 1.08, -0.72));
  for (const x of [-0.98, 0.98]) paint.push(new THREE.BoxGeometry(0.5, 0.06, 3.05).translate(x, 0.74, 0.02));
  if (o.light) { paint.push(new THREE.BoxGeometry(1.7, 0.08, 0.34).translate(0, 1.36, -1.2)); for (const x of [-0.6, 0.6]) paint.push(new THREE.BoxGeometry(0.1, 0.3, 0.12).translate(x, 1.2, -1.2)); }
  else if (!o.lite) { paint.push(new RoundedBoxGeometry(0.34, 0.24, 0.6, 1, 0.05).translate(-0.98, 0.9, -0.55)); paint.push(new RoundedBoxGeometry(0.34, 0.2, 0.44, 1, 0.05).translate(0.98, 0.88, -0.75)); }
  const Y = 1.06, tur = [];
  tur.push(ex([[-0.62, 0.72], [0.62, 0.72], [0.78, 0.2], [0.5, -0.82], [-0.5, -0.82], [-0.78, 0.2]], 0.4, 0.07).rotateX(-Math.PI / 2).translate(0, 0, -0.05));
  tur.push(new THREE.CylinderGeometry(0.27, 0.3, 0.1, n).translate(0.2, 0.5, -0.25)); tur.push(new THREE.BoxGeometry(0.62, 0.36, 0.34).translate(0, 0.2, 0.86));
  const brl = []; const L = o.long ? 2.1 : o.short ? 0.9 : o.laser ? 2.2 : 1.7, br = o.short ? 2 : o.laser ? 0.65 : 1;
  if (o.armor) { for (const x of [-1.33, 1.33]) steel.push(new THREE.BoxGeometry(0.12, 0.5, 2.3).translate(x, 0.62, 0)); steel.push(new THREE.BoxGeometry(1.5, 0.4, 0.12).translate(0, 0.72, 1.5)); for (const x of [-0.86, 0.86]) tur.push(new THREE.BoxGeometry(0.1, 0.34, 1.1).translate(x, 0.22, -0.1)); }
  for (const bx of o.twin ? [-0.24, 0.24] : [0]) { brl.push(cylZ(0.1 * br, 0.125 * br, L, n, 0.2, 0.95 + L / 2).translate(bx, 0, 0)); brl.push(cylZ(0.15, 0.15, 0.5, n, 0.2, 1.25).translate(bx, 0, 0)); brl.push(cylZ(0.17 * br, 0.17 * br, 0.3, n, 0.2, 0.92 + L).translate(bx, 0, 0)); }
  if (o.laser) for (const z of [1.5, 2.0, 2.5]) brl.push(cylZ(0.16, 0.16, 0.08, n, 0.2, z));
  const wn = o.lite ? 8 : 12;
  for (const sx of [-0.98, 0.98]) { for (let i = 0; i < 5; i++) steel.push(cylX(0.25, 0.3, wn, sx, 0.27, -1.0 + i * 0.5)); steel.push(cylX(0.2, 0.3, wn, sx, 0.46, 1.3)); steel.push(cylX(0.2, 0.3, wn, sx, 0.46, -1.32)); steel.push(new THREE.BoxGeometry(0.2, 0.3, 2.5).translate(sx, 0.4, 0)); }
  if (o.plow) { steel.push(new THREE.BoxGeometry(3.0, 0.9, 0.16).translate(0, 0.55, 1.75)); steel.push(new THREE.BoxGeometry(0.2, 0.3, 0.5).translate(-0.7, 0.5, 1.5)); steel.push(new THREE.BoxGeometry(0.2, 0.3, 0.5).translate(0.7, 0.5, 1.5)); for (const x of [-1.33, 1.33]) steel.push(new THREE.BoxGeometry(0.12, 0.5, 2.2).translate(x, 0.6, 0)); }
  if (o.crown) for (const x of [-0.4, 0, 0.4]) glow.push(new THREE.BoxGeometry(0.16, x ? 0.3 : 0.42, 0.16).translate(x, Y + 0.6 + (x ? 0 : 0.06), -0.3));
  if (o.eye) glow.push(new THREE.BoxGeometry(0.66, 0.1, 0.06).translate(0, Y + 0.3, 0.72));
  return { paint, steel, rubber, tur, brl, Y, L };
}
const cleatG = () => new THREE.BoxGeometry(0.46, 0.07, 0.15);
// 敵用: 1つにまとめたジオメトリ（インスタンス描画）。履帯の板は止まったまま
export function tankGeo(hex, o = {}) {
  const P = tankParts(Object.assign({ eye: true }, o)), out = { pos: [], nor: [], col: [] }, c = new THREE.Color(), nc = o.lite ? 12 : 20;
  const sc = o.scale || 1, add = (list, col, dy) => { for (const g of list) { if (dy) g.translate(0, dy, 0); g.scale(sc, sc, sc); pushGeo(out, g, c.set(col)); } };
  add(P.paint, hex); add(P.tur, o.tur || hex, P.Y); add(P.brl, 0x2b2e33, P.Y); add(P.steel, 0x2b2e33);
  const cl = []; for (const sx of [-0.98, 0.98]) for (let i = 0; i < nc; i++) { loop(i / nc, lp); cl.push(cleatG().rotateX(lp.a).translate(sx, lp.y, lp.z)); } add(cl, 0x17181b);
  const gl = []; if (o.crown) for (const x of [-0.4, 0, 0.4]) gl.push(new THREE.BoxGeometry(0.16, x ? 0.3 : 0.42, 0.16).translate(x, P.Y + 0.6, -0.3)); gl.push(new THREE.BoxGeometry(0.66, 0.1, 0.06).translate(0, P.Y + 0.3, 0.74));
  for (const g of gl) { g.scale(sc, sc, sc); pushGeo(out, g, c.setRGB(5, 0.7, 0.3)); }
  return finish(out);
}
const merged = (list, hex) => { const o = { pos: [], nor: [], col: [] }, c = new THREE.Color(hex); for (const g of list) pushGeo(o, g, c); return finish(o); };
const NC = 26;
// 自機用: 砲塔が回り、履帯が動き、車体が傾くモデル
export function mkTank(hex, sc = 1, o = {}) {
  const P = tankParts(o), g = new THREE.Group(), tilt = new THREE.Group(), tur = new THREE.Group();
  const pm = patch(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.25, roughness: 0.6 }), { detail: 2 }), sm = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.85, roughness: 0.42 }), rm = new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.3, roughness: 0.75 });
  const body = new THREE.Mesh(merged(P.paint, hex), pm), wheels = new THREE.Mesh(merged(P.steel, 0x2b2e33), sm), tm = new THREE.Mesh(merged(P.tur, hex), pm), brl = new THREE.Mesh(merged(P.brl.concat([new THREE.CylinderGeometry(0.012, 0.012, 1.3, 5).translate(-0.5, 1.05, -0.6)]), 0x2b2e33), sm);
  const cl = new THREE.InstancedMesh(cleatG(), rm, NC * 2); cl.frustumCulled = false;
  for (const m of [body, wheels, tm, brl, cl]) { m.castShadow = true; m.receiveShadow = true; }
  for (const sx of [-0.45, 0.45]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.6) })); l.position.set(sx, 0.78, 1.32); body.add(l); }
  if (o.laser) { const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 2.6, 3.2) })); tip.position.set(0, 0.2, 1.1 + P.L); brl.add(tip); }
  tur.position.y = P.Y; tur.add(tm); tur.add(brl); tilt.add(body); tilt.add(tur); g.add(tilt); g.add(wheels); g.add(cl); g.scale.setScalar(sc); scene.add(g);
  const t = { g, tilt, tur, brl, cl, off: 0, sc }; moveTracks(t, 0); return t;
}
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), SC = new THREE.Vector3(1, 1, 1), EU = new THREE.Euler();
export function moveTracks(t, d) {
  t.off += d / t.sc / TPER; let n = 0;
  for (const sx of [-0.98, 0.98]) for (let i = 0; i < NC; i++) { loop(i / NC + t.off, lp); M4.compose(V3.set(sx, lp.y, lp.z), Q.setFromEuler(EU.set(lp.a, 0, 0)), SC.set(1, 1, 1)); t.cl.setMatrixAt(n++, M4); }
  t.cl.instanceMatrix.needsUpdate = true;
}

// ---------- 初期化 ----------
export function initGfx(canvas) {
  try { coarse = matchMedia('(pointer:coarse)').matches; } catch (e) { /* noop */ }
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene(); scene.background = new THREE.Color(0x2f6f5e); scene.fog = new THREE.Fog(0x2f6f5e, 75, 170);
  camera = new THREE.PerspectiveCamera(45, 1, 1, 220);
  U.cloud.value = texOf(256, (u, v) => [fbm(u * 4, v * 4, 4, 4), fbm(u * 16 + 5, v * 16 + 9, 3, 16), fbm(u * 8 + 3, v * 8 + 1, 3, 8)]); U.cloud.value.wrapS = U.cloud.value.wrapT = THREE.RepeatWrapping;
  { // 空の映り込み
    const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uSun: { value: SUN } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'varying vec3 vD; uniform vec3 uSun; void main(){ vec3 d = normalize(vD); float h = d.y; vec3 c = mix(vec3(1.2,0.98,0.72), vec3(0.3,0.52,0.95), smoothstep(-0.02,0.55,h)); c = mix(vec3(0.25,0.27,0.18), c, smoothstep(-0.12,0.02,h)); float s = max(dot(d,uSun),0.); c += vec3(1.,0.85,0.6)*(pow(s,40.)*3. + pow(s,600.)*40.); gl_FragColor = vec4(c,1.); }' })));
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.02).texture; scene.environmentIntensity = 0.5; pm.dispose();
  }
  hemi = new THREE.HemisphereLight(0xffffff, 0x7fae8a, 0.9); scene.add(hemi);
  light = new THREE.DirectionalLight(0xfff1d0, 3); light.castShadow = true;
  const sc = light.shadow.camera; sc.left = -38; sc.right = 38; sc.top = 38; sc.bottom = -38; sc.near = 1; sc.far = 150; light.shadow.bias = -0.0005; light.shadow.normalBias = 0.05; scene.add(light); scene.add(light.target);
  for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffa040, 0, 16, 1.6); l.position.y = 2; scene.add(l); flashes.push(l); }
  // 地面: アリーナ全体を1枚のキャンバスに描く（テーマごとに applyTheme で描き直す）
  GS = coarse ? 1024 : 2048;
  const cv = document.createElement('canvas'); cv.width = cv.height = GS; gctx = cv.getContext('2d');
  gtex = new THREE.CanvasTexture(cv); gtex.colorSpace = THREE.SRGBColorSpace; gtex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  noiseCv = canvasOf(256, (u, v) => { const n = fbm(u * 6, v * 6, 4, 6); return [n, n, n]; });
  const nm = normalTex(256, (u, v) => fbm(u * 8, v * 8, 4, 8) + 0.4 * fbm(u * 32, v * 32, 2, 32), 5), nm2 = nm.clone(); nm.repeat.set(14, 14); nm2.repeat.set(80, 80);
  ground = new THREE.Mesh(new THREE.PlaneGeometry(A * 2, A * 2).rotateX(-Math.PI / 2), patch(new THREE.MeshStandardMaterial({ map: gtex, normalMap: nm, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.94 }), { detail: 2 }));
  ground.receiveShadow = true; scene.add(ground);
  outer = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), patch(new THREE.MeshStandardMaterial({ color: 0x3b8468, normalMap: nm2, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.94 }), { detail: 1 })); outer.position.y = -0.05; outer.receiveShadow = true; scene.add(outer);
  const t = 1.2, L = A * 2 + t * 2, w = 0xffffff;
  fence = new THREE.Mesh(geo([
    { s: [L, 1.4, t], p: [0, 0.7, -A - t / 2], c: w }, { s: [L, 1.4, t], p: [0, 0.7, A + t / 2], c: w },
    { s: [t, 1.4, L], p: [-A - t / 2, 0.7, 0], c: w }, { s: [t, 1.4, L], p: [A + t / 2, 0.7, 0], c: w }]), patch(new THREE.MeshStandardMaterial({ color: 0x56688f, roughness: 0.8 }), { detail: 1 }));
  fence.castShadow = fence.receiveShadow = true; scene.add(fence);
  initFx(); initGrass(); initWater();
  composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.55, 1.1); composer.addPass(bloom); composer.addPass(new OutputPass());
  grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uPx: { value: new THREE.Vector2() }, uTilt: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uT, uTilt; uniform vec2 uPx; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
        float k = smoothstep(0.32, 0.54, abs(vUv.y - 0.52))*uTilt;
        if (k > 0.01) { vec2 r = uPx*k*3.; c = (c + texture2D(tDiffuse, vUv+vec2(r.x,0.)).rgb + texture2D(tDiffuse, vUv-vec2(r.x,0.)).rgb + texture2D(tDiffuse, vUv+vec2(0.,r.y)).rgb + texture2D(tDiffuse, vUv-vec2(0.,r.y)).rgb + texture2D(tDiffuse, vUv+r*0.7).rgb + texture2D(tDiffuse, vUv-r*0.7).rgb + texture2D(tDiffuse, vUv+vec2(r.x,-r.y)*0.7).rgb + texture2D(tDiffuse, vUv-vec2(r.x,-r.y)*0.7).rgb)/9.; }
        float l = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(l), c, 1.12); c = mix(c, c*c*(3.-2.*c), 0.2);
        c *= vec3(1.02,1.0,0.96); vec2 q = (vUv-0.5)*vec2(1.05,1.); c *= 1. - 0.36*pow(dot(q,q)*2., 1.4);
        c += (h(vUv*913. + uT) - 0.5)*0.02; gl_FragColor = vec4(c, 1.); }`,
  });
  composer.addPass(grade);
  setQ(coarse ? 1 : 0);
  window.addEventListener('resize', resize);
}

// ---------- 画質の段階（0 が最高）。adapt() が自動で上下させる ----------
let q = 0, qMin = 0;
const QP = [{ pr: 2, tilt: 1, bloom: 1, sh: 2048, grass: 1 }, { pr: 1.5, tilt: 0, bloom: 1, sh: 1024, grass: 0.6 }, { pr: 1.1, tilt: 0, bloom: 1, sh: 1024, grass: 0.4 }, { pr: 0.9, tilt: 0, bloom: 0, sh: 512, grass: 0.25 }, { pr: 0.7, tilt: 0, bloom: 0, sh: 0, grass: 0.12 }];
export function setQ(n, pin) {
  q = clamp(n, 0, QP.length - 1); if (pin) qMin = q; const p = QP[q];
  grade.uniforms.uTilt.value = p.tilt; bloom.enabled = !!p.bloom;
  const on = p.sh > 0; renderer.shadowMap.enabled = on; light.castShadow = on;
  if (on && light.shadow.mapSize.x !== p.sh) { light.shadow.mapSize.set(p.sh, p.sh); if (light.shadow.map) { light.shadow.map.dispose(); light.shadow.map = null; } }
  grass.count = Math.floor(grassN * p.grass); resize();
}
export const quality = () => q;
export function resize() {
  const w = window.innerWidth, h = window.innerHeight; if (!w || !h) return; const pr = Math.min(window.devicePixelRatio || 1, QP[q].pr);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); grade.uniforms.uPx.value.set(1 / w, 1 / h);
  camera.aspect = w / h; camera.fov = camera.aspect >= 1 ? 45 : 55; camera.updateProjectionMatrix();
}
let accT = 0, accN = 0, good = 0;
export function adapt(ms) {
  accT += ms; accN++; if (accT < 1500) return;
  const avg = accT / accN; accT = 0; accN = 0;
  if (avg > 24) { good = 0; if (q < QP.length - 1) { setQ(q + 1); render(); } }
  else if (avg < 14 && q > qMin) { if (++good >= 6) { good = 0; setQ(q - 1); render(); } } else good = 0;
}

// ---------- テーマ（拠点の種類）の色・光・地面の絵 ----------
export function applyTheme(th, feat) {
  scene.background.set(th.bg); scene.fog.color.set(th.bg); outer.material.color.set(th.outer); fence.material.color.set(th.fence);
  hemi.color.set(th.sky); hemi.groundColor.set(th.gnd); hemi.intensity = th.hemiI * 0.5; light.color.set(th.sun); light.intensity = th.sunI * 1.2;
  const g = gctx, S = GS, u = S / (2 * A), X = x => (x + A) * u;
  let sd = (th.i * 7919 + 13) >>> 0; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  g.setLineDash([]); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.fillStyle = th.g1; g.fillRect(0, 0, S, S);
  // 大きな色むら（市松模様の代わり）
  for (let i = 0; i < 90; i++) { g.fillStyle = i & 1 ? th.g2 : th.g1; g.globalAlpha = 0.5; g.beginPath(); g.ellipse(r() * S, r() * S, (2 + r() * 5) * u, (1.5 + r() * 4) * u, r() * 3, 0, 6.283); g.fill(); }
  g.globalAlpha = 1;
  for (let i = 0; i < 1400; i++) { g.fillStyle = i & 1 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.06)'; g.beginPath(); g.ellipse(r() * S, r() * S, (0.12 + r() * 0.5) * u, (0.1 + r() * 0.35) * u, r() * 3, 0, 6.283); g.fill(); }
  if (th.paint) th.paint(g, { u, X, S, r, feat, A });
  g.globalCompositeOperation = 'soft-light'; g.globalAlpha = 0.7; g.drawImage(noiseCv, 0, 0, S, S); g.globalAlpha = 0.5; g.drawImage(noiseCv, 0, 0, S / 4, S / 4, 0, 0, S, S);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  gtex.needsUpdate = true;
  setGrass(th); setWater(feat); sea.visible = !!th.sea; outer.visible = !th.sea;
}
export function addShake(a) { shake = Math.min(1.2, shake + a); }
export function camUpdate(px, pz, dt, snap) {
  const k = snap ? 1 : 1 - Math.exp(-7 * dt); cx += (px - cx) * k; cz += (pz - cz) * k;
  const H = camera.aspect >= 1 ? 27 : 40; shake *= Math.exp(-9 * dt);
  const sx = (R() - 0.5) * shake, sz = (R() - 0.5) * shake;
  camera.position.set(cx + sx, H, cz + H * 0.52 + sz); camera.lookAt(cx + sx, 0, cz - 1 + sz);
  const tx = Math.round(cx), tz = Math.round(cz); light.position.set(tx + SUN.x * 70, SUN.y * 70, tz + SUN.z * 70); light.target.position.set(tx, 0, tz); light.target.updateMatrixWorld();
  U.tank.value.set(px, 0, pz);
}
export function render() { grade.uniforms.uT.value = U.t.value % 10; composer.render(); }

// ---------- 草 ----------
let grass, grassN = 0; const GMAX = 16000, gc = new THREE.Color(), gc2 = new THREE.Color();
function initGrass() {
  const pos = [], col = [], hh = [], nor = [], idx = [];
  for (let b = 0; b < 5; b++) {
    const a = R() * 6.283, ox = rr(-0.3, 0.3), oz = rr(-0.3, 0.3), h = rr(0.4, 0.8), w = 0.075, ln = rr(0.05, 0.22), dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, i0 = pos.length / 3;
    const v = (s, t, wd) => { pos.push(ox + px * s * wd + dx * ln * t * t, h * t, oz + pz * s * wd + dz * ln * t * t); hh.push(t); const k = 0.55 + 0.7 * t; col.push(k, k, k * 0.9); nor.push(dx * 0.25, 1, dz * 0.25); };
    v(-1, 0, w); v(1, 0, w); v(-1, 0.55, w * 0.7); v(1, 0.55, w * 0.7); v(0, 1, 0); idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2, i0 + 2, i0 + 3, i0 + 4);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1)); g.setIndex(idx);
  grass = new THREE.InstancedMesh(g, patch(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), { wind: true }), GMAX);
  grass.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GMAX * 3).fill(1), 3); grass.count = 0; grass.receiveShadow = true; grass.frustumCulled = false; scene.add(grass);
}
// th.grass = { c: [色1, 色2], d: 密度 0..1, h: 高さ倍率 }。ブロックのあるマス・水・道は避ける
function setGrass(th) {
  const G = th.grass; grassN = 0; if (!G) { grass.count = 0; return; }
  let sd = (th.i * 31337 + 5) >>> 0; const r = () => { sd = (Math.imul(sd, 1664525) + 1013904223) >>> 0; return sd / 4294967296; };
  const Rg = A + 7, N = Math.floor(GMAX * (G.d || 1)); gc.set(G.c[0]); gc2.set(G.c[1]);
  for (let i = 0; i < N * 3 && grassN < N; i++) {
    const x = (r() * 2 - 1) * Rg, z = (r() * 2 - 1) * Rg, n = fbm(x * 0.16 + 50, z * 0.16 + 50, 2, 4096); if (n < 0.34 || blockAt(x, z) || inWater(x, z)) continue;
    if (G.skip && G.skip(x, z)) continue; if (Math.abs(Math.abs(x) - A - 0.6) < 0.8 && Math.abs(z) < A + 1.4) continue; if (Math.abs(Math.abs(z) - A - 0.6) < 0.8 && Math.abs(x) < A + 1.4) continue;
    const s = (0.75 + r() * 0.6), t = r(); M4.compose(V3.set(x, 0, z), Q.identity(), SC.set(s, s * (0.8 + r() * 0.5) * (G.h || 1), s)); grass.setMatrixAt(grassN, M4);
    const o = grassN * 3, k = 0.85 + r() * 0.3; grass.instanceColor.array[o] = lerp(gc.r, gc2.r, t) * k; grass.instanceColor.array[o + 1] = lerp(gc.g, gc2.g, t) * k; grass.instanceColor.array[o + 2] = lerp(gc.b, gc2.b, t) * k; grassN++;
  }
  grass.instanceMatrix.needsUpdate = true; grass.instanceColor.needsUpdate = true; grass.count = Math.floor(grassN * QP[q].grass);
}

// ---------- 水（川） ----------
let water, sea, wmask, wctx;
function initWater() {
  const c = document.createElement('canvas'); c.width = c.height = 256; wctx = c.getContext('2d'); wmask = new THREE.CanvasTexture(c);
  const wm = all => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uAll: { value: all }, uMask: { value: wmask }, uN: U.cloud, uT: U.t, uSun: { value: SUN } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform sampler2D uMask, uN; uniform float uT, uAll; uniform vec3 uSun; varying vec2 vUv; varying vec3 vW;
      void main(){ float d = max(texture2D(uMask, vUv).r, uAll); if (d <= 0.02) discard;
        vec2 w = vW.xz*0.16; vec3 n1 = texture2D(uN, w + uT*vec2(0.06,0.01)).rgb, n2 = texture2D(uN, w*1.9 + uT*vec2(0.09,-0.02)).rgb;
        vec2 nn = (n1.rg + n2.gb - 1.)*0.3; vec3 N = normalize(vec3(nn.x, 1., nn.y)); vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1. - max(dot(N,V),0.), 3.)*0.8 + 0.06; float caus = smoothstep(0.62,0.9, n1.b + n2.r - 0.45)*(1.-smoothstep(0.1,0.8,d));
        vec3 col = mix(vec3(0.2,0.62,0.6), vec3(0.04,0.24,0.42), smoothstep(0.,0.85,d)); col += vec3(0.25,0.3,0.2)*caus;
        vec3 Rf = reflect(-V,N); vec3 sky = mix(vec3(0.75,0.62,0.45), vec3(0.22,0.42,0.75), clamp(Rf.y*1.2,0.,1.)); col = mix(col, sky, fr*0.8);
        col += vec3(1.,0.88,0.65)*pow(max(dot(Rf,uSun),0.), 420.)*3.;
        float foam = smoothstep(0.16, 0.03, d + (n1.b-0.5)*0.14 + 0.03*sin(uT*1.4 + vW.x*0.8)); col = mix(col, vec3(0.92), foam*0.85);
        gl_FragColor = vec4(col, mix(0.55,0.95,smoothstep(0.02,0.3,d))); }`,
  });
  water = new THREE.Mesh(new THREE.PlaneGeometry(A * 2, A * 2).rotateX(-Math.PI / 2), wm(0));
  sea = new THREE.Mesh(new THREE.PlaneGeometry(520, 520).rotateX(-Math.PI / 2), wm(0.9)); sea.position.y = -0.5; sea.visible = false; scene.add(sea);
  water.position.y = 0.04; water.renderOrder = 1; water.visible = false; scene.add(water);
}
function setWater(feat) {
  const rv = feat && feat.river; water.visible = !!rv; if (!rv) return;
  const g = wctx, S = 256, u = S / (2 * A); g.globalCompositeOperation = 'source-over'; g.filter = 'none'; g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const line = (w, c) => { g.strokeStyle = c; g.lineWidth = w * u; g.lineCap = 'butt'; g.beginPath(); for (let x = -A - 1; x <= A + 1; x += 0.5) { const X = (x + A) * u, Z = (rv.zc(x) + A) * u; if (x === -A - 1) g.moveTo(X, Z); else g.lineTo(X, Z); } g.stroke(); };
  for (let i = 0; i < 6; i++) { const k = i / 5; line(rv.hw * 2 * (1 - k * 0.8), `rgb(${Math.round(40 + 215 * k)},0,0)`); }
  g.fillStyle = '#000'; for (const b of rv.bridges) g.fillRect((b - 2.75 + A) * u, 0, 5.5 * u, S);
  wmask.needsUpdate = true;
}

// ---------- 粒子・破片・輪・焦げ跡・履帯の跡・閃光 ----------
const flashes = []; let flashI = 0, PA, PS, chips, scorch, marks; const tc = new THREE.Color(), ccache = new Map();
function rgb(hex) { let c = ccache.get(hex); if (!c) { tc.set(hex); c = [tc.r, tc.g, tc.b]; ccache.set(hex, c); } return c; }
export function flash(x, z, power, hex = 0xffa040) { const l = flashes[flashI++ % 3]; l.position.set(x, 2.2, z); l.color.set(hex); l.intensity = power; }
function mkSprites(tex, additive, cap) {
  const g = new THREE.InstancedBufferGeometry(), b = new THREE.PlaneGeometry(1, 1); g.index = b.index; g.setAttribute('position', b.attributes.position); g.setAttribute('uv', b.attributes.uv);
  const ip = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), ia = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), ic = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  for (const a of [ip, ia, ic]) a.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iPos', ip); g.setAttribute('iPar', ia); g.setAttribute('iCol', ic); g.instanceCount = 0;
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { map: { value: tex } },
    vertexShader: 'attribute vec3 iPos; attribute vec4 iPar; attribute vec3 iCol; varying vec2 vUv; varying vec4 vC; void main(){ vUv = uv; vC = vec4(iCol, iPar.z); vec4 mv = viewMatrix*vec4(iPos,1.); float c = cos(iPar.y), s = sin(iPar.y); vec2 p = position.xy*iPar.x; mv.xy += vec2(c*p.x - s*p.y, s*p.x + c*p.y); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vUv; varying vec4 vC; void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vC.rgb*t.rgb, t.a*vC.a); }',
  }));
  m.frustumCulled = false; m.renderOrder = additive ? 4 : 3; scene.add(m);
  return { list: [], cap, ip, ia, ic, g };
}
function emit(sys, x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a, grav = 0, drag = 0) { if (sys.list.length >= sys.cap) return; sys.list.push({ x, y, z, vx, vy, vz, t: 0, life, s0, s1, c0, c1, a, grav, drag, rot: R() * 6.283, vr: rr(-1, 1) }); }
function updSprites(sys, dt) {
  const L = sys.list; let n = 0;
  for (let i = 0; i < L.length; i++) {
    const p = L[i]; p.t += dt; if (p.t >= p.life) continue; L[n] = p;
    const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy = p.vy * k - p.grav * dt; p.vz *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; } p.rot += p.vr * dt;
    const f = p.t / p.life, e = 1 - (1 - f) * (1 - f), fo = f < 0.12 ? f / 0.12 : f > 0.45 ? 1 - (f - 0.45) / 0.55 : 1;
    sys.ip.setXYZ(n, p.x, p.y, p.z); sys.ia.setXYZW(n, lerp(p.s0, p.s1, e), p.rot, p.a * fo, 0); sys.ic.setXYZ(n, lerp(p.c0[0], p.c1[0], f), lerp(p.c0[1], p.c1[1], f), lerp(p.c0[2], p.c1[2], f)); n++;
  }
  L.length = n; sys.g.instanceCount = n; sys.ip.needsUpdate = sys.ia.needsUpdate = sys.ic.needsUpdate = true;
}
const PN = 500, parts = [];
function initFx() {
  const puff = texOf(128, (u, v) => { const dx = u - 0.5, dz = v - 0.5, d = Math.hypot(dx, dz) * 2, n = fbm(u * 5, v * 5, 4, 4096), a = clamp((1 - d) * 1.6 - (1 - n) * 0.7, 0, 1), sh = 0.72 + 0.28 * clamp(0.5 - dz * 1.4 - dx * 0.5, 0, 1); return [sh, sh, sh, a * a * (3 - 2 * a)]; });
  const glow = texOf(64, (u, v) => { const d = Math.hypot(u - 0.5, v - 0.5) * 2; return [1, 1, 1, Math.pow(clamp(1 - d, 0, 1), 2.2)]; });
  PS = mkSprites(puff, false, coarse ? 260 : 420); PA = mkSprites(glow, true, coarse ? 380 : 620);
  chips = new Inst(new THREE.BoxGeometry(1, 1, 1), PN, {}); chips.m.castShadow = true;
  const st = texOf(64, (u, v) => { const d = Math.hypot(u - 0.5, v - 0.5) * 2, a = clamp(1 - d, 0, 1) * (0.6 + 0.6 * fbm(u * 6, v * 6, 3, 4096)); return [0.03, 0.025, 0.02, clamp(a * 1.5, 0, 0.85)]; });
  scorch = { im: new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 48), n: 0 };
  scorch.im.count = 0; scorch.im.frustumCulled = false; scene.add(scorch.im);
  { const N = 320, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 12), uv = new Float32Array(N * 8), born = new Float32Array(N * 4).fill(-99), idx = [];
    for (let i = 0; i < N; i++) { idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3); uv.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8); }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aB', new THREE.BufferAttribute(born, 1)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, uniforms: { uT: U.t }, vertexShader: 'attribute float aB; uniform float uT; varying float vA; varying vec2 vUv; void main(){ vUv = uv; vA = clamp(1. - (uT - aB)/8., 0., 1.); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'varying float vA; varying vec2 vUv; void main(){ float s = smoothstep(0.2,0.35,fract(vUv.y*2.)) * smoothstep(0.,0.15,vUv.x) * smoothstep(1.,0.85,vUv.x); gl_FragColor = vec4(0.07,0.055,0.03, vA*0.4*s); }' }));
    m.frustumCulled = false; scene.add(m); marks = { g, pos, born, i: 0, N }; }
  const rg = new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2);
  for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; m.position.y = 0.15; m.renderOrder = 2; scene.add(m); rings.push({ m, t: 1, R: 1 }); }
  // 着弾予告の円と、突進・狙撃の予告線
  const wm = o => new THREE.MeshBasicMaterial({ color: 0xff3348, transparent: true, opacity: o, depthWrite: false });
  const wr = new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), wf = new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), wl = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0, 0, 0.5);
  for (let i = 0; i < 12; i++) { const o = new THREE.Mesh(wr, wm(0.9)), f = new THREE.Mesh(wf, wm(0.3)); o.position.y = 0.12; f.position.y = 0.1; o.visible = f.visible = false; o.renderOrder = f.renderOrder = 2; scene.add(o, f); warnC.push({ o, f }); }
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(wl, wm(0.3)); m.position.y = 0.11; m.visible = false; m.renderOrder = 2; scene.add(m); warnL.push(m); }
}
// 破片（光の当たる小さな箱）。呼び方は以前の粒子と同じ
export function burst(x, y, z, n, hex, spd, size, life, up = 1) {
  if (parts.length > PN - 40) n = Math.ceil(n / 3);
  const c = rgb(hex);
  for (let i = 0; i < n && parts.length < PN; i++) {
    const a = R() * 6.283, v = spd * (0.35 + R() * 0.65);
    parts.push({ x, y, z, vx: Math.cos(a) * v, vz: Math.sin(a) * v, vy: (2 + R() * 6) * up, l: life * (0.6 + R() * 0.6), m: life, s: size * (0.6 + R() * 0.8), r: c[0], g: c[1], b: c[2], ry: a });
  }
}
export function updParticles(dt) {
  U.t.value += dt;
  chips.begin();
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.l -= dt; if (p.l <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
    p.vy -= 22 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.ry += dt * 5;
    if (p.y < p.s / 2) { p.y = p.s / 2; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
    const s = p.s * clamp(p.l / p.m * 2, 0, 1); chips.put(p.x, p.y, p.z, p.ry, s, s * 0.6, p.r, p.g, p.b);
  }
  chips.end(); updSprites(PA, dt); updSprites(PS, dt);
  for (const l of flashes) l.intensity *= Math.exp(-14 * dt);
}
const FIRE0 = [2.2, 1.0, 0.25], FIRE1 = [0.9, 0.15, 0.02], SMK0 = [0.33, 0.3, 0.27], SMK1 = [0.1, 0.1, 0.11], SPK0 = [9, 5, 1.2], SPK1 = [3, 0.6, 0.1];
// 爆発: 閃光・炎・煙・火花・焦げ跡。R は半径の目安
export function fxExplode(x, z, Rr) {
  const busy = PA.list.length > PA.cap * 0.6 ? 0.4 : 1, k = Rr / 3; flash(x, z, 13 * k); if (Rr >= 2.5) addScorch(x, z, Rr * 1.5);
  emit(PA, x, 1, z, 0, 0, 0, 0.1, Rr * 1.3, Rr * 2.1, [2.4, 1.5, 0.6], [1.2, 0.5, 0.1], 0.8);
  for (let i = 0; i < (7 * k + 3) * busy; i++) { const a = R() * 6.283, s = rr(1, 6) * k; emit(PA, x + Math.cos(a) * 0.4, rr(0.5, 1.4), z + Math.sin(a) * 0.4, Math.cos(a) * s, rr(2, 7), Math.sin(a) * s, rr(0.35, 0.75), rr(1.6, 2.6) * k, 0.4, FIRE0, FIRE1, 0.5, -2, 2.5); }
  for (let i = 0; i < (7 * k + 2) * busy; i++) { const a = R() * 6.283, s = rr(0.5, 3.5) * k; emit(PS, x + Math.cos(a) * 0.6, rr(0.6, 1.6), z + Math.sin(a) * 0.6, Math.cos(a) * s, rr(1.5, 4.5), Math.sin(a) * s, rr(1.1, 2.2), rr(1, 1.6) * k, rr(3, 4.6) * k, SMK0, SMK1, 0.7, -0.6, 1.4); }
  for (let i = 0; i < 14 * k * busy; i++) { const a = R() * 6.283, s = rr(6, 17); emit(PA, x, 0.8, z, Math.cos(a) * s, rr(4, 13), Math.sin(a) * s, rr(0.4, 0.9), 0.22, 0.05, SPK0, SPK1, 1, 26, 0.6); }
}
export function fxMuzzle(x, z, ang, hex) {
  const s = Math.sin(ang), c = Math.cos(ang), col = hex ? rgb(hex).map(v => v * 2.4) : [2.6, 1.7, 0.7]; flash(x, z, 4, hex || 0xffc070);
  emit(PA, x, 1.2, z, 0, 0, 0, 0.06, 0.7, 1.3, col, [col[0] * 0.5, col[1] * 0.3, col[2] * 0.2], 1);
  for (let i = 0; i < 3; i++) emit(PA, x, 1.2, z, s * rr(4, 12) + rr(-2, 2), rr(-0.5, 1.5), c * rr(4, 12) + rr(-2, 2), rr(0.1, 0.2), 0.45, 0.1, FIRE0, FIRE1, 0.7, 0, 4);
  if (PS.list.length < PS.cap * 0.5) emit(PS, x, 1.2, z, s * rr(1, 4), rr(0.3, 1.2), c * rr(1, 4), rr(0.4, 0.8), 0.35, rr(1.0, 1.6), [0.75, 0.72, 0.68], [0.5, 0.5, 0.5], 0.26, -0.5, 2.5);
}
export function fxSparks(x, z, n = 5, hex) { const c0 = hex ? rgb(hex).map(v => v * 7) : SPK0; for (let j = 0; j < n; j++) { const a = R() * 6.283; emit(PA, x, 1.2, z, Math.cos(a) * rr(3, 10), rr(2, 8), Math.sin(a) * rr(3, 10), rr(0.2, 0.45), 0.2, 0.04, c0, SPK1, 1, 24, 0.5); } }
export function fxDust(x, z, hex, n = 1, big = 1) { const c = rgb(hex); for (let i = 0; i < n; i++) emit(PS, x + rr(-0.3, 0.3), 0.25, z + rr(-0.3, 0.3), rr(-1, 1) * big, rr(0.3, 1.2) * big, rr(-1, 1) * big, rr(0.6, 1.1), 0.45 * big, rr(1.2, 2.0) * big, c, c, 0.3, 0, 1.5); }
export function fxSplash(x, z, n = 2) { for (let i = 0; i < n; i++) emit(PS, x + rr(-0.6, 0.6), 0.2, z + rr(-0.6, 0.6), rr(-1.5, 1.5), rr(2, 4.5), rr(-1.5, 1.5), rr(0.4, 0.7), 0.3, 1.0, [0.85, 0.95, 1], [0.7, 0.9, 1], 0.55, 11, 0.5); }
// 拠点ごとの空気感: 光の粒・雪・砂ぼこり・火の粉
export function fxAmb(kind, x, z, dt) {
  const lo = coarse ? 0.5 : 1;
  if (kind === 'none') return;
  if (kind === 'snow') { if (R() < dt * 70 * lo) emit(PS, x + rr(-30, 26), rr(9, 13), z + rr(-22, 16), rr(1, 2.4), rr(-4.5, -3), rr(0.2, 1), 3.2, 0.2, 0.2, [1, 1, 1], [1, 1, 1], 0.9, 0, 0); return; }
  if (kind === 'sand') { if (R() < dt * 22 * lo) emit(PS, x + rr(-34, 20), rr(0.3, 1.6), z + rr(-18, 16), rr(6, 10), rr(0, 0.5), rr(-1, 1.5), 1.8, 0.6, rr(1.6, 2.6), [0.93, 0.84, 0.62], [0.93, 0.84, 0.62], 0.13, 0, 0); return; }
  if (kind === 'ember') { if (R() < dt * 14 * lo) emit(PA, x + rr(-24, 24), rr(0.4, 2.5), z + rr(-16, 16), rr(-0.8, 0.8), rr(0.8, 2.4), rr(-0.8, 0.8), rr(1.8, 3), 0.1, 0.03, [5, 1.6, 0.3], [2, 0.3, 0.05], 0.9, 0, 0); return; }
  if (R() < dt * 7) fxMote(x, z);
}
function fxMote(x, z) { emit(PA, x + rr(-24, 24), rr(0.6, 4), z + rr(-16, 16), rr(-0.3, 0.3), rr(0.05, 0.3), rr(-0.3, 0.3), rr(2.5, 5), 0.1, 0.16, [2.2, 1.9, 1.0], [2.2, 1.9, 1.0], 0.5, 0, 0); }
function addScorch(x, z, Rr) { const i = scorch.n++ % 48; M4.compose(V3.set(x, 0.03, z), Q.setFromEuler(EU.set(0, R() * 6.283, 0)), SC.set(Rr, 1, Rr)); scorch.im.setMatrixAt(i, M4); scorch.im.count = Math.min(48, scorch.n); scorch.im.instanceMatrix.needsUpdate = true; }
export function clearMarks() { scorch.n = 0; scorch.im.count = 0; marks.born.fill(-99); marks.g.attributes.aB.needsUpdate = true; PA.list.length = PS.list.length = parts.length = 0; }
export function addMark(x, z, ry, len, w = 0.78) {
  for (const sx of [-w, w]) { const i = marks.i++ % marks.N, c = Math.cos(ry), s = Math.sin(ry), mx = x + c * sx, mz = z - s * sx, hw = 0.19, hl = len / 2, o = i * 12; const P = (k, a, b) => { marks.pos[o + k * 3] = mx + c * a + s * b; marks.pos[o + k * 3 + 1] = 0.025; marks.pos[o + k * 3 + 2] = mz - s * a + c * b; }; P(0, -hw, -hl); P(1, hw, -hl); P(2, -hw, hl); P(3, hw, hl); marks.born.fill(U.t.value, i * 4, i * 4 + 4); }
  marks.g.attributes.position.needsUpdate = marks.g.attributes.aB.needsUpdate = true;
}
// ---- 衝撃波の輪 ----
const rings = []; let ringI = 0;
export function ring(x, z, Rr, hex = 0xffe9a8) { const r = rings[ringI++ % rings.length]; r.t = 0; r.R = Rr; r.m.position.x = x; r.m.position.z = z; r.m.material.color.set(hex); r.m.visible = true; }
const warnC = [], warnL = [];
export function setWarn(H, L) {
  for (let i = 0; i < warnC.length; i++) { const w = warnC[i], h = H[i]; w.o.visible = w.f.visible = !!h; if (!h) continue; const p = Math.min(1, h.t / h.T), s = Math.max(0.05, h.r * p); w.o.position.x = w.f.position.x = h.x; w.o.position.z = w.f.position.z = h.z; w.o.scale.set(h.r, 1, h.r); w.f.scale.set(s, 1, s); w.f.material.opacity = 0.2 + 0.3 * p; }
  for (let i = 0; i < warnL.length; i++) { const m = warnL[i], l = L[i]; m.visible = !!l; if (!l) continue; m.position.x = l.x; m.position.z = l.z; m.rotation.y = l.a; m.scale.set(l.w, 1, l.len); m.material.opacity = 0.14 + 0.36 * Math.min(1, Math.max(0, l.p)); }
}
export function updRings(dt) {
  for (const r of rings) { if (!r.m.visible) continue; r.t += dt * 3.2; if (r.t >= 1) { r.m.visible = false; continue; } const s = r.R * (0.25 + 0.75 * Math.sqrt(r.t)); r.m.scale.set(s, 1, s); r.m.material.opacity = 0.7 * (1 - r.t); }
}
