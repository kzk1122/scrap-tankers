// 見本のビルド: demo/rich.js を1本にまとめて HTML 1枚にする
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const site = process.argv[2] === 'site';
const r = await build({ entryPoints: ['demo/rich.js'], bundle: true, minify: true, format: 'iife', write: false, target: 'es2019', legalComments: 'none' });
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
let page = readFileSync('demo/rich.html', 'utf8').replace('<!--JS-->', () => '<script>' + js + '</script>');
mkdirSync('dist', { recursive: true });
if (site) { const m = page.match(/<title>.*?<\/title>/)[0]; page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">${m}<style>*{box-sizing:border-box}body{margin:0}[hidden]{display:none!important}</style></head><body>${page.replace(m, '')}</body></html>`; }
writeFileSync(site ? 'dist/rich-site.html' : 'dist/rich-look.html', page);
console.log((page.length / 1024).toFixed(0) + 'KB');
