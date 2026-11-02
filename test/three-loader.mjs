// Test-only resolver: use the same vendored Three.js as the browser import map.
const three = new URL('../lib/three.module.js', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') return { url: three, shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url.includes('/OPUS5.5-COD/') && url.endsWith('.js')) return nextLoad(url, { ...context, format: 'module' });
  return nextLoad(url, context);
}
