import {readFile} from 'node:fs/promises';
export {resolve} from './integration-loader.mjs';
import {load as baseLoad} from './integration-loader.mjs';
export async function load(url,context,nextLoad){
 if(url.endsWith('/dist/js/main.js')){
  const original=await readFile(new URL(url),'utf8');
  const marker='const game = new Game();';
  if(!original.includes(marker))throw new Error('Entry guard changed; review loader must be updated');
  return {format:'module',source:original.slice(0,original.indexOf(marker))+'\nexport { Game };',shortCircuit:true};
 }
 return baseLoad(url,context,nextLoad);
}
