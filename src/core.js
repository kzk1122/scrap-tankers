// 土台: three の再エクスポート、乱数、言語、保存、画面へのエラー表示
import * as THREE from 'three';
export { THREE };
export const TARGET = __TARGET__; // 'artifact' | 'site' | 'cg'（出し先。build.mjs が決める）

let _s = ((Date.now() % 2147483647) ^ 0x9e3779b9) >>> 0;
export function seed(n) { _s = n >>> 0; }
export function rnd() {
  _s = (_s + 0x6D2B79F5) >>> 0; let t = _s;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rr = (a, b) => a + rnd() * (b - a);
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export function angLerp(a, b, k) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2; else if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

export const KEY = 'scrap_tankers_v1';
function load(str) {
  const d = { v: 1, scrap: 0, stage: 1, runs: 0, best: 1, up: { dmg: 0, hp: 0, spd: 0 }, parts: { hull: 'std', turret: 'cannon', gear: 'none', paint: 'orange' }, own: {}, daily: null, supply: null, login: null, mute: false, lang: null };
  try {
    const j = JSON.parse(str !== undefined ? str : localStorage.getItem(KEY) || 'null');
    if (j && j.v === 1) { Object.assign(d, j); d.up = Object.assign({ dmg: 0, hp: 0, spd: 0 }, j.up); d.parts = Object.assign({ hull: 'std', turret: 'cannon', gear: 'none', paint: 'orange' }, j.parts); d.own = j.own || {}; }
  } catch (e) { /* 保存が使えなくても遊べる */ }
  return d;
}
export const save = load();
// SDK 側の保存（アカウント連携）を読み込んだとき、同じ save オブジェクトへ上書きする
export function hydrate(str) { const d = load(str); for (const k of Object.keys(save)) delete save[k]; Object.assign(save, d); }
let persistCb = null;
export const onPersist = fn => { persistCb = fn; };
// 端末の現地時刻での「何日目か」。テストでは setDayOff で日付を進める
let dayOff = 0;
export const setDayOff = n => { dayOff = n; };
export const today = () => Math.floor((Date.now() - new Date().getTimezoneOffset() * 60000) / 86400000) + dayOff;
export function persist() { const s = JSON.stringify(save); try { localStorage.setItem(KEY, s); } catch (e) { /* noop */ } if (persistCb) persistCb(s); }

function pickLang() {
  try { const q = new URLSearchParams(location.search).get('lang'); if (q === 'ja' || q === 'en') return q; } catch (e) { /* noop */ }
  if (save.lang) return save.lang;
  return (navigator.language || 'en').toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
export const LANG = pickLang();
export const jaEn = (ja, en) => LANG === 'ja' ? ja : en;

export function diag(msg) {
  const el = document.getElementById('diag'); if (!el) return;
  el.hidden = false; if (el.textContent.length < 1500) el.textContent += msg + '\n';
}
window.addEventListener('error', e => diag('ERR ' + e.message + ' @' + (e.lineno || '?')));
window.addEventListener('unhandledrejection', e => diag('REJ ' + (e.reason && e.reason.message || e.reason)));
