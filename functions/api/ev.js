// Cloudflare Pages Functions: 計測イベントの受け口。D1 を DB という名前でつなぐ（schema.sql 参照）
export async function onRequestPost({ request, env }) {
  try {
    const txt = await request.text(); if (txt.length > 16000) return new Response('too big', { status: 413 });
    const b = JSON.parse(txt), evs = Array.isArray(b.evs) ? b.evs.slice(0, 40) : [];
    const s = (v, n) => String(v == null ? '' : v).slice(0, n), now = Date.now();
    const st = env.DB.prepare('INSERT INTO ev (ts, uid, sid, tg, dev, lang, day, run, n, t, d) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
    const rows = evs.map(e => { const { n, t, ...d } = e || {}; return st.bind(now, s(b.id, 16), s(b.sid, 16), s(b.tg, 10), s(b.dev, 2), s(b.lang, 4), b.day | 0, b.run | 0, s(n, 24), +t || 0, s(JSON.stringify(d), 300)); });
    if (rows.length) await env.DB.batch(rows);
    return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
  } catch (e) { return new Response('bad', { status: 400 }); }
}
export const onRequestOptions = () => new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type' } });
