const three=new URL('../dist/lib/three.module.js',import.meta.url).href;
const materials='data:text/javascript,'+encodeURIComponent(`import {MeshStandardMaterial} from ${JSON.stringify(three)};const cache={};export function camoMaterial(_c,base){return base;}export function mat(name){return cache[name]??=new MeshStandardMaterial({color:0xaaaaaa});}`);
export async function resolve(specifier,context,next){
 if(specifier==='three')return {url:three,shortCircuit:true};
 if(specifier.startsWith('three/addons/'))return {url:new URL('../dist/lib/jsm/'+specifier.slice(13),import.meta.url).href,shortCircuit:true};
 if(specifier==='./materials.js')return {url:materials,shortCircuit:true};
 return next(specifier,context);
}
export async function load(url,context,next){return next(url,url.includes('/dist/')&&url.endsWith('.js')?{...context,format:'module'}:context);}
