import {mkdir,writeFile,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const backend='https://yaya-art-gallery.possbb.chatgpt.site';
const response=await fetch(backend+'/api/public/artworks',{signal:AbortSignal.timeout(60000)});
if(!response.ok&&response.status!==403)throw new Error('Public feed failed: '+response.status);
const items=response.status===403?[]:await response.json();
if(!Array.isArray(items))throw new Error('Invalid feed');
await mkdir('media',{recursive:true});
const keep=new Set();
for(const item of items)for(const kind of ['original','clean','video']){
 if(!item[kind])continue;
 const url=new URL(item[kind],backend);
 if(url.origin!==backend||!url.pathname.startsWith('/api/families/yaya/artworks/'))throw new Error('Unexpected media URL');
 const r=await fetch(url,{signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw new Error('Media failed: '+r.status);
 const bytes=Buffer.from(await r.arrayBuffer());
 const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/webm':'webm'}[r.headers.get('content-type')?.split(';')[0]];
 if(!ext||!bytes.length||bytes.length>50*1024*1024)throw new Error('Invalid media');
 const name=createHash('sha256').update(bytes).digest('hex')+'.'+ext;
 keep.add(name);await writeFile('media/'+name,bytes);item[kind]='./media/'+name;
}
await writeFile('artworks.json',JSON.stringify(items,null,2)+'\n');
for(const name of await readdir('media'))if(/^[a-f0-9]{64}\.(png|jpg|webp|mp4|webm)$/.test(name)&&!keep.has(name))await unlink('media/'+name);
console.log('Synced '+items.length+' artworks, '+keep.size+' media files');
