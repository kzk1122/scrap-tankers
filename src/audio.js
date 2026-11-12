// 効果音はすべて WebAudio で合成。種類ごとに鳴らす間隔を制限して同時発音を抑える
import { save, persist } from './core.js';
let ac = null, master = null, nbuf = null;
const last = {};
export function audioInit() {
  if (ac) { if (ac.state !== 'running') ac.resume().catch(() => {}); return; }
  try {
    ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ac.createGain(); master.gain.value = save.mute ? 0 : 0.5;
    const comp = ac.createDynamicsCompressor(); master.connect(comp); comp.connect(ac.destination);
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
