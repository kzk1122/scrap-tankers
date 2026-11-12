-- 計測イベント。wrangler d1 execute <db> --file schema.sql
CREATE TABLE IF NOT EXISTS ev (ts INTEGER, uid TEXT, sid TEXT, tg TEXT, dev TEXT, lang TEXT, day INTEGER, run INTEGER, n TEXT, t REAL, d TEXT);
CREATE INDEX IF NOT EXISTS ev_n ON ev (n, ts);
CREATE INDEX IF NOT EXISTS ev_sid ON ev (sid);

-- 例: 到達率（セッション数）
-- SELECT n, dev, COUNT(DISTINCT sid) FROM ev WHERE n IN ('load','move','kill','lvl','t60','t180','t600','win') GROUP BY n, dev;
-- 例: ロード時間の中央値に近い値
-- SELECT dev, AVG(t) FROM ev WHERE n = 'load' GROUP BY dev;
-- 例: 負けた波
-- SELECT json_extract(d,'$.stage') st, json_extract(d,'$.wave') wv, COUNT(*) FROM ev WHERE n = 'end' AND json_extract(d,'$.won') = 0 GROUP BY st, wv;
-- 例: D1（初日の翌日に来た人の割合）
-- SELECT COUNT(DISTINCT CASE WHEN day = 1 THEN uid END) * 1.0 / COUNT(DISTINCT CASE WHEN day = 0 THEN uid END) FROM ev;
