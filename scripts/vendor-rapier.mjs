// Keep the standalone browser build local and identical to the locked dependency.
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const source = new URL('node_modules/@dimforge/rapier3d-compat/', root);
const target = new URL('lib/rapier/', root);
await mkdir(target, { recursive: true });
const module = await readFile(new URL('dist/rapier.mjs', source), 'utf8');
await writeFile(new URL('rapier.mjs', target), module.replace(/\/\/# sourceMappingURL=.*$/m, ''));
await copyFile(new URL('LICENSE', source), new URL('LICENSE', target));
console.log('Vendored Rapier to ' + fileURLToPath(target));
