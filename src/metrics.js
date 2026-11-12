// 計測: どこでやめたかを知るための匿名イベント。送り先（__EV__）が空なら貯めるだけで送らない
import { TARGET, save, persist, today, LANG } from './core.js';
const URL_ = __EV__, sid = Math.random().toString(36).slice(2, 10), q = [], seen = {};
export const log = [];
let touch = false;
export function evTouch(v) { touch = v; }
function uid() { if (!save.id) { save.id = Math.random().toString(36).slice(2, 12); save.d0 = today(); persist(); } return save.id; }
export function ev(n, d) {
  const e = Object.assign({ n, t: Math.round(performance.now() / 100) / 10 }, d);
  log.push(e); if (log.length > 300) log.shift();
  if (!URL_) return; q.push(e); if (q.length >= 12) flush();
}
export function once(n, d) { if (seen[n]) return; seen[n] = 1; ev(n, d); }
export function flush() {
  if (!URL_ || !q.length) return;
  const body = JSON.stringify({ id: uid(), sid, tg: TARGET, dev: touch ? 'm' : 'd', lang: LANG, day: today() - (save.d0 || today()), run: save.runs, evs: q.splice(0) });
  try { if (!(navigator.sendBeacon && navigator.sendBeacon(URL_, body))) fetch(URL_, { method: 'POST', body, keepalive: true }).catch(() => {}); } catch (e) { /* 計測の失敗で遊びを止めない */ }
}
// 遊んだ時間の節目（1分・3分・10分）。画面が見えている時間だけ数える
let played = 0; const MARKS = [60, 180, 600];
export function evTime(dt) { played += dt; while (MARKS.length && played >= MARKS[0]) ev('t' + MARKS.shift()); }
if (URL_) { setInterval(flush, 15000); }
