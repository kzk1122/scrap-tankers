// 入力: PC は WASD＋マウス、スマホは画面ドラッグのスティック（照準と射撃は自動）
import { THREE } from './core.js';
export const I = { mx: 0, mz: 0, fire: false, ax: 0, az: -1, touch: false, moved: false, fired: false, ext: null, dest: null, auto: false, click: false, sp: false, lock: false, px: 0, pz: 0 };
const keys = new Set(); const ndc = new THREE.Vector2(0, 0.3);
export const STOP_R = 2.8; // この半径の内側にカーソルがあると止まる
let follow = false, kbd = false; // PC: マウスに戦車がついてくる（既定）。移動キーを押したらキーボード操作、クリックで戻る
let joyId = null, jx = 0, jy = 0, ox = 0, oy = 0, mouseDown = false, joyEl = null, first = null;
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), hitP = new THREE.Vector3();
const isUi = t => !!(t && t.closest && t.closest('.ov,button'));

// ---- PC: 出撃中はカーソルを隠し、戦車のまわりの小さな円の中だけで動くスティックにする（Pointer Lock）。使えない環境では今までのマウス追従のまま ----
const KR = 56, tv = new THREE.Vector3();
let locked = false, lockOff = false, want = false, kx = 0, ky = 0;
const cv = () => document.getElementById('c');
function tryLock() {
  if (I.touch || I.ext || locked || !want || lockOff) return; const c = cv(); if (!c || !c.requestPointerLock) return;
  try { const r = c.requestPointerLock(); if (r && r.catch) r.catch(() => { }); } catch (e) { /* noop */ }
}
export function setLock(w) { if (w === want) return; want = w; if (w) tryLock(); else if (locked) document.exitPointerLock(); }
export function initInput(onFirst) {
  document.addEventListener('pointerlockchange', () => {
    const was = locked; locked = document.pointerLockElement === cv(); I.lock = locked;
    if (locked) { kx = ky = 0; joyEl.classList.add('pc'); joyEl.hidden = false; }
    else { if (was && want) lockOff = true; joyEl.classList.remove('pc'); if (joyId === null) joyEl.hidden = true; } // Esc で外したら、画面をクリックするまで戻さない
  });
  first = onFirst; joyEl = document.getElementById('joy');
  document.getElementById('sp').addEventListener('pointerdown', e => { e.preventDefault(); I.sp = true; });
  try { I.touch = matchMedia('(pointer:coarse)').matches; } catch (e) { /* noop */ }
  const fire1 = () => { if (first) { first(); } };
  window.addEventListener('keydown', e => {
    fire1(); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys.add(k);
    if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
    if (k !== 'Escape') tryLock();
    if ((k === ' ' || k === 'e') && !e.repeat) I.sp = true; // 必殺技
  });
  window.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; joyId = null; jx = jy = 0; if (joyEl) joyEl.hidden = true; });
  window.addEventListener('pointerdown', e => {
    fire1(); if (isUi(e.target)) return;
    if (e.pointerType === 'touch') {
      I.touch = true;
      if (joyId === null) { joyId = e.pointerId; ox = e.clientX; oy = e.clientY; jx = jy = 0; joyEl.hidden = false; joyEl.style.left = ox + 'px'; joyEl.style.top = oy + 'px'; joyEl.firstElementChild.style.transform = 'translate(-50%,-50%)'; }
    } else { I.touch = false; if (e.button === 0) { if (locked) kx = ky = 0; /* スティック中の左クリックはブレーキ */ lockOff = false; tryLock(); } if (e.button === 0) { mouseDown = true; I.click = true; kbd = false; follow = true; } else if (e.button === 2) I.sp = true; setNdc(e); }
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy), R = 56;
      if (d > R) { dx *= R / d; dy *= R / d; }
      jx = dx / R; jy = dy / R; joyEl.firstElementChild.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else if (locked) { kx += e.movementX; ky += e.movementY; const d = Math.hypot(kx, ky); if (d > KR) { kx *= KR / d; ky *= KR / d; } if (e.movementX || e.movementY) kbd = false; }
    else { setNdc(e); if (!kbd && (e.movementX || e.movementY)) follow = true; }
  });
  document.addEventListener('mouseleave', () => { follow = false; });
  const up = e => {
    if (e.pointerType === 'touch') { if (e.pointerId === joyId) { joyId = null; jx = jy = 0; joyEl.hidden = true; } }
    else if (e.button === 0) mouseDown = false;
  };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('contextmenu', e => e.preventDefault());
}
function setNdc(e) { ndc.x = e.clientX / innerWidth * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1; }

export function pollInput(camera) {
  if (I.ext) { I.mx = I.ext.mx || 0; I.mz = I.ext.mz || 0; I.fire = !!I.ext.fire; I.touch = !!I.ext.auto; if (I.mx || I.mz) I.moved = true; if (I.ext.ax !== undefined) { I.ax = I.ext.ax; I.az = I.ext.az; } if (I.ext.sp) I.sp = true; return; }
  let x = 0, z = 0;
  if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('d') || keys.has('ArrowRight')) x += 1;
  if (keys.has('w') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('s') || keys.has('ArrowDown')) z += 1;
  if (joyId !== null) { x = jx; z = jy; if (Math.hypot(x, z) < 0.15) x = z = 0; }
  const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
  if (locked) { // スティックの輪を戦車の位置に出す
    tv.set(I.px, 1, I.pz).project(camera); joyEl.style.left = (tv.x + 1) / 2 * innerWidth + 'px'; joyEl.style.top = (1 - tv.y) / 2 * innerHeight + 'px'; joyEl.firstElementChild.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`; joyEl.classList.toggle('stop', Math.hypot(kx, ky) / KR <= 0.25);
  }
  if (!I.touch && !locked) { ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hitP)) { I.ax = hitP.x; I.az = hitP.z; } }
  if (l > 0) { kbd = true; follow = false; I.auto = locked; }
  else if (locked) { if (!kbd) { I.auto = true; const m = Math.hypot(kx, ky) / KR, g = Math.min(1, (m - 0.25) / 0.45); if (g > 0) { x = kx / KR / m * g; z = ky / KR / m * g; } } } // まん中の小さな円の中は止まる。外に出すとすぐ全速
  else if (!I.touch && follow) {
    I.auto = true;
    // カメラの中心（戦車が落ち着く場所）からカーソルまでを見る。戦車やカメラが動いても向きと強さが変わらないので、滑らずに狙った所で止まれる
    const dx = I.ax - camera.position.x, dz = I.az - (camera.position.z - camera.position.y * 0.52), d = Math.hypot(dx, dz) || 1, k = Math.min(1, (d - STOP_R) / 2.2); // スマホのスティックと同じ考え方: 戦車のまわりの円の中にカーソルを置くと止まり、外に出すとその方向へすぐ全速
    if (k > 0) { const m = 0.35 + 0.65 * k; x = dx / d * m; z = dz / d * m; }
  }
  I.mx = x; I.mz = z; if (Math.hypot(x, z) > 0.3) I.moved = true;
  I.fire = mouseDown;
  if (I.fire) I.fired = true;
}
