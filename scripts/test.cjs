const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const cases = [
  ['tests/menu.cjs'], ['tests/match.cjs'],
  ...['combat', 'abilities', 'ai-v2', 'recoil', 'recoil-ballistics'].map(n => ['--experimental-loader', './tests/three-loader.mjs', `tests/${n}.mjs`]),
  ...['map', 'ai-world-v2', 'voxel', 'jinqu-voxel', 'combat-feedback'].map(n => ['--experimental-loader', './tests/world-loader.mjs', `tests/${n}.mjs`]),
  ['--experimental-loader', './tests/integration-loader.mjs', 'tests/integration.mjs'],
  ['--experimental-loader', './tests/integration-loader.mjs', 'tests/optics.mjs'],
  ['--experimental-loader', './tests/review-v2-loader.mjs', 'tests/review-v2.mjs'],
  ['--experimental-loader', './tests/review-v2-loader.mjs', 'tests/mouse-input.mjs']
];
for (const args of cases) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
const assisted = spawnSync(process.execPath, ['--experimental-loader', './tests/integration-loader.mjs', 'tests/integration.mjs'], { cwd: root, stdio: 'inherit', env: { ...process.env, ASSISTED: '1', SEED: '2401' } });
process.exit(assisted.status ?? 1);
