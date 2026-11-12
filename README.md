# Scrap Tankers（スクラップ・タンカーズ）

CrazyGames のフルローンチを目指す見下ろし型ローグライト戦車ゲーム。企画書: https://claude.ai/artifact/Td8d28BRgUYmaH17qdeaj7

## 構成
- `src/*.js` ES モジュール。`core`（乱数・保存・言語）`gfx`（描画）`world`（壊せる地形）`input` `audio` `game`（本体）`ui` `platform`（出し先ごとの違い）`main`
- `src/page.html` HTML と CSS。`build.mjs` が esbuild で1本にまとめて HTML 1枚にする（three.js も同梱、外部読み込みなし）
- `node build.mjs artifact` → `dist/scrap-tankers.html`（試作 Artifact 用）、`node build.mjs site` → `dist/index.html`

## 出し先
- `node build.mjs site` → `dist/index.html`（Cloudflare Pages 用。計測は `/api/ev` へ送る。受け口は `functions/api/ev.js`、表は `schema.sql`、D1 を `DB` という名前でつなぐ）
- `node build.mjs cg` → `dist/cg/index.html`（CrazyGames 用。SDK v3 を読み込み、進捗は SDK のデータ保存、gameplayStart/Stop、loadingStart/Stop、happytime、muteAudio に対応。提出時は「Progress Save」を選ぶ）
- 計測の送り先は `EV_URL=https://… node build.mjs cg` で変えられる（空なら送らない。cg は既定で送らない）
- 計測イベント: load（ロード時間 ms）/ start / move / kill / lvl / end（負けた波と場所）/ win / again / buy / part / equip / tab / t60 / t180 / t600 / leave

## テスト（Playwright、`PW=$(npm root -g)/playwright` を付ける）
- `test/smoke.mjs` 起動・画面撮影、`test/real.mjs` 実入力の通し確認
- `test/platform.mjs` 計測イベントと CrazyGames SDK（偽物）とのつなぎ込み
- `test/bots.mjs` ボット計測。`MODES=idle,pcidle,mash,good RUNS=5 STAGE=1 UP=0`。中央値でバランスを決める
- ページ内の入口は `window.__tk`（manual / seed / step / input / state / pick / restart）

## 版1（2026-11-11）の計測（拠点1、ガレージ強化なし、5回の中央値）
| ボット | 生存 | 到達 | 勝ち |
| --- | --- | --- | --- |
| 何もしない（PC・撃たない） | 21秒 | WAVE 1 | 0/5 |
| 何もしない（スマホ・自動射撃） | 59秒 | WAVE 3 | 0/5 |
| 適当に動く | 134秒 | WAVE 6 | 2/5 |
| 上手（逃げ撃ち） | 149秒 | ボス撃破 | 5/5 |
最初のレベルアップは 6〜12秒。

## 決めたこと
- 負けあり・スクラップは必ず持ち帰り / 待ちなし / 画面をふさがない
- 序盤の波は被ダメージを軽くし（WAVE1 は半分）、被弾後 0.45 秒は無敵
- スマホは照準と射撃が自動、PC はマウス照準＋クリック射撃
