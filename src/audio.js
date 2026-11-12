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

// ---- BGM: 音声ファイルなしのステップシーケンサー。通常曲（calm）と体力が赤のときの緊迫曲（danger） ----
const TR = {
  calm: { bpm: 116, roots: [45, 41, 48, 43], minor: [1, 0, 0, 0] },   // Am F C G
  danger: { bpm: 156, roots: [40, 40, 41, 40], minor: [1, 1, 0, 1] }, // Em Em F Em
};
let mWant = 'off', mMode = 'off', mStep = 0, mNext = 0, mVol = 1;
export function music(mode) { mWant = mode; }
export function musicVol(v) { if (v === mVol) return; mVol = v; if (mg) mg.gain.setTargetAtTime(0.34 * v, ac.currentTime, 0.25); }
export function musicState() { return { want: mWant, mode: mMode, step: mStep, running: !!ac && ac.state === 'running' }; }
export function audioPause(p) { if (!ac) return; if (p) ac.suspend().catch(() => {}); else ac.resume().catch(() => {}); }
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
function mNote(type, midi, t, dur, vol) {
  const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = hz(midi);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(mg); o.start(t); o.stop(t + dur + 0.02);
}
function mKick(t, vol) {
  const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16); o.connect(g); g.connect(mg); o.start(t); o.stop(t + 0.18);
}
function mNoise(t, dur, vol, hp) {
  const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = nbuf; f.type = 'highpass'; f.frequency.value = hp;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f); f.connect(g); g.connect(mg); s.start(t, (mStep * 0.013) % 0.5); s.stop(t + dur + 0.02);
}
const ARP = [0, 2, 1, 2, 3, 2, 1, 2], BASS = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0];
function playStep(mode, st, t) {
  const tr = TR[mode], bar = (st >> 4) & 3, s = st & 15, root = tr.roots[bar], ch = tr.minor[bar] ? [0, 3, 7, 12] : [0, 4, 7, 12], d = 60 / tr.bpm / 4;
  if (mode === 'calm') {
    if (BASS[s]) mNote('triangle', root, t, d * 2.6, 0.5);
    if (s % 2 === 0) mNote('square', root + 24 + ch[ARP[(s >> 1) & 7]], t, d * 1.7, 0.07);
    if (s === 0 && bar % 2 === 0) mNote('triangle', root + 36 + ch[2], t, d * 14, 0.09);
    if (s === 0 || s === 8 || s === 10) mKick(t, s === 10 ? 0.45 : 0.8);
    if (s === 4 || s === 12) mNoise(t, 0.12, 0.3, 1800);
    if (s % 2 === 0) mNoise(t, 0.03, 0.09, 7000);
  } else {
    if (s % 2 === 0) mNote('sawtooth', root, t, d * 1.6, 0.26);
    mNote('square', root + 24 + (s % 4 < 2 ? 7 : 8), t, d * 0.8, s % 4 === 0 ? 0.085 : 0.05); // 半音で揺れる警報風
    if (s % 8 === 0) mNote('triangle', root + 36 + ch[bar === 2 ? 0 : 1], t, d * 6, 0.1);
    if (s % 4 === 0) mKick(t, 0.85);
    if (s === 4 || s === 12 || s === 15) mNoise(t, 0.1, 0.32, 2000);
    mNoise(t, 0.025, s % 2 ? 0.05 : 0.1, 8000);
  }
}
function sched() {
  if (!ac || ac.state !== 'running') return;
  if (mWant === 'off') { mMode = 'off'; return; }
  const now = ac.currentTime;
  if (mMode === 'off' || mNext < now - 0.2) { mMode = mWant; mStep = 0; mNext = now + 0.06; }
  while (mNext < now + 0.16) {
    if (mMode !== mWant && mStep % 4 === 0) { mMode = mWant; mStep = 0; } // 拍の頭で曲を切り替える
    playStep(mMode, mStep, mNext); mNext += 60 / TR[mMode].bpm / 4; mStep = (mStep + 1) & 63;
  }
}
