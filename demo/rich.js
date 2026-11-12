// グラフィック方針の見本: 同じ見下ろし戦車を、光・影・質感・水・草・爆発を作り込んだ描画で動かす
// 素材はすべてコードで生成（画像ファイルなし）。three.js と後処理（ブルームと色調整）を同梱する
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const $ = id => document.getElementById(id);
const diag = m => { const e = $('diag'); e.hidden = false; if (e.textContent.length < 1200) e.textContent += m + '\n'; };
window.addEventListener('error', e => diag('ERR ' + e.message + ' @' + (e.lineno || '?')));
const JA = (navigator.language || 'en').toLowerCase().startsWith('ja'), L = (ja, en) => JA ? ja : en;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, t) => a + (b - a) * t, sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
let _s = 20261112; const rnd = () => { _s = (_s + 0x6D2B79F5) >>> 0; let t = _s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rr = (a, b) => a + rnd() * (b - a);
function angLerp(a, b, k) { let d = (b - a) % 6.2832; if (d > Math.PI) d -= 6.2832; else if (d < -Math.PI) d += 6.2832; return a + d * k; }

// ---------- ノイズとテクスチャ生成 ----------
const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function vn(x, y, P) { // P を渡すと周期 P でつながる
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = P ? (a => ((a % P) + P) % P) : (a => a), x0 = w(xi), x1 = w(xi + 1), y0 = w(yi), y1 = w(yi + 1);
  return lerp(lerp(hash(x0, y0), hash(x1, y0), u), lerp(hash(x0, y1), hash(x1, y1), u), v);
}
function fbm(x, y, o = 4, P = 0) { let a = 0.5, s = 0, n = 0; for (let i = 0; i < o; i++) { s += a * vn(x, y, P); n += a; a *= 0.5; x = x * 2 + 17; y = y * 2 + 31; if (P) P *= 2; } return s / n; }
function canvasTex(S, fn, srgb) {
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), im = g.createImageData(S, S), d = im.data;
  for (let y = 0, i = 0; y < S; y++) for (let x = 0; x < S; x++, i += 4) { const p = fn(x / S, y / S, x, y); d[i] = p[0] * 255; d[i + 1] = p[1] * 255; d[i + 2] = p[2] * 255; d[i + 3] = (p[3] === undefined ? 1 : p[3]) * 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function normalTex(S, hfn, str) { // 高さの関数から法線マップ（くり返し前提）
  const h = new Float32Array(S * S); for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = hfn(x / S, y / S);
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  const t = canvasTex(S, (u, v, x, y) => { const dx = (at(x + 1, y) - at(x - 1, y)) * str, dy = (at(x, y + 1) - at(x, y - 1)) * str, l = Math.hypot(dx, dy, 1); return [-dx / l * 0.5 + 0.5, dy / l * 0.5 + 0.5, 1 / l * 0.5 + 0.5]; });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------- 地形の決まりごと（描画と当たり判定で同じ式を使う） ----------
const A = 38; // 動ける範囲の半分
const POND = { x: -15, z: 11 };
const pondD = (x, z) => { const dx = (x - POND.x) / 1.3, dz = z - POND.z, a = Math.atan2(dz, dx); return Math.hypot(dx, dz) - (6.6 + 1.1 * Math.sin(a * 3 + 0.6) + 0.6 * Math.sin(a * 5 + 2)); };
const roadZ = x => -7 + 6 * Math.sin(x * 0.085 + 0.6) + 2 * Math.sin(x * 0.21);
const roadD = (x, z) => Math.min(Math.abs(z - roadZ(x)) * 0.92, Math.hypot(x, z) - 1.5);

// ---------- 描画の土台 ----------
const coarse = (() => { try { return matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } })();
let HI = !coarse; try { const v = localStorage.getItem('rich_q'); if (v) HI = v === '1'; } catch (e) { /* noop */ }
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); const HAZE = new THREE.Color(0xcdbf9a);
scene.background = HAZE; scene.fog = new THREE.Fog(HAZE, 62, 135);
const camera = new THREE.PerspectiveCamera(34, 1, 1, 260);
const SUN = new THREE.Vector3(-0.62, 0.55, -0.56).normalize();
const U = { t: { value: 0 }, cloud: { value: null }, tank: { value: new THREE.Vector3() } };

// 空の映り込み用の環境マップ（夕方寄りの空）
{
  const es = new THREE.Scene();
  es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, uniforms: { uSun: { value: SUN } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying vec3 vD; uniform vec3 uSun; void main(){ vec3 d = normalize(vD); float h = d.y; vec3 c = mix(vec3(1.25,0.95,0.62), vec3(0.28,0.5,0.95), smoothstep(-0.02,0.55,h)); c = mix(vec3(0.22,0.26,0.12), c, smoothstep(-0.12,0.02,h)); float s = max(dot(d,uSun),0.); c += vec3(1.,0.8,0.5)*(pow(s,40.)*3. + pow(s,600.)*40.); gl_FragColor = vec4(c,1.); }',
  })));
  const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.02).texture; scene.environmentIntensity = 0.75; pm.dispose();
}
const sun = new THREE.DirectionalLight(0xffe2b8, 3.3); sun.castShadow = true;
sun.shadow.camera.left = -30; sun.shadow.camera.right = 30; sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30; sun.shadow.camera.near = 1; sun.shadow.camera.far = 140;
sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; scene.add(sun); scene.add(sun.target);
scene.add(new THREE.HemisphereLight(0x9fc4ff, 0x4a5a2a, 0.9));
const flashes = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffa040, 0, 16, 1.6); l.position.y = 2; scene.add(l); return l; }); let flashI = 0;
function flash(x, z, power, hex = 0xffa040) { const l = flashes[flashI++ % 3]; l.position.set(x, 2.2, z); l.color.set(hex); l.intensity = power; }

