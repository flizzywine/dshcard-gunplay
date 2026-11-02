export {load} from './three-loader.mjs';
import {resolve as baseResolve} from './three-loader.mjs';
export async function resolve(specifier,context,nextResolve){
 if(specifier.startsWith('three/addons/'))return {url:new URL('../dist/lib/jsm/'+specifier.slice('three/addons/'.length),import.meta.url).href,shortCircuit:true};
 return baseResolve(specifier,context,nextResolve);
}
