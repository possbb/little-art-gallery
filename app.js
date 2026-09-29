import {setupAccounts} from './accounts.js';
import {setupCleaner} from './cleaner.js';
const $ = s => document.querySelector(s);
const publicBackend=window.GALLERY_PUBLIC_BACKEND;
let artworks=[], mode='all',selected=null,editing=null,canEdit=false,busy=false,detailMode='clean',familyId=null,canDelete=false,loadVersion=0;
const artworkApi=()=>'/api/families/'+familyId+'/artworks';
async function api(url,options) { const r=await fetch(url,options); const body=await r.json(); if(!r.ok) throw new Error(body.error||'操作失败，请重试。');return body; }
function render() {
  $('#count').textContent=artworks.length;
  $('#gallery').replaceChildren();
  const visible=artworks.filter(item=>mode==='all'||(mode==='video'?!!item.video:mode==='clean'?!!item.clean:!!item.original));
  $('#status').textContent=visible.length?'':mode==='video'?'还没有视频版。登录管理后可上传视频，或为画作添加视频版。':'还没有作品。';
  for(const item of visible) {
    const card=document.createElement('button');card.className='art-card';
    const mat=document.createElement('div');mat.className='art-mat';
    const versions=(mode==='all'?['video','clean','original']:[mode]).filter(kind=>item[kind]);
    mat.classList.add('combined-preview');if(versions.includes('video'))mat.classList.add('has-video');
    mat.dataset.count=versions.length;
    for(const kind of versions){
      const frame=document.createElement('div');frame.className='preview-version '+kind;if(kind==='original'&&item.originalRotation===90)frame.classList.add('rotate-original');
      const media=document.createElement(kind==='video'?'video':'img');
      media.src=item[kind]+(kind==='video'?'#t=0.1':'');
      if(kind==='video'){media.preload='metadata';media.muted=true;media.playsInline=true;media.setAttribute('aria-label',item.title+' 视频');}
      else{media.alt=item.title+' '+(kind==='clean'?'电子版':'原图');media.loading='lazy';}
      const label=document.createElement('span');label.className='version-label';label.textContent=kind==='video'?'▶ 视频版':kind==='clean'?'白底电子版':'原始画作';
      frame.append(media,label);mat.append(frame);
    }
    const meta=document.createElement('div');meta.className='art-meta';const title=document.createElement('h3');title.textContent=item.title;const date=document.createElement('span');date.textContent=item.date||'日期待记录';meta.append(title,date);
    const note=document.createElement('p');note.className='art-note';note.textContent=item.notes||'每一笔，都只有这一次。';
    card.append(mat,meta,note);card.onclick=()=>openDetail(item.id);$('#gallery').append(card);
  }
}
function playDetailVideo() {
  const video=$('#detail-video');
  if(!$('#detail').open||video.hidden)return;
  const source=video.src;
  video.play().catch(error=>{
    if(error.name!=='NotAllowedError'||!$('#detail').open||video.hidden||video.src!==source)return;
    video.muted=true;
    video.play().catch(()=>{});
  });
}
function updateDetail(next=detailMode) {
  detailMode=selected[next]?next:selected.clean?'clean':selected.original?'original':'video';
  const isVideo=detailMode==='video';
  const source=isVideo?selected.video:detailMode==='clean'&&selected.clean?selected.clean:selected.original;
  const area=$('#detail .detail-image');area.classList.toggle('has-video',!!selected.video);area.dataset.count=['video','clean','original'].filter(kind=>selected[kind]).length;
  for(const kind of ['clean','original']){
    const image=$(kind==='clean'?'#detail-img':'#original-img');$('#version-'+kind).hidden=!selected[kind];image.parentElement.classList.toggle('rotate-original',kind==='original'&&selected.originalRotation===90);
    image.onload=null;image.onerror=null;image.style.visibility='hidden';
    if(selected[kind]){image.onload=()=>{image.style.visibility='visible';};image.onerror=()=>{image.style.visibility='visible';image.alt='图片加载失败，请刷新重试。';};image.src=selected[kind];image.alt=selected.title+' '+(kind==='clean'?'电子版':'原图');if(image.complete&&image.naturalWidth)image.onload();}
    else image.removeAttribute('src');
  }
  const video=$('#detail-video');$('#version-video').hidden=!selected.video;video.hidden=!selected.video;$('#video-error').hidden=true;
  if(selected.video){if(video.getAttribute('src')!==selected.video)video.src=selected.video;}
  else{video.pause();video.removeAttribute('src');video.load();}
  $('#detail-title').textContent=selected.title;$('#detail-date').textContent=selected.date?'创作于 '+selected.date:'创作日期尚未记录';$('#detail-notes').textContent=selected.notes||'';
  $('#detail-state').textContent=isVideo?'可以直接播放，或下载到设备。':detailMode==='clean'&&selected.clean?'背景清理版本 · 原图已保留，可切换对照。':'保留最初的笔触，也保留创作的样子。';
  for(const key of ['clean','original','video']) {const button=$('#show-'+key);button.hidden=!selected[key];button.classList.toggle('active',detailMode===key);button.setAttribute('aria-pressed',detailMode===key);}
  $('#download').href=source;$('#download').download=selected.title;
  $('#edit').hidden=!canEdit;$('#attach-video').hidden=!canEdit;$('#attach-video').textContent=selected.video?'更换视频版':'添加视频版';$('#detail-error').textContent='';
  $('#delete-art').hidden=!canDelete;
  $('#clean-art').hidden=!canEdit||!selected.original;
  for(const kind of ['clean','original'])$('#upload-'+kind).hidden=!canEdit||!selected.original;
  $('#merge-video').hidden=!canDelete||!selected.original||!!selected.video||!artworks.some(item=>item.video&&!item.original);
  $('#download').textContent='下载'+({video:'视频版',clean:'电子版',original:'原图'}[detailMode]);
  if(selected.video)playDetailVideo();
}
function openDetail(id) {const item=artworks.find(x=>x.id===id);if(!item)throw new Error('找不到作品。');selected=item;updateDetail(mode==='all'?(item.video?'video':'clean'):mode);if(!$('#detail').open){$('#detail').showModal();playDetailVideo();}}
function openEditor(item=null) {
  if(!canEdit||busy)return;editing=item;$('#art-form').reset();$('#form-error').textContent='';$('#upload-progress').hidden=true;
  $('#editor-title').textContent=item?'修改名称与资料':'上传图片或视频';
  const f=$('#art-form').elements;f.title.value=item?.title||'';f.date.value=item?.date||'';f.notes.value=item?.notes||'';
  $('#file-label').hidden=!!item;f.file.required=!item;$('#metadata-fields').hidden=!item;$('#upload-hint').hidden=!!item;$('#editor').showModal();
}
function rawUpload(file,title,item,onProgress,kind='video') {
  if(!file)return Promise.reject(new Error('请选择文件。'));
  if(!['image/png','image/jpeg','image/webp','video/mp4','video/webm'].includes(file.type))return Promise.reject(new Error('支持 PNG、JPG、WebP、MP4 和 WebM。'));
  if(item&&(kind==='clean'?file.type!=='image/png':kind==='original'?!file.type.startsWith('image/'):!file.type.startsWith('video/')))return Promise.reject(new Error('文件格式不正确。'));
  if(file.size>50*1024*1024||!file.size)return Promise.reject(new Error('文件需大于 0 字节且不超过 50 MB。'));
  return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open('POST',artworkApi()+(item?'/'+item.id+'/'+kind:''));xhr.setRequestHeader('Content-Type',file.type);xhr.setRequestHeader('X-Artwork-Name',encodeURIComponent(title));if(item)xhr.setRequestHeader('X-Revision',item.revision);
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{let body;try{body=JSON.parse(xhr.responseText);}catch{return reject(new Error('上传失败，请稍后重试。'));}if(xhr.status>=200&&xhr.status<300)resolve(body);else reject(new Error(body.error||'上传失败。'));};
    xhr.onerror=()=>reject(new Error('网络中断，请确认网络后重试。'));xhr.onabort=()=>reject(new Error('上传已取消。'));xhr.timeout=15*60*1000;xhr.ontimeout=()=>reject(new Error('上传超时，请稍后重试。'));xhr.send(file);
  });
}
function merge(item) {const found=artworks.some(a=>a.id===item.id);artworks=found?artworks.map(a=>a.id===item.id?item:a):[item,...artworks];render();if(selected?.id===item.id){selected=item;updateDetail();}}
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>{if(!busy)$('#'+b.dataset.close).close();});
$('#detail').addEventListener('close',()=>$('#detail-video').pause());
$('#detail-video').addEventListener('error',()=>{if($('#detail-video').getAttribute('src'))$('#video-error').hidden=false;});
for(const id of ['editor','detail'])$('#'+id).addEventListener('cancel',e=>{if(busy)e.preventDefault();});
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{mode=b.dataset.view;document.querySelectorAll('[data-view]').forEach(other=>{other.classList.toggle('active',other===b);other.setAttribute('aria-pressed',other===b);});render();});
for(const key of ['clean','original','video'])$('#show-'+key).onclick=()=>updateDetail(key);
$('#add').onclick=()=>openEditor();$('#edit').onclick=()=>openEditor(selected);
$('#art-form').elements.file.onchange=()=>{const f=$('#art-form').elements;if(!f.title.value&&f.file.files[0])f.title.value=f.file.files[0].name.replace(/\.[^.]+$/,'').slice(0,100);};
$('#art-form').onsubmit=async e=>{
  e.preventDefault();if(busy)return;busy=true;$('#save').disabled=true;$('#save').textContent='正在保存…';$('#form-error').textContent='';
  try {const f=e.currentTarget.elements;let item;if(editing)item=await api(artworkApi()+'/'+editing.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:f.title.value,notes:f.notes.value,date:f.date.value,revision:editing.revision})});else {$('#upload-progress').hidden=false;$('#upload-progress').value=0;item=await rawUpload(f.file.files[0],f.title.value,null,n=>{$('#upload-progress').value=n;$('#save').textContent=n===100?'上传完成，正在保存…':'上传中 '+n+'%';});}merge(item);$('#editor').close();}
  catch(error){$('#form-error').textContent=error.message;}
  finally{busy=false;$('#save').disabled=false;$('#save').textContent='保存作品';}
};
$('#attach-video').onclick=()=>{if(!busy)$('#video-file').click();};
$('#video-file').onchange=async()=>{
  const file=$('#video-file').files[0];if(!file||busy)return;busy=true;$('#attach-video').disabled=true;$('#edit').disabled=true;
  try{const item=await rawUpload(file,selected.title,selected,n=>{$('#attach-video').textContent=n===100?'正在保存…':'上传中 '+n+'%';});merge(item);updateDetail('video');}
  catch(e){$('#detail-error').textContent=e.message;}
  finally{busy=false;$('#attach-video').disabled=false;$('#edit').disabled=false;$('#attach-video').textContent=selected.video?'更换视频版':'添加视频版';$('#video-file').value='';}
};
window.addEventListener('beforeunload',e=>{if(busy){e.preventDefault();e.returnValue='';}});
const accounts=publicBackend?null:setupAccounts({reload:()=>load(),isBusy:()=>busy});
if(publicBackend){$('#login').textContent='上传与管理';$('#login').onclick=()=>location.assign(publicBackend);$('#download').target='_blank';$('#download').rel='noopener';}
async function load() {
  const version=++loadVersion;
  artworks=[];selected=null;canEdit=false;canDelete=false;$('#add').hidden=true;$('#detail').close();render();
  if(publicBackend){
    $('#status').textContent='正在读取最新作品…';
    const items=await api(publicBackend+'/api/public/artworks',{credentials:'omit',cache:'no-store'});
    if(version!==loadVersion)return;
    artworks=items.map(item=>({...item,...Object.fromEntries(['original','clean','video'].map(kind=>[kind,item[kind]?new URL(item[kind],publicBackend).href:null]))}));render();return;
  }
  const session=await api('/api/session');if(version!==loadVersion)return;
  const params=new URL(location.href).searchParams;
  const candidate=params.get('family');
  const family=session.families.find(f=>f.id===candidate)||(!params.has('share')?session.families[0]:null);
  familyId=family?.id||(params.has('share')?candidate:'yaya');
  canEdit=['owner','editor'].includes(family?.role);canDelete=family?.role==='owner';
  accounts.update(session,family);
  $('#add').hidden=!canEdit;
  if(!familyId){$('#status').textContent=session.signedIn?'还没有加入家庭，请使用管理员提供的邀请链接。':'这是私密家庭画廊，请先使用受邀邮箱登录。';return;}
  const items=await api(artworkApi()+(params.has('share')?'?share='+encodeURIComponent(params.get('share')):''));
  if(version!==loadVersion)return;artworks=items;render();
}
try{await load();}catch(e){$('#status').textContent=e.message;}
window.addEventListener('focus',()=>{if(!busy&&!document.querySelector('dialog[open]'))load().catch(e=>{$('#status').textContent=e.message;});});
if(document.modelContext?.registerTool){try{await document.modelContext.registerTool({name:'list_artworks',description:'读取画廊作品与视频状态。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async()=>artworks.map(({id,title,video})=>({id,title,hasVideo:!!video}))});}catch{}}

const openCleaner=setupCleaner({save:(blob,item,progress)=>rawUpload(blob,item.title,item,progress,'clean'),onSaved:item=>{merge(item);updateDetail('clean');},setBusy:value=>{busy=value;}});
$('#clean-art').onclick=()=>{if(canEdit&&!busy&&selected?.original){$('#detail-video').pause();openCleaner(selected);}};
$('#delete-art').onclick=async()=>{
  if(!canDelete||busy||!selected)return;
  const item=selected;
  if(!confirm('删除“'+item.title+'”？\n原图、电子版和视频会一起从画廊移除。'))return;
  busy=true;$('#delete-art').disabled=true;$('#detail-error').textContent='';
  try{
    await api(artworkApi()+'/'+item.id,{method:'DELETE',headers:{'X-Revision':item.revision}});
    artworks=artworks.filter(a=>a.id!==item.id);$('#detail-video').pause();$('#detail').close();selected=null;render();
  }catch(e){$('#detail-error').textContent=e.message;}
  finally{busy=false;$('#delete-art').disabled=false;}
};

let imageUploadKind='clean';
for(const kind of ['clean','original'])$('#upload-'+kind).onclick=()=>{
  if(busy||!canEdit||!selected?.original)return;
  imageUploadKind=kind;$('#image-file').accept=kind==='clean'?'image/png':'image/png,image/jpeg,image/webp';$('#image-file').click();
};
$('#image-file').onchange=async()=>{
  const file=$('#image-file').files[0],item=selected,kind=imageUploadKind;
  if(!file||busy||!canEdit||!item?.original)return;
  busy=true;const button=$('#upload-'+kind),label=button.textContent;button.disabled=true;
  try{const saved=await rawUpload(file,item.title,item,n=>{button.textContent='上传中 '+n+'%';},kind);merge(saved);updateDetail(kind);}
  catch(e){$('#detail-error').textContent=e.message;}
  finally{busy=false;button.disabled=false;button.textContent=label;$('#image-file').value='';}
};

$('#merge-video').onclick=()=>{
 if(busy||!canDelete||!selected?.original||selected.video)return;
 const select=$('#merge-source');select.replaceChildren(new Option('请选择对应的视频',''));
 for(const item of artworks.filter(item=>item.video&&!item.original))select.add(new Option(item.title,item.id));
 $('#merge-error').textContent='';$('#merge-dialog').showModal();
};
$('#merge-form').onsubmit=async e=>{
 e.preventDefault();if(busy||!canDelete)return;
 const source=artworks.find(item=>item.id===$('#merge-source').value),target=selected;if(!source||!target)return;
 busy=true;$('#merge-save').disabled=true;
 try{const saved=await api(artworkApi()+'/'+target.id+'/merge-video',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sourceId:source.id,sourceRevision:source.revision,revision:target.revision})});artworks=artworks.filter(item=>item.id!==source.id);merge(saved);$('#merge-dialog').close();updateDetail('video');}
 catch(e){$('#merge-error').textContent=e.message;}
 finally{busy=false;$('#merge-save').disabled=false;}
};
$('#merge-dialog').addEventListener('cancel',e=>{if(busy)e.preventDefault();});
