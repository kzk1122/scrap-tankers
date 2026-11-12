// 出し先ごとの違いはここだけに置く。cg = CrazyGames SDK v3（読み込みは build.mjs が <head> に入れる）
import { TARGET, KEY, hydrate, persist, onPersist } from './core.js';
let sdk = null, muteCb = null;
const call = f => { try { if (sdk) return f(sdk); } catch (e) { /* SDK が止まっていても遊べる */ } };
const wait = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
export const platform = {
  name: TARGET, user: null,
  // 起動時に1回。SDK が無い・遅い・無効でも 3 秒以内に必ず戻る
  async init() {
    if (TARGET !== 'cg' || !window.CrazyGames || !window.CrazyGames.SDK) return;
    try {
      const S = window.CrazyGames.SDK; await wait(S.init(), 3000);
      if (S.environment === 'disabled' || !S.game) return;
      sdk = S; call(s => s.game.loadingStart());
      // 進捗は SDK のデータ保存が正。無ければ端末の保存を SDK へ移す
      const cloud = call(s => s.data.getItem(KEY));
      if (cloud) hydrate(cloud);
      onPersist(str => call(s => s.data.setItem(KEY, str)));
      if (!cloud) persist();
      call(s => s.game.addSettingsChangeListener(() => muteCb && muteCb(platform.muted())));
      wait(Promise.resolve(call(s => s.user.getUser())), 2000).then(u => { if (u && u.username) platform.user = { name: u.username, pic: u.profilePictureUrl || '' }; }).catch(() => {});
    } catch (e) { sdk = null; }
  },
  loaded() { call(s => s.game.loadingStop()); },
  gameplayStart() { call(s => s.game.gameplayStart()); },
  gameplayStop() { call(s => s.game.gameplayStop()); },
  happyTime() { call(s => s.game.happytime()); },
  // サイト側の「音を消す」設定。ゲーム内の音ボタンより優先する
  muted() { return !!call(s => s.game.settings && s.game.settings.muteAudio); },
  onMute(fn) { muteCb = fn; },
};
