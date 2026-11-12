// ビルド: src を1本にまとめ、HTML 1枚にする。出し先は引数（artifact / site / cg）
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const target = process.argv[2] || 'artifact';
const r = await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2019', define: { __TARGET__: JSON.stringify(target), __EV__: JSON.stringify(process.env.EV_URL !== undefined ? process.env.EV_URL : target === 'site' ? '/api/ev' : '') }, legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const page = readFileSync('src/page.html', 'utf8').replace('<!--JS-->', () => '<script>' + js + '</script>');
mkdirSync('dist', { recursive: true });
if (target === 'artifact') writeFileSync('dist/scrap-tankers.html', page);
else {
  const m = page.match(/<title>.*?<\/title>/)[0];
  const sdk = target === 'cg' ? '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>' : '';
  if (target !== 'site') mkdirSync('dist/' + target, { recursive: true });
  writeFileSync(target === 'site' ? 'dist/index.html' : `dist/${target}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8">${sdk}<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">${m}<style>*{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}</style></head><body>${page.replace(m, '')}</body></html>`);
}
console.log(target, (page.length / 1024).toFixed(0) + 'KB');
