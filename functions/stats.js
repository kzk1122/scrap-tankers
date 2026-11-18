// 計測の集計ページ（/stats）。?tg=site|cg で遊ばれた場所を絞る。?days=7 で期間を変えられる。?from=2026-11-18（日本時間）でその日より前を数えない（環境変数 STATS_FROM で既定にもできる）。環境変数 STATS_KEY を入れると ?k=… が必要になる
const FUNNEL = [['load', 'ロード完了'], ['move', '最初の移動'], ['kill', '最初の撃破'], ['lvl', '最初のレベルアップ'], ['t60', '1分プレイ'], ['end', '1回目の出撃が終わる'], ['again', 'もう一度出撃'], ['t180', '3分プレイ'], ['win', '拠点を奪還'], ['t600', '10分プレイ']];
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const pct = (a, b) => b ? (a / b * 100).toFixed(1) + '%' : '—';
export async function onRequestGet({ request, env }) {
  const u = new URL(request.url);
  if (env.STATS_KEY && u.searchParams.get('k') !== env.STATS_KEY) return new Response('forbidden', { status: 403 });
  const fromS = u.searchParams.get('from') || env.STATS_FROM || '', fromTs = /^\d{4}-\d{2}-\d{2}$/.test(fromS) ? Date.parse(fromS + 'T00:00:00+09:00') || 0 : 0;
  const daysP = u.searchParams.get('days'), days = Math.max(1, Math.min(90, +daysP || (fromTs ? 90 : 7))), since = Math.max(Date.now() - days * 86400000, fromTs);
  // tg: どこで遊ばれたか（site = 公開版 / cg = CrazyGames）。無指定はすべて
  const tg = ['site', 'cg'].includes(u.searchParams.get('tg')) ? u.searchParams.get('tg') : '', TG = tg ? ' AND tg = ?' : '', A = tg ? [since, tg] : [since];
  const link = (d, t = tg) => `?days=${d}${u.searchParams.get('from') ? '&from=' + esc(fromS) : ''}${t ? '&tg=' + t : ''}${env.STATS_KEY ? '&k=' + esc(u.searchParams.get('k')) : ''}`;
  const q = async (sql, ...a) => (await env.DB.prepare(sql).bind(...a).all()).results || [];
  const [fun, load, runs, ends, ret, parts, idle, by, wel] = await Promise.all([
    q(`SELECT n, dev, COUNT(DISTINCT sid) c FROM ev WHERE ts >= ?${TG} GROUP BY n, dev`, ...A),
    q(`SELECT dev, COUNT(*) c, AVG(json_extract(d,'$.ms')) ms, MAX(json_extract(d,'$.ms')) mx FROM ev WHERE ts >= ?${TG} AND n = 'load' GROUP BY dev`, ...A),
    q(`SELECT dev, COUNT(*) c, COUNT(DISTINCT sid) s FROM ev WHERE ts >= ?${TG} AND n = 'start' GROUP BY dev`, ...A),
    q(`SELECT json_extract(d,'$.stage') st, json_extract(d,'$.wave') wv, SUM(json_extract(d,'$.won')) won, SUM(json_extract(d,'$.home')) home, COUNT(*) c, AVG(json_extract(d,'$.s')) s, AVG(json_extract(d,'$.lvl')) lv FROM ev WHERE ts >= ?${TG} AND n = 'end' GROUP BY st, wv ORDER BY st, wv`, ...A),
    q(`SELECT dev, COUNT(DISTINCT CASE WHEN day = 0 THEN uid END) d0, COUNT(DISTINCT CASE WHEN day = 1 THEN uid END) d1, COUNT(DISTINCT CASE WHEN day >= 2 THEN uid END) d2 FROM ev WHERE ts >= ?${TG} GROUP BY dev`, ...A),
    q(`SELECT json_extract(d,'$.k') k, n, COUNT(*) c FROM ev WHERE ts >= ?${TG} AND n IN ('part','buy','tab') GROUP BY k, n ORDER BY c DESC LIMIT 30`, ...A),
    q(`SELECT dev, COUNT(*) c, AVG(mt) s FROM (SELECT sid, dev, MAX(t) mt, SUM(n = 'move') mv FROM ev WHERE ts >= ?${TG} GROUP BY sid, dev) WHERE mv = 0 GROUP BY dev`, ...A),
    q(`SELECT dev, json_extract(d,'$.by') k, COUNT(DISTINCT sid) c FROM ev WHERE ts >= ?${TG} AND n = 'move' GROUP BY dev, k`, ...A),
    q(`SELECT dev, COUNT(*) c, SUM(st) s FROM (SELECT sid, dev, MAX(n = 'start') st FROM ev WHERE ts >= ?${TG} AND sid IN (SELECT sid FROM ev WHERE ts >= ?${TG} AND n = 'welcome') GROUP BY sid, dev) GROUP BY dev`, ...A, ...A),
  ]);
  const cnt = (n, dev) => (fun.find(r => r.n === n && r.dev === dev) || { c: 0 }).c, DEV = [['d', 'PC'], ['m', 'スマホ']];
  let h = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Scrap Tankers 計測</title><style>body{font:14px/1.5 system-ui,sans-serif;background:#0f1728;color:#e8eefc;margin:0;padding:16px;max-width:860px;margin:auto}h1{font-size:20px}h2{font-size:15px;margin:22px 0 6px;color:#ffc83a}table{border-collapse:collapse;width:100%}td,th{padding:5px 8px;border-bottom:1px solid #26365c;text-align:right}td:first-child,th:first-child{text-align:left}th{color:#a9b6d6;font-weight:600}small,p{color:#a9b6d6}a{color:#49b8ff}.bad{color:#ff8b96}.ok{color:#5fe08a}</style><h1>Scrap Tankers 計測（${fromTs ? esc(fromS) + ' 以降' + (daysP ? '、直近 ' + days + ' 日' : '') : '直近 ' + days + ' 日'}）</h1><p>期間: <a href="${link(1)}">1日</a> / <a href="${link(7)}">7日</a> / <a href="${link(30)}">30日</a>　場所: <a href="${link(days, '')}">${tg ? '' : '▶'}すべて</a> / <a href="${link(days, 'site')}">${tg === 'site' ? '▶' : ''}公開版</a> / <a href="${link(days, 'cg')}">${tg === 'cg' ? '▶' : ''}CrazyGames</a>　数はセッション（1回の訪問）単位です。</p>`;
  h += '<h2>到達率（ロード完了を100%として）</h2><table><tr><th>段階</th>' + DEV.map(d => `<th>${d[1]}</th><th>率</th>`).join('') + '</tr>';
  for (const [n, ja] of FUNNEL) h += `<tr><td>${ja}</td>` + DEV.map(([dv]) => { const c = cnt(n, dv), b = cnt('load', dv), p = b ? c / b : 0; return `<td>${c}</td><td class="${n === 't60' ? (p >= 0.7 ? 'ok' : 'bad') : ''}">${pct(c, b)}</td>`; }).join('') + '</tr>';
  h += '</table><small>目標: 1分プレイ 70% 以上（CrazyGames のコンバージョンに相当）</small>';
  h += '<h2>一度も動かさずに離れた訪問</h2><table><tr><th>端末</th><th>訪問数</th><th>平均の滞在</th><th>動かした人の操作方法</th></tr>';
  for (const [dv, ja] of DEV) { const r = idle.find(x => x.dev === dv); h += `<tr><td>${ja}</td><td>${r ? r.c : 0}</td><td>${r ? Math.round(r.s) + ' 秒' : '—'}</td><td>${by.filter(x => x.dev === dv).map(x => esc(x.k) + ' ' + x.c).join(' / ') || '—'}</td></tr>`; }
  h += '</table><small>滞在は最後に記録が届いた時点まで。タブを裏で開いただけの訪問もここに入ります</small>';
  h += '<h2>ロード時間と出撃回数</h2><table><tr><th>端末</th><th>ロード平均</th><th>最長</th><th>出撃 / 訪問</th></tr>';
  for (const [dv, ja] of DEV) { const l = load.find(r => r.dev === dv), r = runs.find(x => x.dev === dv); h += `<tr><td>${ja}</td><td class="${l && l.ms > 3000 ? 'bad' : 'ok'}">${l ? (l.ms / 1000).toFixed(2) + ' 秒' : '—'}</td><td>${l ? (l.mx / 1000).toFixed(2) + ' 秒' : '—'}</td><td>${r && r.s ? (r.c / r.s).toFixed(2) : '—'}</td></tr>`; }
  h += '</table><small>目標: ロード 3 秒以内、1訪問あたり 3 出撃</small>';
  h += '<h2>翌日の戻り（D1）</h2><table><tr><th>端末</th><th>初日の人数</th><th>翌日も来た</th><th>D1</th><th>2日目以降</th></tr>';
  for (const [dv, ja] of DEV) { const r = ret.find(x => x.dev === dv) || { d0: 0, d1: 0, d2: 0 }; h += `<tr><td>${ja}</td><td>${r.d0}</td><td>${r.d1}</td><td>${pct(r.d1, r.d0)}</td><td>${r.d2}</td></tr>`; }
  h += '</table><small>目標: D1 12%。端末ごとの匿名IDで数えるため、公開から2日以上たってから意味が出ます</small>';
  h += '<p><small>その日はじめての再訪で出る「おかえり」画面: ' + DEV.map(([dv, ja]) => { const r = wel.find(x => x.dev === dv); return `${ja} 表示 ${r ? r.c : 0}・そこから出撃 ${r ? r.s : 0}`; }).join(' ／ ') + '</small></p>';
  h += '<h2>出撃が終わった場所</h2><table><tr><th>拠点</th><th>WAVE</th><th>回数</th><th>うち勝ち</th><th>うち基地に戻る</th><th>平均時間</th><th>レベルアップ</th></tr>';
  for (const r of ends) h += `<tr><td>拠点 ${esc(r.st)}</td><td>${r.wv >= 6 ? 'ボス' : 'WAVE ' + (r.wv + 1)}</td><td>${r.c}</td><td>${r.won || 0}</td><td>${r.home || 0}</td><td>${Math.round(r.s)} 秒</td><td>${r.lv ? (r.lv - 1).toFixed(1) + ' 回' : '—'}</td></tr>`;
  h += '</table><h2>結果画面で選ばれたもの</h2><table><tr><th>項目</th><th>種類</th><th>回数</th></tr>';
  for (const r of parts) h += `<tr><td>${esc(r.k)}</td><td>${r.n === 'part' ? 'パーツ購入' : r.n === 'buy' ? '強化購入' : 'タブを開く'}</td><td>${r.c}</td></tr>`;
  return new Response(h + '</table></html>', { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
