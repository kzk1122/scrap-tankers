// 効果音はすべて WebAudio で合成。種類ごとに鳴らす間隔を制限して同時発音を抑える
import { save, persist } from './core.js';
let ac = null, master = null, nbuf = null, mg = null;
const last = {};
export function audioInit() {
  if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ac.createGain(); master.gain.value = save.mute ? 0 : 0.5;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
    mg = ac.createGain(); mg.gain.value = 0.34; mg.connect(master); setInterval(sched, 30);
    nbuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = nbuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { ac = null; }
}
export function toggleMute() {
  save.mute = !save.mute; persist();
  if (master) master.gain.value = save.mute ? 0 : 0.5;
  return save.mute;
}
function ok(k, gap) {
  if (!ac || ac.state !== 'running' || save.mute) return false;
  const t = ac.currentTime; if (t - (last[k] || -9) < gap) return false; last[k] = t; return true;
}
function tone(type, f0, f1, dur, vol, at = 0) {
  const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, f0, f1) {
  const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
  s.buffer = nbuf; s.loop = true; f.type = 'lowpass';
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
export const sfx = {
  shot() { if (ok('shot', 0.05)) { tone('square', 480 + Math.random() * 90, 130, 0.09, 0.1); noise(0.07, 0.14, 2600, 600); } },
  hit() { if (ok('hit', 0.04)) tone('triangle', 330, 110, 0.06, 0.14); },
  crack() { if (ok('crack', 0.05)) noise(0.14, 0.3, 1800, 300); },
  boom(big) { if (ok('boom', 0.08)) { noise(big ? 0.7 : 0.36, big ? 0.8 : 0.5, big ? 1000 : 1500, 70); tone('sine', big ? 130 : 170, 34, big ? 0.5 : 0.26, 0.55); } },
  pick(n) { if (ok('pick', 0.035)) { const f = 660 + Math.min(n, 14) * 55; tone('sine', f, f * 1.5, 0.08, 0.13); } },
  heal() { if (ok('heal', 0.1)) { tone('sine', 520, 780, 0.12, 0.2); tone('sine', 780, 1040, 0.14, 0.18, 0.1); } },
  lvl() { if (ok('lvl', 0.2)) [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.16, 0.22, i * 0.07)); },
  hurt() { if (ok('hurt', 0.12)) { tone('sawtooth', 230, 70, 0.2, 0.22); noise(0.12, 0.25, 900, 200); } },
  ui() { if (ok('ui', 0.04)) tone('triangle', 620, 930, 0.07, 0.14); },
  buy() { if (ok('buy', 0.05)) { tone('square', 440, 880, 0.08, 0.1); tone('square', 880, 1320, 0.1, 0.1, 0.07); } },
  wave() { if (ok('wave', 0.3)) { tone('sawtooth', 196, 196, 0.18, 0.14); tone('sawtooth', 294, 294, 0.3, 0.14, 0.16); } },
  win() { if (ok('win', 0.5)) [523, 659, 784, 1047, 1319].forEach((f, i) => tone('triangle', f, f, 0.3, 0.22, i * 0.11)); },
  lose() { if (ok('lose', 0.5)) [392, 330, 262, 196].forEach((f, i) => tone('sawtooth', f, f * 0.97, 0.28, 0.16, i * 0.16)); },
};

