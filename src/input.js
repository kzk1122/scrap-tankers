// 入力: PC は WASD＋マウス、スマホは画面ドラッグのスティック（照準と射撃は自動）
import { THREE } from './core.js';
export const I = { mx: 0, mz: 0, fire: false, ax: 0, az: -1, touch: false, moved: false, fired: false, ext: null, dest: null, auto: false, click: false, px: 0, pz: 0 };
const keys = new Set(); const ndc = new THREE.Vector2(0, 0.3);
let joyId = null, jx = 0, jy = 0, ox = 0, oy = 0, mouseDown = false, joyEl = null, first = null;
const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1), hitP = new THREE.Vector3();
const isUi = t => !!(t && t.closest && t.closest('.ov,button'));

export function initInput(onFirst) {
  first = onFirst; joyEl = document.getElementById('joy');
  try { I.touch = matchMedia('(pointer:coarse)').matches; } catch (e) { /* noop */ }
  const fire1 = () => { if (first) { first(); } };
  window.addEventListener('keydown', e => {
    fire1(); const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys.add(k);
    if (k.startsWith('Arrow') || k === ' ') e.preventDefault();
  });
  window.addEventListener('keyup', e => keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key));
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; joyId = null; jx = jy = 0; if (joyEl) joyEl.hidden = true; });
  window.addEventListener('pointerdown', e => {
    fire1(); if (isUi(e.target)) return;
    if (e.pointerType === 'touch') {
      I.touch = true;
      if (joyId === null) { joyId = e.pointerId; ox = e.clientX; oy = e.clientY; jx = jy = 0; joyEl.hidden = false; joyEl.style.left = ox + 'px'; joyEl.style.top = oy + 'px'; joyEl.firstElementChild.style.transform = 'translate(-50%,-50%)'; }
    } else { I.touch = false; if (e.button === 0) { mouseDown = true; I.click = true; } setNdc(e); }
  });
  window.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') {
      if (e.pointerId !== joyId) return;
      let dx = e.clientX - ox, dy = e.clientY - oy; const d = Math.hypot(dx, dy), R = 56;
      if (d > R) { dx *= R / d; dy *= R / d; }
      jx = dx / R; jy = dy / R; joyEl.firstElementChild.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    } else setNdc(e);
  });
  const up = e => {
    if (e.pointerType === 'touch') { if (e.pointerId === joyId) { joyId = null; jx = jy = 0; joyEl.hidden = true; } }
    else if (e.button === 0) mouseDown = false;
  };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('contextmenu', e => e.preventDefault());
}
function setNdc(e) { ndc.x = e.clientX / innerWidth * 2 - 1; ndc.y = -(e.clientY / innerHeight) * 2 + 1; }

export function pollInput(camera) {
  if (I.ext) { I.mx = I.ext.mx || 0; I.mz = I.ext.mz || 0; I.fire = !!I.ext.fire; I.touch = !!I.ext.auto; if (I.ext.ax !== undefined) { I.ax = I.ext.ax; I.az = I.ext.az; } return; }
  let x = 0, z = 0;
  if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('d') || keys.has('ArrowRight')) x += 1;
  if (keys.has('w') || keys.has('ArrowUp')) z -= 1;
  if (keys.has('s') || keys.has('ArrowDown')) z += 1;
  if (joyId !== null) { x = jx; z = jy; if (Math.hypot(x, z) < 0.15) x = z = 0; }
  const l = Math.hypot(x, z); if (l > 1) { x /= l; z /= l; }
  if (!I.touch) { ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, hitP)) { I.ax = hitP.x; I.az = hitP.z; } }
  // PC: クリックした場所へ移動（押しっぱなしで追従）。その間は狙いも自動。キーを押すとキーボード操作に戻る
  if (l > 0) { I.dest = null; I.auto = false; }
  else if (!I.touch) {
    if (mouseDown || I.click) { I.dest = { x: I.ax, z: I.az }; I.auto = true; }
    if (I.dest) { const dx = I.dest.x - I.px, dz = I.dest.z - I.pz, d = Math.hypot(dx, dz); if (d < 0.6) I.dest = null; else { x = dx / d; z = dz / d; } }
  }
  I.mx = x; I.mz = z; if (x || z) I.moved = true;
  I.fire = mouseDown || keys.has(' ');
  if (I.fire) I.fired = true;
}
