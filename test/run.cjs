const { spawnSync } = require('node:child_process');
for (const name of ['aim', 'recoil', 'recoil-ballistics']) {
  const r = spawnSync(process.execPath, ['--experimental-loader', './test/three-loader.mjs', `test/${name}.mjs`], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status || 1);
}
