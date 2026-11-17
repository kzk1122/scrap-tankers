// 土台: three の再エクスポート、乱数、言語、保存、画面へのエラー表示
import * as THREE from 'three';
import { T as TR, LANGS } from './i18n.js';
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
  const d = { v: 1, scrap: 0, stage: 1, runs: 0, best: 1, up: { dmg: 0, hp: 0, spd: 0 }, parts: { hull: 'std', turret: 'cannon', gear: 'none', paint: 'orange' }, own: {}, daily: null, supply: null, login: null, lose: null, mute: false, lang: null, view: 0 };
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
  const ok = ['ja', 'en', ...LANGS], pre = v => String(v || '').toLowerCase().slice(0, 2);
  try { const q = pre(new URLSearchParams(location.search).get('lang')); if (ok.includes(q)) return q; } catch (e) { /* noop */ }
  if (ok.includes(save.lang)) return save.lang;
  const n = pre(navigator.language); return ok.includes(n) ? n : 'en';
}
export const LANG = pickLang();
try { document.documentElement.lang = LANG; } catch (e) { /* noop */ }
// 日本語と英語は呼び出し側が持つ。ほかの言語は英語の文をキーに i18n.js の表から引く。数や名前の入る文は型（{0} {1}）で合わせる
const LI = LANGS.indexOf(LANG), PAT = [], memo = new Map();
if (LI >= 0) {
  for (const k of Object.keys(TR)) if (k.includes('{')) PAT.push([new RegExp('^' + k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{\d\}/g, '(.+?)') + '$'), (k.match(/\{\d\}/g) || []).map(x => +x[1]), TR[k][LI], k.length]);
  PAT.sort((a, b) => b[3] - a[3]);
}
export const missing = new Set(); // 表にない文（テストで確認する）
function tr(en, inner) {
  const hit = TR[en]; if (hit) return hit[LI];
  if (memo.has(en)) return memo.get(en);
  let out = en, found = false;
  for (const [re, idx, tpl] of PAT) { const m = re.exec(en); if (!m) continue; out = tpl.replace(/\{(\d)\}/g, (_, d) => { const v = m[idx.indexOf(+d) + 1]; return /^[\d.,+\-% ]*$/.test(v) ? v : tr(v, true); }); found = true; break; }
  if (!found && !inner && /[A-Za-z]{3}/.test(en.replace(/<[^>]+>/g, '').replace(/\b(Lv|HP|WAVE|BOSS|MAX)\b/g, ''))) missing.add(en);
  if (memo.size < 500) memo.set(en, out); return out;
}
export const jaEn = (ja, en) => LANG === 'ja' ? ja : LI < 0 ? en : tr(en);

export function diag(msg) {
  const el = document.getElementById('diag'); if (!el) return;
  el.hidden = false; if (el.textContent.length < 1500) el.textContent += msg + '\n';
}
window.addEventListener('error', e => diag('ERR ' + e.message + ' @' + (e.lineno || '?')));
window.addEventListener('unhandledrejection', e => diag('REJ ' + (e.reason && e.reason.message || e.reason)));
