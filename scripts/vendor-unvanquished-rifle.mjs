import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = new URL('../assets/unvanquished-rifle/', import.meta.url);
await mkdir(out, { recursive: true });
const repositories = ['res-weapons_src.dpkdir', 'res-players_src.dpkdir'];
const commits = {};
for (const repo of repositories) {
  const r = await fetch(`https://api.github.com/repos/UnvanquishedAssets/${repo}/commits/master`);
  if (!r.ok) throw Error(`Commit lookup: ${r.status}`);
  commits[repo] = (await r.json()).sha;
}
const files = [
  ...['rifle_view.md5mesh', ...['idle', 'fire', 'reload', 'raise', 'lower'].map(n => `rifle_view_${n}.md5anim`), 'rifle.png', 'rifle_n.png', 'rifle_s.png', 'license.txt', 'weapon.cfg']
    .map(name => ({ repo: repositories[0], path: `models/weapons/rifle/${name}`, name })),
  ...['hand.png', 'hand_n.png', 'hand_s.png'].map(name => ({ repo: repositories[1], path: `models/players/human_hand/${name}`, name })),
];
const manifest = { retrieved: new Date().toISOString(), commits, files: [] };
// Limit connections; keep exact upstream bytes and a reproducible provenance manifest.
for (const f of files) {
  const url = `https://raw.githubusercontent.com/UnvanquishedAssets/${f.repo}/${commits[f.repo]}/${f.path}`;
  const response = await fetch(url); if (!response.ok) throw Error(`${response.status}: ${url}`);
  const data = Buffer.from(await response.arrayBuffer()); await writeFile(new URL(f.name, out), data);
  manifest.files.push({ ...f, url, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') });
  console.log(`${f.name}: ${data.length} bytes`);
}
await writeFile(new URL('manifest.json', out), JSON.stringify(manifest, null, 2) + '\n');