// ---- BGM: 音声ファイルなしのステップシーケンサー。通常曲はマーチ（march）、体力が赤のときは緊迫曲（danger） ----
// マーチは8小節・ハ長調のオリジナル。ブラス風の主旋律、ズンチャの低音と和音、スネアのロール、大太鼓
const C = [48, 0], F = [41, 0], Gc = [43, 0]; // [根音, 短調か]
const MARCH = {
  bpm: 120, len: 128, chords: [C, C, F, C, Gc, Gc, C, C],
  // 小節ごとの主旋律 [位置(16分), 音, 長さ(16分)]
  mel: [
    [[0, 67, 3], [3, 67, 1], [4, 72, 4], [8, 76, 3], [11, 72, 1], [12, 76, 4]],
    [[0, 79, 6], [6, 76, 2], [8, 72, 4], [12, 67, 4]],
    [[0, 69, 3], [3, 69, 1], [4, 72, 4], [8, 77, 3], [11, 72, 1], [12, 77, 4]],
    [[0, 76, 6], [6, 72, 2], [8, 67, 8]],
    [[0, 74, 3], [3, 74, 1], [4, 79, 4], [8, 77, 3], [11, 74, 1], [12, 71, 4]],
    [[0, 74, 4], [4, 71, 4], [8, 67, 4], [12, 67, 2], [14, 69, 1], [15, 71, 1]],
    [[0, 72, 4], [4, 76, 4], [8, 74, 3], [11, 72, 1], [12, 74, 4]],
    [[0, 72, 8], [8, 67, 2], [10, 67, 2], [12, 72, 4]],
  ],
  snare: [1, 0, 0.35, 0.35, 1, 0, 0.35, 0.35, 1, 0, 0.35, 0.35, 1, 0.45, 0.55, 0.75],
  roll: [1, 0, 0.35, 0.35, 1, 0, 0.35, 0.35, 0.4, 0.45, 0.5, 0.55, 0.65, 0.75, 0.85, 1],
};
const DANGER = { bpm: 156, len: 64, chords: [[40, 1], [40, 1], [41, 0], [40, 1]] };
const TR = { calm: MARCH, danger: DANGER };
let mWant = 'off', mMode = 'off', mStep = 0, mNext = 0, mVol = 1, brass = null;
export function music(mode) { mWant = mode; }
export function musicVol(v) { if (v === mVol) return; mVol = v; if (mg) mg.gain.setTargetAtTime(0.34 * v, ac.currentTime, 0.25); }
export function musicState() { return { want: mWant, mode: mMode, step: mStep, running: !!ac && ac.state === 'running' }; }
export function audioPause(p) { if (!ac) return; if (p) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); }
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function mNote(type, midi, t, dur, vol, dest) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = hz(midi);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.012); g.gain.setValueAtTime(vol, t + Math.max(0.013, dur * 0.6)); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest || mg); o.start(t); o.stop(t + dur + 0.02);
}
function mKick(t, vol, f = 150) {
  const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(mg); o.start(t); o.stop(t + 0.2);
}
function mNoise(t, dur, vol, hp) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nbuf; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(mg); s.start(t, (mStep * 0.013) % 0.5); s.stop(t + dur + 0.02);
}
function mSnare(t, v) { mNoise(t, 0.07 + 0.05 * v, 0.34 * v, 1500); mNote('triangle', 57, t, 0.05, 0.12 * v); }
function playStep(mode, st, t) {
  const tr = TR[mode], bar = st >> 4, s = st & 15, d = 60 / tr.bpm / 4;
  if (!brass) { brass = ac.createBiquadFilter(); brass.type = 'lowpass'; brass.frequency.value = 2100; brass.Q.value = 0.7; brass.connect(mg); }
  let ch = tr.chords[bar]; if (mode === 'calm' && bar === 6 && s >= 8) ch = Gc; // 7小節目の後半は属和音
  const root = ch[0], tri = ch[1] ? [0, 3, 7] : [0, 4, 7];
  if (mode === 'calm') {
    for (const n of tr.mel[bar]) if (n[0] === s) {
      mNote('sawtooth', n[1], t, d * n[2] * 0.92, 0.2, brass); mNote('square', n[1] - 12, t, d * n[2] * 0.9, 0.05, brass);
      if (bar >= 4) mNote('triangle', n[1] + 12, t, d * n[2] * 0.8, 0.07); // 後半はピッコロを重ねる
    }
    if (s === 0 || s === 8) mNote('triangle', s === 0 ? root : root - 5, t, d * 3.4, 0.6);         // ズン（チューバ）
    if (s === 4 || s === 12) for (const k of tri) mNote('sawtooth', root + 12 + k, t, d * 1.5, 0.07, brass); // チャ（和音）
    const sn = (bar === 3 || bar === 7 ? tr.roll : tr.snare)[s]; if (sn) mSnare(t, sn);
    if (s === 0 || s === 8) mKick(t, 0.8, 120);
    if (s === 0 && bar % 4 === 0) mNoise(t, 0.7, 0.16, 5000); // シンバル
  } else {
    if (s % 2 === 0) mNote('sawtooth', root, t, d * 1.6, 0.26, brass);
    mNote('square', root + 24 + (s % 4 < 2 ? 7 : 8), t, d * 0.8, s % 4 === 0 ? 0.085 : 0.05); // 半音で揺れる警報風
    if (s % 8 === 0) mNote('sawtooth', root + 24 + tri[bar === 2 ? 0 : 1], t, d * 6, 0.12, brass);
    if (s % 4 === 0) mKick(t, 0.85);
    mSnare(t, s % 4 === 0 ? 0.9 : s % 2 === 0 ? 0.5 : 0.3); // 16分で刻む急ぎ足のスネア
  }
}
function sched() {
  if (!ac || ac.state !== 'running') return;
  if (mWant === 'off') { mMode = 'off'; return; }
  const now = ac.currentTime;
  if (mMode === 'off' || mNext < now - 0.2) { mMode = mWant; mStep = 0; mNext = now + 0.06; }
  while (mNext < now + 0.16) {
    if (mMode !== mWant && mStep % 4 === 0) { mMode = mWant; mStep = 0; } // 拍の頭で曲を切り替える
    playStep(mMode, mStep, mNext); mNext += 60 / TR[mMode].bpm / 4; mStep = (mStep + 1) % TR[mMode].len;
  }
}
