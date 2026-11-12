// 出し先ごとの違いはここだけに置く（CrazyGames SDK はフェーズ5でここに実装）
import { TARGET } from './core.js';
export const platform = {
  name: TARGET,
  gameplayStart() {},
  gameplayStop() {},
  happyTime() {},
};