U.cloud.value = canvasTex(256, (u, v) => [fbm(u * 4, v * 4, 4, 4), fbm(u * 16 + 5, v * 16 + 9, 3, 16), fbm(u * 8 + 3, v * 8 + 1, 3, 8)]);
U.cloud.value.wrapS = U.cloud.value.wrapT = THREE.RepeatWrapping;
// 標準マテリアルに「雲の影・草の風・地面の細かい模様」を足す
function patch(mat, o = {}) {
  mat.onBeforeCompile = sh => {
    sh.uniforms.uT = U.t; sh.uniforms.uCloud = U.cloud; sh.uniforms.uTank = U.tank;
    sh.vertexShader = 'uniform float uT; uniform vec3 uTank; varying vec2 vCW;\n' + (o.wind ? 'attribute float aH;\n' : '') + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n' + (o.wind ? `
        vec2 ip = instanceMatrix[3].xz; float ph = ip.x*0.35 + ip.y*0.27; float w = sin(uT*1.7+ph) + 0.5*sin(uT*3.3+ph*1.7);
        float k = aH*aH; transformed.x += w*0.1*k; transformed.z += w*0.06*k;
        vec2 aw = ip - uTank.xz; float dd = length(aw); float push = smoothstep(2.6,0.7,dd)*aH; transformed.xz += aw/(dd+0.001)*push*0.55; transformed.y -= push*0.32;` : ''))
      .replace('#include <project_vertex>', '#include <project_vertex>\n vec4 cwp = vec4(transformed,1.);\n#ifdef USE_INSTANCING\n cwp = instanceMatrix*cwp;\n#endif\n vCW = (modelMatrix*cwp).xz;');
    sh.fragmentShader = 'uniform float uT; uniform sampler2D uCloud; varying vec2 vCW;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n float cl = texture2D(uCloud, vCW*0.011 + uT*vec2(0.012,0.006)).r; diffuseColor.rgb *= mix(0.6,1.05,smoothstep(0.38,0.6,cl));'
        + (o.detail ? ' diffuseColor.rgb *= 0.8 + 0.4*texture2D(uCloud, vCW*0.19).g;' : ''));
  };
  mat.customProgramCacheKey = () => 'p' + (o.wind ? 1 : 0) + (o.detail ? 1 : 0);
  return mat;
}

// ---------- 地面 ----------
const GC = { g1: [0.17, 0.33, 0.09], g2: [0.36, 0.5, 0.15], d1: [0.4, 0.29, 0.17], d2: [0.56, 0.44, 0.28], sand: [0.78, 0.7, 0.48], bed: [0.16, 0.3, 0.26] };
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
function groundCol(x, z) {
  const n = fbm(x * 0.09 + 40, z * 0.09 + 40, 4), n2 = fbm(x * 0.6, z * 0.6, 3);
  let c = mix3(GC.g1, GC.g2, sstep(0.3, 0.72, n) * 0.8 + n2 * 0.25);
  const rd = roadD(x, z) + (n2 - 0.5) * 2.2, dirt = 1 - sstep(1.3, 2.9, rd); c = mix3(c, mix3(GC.d1, GC.d2, n2), dirt);
  const pd = pondD(x, z) + (n2 - 0.5) * 0.9; c = mix3(c, GC.sand, 1 - sstep(0.4, 2.3, pd)); c = mix3(c, GC.bed, 1 - sstep(-1.6, 0.1, pd));
  return c;
}
const isGrass = (x, z) => roadD(x, z) > 3.1 && pondD(x, z) > 1.6;
{
  const S = coarse ? 768 : 1024, W = 128, tex = canvasTex(S, (u, v) => groundCol((u - 0.5) * W, (v - 0.5) * W), true);
  tex.repeat.set(260 / W, 260 / W); tex.offset.set(0.5 - 130 / W, 0.5 - 130 / W);
  const nm = normalTex(256, (u, v) => fbm(u * 8, v * 8, 4, 8) + 0.4 * fbm(u * 32, v * 32, 2, 32), 5); nm.repeat.set(52, 52);
  const m = patch(new THREE.MeshStandardMaterial({ map: tex, normalMap: nm, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.96, metalness: 0 }), { detail: true });
  const g = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), m); g.rotation.x = -Math.PI / 2; g.receiveShadow = true; scene.add(g);
}

// ---------- 水 ----------
{
  const PW = 30, PH = 24, mask = canvasTex(128, (u, v) => { const d = -pondD(POND.x + (u - 0.5) * PW, POND.z + (v - 0.5) * PH); return [clamp(d / 4, 0, 1), 0, 0]; });
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms: { uMask: { value: mask }, uN: U.cloud, uT: U.t, uSun: { value: SUN } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
    fragmentShader: `uniform sampler2D uMask, uN; uniform float uT; uniform vec3 uSun; varying vec2 vUv; varying vec3 vW;
      void main(){ float d = texture2D(uMask, vUv).r; if (d <= 0.004) discard;
        vec2 w = vW.xz*0.16; vec3 n1 = texture2D(uN, w + uT*vec2(0.035,0.02)).rgb, n2 = texture2D(uN, w*1.9 - uT*vec2(0.03,0.04)).rgb;
        vec2 nn = (n1.rg + n2.gb - 1.)*0.3; vec3 N = normalize(vec3(nn.x, 1., nn.y)); vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1. - max(dot(N,V),0.), 3.)*0.8 + 0.06; float caus = smoothstep(0.62,0.9, n1.b + n2.r - 0.45)*(1.-smoothstep(0.1,0.7,d));
        vec3 col = mix(vec3(0.2,0.62,0.56), vec3(0.03,0.2,0.33), smoothstep(0.,0.75,d));
        col += vec3(0.25,0.3,0.2)*caus; vec3 R = reflect(-V,N); vec3 sky = mix(vec3(0.75,0.62,0.45), vec3(0.22,0.42,0.75), clamp(R.y*1.2,0.,1.)); col = mix(col, sky, fr*0.8);
        col += vec3(1.,0.88,0.65)*pow(max(dot(R,uSun),0.), 420.)*3.;
        float foam = smoothstep(0.1, 0.0, d + (n1.b-0.5)*0.1 + 0.02*sin(uT*1.4 + vW.x*0.8)); col = mix(col, vec3(0.92), foam*0.85);
        gl_FragColor = vec4(col, mix(0.5,0.95,smoothstep(0.,0.3,d))); }`,
  });
  const w = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), m); w.rotation.x = -Math.PI / 2; w.position.set(POND.x, 0.04, POND.z); w.renderOrder = 1; scene.add(w);
}

// ---------- 形を作る小道具 ----------
function paint(g, fn) { // 頂点色をつける。fn(x,y,z) -> [r,g,b]
  g = g.index ? g.toNonIndexed() : g; const p = g.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = fn(p.getX(i), p.getY(i), p.getZ(i)); c[i * 3] = k[0]; c[i * 3 + 1] = k[1]; c[i * 3 + 2] = k[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
const lin = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const flat = h => { const k = lin(h); return () => k; };
function merge(list) { return mergeGeometries(list.map(g => { g = g.index ? g.toNonIndexed() : g; if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; })); }
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V3 = new THREE.Vector3(), SC = new THREE.Vector3(), EU = new THREE.Euler(), COL = new THREE.Color();
const mat4 = (x, y, z, ry, s, sy) => M4.compose(V3.set(x, y, z), Q.setFromEuler(EU.set(0, ry, 0)), SC.set(s, sy === undefined ? s : sy, s));

// ---------- 障害物（すべて円で当たりを取る） ----------
const OBS = []; // {x,z,r,type,hp,i,alive}
const free = (x, z, r) => Math.hypot(x, z) > 7 && pondD(x, z) > r + 0.6 && OBS.every(o => Math.hypot(o.x - x, o.z - z) > o.r + r + 0.5);
// 木（針葉樹と広葉樹）
{
  const trunk = h => paint(new THREE.CylinderGeometry(0.16, 0.3, h, 7).translate(0, h / 2, 0), (x, y) => { const k = 0.7 + 0.3 * y / h; return [0.3 * k, 0.19 * k, 0.1 * k]; });
  const cone = (r, h, y, a, b) => paint(new THREE.ConeGeometry(r, h, 9).translate(0, y + h / 2, 0), (x, yy, z) => mix3(a, b, clamp((yy - y) / h + (Math.hypot(x, z) / r - 0.5) * -0.3, 0, 1)));
  const pine = merge([trunk(1.6), cone(1.9, 2.1, 1.0, [0.05, 0.2, 0.09], [0.13, 0.36, 0.14]), cone(1.5, 1.9, 2.2, [0.06, 0.23, 0.1], [0.16, 0.4, 0.16]), cone(1.05, 1.7, 3.3, [0.08, 0.27, 0.11], [0.22, 0.47, 0.18])]);
  const blob = (r, x, y, z) => { const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { const k = 1 + (fbm(p.getX(i) * 1.3 + x, p.getY(i) * 1.3 + z, 2) - 0.5) * 0.5; n.setXYZ(i, p.getX(i) / r, p.getY(i) / r, p.getZ(i) / r); p.setXYZ(i, p.getX(i) * k + x, p.getY(i) * k * 0.85 + y, p.getZ(i) * k + z); } return paint(g, (px, py) => mix3([0.08, 0.24, 0.05], [0.3, 0.5, 0.1], clamp((py - y) / r * 0.5 + 0.5, 0, 1))); };
  const oak = merge([trunk(2.0), blob(1.5, 0, 3.0, 0), blob(1.1, 1.0, 2.5, 0.3), blob(1.0, -0.8, 2.6, -0.6), blob(0.9, 0.1, 2.4, 1.0)]);
  const pts = [[], []];
  for (let i = 0; i < 900 && pts[0].length + pts[1].length < 150; i++) { // 外周の森
    const a = rnd() * 6.283, d = A + 2.5 + rnd() * rnd() * 30, x = Math.cos(a) * d * 1.15, z = Math.sin(a) * d; if (Math.max(Math.abs(x), Math.abs(z)) < A + 2) continue;
    pts[rnd() < 0.6 ? 0 : 1].push([x, z, rr(0.9, 1.7)]);
  }
  for (let i = 0; i < 400 && OBS.length < 20; i++) { const x = rr(-A + 3, A - 3), z = rr(-A + 3, A - 3); if (!isGrass(x, z) || !free(x, z, 1.4)) continue; const k = rnd() < 0.5 ? 0 : 1, s = rr(0.85, 1.25); pts[k].push([x, z, s]); OBS.push({ x, z, r: 0.55 * s, type: 'tree', alive: true }); }
  [pine, oak].forEach((g, k) => {
    const im = new THREE.InstancedMesh(g, patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })), pts[k].length); im.castShadow = im.receiveShadow = true;
    pts[k].forEach((p, i) => { im.setMatrixAt(i, mat4(p[0], 0, p[1], rnd() * 6.283, p[2], p[2] * rr(0.9, 1.2))); im.setColorAt(i, COL.setHSL(0, 0, rr(0.75, 1.0))); }); scene.add(im);
  });
}
// 岩
{
  const g = new THREE.IcosahedronGeometry(1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.75 + fbm(p.getX(i) * 1.7 + 3, p.getZ(i) * 1.7 + p.getY(i), 2) * 0.6; p.setXYZ(i, p.getX(i) * k, Math.max(-0.2, p.getY(i) * k * 0.7), p.getZ(i) * k); }
  g.computeVertexNormals(); const gg = paint(g, (x, y) => { const k = 0.42 + y * 0.16 + rnd() * 0.05; return [k * 1.02, k, k * 0.95]; });
  const list = []; for (let i = 0; i < 300 && list.length < 16; i++) { const x = rr(-A + 2, A - 2), z = rr(-A + 2, A - 2), s = rr(0.8, 1.9); if (roadD(x, z) < 2.5 || !free(x, z, s)) continue; list.push([x, z, s]); OBS.push({ x, z, r: s * 0.85, type: 'rock', alive: true }); }
  for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, d = rr(7.5, 11); list.push([POND.x + Math.cos(a) * d * 1.3, POND.z + Math.sin(a) * d, rr(0.25, 0.55)]); }
  const im = new THREE.InstancedMesh(gg, patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true })), list.length); im.castShadow = im.receiveShadow = true;
  list.forEach((p, i) => im.setMatrixAt(i, mat4(p[0], 0.1 * p[2], p[1], rnd() * 6.283, p[2], p[2] * rr(0.7, 1.1)))); scene.add(im);
}
// 木箱とドラム缶（壊せる）
const woodTex = (() => {
  const h = (u, v) => { const b = 0.11, e = Math.min(u, v, 1 - u, 1 - v), fr = e < b ? 1 : 0, pl = Math.abs(((u * 4) % 1) - 0.5) < 0.46 ? 1 : 0, dg = Math.abs(u - v) < 0.07 && !fr ? 1 : 0; return { fr, pl, dg, e }; };
  const col = canvasTex(256, (u, v) => { const k = h(u, v), gr = fbm(u * 3, v * 40 + (k.fr ? 9 : 0), 3), base = k.fr || k.dg ? [0.5, 0.33, 0.16] : [0.66, 0.47, 0.25], d = (0.75 + gr * 0.5) * (k.pl || k.fr ? 1 : 0.45); const nail = k.fr && ((Math.hypot(((u * 2) % 1) - 0.5, 0) < 0.02 && (v < 0.07 || v > 0.93)) ) ? 0.4 : 1; return [base[0] * d * nail, base[1] * d * nail, base[2] * d * nail]; }, true);
  const nrm = normalTex(256, (u, v) => { const k = h(u, v); return (k.fr || k.dg ? 0.5 : k.pl ? 0.3 : 0) + fbm(u * 3, v * 40, 2) * 0.12; }, 6); nrm.wrapS = nrm.wrapT = THREE.ClampToEdgeWrapping;
  return { col, nrm };
})();
const crateIM = new THREE.InstancedMesh(new RoundedBoxGeometry(1.9, 1.9, 1.9, 3, 0.09).translate(0, 0.95, 0), patch(new THREE.MeshStandardMaterial({ map: woodTex.col, normalMap: woodTex.nrm, roughness: 0.82 })), 60);
const barrelIM = (() => {
  const body = paint(new THREE.CylinderGeometry(0.62, 0.62, 1.5, 18).translate(0, 0.75, 0), (x, y) => Math.abs(y - 0.75) < 0.16 ? [0.9, 0.82, 0.6] : [0.72, 0.09, 0.07]);
  const rib = y => paint(new THREE.TorusGeometry(0.63, 0.045, 6, 18).rotateX(Math.PI / 2).translate(0, y, 0), flat(0x8a1410));
  const cap = paint(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 18).translate(0, 1.5, 0), flat(0x4a1210));
  return new THREE.InstancedMesh(merge([body, rib(0.06), rib(0.5), rib(1.0), rib(1.46), cap]), patch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.65 })), 30);
})();
{
  let nc = 0, nb = 0;
  const addCrate = (x, z, ry) => { if (nc >= 60 || !free(x, z, 1.25)) return; crateIM.setMatrixAt(nc, mat4(x, 0, z, ry, 1)); crateIM.setColorAt(nc, COL.setHSL(0.08, 0.1, rr(0.8, 1))); OBS.push({ x, z, r: 1.25, type: 'crate', hp: 30, i: nc++, ry, alive: true }); };
  const addBarrel = (x, z) => { if (nb >= 30 || !free(x, z, 0.7)) return; barrelIM.setMatrixAt(nb, mat4(x, 0, z, rnd() * 6, 1)); OBS.push({ x, z, r: 0.7, type: 'barrel', hp: 8, i: nb++, alive: true }); };
  for (let k = 0; k < 13; k++) { const cx = rr(-A + 6, A - 6), cz = rr(-A + 6, A - 6), ry = rnd() * 0.5, n = 2 + ((rnd() * 4) | 0); for (let j = 0; j < n; j++) addCrate(cx + ((j % 2) * 2.05) * Math.cos(ry) + rr(-0.1, 0.1), cz + ((j >> 1) * 2.05) + rr(-0.1, 0.1), ry + rr(-0.06, 0.06)); if (rnd() < 0.8) { addBarrel(cx - 2, cz + rr(-1, 1)); if (rnd() < 0.6) addBarrel(cx - 2.2, cz + 1.6); } }
  for (let k = 0; k < 8; k++) addBarrel(rr(-A + 5, A - 5), rr(-A + 5, A - 5));
  crateIM.count = nc; barrelIM.count = nb; for (const m of [crateIM, barrelIM]) { m.castShadow = m.receiveShadow = true; scene.add(m); }
}
// コンクリートの防壁
{
  const ct = canvasTex(128, (u, v) => { const n = 0.62 + fbm(u * 6, v * 6, 4) * 0.3, st = v > 0.42 && v < 0.6 ? ((u * 6 + v * 2) % 1 < 0.5 ? [0.95, 0.72, 0.1] : [0.12, 0.12, 0.12]) : [n, n * 0.99, n * 0.95]; return st; }, true);
  const g = new RoundedBoxGeometry(3.6, 1.15, 0.8, 3, 0.12).translate(0, 0.575, 0), m = patch(new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9 }));
  for (let i = 0, n = 0; i < 200 && n < 9; i++) { const x = rr(-A + 6, A - 6), z = rr(-A + 6, A - 6), ry = rnd() < 0.5 ? rr(-0.2, 0.2) : Math.PI / 2 + rr(-0.2, 0.2); if (!free(x, z, 2.4)) continue; const b = new THREE.Mesh(g, m); b.position.set(x, 0, z); b.rotation.y = ry; b.castShadow = b.receiveShadow = true; scene.add(b); n++; for (const k of [-1.25, 0, 1.25]) OBS.push({ x: x + Math.cos(ry) * k, z: z - Math.sin(ry) * k, r: 0.62, type: 'wall', alive: true }); }
}
// 草（風でゆれ、戦車が通るとたおれる）
const grass = (() => {
  const pos = [], col = [], hh = [], nor = [], idx = [];
  for (let b = 0; b < 5; b++) {
    const a = rnd() * 6.283, ox = rr(-0.3, 0.3), oz = rr(-0.3, 0.3), h = rr(0.45, 0.95), w = 0.075, ln = rr(0.05, 0.22), dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, i0 = pos.length / 3;
    const v = (s, t, wd) => { pos.push(ox + px * s * wd + dx * ln * t * t, h * t, oz + pz * s * wd + dz * ln * t * t); hh.push(t); const k = 0.5 + 0.75 * t; col.push(k, k, k * 0.9); nor.push(dx * 0.25, 1, dz * 0.25); };
    v(-1, 0, w); v(1, 0, w); v(-1, 0.55, w * 0.7); v(1, 0.55, w * 0.7); v(0, 1, 0); idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2, i0 + 2, i0 + 3, i0 + 4);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('aH', new THREE.Float32BufferAttribute(hh, 1)); g.setIndex(idx);
  const N = 22000, im = new THREE.InstancedMesh(g, patch(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), { wind: true }), N);
  let n = 0; const R = A + 9;
  for (let i = 0; i < N * 4 && n < N; i++) {
    const x = rr(-R, R), z = rr(-R, R); if (!isGrass(x, z) || fbm(x * 0.2 + 9, z * 0.2, 2) < 0.3) continue; let ok = true; for (const o of OBS) if (o.type !== 'tree' && Math.hypot(o.x - x, o.z - z) < o.r + 0.2) { ok = false; break; } if (!ok) continue;
    const c = groundCol(x, z), s = rr(0.75, 1.35); im.setMatrixAt(n, mat4(x, 0, z, 0, s, s * rr(0.8, 1.3))); im.setColorAt(n, COL.setRGB(c[0] * 1.35 + 0.03, c[1] * 1.4 + 0.04, c[2] * 1.2, THREE.SRGBColorSpace)); n++;
  }
  im.userData.n = n; im.count = n; im.receiveShadow = true; im.frustumCulled = false; scene.add(im); return im;
})();

// ---------- 戦車 ----------
const TG = (() => {
  const shp = pts => { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; };
  const ex = (pts, d, bev) => new THREE.ExtrudeGeometry(shp(pts), { depth: d, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, steps: 1 });
  // 車体: 横から見た形を幅方向に押し出す
  const hull = ex([[-1.3, 0.38], [1.2, 0.38], [1.5, 0.62], [1.0, 1.0], [-1.15, 1.0], [-1.38, 0.78]], 1.34, 0.06).translate(0, 0, -0.67).rotateY(-Math.PI / 2);
  const deck = new RoundedBoxGeometry(1.1, 0.1, 0.85, 2, 0.04).translate(0, 1.08, -0.72);
  const guard = x => new RoundedBoxGeometry(0.5, 0.06, 3.05, 2, 0.03).translate(x, 0.74, 0.02);
  const box = new RoundedBoxGeometry(0.34, 0.24, 0.6, 2, 0.05).translate(-0.98, 0.9, -0.55), box2 = new RoundedBoxGeometry(0.34, 0.2, 0.44, 2, 0.05).translate(0.98, 0.88, -0.75);
  const body = merge([hull, deck, guard(-0.98), guard(0.98), box, box2]);
  // 砲塔: 上から見た形を上へ押し出す
  const turret = ex([[-0.62, 0.72], [0.62, 0.72], [0.78, 0.2], [0.5, -0.82], [-0.5, -0.82], [-0.78, 0.2]].map(p => [p[0], p[1]]), 0.4, 0.07).rotateX(-Math.PI / 2).translate(0, 0, -0.05);
  const hatch = new THREE.CylinderGeometry(0.27, 0.3, 0.1, 14).translate(0.2, 0.5, -0.25), cup = new RoundedBoxGeometry(0.3, 0.16, 0.36, 2, 0.04).translate(-0.3, 0.5, -0.2);
  const mant = new RoundedBoxGeometry(0.62, 0.36, 0.34, 2, 0.08).translate(0, 0.2, 0.86);
  const turr = merge([turret, hatch, cup, mant]);
  const barrel = merge([new THREE.CylinderGeometry(0.1, 0.125, 1.7, 14).rotateX(Math.PI / 2).translate(0, 0.2, 1.8), new THREE.CylinderGeometry(0.15, 0.15, 0.5, 14).rotateX(Math.PI / 2).translate(0, 0.2, 1.25), new THREE.CylinderGeometry(0.17, 0.17, 0.3, 14).rotateX(Math.PI / 2).translate(0, 0.2, 2.62), new THREE.CylinderGeometry(0.012, 0.012, 1.3, 5).translate(-0.5, 1.05, -0.6)]);
  // 転輪と履帯の裏
  const wl = []; for (const sx of [-0.98, 0.98]) { for (let i = 0; i < 5; i++) wl.push(new THREE.CylinderGeometry(0.25, 0.25, 0.3, 12).rotateZ(Math.PI / 2).translate(sx, 0.27, -1.0 + i * 0.5)); wl.push(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12).rotateZ(Math.PI / 2).translate(sx, 0.46, 1.3)); wl.push(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 12).rotateZ(Math.PI / 2).translate(sx, 0.46, -1.32)); wl.push(new THREE.BoxGeometry(0.2, 0.3, 2.5).translate(sx, 0.4, 0)); }
  const wheels = merge(wl), cleat = new THREE.BoxGeometry(0.46, 0.07, 0.15), lamp = new THREE.SphereGeometry(0.08, 8, 6), visor = new RoundedBoxGeometry(0.66, 0.1, 0.06, 1, 0.02);
  // 履帯の輪（横から見た長円）の上の点。s は 0..1
  const R = 0.3, LEN = 2.5, PER = 2 * LEN + 2 * Math.PI * R;
  const loop = (s, out) => { let d = ((s % 1) + 1) % 1 * PER; if (d < LEN) { out.z = -LEN / 2 + d; out.y = 2 * R + 0.02; out.a = 0; } else if ((d -= LEN) < Math.PI * R) { const a = d / R; out.z = LEN / 2 + Math.sin(a) * R; out.y = R + 0.02 + Math.cos(a) * R; out.a = a; } else if ((d -= Math.PI * R) < LEN) { out.z = LEN / 2 - d; out.y = 0.02; out.a = Math.PI; } else { const a = (d - LEN) / R + Math.PI; out.z = -LEN / 2 + Math.sin(a) * R; out.y = R + 0.02 + Math.cos(a) * R; out.a = a; } };
  return { body, turr, barrel, wheels, cleat, lamp, visor, loop, PER };
})();
const steel = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.85, roughness: 0.42 }), rubber = new THREE.MeshStandardMaterial({ color: 0x1a1b1e, metalness: 0.3, roughness: 0.75 });
const paintTex = (() => { const t = canvasTex(128, (u, v) => { const n = 0.55 + fbm(u * 6, v * 6, 4, 6) * 0.4; return [n, n, n]; }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
const NC = 26, lp = { z: 0, y: 0, a: 0 };
function mkTank(hex, enemy) {
  const g = new THREE.Group(), tilt = new THREE.Group(), pm = new THREE.MeshStandardMaterial({ color: hex, metalness: 0.25, roughness: 0.62, roughnessMap: paintTex });
  const body = new THREE.Mesh(TG.body, pm), wheels = new THREE.Mesh(TG.wheels, steel), tur = new THREE.Group(), tm = new THREE.Mesh(TG.turr, pm), brl = new THREE.Mesh(TG.barrel, steel);
  tur.position.y = 1.06; tur.add(tm); tur.add(brl);
  const cl = new THREE.InstancedMesh(TG.cleat, rubber, NC * 2); cl.frustumCulled = false;
  for (const m of [body, wheels, tm, brl, cl]) { m.castShadow = true; m.receiveShadow = true; }
  tilt.add(body); tilt.add(tur); g.add(tilt); g.add(wheels); g.add(cl);
  if (enemy) { const v = new THREE.Mesh(TG.visor, new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff2a1a, emissiveIntensity: 5 })); v.position.set(0, 0.3, 0.72); tur.add(v); }
  else for (const sx of [-0.45, 0.45]) { const l = new THREE.Mesh(TG.lamp, new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 3 })); l.position.set(sx, 0.78, 1.32); body.add(l); }
  const t = { g, tilt, tur, brl, cl, off: 0 }; setCleats(t, 0); return t;
}
function setCleats(t, d) { // 履帯の板を進んだ距離ぶん回す
  t.off += d / TG.PER; let n = 0;
  for (const sx of [-0.98, 0.98]) for (let i = 0; i < NC; i++) { TG.loop(i / NC + t.off, lp); M4.compose(V3.set(sx, lp.y, lp.z), Q.setFromEuler(EU.set(lp.a, 0, 0)), SC.set(1, 1, 1)); t.cl.setMatrixAt(n++, M4); }
  t.cl.instanceMatrix.needsUpdate = true;
}

// ---------- 粒子（炎・煙・火花・土ぼこり・水しぶき） ----------
const puffTex = canvasTex(128, (u, v) => { const dx = u - 0.5, dz = v - 0.5, d = Math.hypot(dx, dz) * 2, n = fbm(u * 5, v * 5, 4), a = clamp((1 - d) * 1.6 - (1 - n) * 0.7, 0, 1), sh = 0.72 + 0.28 * clamp(0.5 - dz * 1.4 - dx * 0.5, 0, 1); return [sh, sh, sh, a * a * (3 - 2 * a)]; });
const glowTex = canvasTex(64, (u, v) => { const d = Math.hypot(u - 0.5, v - 0.5) * 2, a = Math.pow(clamp(1 - d, 0, 1), 2.2); return [1, 1, 1, a]; });
function mkParticles(tex, additive, cap) {
  const g = new THREE.InstancedBufferGeometry(), b = new THREE.PlaneGeometry(1, 1); g.index = b.index; g.setAttribute('position', b.attributes.position); g.setAttribute('uv', b.attributes.uv);
  const ip = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3), ia = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), ic = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  for (const a of [ip, ia, ic]) a.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iPos', ip); g.setAttribute('iPar', ia); g.setAttribute('iCol', ic);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: { map: { value: tex } },
    vertexShader: 'attribute vec3 iPos; attribute vec4 iPar; attribute vec3 iCol; varying vec2 vUv; varying vec4 vC; void main(){ vUv = uv; vC = vec4(iCol, iPar.z); vec4 mv = viewMatrix*vec4(iPos,1.); float c = cos(iPar.y), s = sin(iPar.y); vec2 p = position.xy*iPar.x; mv.xy += vec2(c*p.x - s*p.y, s*p.x + c*p.y); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vUv; varying vec4 vC; void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vC.rgb*t.rgb, t.a*vC.a); }',
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = additive ? 4 : 3; scene.add(mesh);
  return { list: [], cap, ip, ia, ic, g };
}
const PA = mkParticles(glowTex, true, 700), PS = mkParticles(puffTex, false, 500);
// p: 位置・速度・寿命・大きさ(始→終)・色(始→終)・濃さ・重力・空気抵抗
function emit(sys, x, y, z, vx, vy, vz, life, s0, s1, c0, c1, a, grav = 0, drag = 0) { if (sys.list.length >= sys.cap) sys.list.shift(); sys.list.push({ x, y, z, vx, vy, vz, t: 0, life, s0, s1, c0, c1, a, grav, drag, rot: rnd() * 6.283, vr: rr(-1, 1) }); }
function updParticles(sys, dt) {
  const L = sys.list; let n = 0;
  for (let i = 0; i < L.length; i++) {
    const p = L[i]; p.t += dt; if (p.t >= p.life) continue; L[n] = p;
    const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy = p.vy * k - p.grav * dt; p.vz *= k; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.05 && p.grav > 0) { p.y = 0.05; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; } p.rot += p.vr * dt;
    const f = p.t / p.life, e = 1 - (1 - f) * (1 - f);
    sys.ip.setXYZ(n, p.x, p.y, p.z); sys.ia.setXYZW(n, lerp(p.s0, p.s1, e), p.rot, p.a * (f < 0.12 ? f / 0.12 : 1 - sstep(0.45, 1, f)), 0); sys.ic.setXYZ(n, lerp(p.c0[0], p.c1[0], f), lerp(p.c0[1], p.c1[1], f), lerp(p.c0[2], p.c1[2], f)); n++;
  }
  L.length = n; sys.g.instanceCount = n; sys.ip.needsUpdate = sys.ia.needsUpdate = sys.ic.needsUpdate = true;
}
// 破片（箱の板など）
const debris = (() => { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 140); im.castShadow = true; im.frustumCulled = false; im.count = 0; scene.add(im); return { im, list: [] }; })();
function chunk(x, y, z, hex, n, spd, size) { for (let i = 0; i < n; i++) { if (debris.list.length >= 140) debris.list.shift(); const a = rnd() * 6.283, s = rr(0.3, 1) * spd; debris.list.push({ x, y, z, vx: Math.cos(a) * s, vy: rr(4, 9), vz: Math.sin(a) * s, rx: rnd() * 6, ry: rnd() * 6, wr: rr(-9, 9), t: 0, life: rr(1.6, 2.6), sx: size * rr(0.5, 1.4), sy: size * rr(0.15, 0.4), sz: size * rr(0.4, 1), c: hex }); } }
function updDebris(dt) {
  const L = debris.list; let n = 0;
  for (let i = 0; i < L.length; i++) { const d = L[i]; d.t += dt; if (d.t > d.life) continue; L[n] = d; d.vy -= 24 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; if (d.y < d.sy) { d.y = d.sy; d.vy *= -0.3; d.vx *= 0.55; d.vz *= 0.55; d.wr *= 0.5; } d.rx += d.wr * dt; d.ry += d.wr * 0.7 * dt; const k = 1 - sstep(0.7, 1, d.t / d.life); M4.compose(V3.set(d.x, d.y, d.z), Q.setFromEuler(EU.set(d.rx, d.ry, 0)), SC.set(d.sx * k, d.sy * k, d.sz * k)); debris.im.setMatrixAt(n, M4); debris.im.setColorAt(n, COL.set(d.c)); n++; }
  L.length = n; debris.im.count = n; debris.im.instanceMatrix.needsUpdate = true; if (debris.im.instanceColor) debris.im.instanceColor.needsUpdate = true;
}
// 衝撃波の輪・焦げ跡・履帯の跡
const rings = [0, 1, 2, 3, 4, 5].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); m.visible = false; m.position.y = 0.12; m.renderOrder = 2; scene.add(m); return { m, t: 1, R: 1, life: 0.4 }; }); let ringI = 0;
function ring(x, z, R, hex, life = 0.4) { const r = rings[ringI++ % rings.length]; r.t = 0; r.R = R; r.life = life; r.m.position.x = x; r.m.position.z = z; r.m.material.color.set(hex); r.m.visible = true; }
const scorch = (() => { const t = canvasTex(64, (u, v) => { const d = Math.hypot(u - 0.5, v - 0.5) * 2, a = clamp(1 - d, 0, 1) * (0.6 + 0.6 * fbm(u * 6, v * 6, 3)); return [0.03, 0.025, 0.02, clamp(a * 1.5, 0, 0.85)]; }); const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 40); im.count = 0; im.frustumCulled = false; scene.add(im); return { im, n: 0 }; })();
function addScorch(x, z, R) { const i = scorch.n++ % 40; scorch.im.setMatrixAt(i, mat4(x, 0.03, z, rnd() * 6.283, R, 1)); scorch.im.count = Math.min(40, scorch.n); scorch.im.instanceMatrix.needsUpdate = true; }
const marks = (() => {
  const N = 360, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 12), uv = new Float32Array(N * 8), born = new Float32Array(N * 4).fill(-99), idx = [];
  for (let i = 0; i < N; i++) { idx.push(i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3); uv.set([0, 0, 1, 0, 0, 1, 1, 1], i * 8); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('aB', new THREE.BufferAttribute(born, 1)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, uniforms: { uT: U.t }, vertexShader: 'attribute float aB; uniform float uT; varying float vA; varying vec2 vUv; void main(){ vUv = uv; vA = clamp(1. - (uT - aB)/9., 0., 1.); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }', fragmentShader: 'varying float vA; varying vec2 vUv; void main(){ float s = smoothstep(0.2,0.35,fract(vUv.y*2.)) * smoothstep(0.,0.15,vUv.x) * smoothstep(1.,0.85,vUv.x); gl_FragColor = vec4(0.08,0.06,0.03, vA*0.42*s); }' }));
  m.frustumCulled = false; scene.add(m); return { g, pos, born, i: 0, N };
})();
function addMark(x, z, ry, len) { for (const sx of [-0.98, 0.98]) { const i = marks.i++ % marks.N, c = Math.cos(ry), s = Math.sin(ry), cx = x + c * sx, cz = z - s * sx, hw = 0.23, hl = len / 2, o = i * 12; const P = (k, a, b) => { marks.pos[o + k * 3] = cx + c * a + s * b; marks.pos[o + k * 3 + 1] = 0.025; marks.pos[o + k * 3 + 2] = cz - s * a + c * b; }; P(0, -hw, -hl); P(1, hw, -hl); P(2, -hw, hl); P(3, hw, hl); marks.born.fill(U.t.value, i * 4, i * 4 + 4); } marks.g.attributes.position.needsUpdate = marks.g.attributes.aB.needsUpdate = true; }

const FIRE0 = [6, 3.2, 0.9], FIRE1 = [1.6, 0.25, 0.02], SMK0 = [0.33, 0.3, 0.27], SMK1 = [0.1, 0.1, 0.11], DUST = [0.62, 0.5, 0.34];
let shake = 0;
function explode(x, z, R) {
  const k = R / 3; flash(x, z, 13 * k); ring(x, z, R * 1.5, 0xffc880, 0.35); addScorch(x, z, R * 1.5); shake = Math.min(1.2, shake + 0.25 * k);
  emit(PA, x, 1, z, 0, 0, 0, 0.1, R * 1.3, R * 2.1, [2.4, 1.5, 0.6], [1.2, 0.5, 0.1], 0.8);
  for (let i = 0; i < 9 * k + 4; i++) { const a = rnd() * 6.283, s = rr(1, 6) * k; emit(PA, x + Math.cos(a) * 0.4, rr(0.5, 1.4), z + Math.sin(a) * 0.4, Math.cos(a) * s, rr(2, 7), Math.sin(a) * s, rr(0.35, 0.75), rr(2.2, 3.6) * k, 0.5, FIRE0, FIRE1, 0.8, -2, 2.5); }
  for (let i = 0; i < 8 * k + 3; i++) { const a = rnd() * 6.283, s = rr(0.5, 3.5) * k; emit(PS, x + Math.cos(a) * 0.6, rr(0.6, 1.6), z + Math.sin(a) * 0.6, Math.cos(a) * s, rr(1.5, 4.5), Math.sin(a) * s, rr(1.2, 2.4), rr(1, 1.6) * k, rr(3, 4.6) * k, SMK0, SMK1, 0.75, -0.6, 1.4); }
  for (let i = 0; i < 16 * k; i++) { const a = rnd() * 6.283, s = rr(6, 17); emit(PA, x, 0.8, z, Math.cos(a) * s, rr(4, 13), Math.sin(a) * s, rr(0.4, 0.9), 0.22, 0.05, [9, 5, 1.2], [3, 0.6, 0.1], 1, 26, 0.6); }
}
function dustPuff(x, z, n, col = DUST, up = 1) { for (let i = 0; i < n; i++) emit(PS, x + rr(-0.3, 0.3), 0.25, z + rr(-0.3, 0.3), rr(-1, 1), rr(0.3, 1.2) * up, rr(-1, 1), rr(0.6, 1.2), 0.5, rr(1.3, 2.2), col, col, 0.32, 0, 1.5); }

// ---------- 弾 ----------
const bulIM = (() => { const im = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6).scale(0.13, 0.13, 0.75), new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 3.6, 1.0) }), 120); im.frustumCulled = false; im.count = 0; scene.add(im); return im; })();
const B = [];

// ---------- 入力 ----------
const I = { mx: 0, mz: 0, fire: false, ax: 0, az: 5, touch: coarse, ext: null };
{
  const keys = new Set(), ndc = new THREE.Vector2(0, 0.3), ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.2), hp = new THREE.Vector3(), joy = $('joy');
  let down = false, jid = null, jx = 0, jy = 0, ox = 0, oy = 0;
  const kk = e => e.key.length === 1 ? e.key.toLowerCase() : e.key;
  addEventListener('keydown', e => { keys.add(kk(e)); if (kk(e).startsWith('Arrow') || e.key === ' ') e.preventDefault(); }); addEventListener('keyup', e => keys.delete(kk(e))); addEventListener('blur', () => { keys.clear(); down = false; jid = null; jx = jy = 0; joy.hidden = true; });
  const setN = e => { ndc.x = e.clientX / innerWidth * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1; };
  addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button')) return; if (e.pointerType === 'touch') { I.touch = true; if (jid === null) { jid = e.pointerId; ox = e.clientX; oy = e.clientY; jx = jy = 0; joy.hidden = false; joy.style.left = ox + 'px'; joy.style.top = oy + 'px'; joy.firstElementChild.style.transform = 'translate(-50%,-50%)'; } } else { I.touch = false; if (e.button === 0) down = true; setN(e); } });
  addEventListener('pointermove', e => { if (e.pointerType === 'touch') { if (e.pointerId !== jid) return; let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy), R = 56; if (d > R) { dx *= R / d; dy *= R / d; } jx = dx / R; jy = dy / R; joy.firstElementChild.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; } else setN(e); });
  const up = e => { if (e.pointerType === 'touch') { if (e.pointerId === jid) { jid = null; jx = jy = 0; joy.hidden = true; } } else if (e.button === 0) down = false; };
  addEventListener('pointerup', up); addEventListener('pointercancel', up); addEventListener('contextmenu', e => e.preventDefault());
  I.poll = () => {
    if (I.ext) { Object.assign(I, I.ext); return; }
    let x = 0, z = 0; if (keys.has('a') || keys.has('ArrowLeft')) x -= 1; if (keys.has('d') || keys.has('ArrowRight')) x += 1; if (keys.has('w') || keys.has('ArrowUp')) z -= 1; if (keys.has('s') || keys.has('ArrowDown')) z += 1;
    if (jid !== null) { x = jx; z = jy; if (Math.hypot(x, z) < 0.15) x = z = 0; } const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; } I.mx = x; I.mz = z; I.fire = down || keys.has(' ');
    if (!I.touch) { ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hp)) { I.ax = hp.x; I.az = hp.z; } }
  };
}

// ---------- ゲームの動き（見本なので体力や成長はなし） ----------
const P = { x: 0, z: 0, vx: 0, vz: 0, ry: 0, ty: 0, cd: 0, recoil: 0, pitch: 0, roll: 0, markD: 0, dustT: 0, tank: mkTank(0xd9780f, false) }; scene.add(P.tank.g);
const E = []; let kills = 0, spawnT = 1.5, tgt = null, tgtT = 0;
function pushOut(o, r) { for (const b of OBS) { if (!b.alive) continue; const dx = o.x - b.x, dz = o.z - b.z, rr2 = r + b.r; if (dx > rr2 || dx < -rr2 || dz > rr2 || dz < -rr2) continue; const d = Math.hypot(dx, dz); if (d < rr2 && d > 1e-4) { o.x += dx / d * (rr2 - d); o.z += dz / d * (rr2 - d); } } o.x = clamp(o.x, -A, A); o.z = clamp(o.z, -A, A); }
function breakObs(b) {
  b.alive = false; (b.type === 'crate' ? crateIM : barrelIM).setMatrixAt(b.i, mat4(0, -50, 0, 0, 0.001)); (b.type === 'crate' ? crateIM : barrelIM).instanceMatrix.needsUpdate = true;
  if (b.type === 'barrel') { explode(b.x, b.z, 4.6); chunk(b.x, 1, b.z, 0x8a1410, 7, 9, 0.5); for (const e of E) if (!e.dead && Math.hypot(e.x - b.x, e.z - b.z) < 5.2) hurtE(e, 80); for (const o of OBS) if (o.alive && o.hp && Math.hypot(o.x - b.x, o.z - b.z) < 4.6) { o.hp -= 40; if (o.hp <= 0) o.fuse = rr(0.06, 0.16); } }
  else { chunk(b.x, 1, b.z, 0xa8733a, 12, 7, 0.75); dustPuff(b.x, b.z, 6, [0.6, 0.47, 0.3], 1.6); shake = Math.min(1.2, shake + 0.08); }
}
function hurtE(e, d) { if (e.dead) return; e.hp -= d; e.hit = 0.1; if (e.hp <= 0) { e.dead = true; scene.remove(e.tank.g); kills++; explode(e.x, e.z, 2.6); chunk(e.x, 1, e.z, 0x6a3fd0, 8, 8, 0.5); chunk(e.x, 1, e.z, 0x2b2e33, 5, 8, 0.4); } }
function spawn() { const a = rnd() * 6.283, e = { x: clamp(P.x + Math.cos(a) * 30, -A, A), z: clamp(P.z + Math.sin(a) * 30, -A, A), ry: 0, hp: 30, hit: 0, dead: false, tank: mkTank(0x6a3fd0, true), dustT: 0 }; if (Math.hypot(e.x - P.x, e.z - P.z) < 14 || pondD(e.x, e.z) < 0) { scene.remove(e.tank.g); return; } e.tank.g.scale.setScalar(0.82); scene.add(e.tank.g); E.push(e); }

function update(dt) {
  U.t.value += dt; I.poll();
  // 自機
  const wet = pondD(P.x, P.z) < 0, spd = 10 * (wet ? 0.6 : 1), k = 1 - Math.exp(-9 * dt), ax0 = P.vx, az0 = P.vz;
  P.vx += (I.mx * spd - P.vx) * k; P.vz += (I.mz * spd - P.vz) * k; const ox = P.x, oz = P.z; P.x += P.vx * dt; P.z += P.vz * dt; pushOut(P, 1.15);
  const moved = Math.hypot(P.x - ox, P.z - oz), v = Math.hypot(P.vx, P.vz);
  if (I.mx || I.mz) P.ry = angLerp(P.ry, Math.atan2(I.mx, I.mz), 1 - Math.exp(-7 * dt));
  // 加速でわずかに前後左右へ傾く（サスペンションの感じ）
  const acx = (P.vx - ax0) / dt, acz = (P.vz - az0) / dt, fw = acx * Math.sin(P.ry) + acz * Math.cos(P.ry), sd = acx * Math.cos(P.ry) - acz * Math.sin(P.ry);
  P.pitch = lerp(P.pitch, clamp(-fw * 0.006, -0.09, 0.09), 1 - Math.exp(-8 * dt)); P.roll = lerp(P.roll, clamp(sd * 0.006, -0.08, 0.08), 1 - Math.exp(-8 * dt));
  setCleats(P.tank, moved); P.markD += moved; if (P.markD > 0.55 && !wet) { addMark(P.x, P.z, P.ry, P.markD + 0.05); P.markD = 0; } else if (wet) P.markD = 0;
  P.dustT -= dt; if (v > 2 && P.dustT <= 0) { P.dustT = 0.06; const bx = P.x - Math.sin(P.ry) * 1.3, bz = P.z - Math.cos(P.ry) * 1.3; if (wet) { emit(PS, bx + rr(-0.6, 0.6), 0.2, bz + rr(-0.6, 0.6), rr(-1.5, 1.5), rr(2, 4.5), rr(-1.5, 1.5), rr(0.4, 0.7), 0.3, 1.0, [0.85, 0.95, 1], [0.7, 0.9, 1], 0.55, 11, 0.5); if (rnd() < 0.25) ring(P.x, P.z, 2.2, 0x9fd8ff, 0.7); } else if (isGrass(P.x, P.z)) { if (rnd() < 0.5) emit(PS, bx, 0.3, bz, rr(-1, 1), rr(0.5, 1.5), rr(-1, 1), 0.7, 0.4, 1.3, [0.5, 0.5, 0.3], [0.5, 0.5, 0.3], 0.16, 0, 1.5); } else dustPuff(bx, bz, 1); }
  let aim = P.ty, fire = I.fire;
  if (I.touch) { tgtT -= dt; if (tgtT <= 0 || !tgt || tgt.dead || tgt.alive === false) { tgtT = 0.2; tgt = null; let bd = 400; for (const e of E) { const d = (e.x - P.x) ** 2 + (e.z - P.z) ** 2; if (!e.dead && d < bd) { bd = d; tgt = e; } } if (!tgt) { bd = 90; for (const o of OBS) { if (!o.alive || !o.hp) continue; const d = (o.x - P.x) ** 2 + (o.z - P.z) ** 2; if (d < bd) { bd = d; tgt = o; } } } } fire = !!tgt; if (tgt) aim = Math.atan2(tgt.x - P.x, tgt.z - P.z); else if (I.mx || I.mz) aim = Math.atan2(I.mx, I.mz); P.ty = angLerp(P.ty, aim, 1 - Math.exp(-14 * dt)); }
  else P.ty = angLerp(P.ty, Math.atan2(I.ax - P.x, I.az - P.z), 1 - Math.exp(-22 * dt));
  P.cd -= dt; P.recoil = Math.max(0, P.recoil - dt * 7);
  if (fire && P.cd <= 0) {
    P.cd = 0.3; P.recoil = 1; const s = Math.sin(P.ty), c = Math.cos(P.ty), mx = P.x + s * 2.9, mz = P.z + c * 2.9; B.push({ x: mx, z: mz, vx: s * 46, vz: c * 46, l: 0.6, a: P.ty });
    flash(mx, mz, 22, 0xffc070); shake = Math.min(1.2, shake + 0.05); emit(PA, mx, 1.3, mz, 0, 0, 0, 0.07, 1.6, 2.6, [9, 6, 2.5], [5, 2, 0.4], 1);
    for (let i = 0; i < 4; i++) emit(PA, mx, 1.3, mz, s * rr(4, 14) + rr(-2, 2), rr(-0.5, 1.5), c * rr(4, 14) + rr(-2, 2), rr(0.1, 0.22), 0.7, 0.15, FIRE0, FIRE1, 0.9, 0, 4);
    for (let i = 0; i < 3; i++) emit(PS, mx, 1.3, mz, s * rr(1, 4) + rr(-1, 1), rr(0.3, 1.2), c * rr(1, 4) + rr(-1, 1), rr(0.5, 0.9), 0.4, rr(1.2, 1.9), [0.75, 0.72, 0.68], [0.5, 0.5, 0.5], 0.3, -0.5, 2.5);
    P.vx -= s * 1.6; P.vz -= c * 1.6;
  }
  // 敵
  spawnT -= dt; if (spawnT <= 0 && E.length < (HI ? 10 : 7)) { spawnT = 1.6; spawn(); }
  for (const e of E) {
    if (e.dead) continue; if (e.hit > 0) e.hit -= dt; let dx = P.x - e.x, dz = P.z - e.z; const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d; const es = 3.6 * (pondD(e.x, e.z) < 0 ? 0.6 : 1), ex = e.x, ez = e.z;
    if (d > 3.2) { e.x += dx * es * dt; e.z += dz * es * dt; } pushOut(e, 1.0); for (const o of E) { if (o === e || o.dead) continue; const qx = e.x - o.x, qz = e.z - o.z, q = Math.hypot(qx, qz); if (q < 2.3 && q > 0.01) { e.x += qx / q * (2.3 - q) * 0.5; e.z += qz / q * (2.3 - q) * 0.5; } }
    const mv = Math.hypot(e.x - ex, e.z - ez); if (mv > 0.001) e.ry = angLerp(e.ry, Math.atan2(e.x - ex, e.z - ez), 1 - Math.exp(-6 * dt)); setCleats(e.tank, mv / 0.82);
    e.tank.g.position.set(e.x, 0, e.z); e.tank.g.rotation.y = e.ry; e.tank.tur.rotation.y = Math.atan2(dx, dz) - e.ry; const s = e.hit > 0 ? 0.9 : 0.82; e.tank.g.scale.setScalar(s);
    e.dustT -= dt; if (mv > 0.01 && e.dustT <= 0) { e.dustT = 0.16; if (!isGrass(e.x, e.z) && pondD(e.x, e.z) > 0) dustPuff(e.x - Math.sin(e.ry), e.z - Math.cos(e.ry), 1); }
  }
  for (let i = E.length - 1; i >= 0; i--) if (E[i].dead) E.splice(i, 1);
  // 弾
  for (let i = B.length - 1; i >= 0; i--) {
    const b = B[i]; b.l -= dt; let dead = b.l <= 0; const st = 3;
    for (let s = 0; s < st && !dead; s++) {
      b.x += b.vx * dt / st; b.z += b.vz * dt / st;
      for (const e of E) if (!e.dead && (e.x - b.x) ** 2 + (e.z - b.z) ** 2 < 1.5) { hurtE(e, 12); dead = true; for (let j = 0; j < 6; j++) { const a = rnd() * 6.283; emit(PA, b.x, 1.2, b.z, Math.cos(a) * rr(3, 10), rr(2, 8), Math.sin(a) * rr(3, 10), rr(0.2, 0.45), 0.2, 0.04, [9, 5, 1.2], [3, 0.6, 0.1], 1, 24, 0.5); } flash(b.x, b.z, 10); break; }
      if (dead) break;
      for (const o of OBS) { if (!o.alive || (o.x - b.x) ** 2 + (o.z - b.z) ** 2 > (o.r + 0.1) ** 2) continue; dead = true; if (o.hp) { o.hp -= 12; if (o.hp <= 0) breakObs(o); else { chunk(b.x, 1.2, b.z, o.type === 'crate' ? 0xa8733a : 0x8a1410, 2, 5, 0.3); dustPuff(b.x, b.z, 2, [0.6, 0.47, 0.3]); } } else { dustPuff(b.x, b.z, 3, o.type === 'tree' ? [0.35, 0.4, 0.2] : [0.6, 0.6, 0.58]); for (let j = 0; j < 4; j++) { const a = rnd() * 6.283; emit(PA, b.x, 1.2, b.z, Math.cos(a) * rr(3, 9), rr(2, 7), Math.sin(a) * rr(3, 9), 0.3, 0.16, 0.04, [8, 5, 1.5], [3, 0.6, 0.1], 1, 24, 0.5); } } break; }
    }
    if (!dead && b.l <= 0.02) dead = true; if (dead) { if (b.l <= 0 && pondD(b.x, b.z) < 0) { ring(b.x, b.z, 1.6, 0x9fd8ff, 0.6); for (let j = 0; j < 5; j++) emit(PS, b.x, 0.2, b.z, rr(-1.5, 1.5), rr(3, 6), rr(-1.5, 1.5), 0.6, 0.3, 0.9, [0.9, 0.97, 1], [0.8, 0.9, 1], 0.6, 12, 0.5); } else if (b.l <= 0) dustPuff(b.x, b.z, 2); B.splice(i, 1); }
  }
  for (const o of OBS) if (o.alive && o.fuse !== undefined) { o.fuse -= dt; if (o.fuse <= 0) breakObs(o); }
  // 光の粒（空気感）
  if (rnd() < dt * 9) emit(PA, P.x + rr(-22, 22), rr(0.6, 4), P.z + rr(-16, 16), rr(-0.3, 0.3), rr(0.05, 0.3), rr(-0.3, 0.3), rr(2.5, 5), 0.1, 0.16, [2.2, 1.9, 1.0], [2.2, 1.9, 1.0], 0.55, 0, 0);
  updParticles(PA, dt); updParticles(PS, dt); updDebris(dt);
  for (const r of rings) { if (!r.m.visible) continue; r.t += dt / r.life; if (r.t >= 1) { r.m.visible = false; continue; } const s = r.R * (0.25 + 0.75 * (1 - (1 - r.t) ** 2)); r.m.scale.set(s, 1, s); r.m.material.opacity = (1 - r.t) * 0.7; }
  for (const l of flashes) l.intensity *= Math.exp(-14 * dt);
}
const camO = new THREE.Vector3(0, 28.5, 18.5), camT = new THREE.Vector3();
function draw(dt, snap) {
  const t = P.tank; t.g.position.set(P.x, 0, P.z); t.g.rotation.y = P.ry; t.tilt.rotation.x = P.pitch - P.recoil * 0.02 * Math.cos(P.ty - P.ry); t.tilt.rotation.z = P.roll; t.tur.rotation.y = P.ty - P.ry; t.brl.position.z = -P.recoil * 0.28;
  U.tank.value.set(P.x, 0, P.z);
  bulIM.count = B.length; B.forEach((b, i) => bulIM.setMatrixAt(i, mat4(b.x, 1.28, b.z, b.a, 1))); bulIM.instanceMatrix.needsUpdate = true;
  const k = snap ? 1 : 1 - Math.exp(-5 * dt), far = camera.aspect < 1 ? 1.0 + (1 - camera.aspect) * 0.75 : 1; camT.x += (P.x + P.vx * 0.25 - camT.x) * k; camT.z += (P.z + P.vz * 0.25 - camT.z) * k;
  shake = Math.max(0, shake - dt * 2.2); const sh = shake * shake * 0.5;
  camera.position.set(camT.x + camO.x * far + rr(-1, 1) * sh, camO.y * far + rr(-1, 1) * sh * 0.5, camT.z + camO.z * far + rr(-1, 1) * sh); camera.lookAt(camT.x, 0.8, camT.z - 1.5);
  const tx = Math.round(camT.x * 2) / 2, tz = Math.round(camT.z * 2) / 2; sun.target.position.set(tx, 0, tz - 3); sun.position.set(tx + SUN.x * 60, SUN.y * 60, tz - 3 + SUN.z * 60);
}

// ---------- 後処理と画質 ----------
const composer = new EffectComposer(renderer); composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.7, 1.05); composer.addPass(bloom); composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uPx: { value: new THREE.Vector2() }, uTilt: { value: 1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT, uTilt; uniform vec2 uPx; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb;
      float k = smoothstep(0.3, 0.52, abs(vUv.y - 0.52))*uTilt; // 画面の上下をぼかしてミニチュア風に
      if (k > 0.01) { vec2 r = uPx*k*3.2; c = (c + texture2D(tDiffuse, vUv+vec2(r.x,0.)).rgb + texture2D(tDiffuse, vUv-vec2(r.x,0.)).rgb + texture2D(tDiffuse, vUv+vec2(0.,r.y)).rgb + texture2D(tDiffuse, vUv-vec2(0.,r.y)).rgb + texture2D(tDiffuse, vUv+r*0.7).rgb + texture2D(tDiffuse, vUv-r*0.7).rgb + texture2D(tDiffuse, vUv+vec2(r.x,-r.y)*0.7).rgb + texture2D(tDiffuse, vUv-vec2(r.x,-r.y)*0.7).rgb)/9.; }
      float l = dot(c, vec3(0.299,0.587,0.114)); c = mix(vec3(l), c, 1.14); c = mix(c, c*c*(3.-2.*c), 0.22);
      c *= vec3(1.03,1.0,0.95); vec2 q = (vUv-0.5)*vec2(1.05,1.); c *= 1. - 0.42*pow(dot(q,q)*2., 1.4);
      c += (h(vUv*913. + uT) - 0.5)*0.022; gl_FragColor = vec4(c, 1.); }`,
});
composer.addPass(grade);
function setQ(hi) {
  HI = hi; try { localStorage.setItem('rich_q', hi ? '1' : '0'); } catch (e) { /* noop */ }
  $('q').textContent = L('画質: ', 'Quality: ') + (hi ? L('高', 'High') : L('軽', 'Light'));
  sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  grass.count = Math.floor(grass.userData.n * (hi ? 1 : 0.45)); grade.uniforms.uTilt.value = hi ? 1 : 0; bloom.strength = hi ? 0.5 : 0.4; resize();
}
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight, pr = Math.min(devicePixelRatio || 1, HI ? 2 : 1.25);
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); composer.setPixelRatio(pr); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); grade.uniforms.uPx.value.set(1 / w, 1 / h);
}
addEventListener('resize', resize); $('q').addEventListener('click', () => setQ(!HI));
$('ttl').innerHTML = L('グラフィック見本', 'Rich look sample') + (innerWidth > 560 ? L('<small>光と影・質感・水・草・爆発を作り込んだ場合</small>', '<small>Lighting, materials, water, grass, explosions</small>') : '');
$('keys').innerHTML = coarse ? L('ドラッグで移動　攻撃は自動', 'Drag to move, auto fire') : L('WASD 移動　マウスで狙う　クリック長押しで射撃', 'WASD move, mouse aim, hold click to fire');

