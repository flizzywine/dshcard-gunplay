import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const rifle=JSON.parse(await readFile(new URL('../assets/unvanquished-rifle/manifest.json',import.meta.url)));
const sha=rifle.commits['res-weapons_src.dpkdir'], playerSha=rifle.commits['res-players_src.dpkdir'];
const out=new URL('../assets/unvanquished-weapons/',import.meta.url);await mkdir(out,{recursive:true});
const entries=[];
for(const id of ['shotgun','mdriver','lcannon']){
  for(const name of [`${id}_view.md5mesh`,...['idle','fire','reload','raise','lower'].map(n=>`${id}_view_${n}.md5anim`),'weapon.cfg'])entries.push({path:`models/weapons/${id}/${name}`,name:`${id}/${name}`});
  const tex=id==='mdriver'?['zmdriver.png','zmdriver_n.png','zmdriver_s.png','core.png','core_n.png','core_s.png','lens.jpg']:id==='lcannon'?['lcannon.webp','lcannon_n.webp','lcannon_s.webp']:['shotgun.png','shotgun_n.png','shotgun_s.png'];
  for(const name of tex)entries.push({path:`models/weapons/${id}/${name}`,name:`${id}/${name}`});
}
entries.push({path:'models/players/human_hand/legacy_hand.png',name:'legacy_hand.png',player:true});
const files=[];
for(let i=0;i<entries.length;i+=4)await Promise.all(entries.slice(i,i+4).map(async f=>{
  const repo=f.player?'res-players_src.dpkdir':'res-weapons_src.dpkdir',commit=f.player?playerSha:sha;
  const url=`https://raw.githubusercontent.com/UnvanquishedAssets/${repo}/${commit}/${f.path}`,r=await fetch(url);
  if(!r.ok)throw Error(`${r.status}: ${url}`);const data=Buffer.from(await r.arrayBuffer()),dest=new URL(f.name,out);
  await mkdir(new URL('./',dest),{recursive:true});await writeFile(dest,data);
  files.push({...f,url,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});console.log(f.name,data.length);
}));
await writeFile(new URL('manifest.json',out),JSON.stringify({retrieved:new Date().toISOString(),commits:rifle.commits,files:files.sort((a,b)=>a.name.localeCompare(b.name))},null,2)+'\n');
