import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tavern = path.resolve(process.env.DSH_TAVERN_SOURCE || path.join(root, '../dsh-tavern'));
const require = createRequire(path.join(tavern, 'package.json'));
const { build } = require('esbuild');
const { writeZipEntries, readZipEntries } = await import(pathToFileURL(path.join(tavern, 'tavern-plugin/lib/domain/zip-entries.js')));
const { pluginManifestProblem } = await import(pathToFileURL(path.join(tavern, 'tavern-plugin/lib/domain/plugin-manifest.js')));
const pkg = JSON.parse(await readFile(path.join(root, 'dsh/plugin/package.json'), 'utf8'));
const problem = pluginManifestProblem(pkg); if (problem) throw new Error(problem);
const bundle = await build({ entryPoints: [path.join(root, 'js/main.js')], bundle: true, write: false,
  format: 'iife', minify: true, target: 'es2022', legalComments: 'inline',
  alias: { 'three/addons': path.join(root, 'lib/jsm'), three: path.join(root, 'lib/three.module.js') } });
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = await readFile(path.join(root, 'style.css'), 'utf8');
let html = await readFile(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace('<link rel="stylesheet" href="style.css">', () => `<style>${css}</style>`)
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>${js}</script>`);
const card = JSON.parse(await readFile(path.join(root, 'dsh/card.json'), 'utf8'));
const manifest = { format: 'dshcard', formatVersion: 1,
  card: { title: card.data.name, version: card.data.character_version, author: card.data.creator },
  requires: { tavernApi: 2 },
  plugins: [{ name: pkg.name, path: 'plugins/pixel-gunplay/', purpose: '内置 Three.js 枪战与全屏战场入口' }] };
const entries = [{ path: 'card.json', content: JSON.stringify(card, null, 2) },
  { path: 'dsh.json', content: JSON.stringify(manifest, null, 2) },
  { path: 'plugins/pixel-gunplay/assets/game.html', content: html },
  { path: 'plugins/pixel-gunplay/assets/README.txt', content: await readFile(path.join(root, 'README.md')) }];
for (const file of ['package.json', 'index.mjs', 'client.js']) entries.push({ path: `plugins/pixel-gunplay/${file}`, content: await readFile(path.join(root, 'dsh/plugin', file)) });
const bytes = writeZipEntries(entries);
readZipEntries(bytes);
const out = path.resolve(process.argv[2] || path.join(root, 'dist/dshcard-gunplay.dshcard'));
await mkdir(path.dirname(out), { recursive: true });
await writeFile(out, bytes);
await writeFile(path.join(path.dirname(out), 'game-preview.html'), html);
console.log(`${out} (${bytes.length} bytes)`);