// ---------- ループ ----------
const T = { manual: false }; let last = performance.now(), fpsT = 0, fpsN = 0;
function tick(dt, render) { update(dt); draw(dt, false); if (!render) return; grade.uniforms.uT.value = U.t.value % 10; composer.render(); }
function frame(now) {
  requestAnimationFrame(frame); const ms = now - last; last = now; if (T.manual || document.hidden) return;
  try { tick(Math.min(0.05, Math.max(0.001, ms / 1000)), true); } catch (e) { diag('LOOP ' + e.message); }
  fpsT += ms; fpsN++; if (fpsT > 500) { $('fps').textContent = Math.round(fpsN * 1000 / fpsT) + ' fps'; $('kills').innerHTML = L('撃破 ', 'Kills ') + '<b>' + kills + '</b>'; fpsT = fpsN = 0; }
}
try { setQ(HI); draw(0, true); camT.set(P.x, 0, P.z); requestAnimationFrame(frame); } catch (e) { diag('BOOT ' + e.message); }
window.__rk = { manual(v) { T.manual = v; }, input(o) { I.ext = o; }, step(n = 1, dt = 1 / 60, render = false) { for (let i = 0; i < n; i++) tick(dt, render && i === n - 1); }, state: () => ({ x: P.x, z: P.z, kills, enemies: E.map(e => [e.x, e.z]), obs: OBS.filter(o => o.alive && o.hp).map(o => [o.x, o.z, o.type]), calls: renderer.info.render.calls, tris: renderer.info.render.triangles }), setQ, explode };
