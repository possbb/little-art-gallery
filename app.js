const $ = s => document.querySelector(s);
const published = document.documentElement.dataset.mode === 'published';
if (published) { $('#add').hidden = true; $('#edit').hidden = true; }
let artworks = [], mode = 'clean', selected = null, editing = null, detailMode = 'clean';
async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败，请重试。');
  return data;
}
function render() {
  $('#count').textContent = artworks.length;
  $('#gallery').replaceChildren();
  $('#status').textContent = artworks.length ? '' : '还没有作品，点击「收藏新作品」留下第一幅画吧。';
  for (const item of artworks) {
    const card = document.createElement('button'); card.className = 'art-card';
    const mat = document.createElement('div'); mat.className = 'art-mat';
    const img = document.createElement('img'); img.src = mode === 'clean' && item.clean ? item.clean : item.original; img.alt = item.title; img.loading = 'lazy';
    mat.append(img);
    const badge = document.createElement('span'); badge.className = 'badge'; badge.textContent = mode === 'clean' && item.clean ? '白底电子版' : mode === 'clean' ? '原图 · 待整理' : '原始画作'; mat.append(badge);
    const meta = document.createElement('div'); meta.className = 'art-meta';
    const title = document.createElement('h3'); title.textContent = item.title;
    const date = document.createElement('span'); date.textContent = item.date || '日期待记录'; meta.append(title,date);
    const note = document.createElement('p'); note.className = 'art-note'; note.textContent = item.notes || '给这幅画留下一点小故事';
    card.append(mat,meta,note); card.addEventListener('click', () => openDetail(item.id)); $('#gallery').append(card);
  }
}
function updateDetail(nextMode = detailMode) {
  detailMode = nextMode;
  const source = detailMode === 'clean' && selected.clean ? selected.clean : selected.original;
  $('#detail-img').src = source; $('#detail-img').alt = selected.title;
  $('#detail-title').textContent = selected.title; $('#detail-date').textContent = selected.date ? '创作于 ' + selected.date : '创作日期尚未记录';
  $('#detail-notes').textContent = selected.notes || '还没有记录这幅画的小故事。';
  $('#detail-state').textContent = detailMode === 'clean' ? selected.clean ? 'AI 辅助清理版本 · 原图已保留，可切换对照。' : '这幅画还没有电子版，目前展示原图。' : '保留最初的笔触，也保留创作的样子。';
  $('#show-clean').classList.toggle('active', detailMode === 'clean'); $('#show-original').classList.toggle('active', detailMode === 'original');
  $('#show-clean').setAttribute('aria-pressed',detailMode === 'clean'); $('#show-original').setAttribute('aria-pressed',detailMode === 'original');
  $('#download').href = source; $('#download').download = selected.title + (detailMode === 'clean' && selected.clean ? '-电子版' : '-原图') + '.' + source.split('.').pop();
}
function openDetail(id) { const item = artworks.find(x => x.id === id); if (!item) throw new Error('找不到作品。'); selected = item; updateDetail(mode); if (!$('#detail').open) $('#detail').showModal(); }
function openEditor(item = null) {
  if (published) return;
  editing = item; const form = $('#art-form'); form.reset(); $('#form-error').textContent = '';
  $('#editor-title').textContent = item ? '编辑作品资料' : '收藏新作品';
  form.elements.title.value = item?.title || ''; form.elements.date.value = item?.date || ''; form.elements.notes.value = item?.notes || '';
  $('#original-label').hidden = !!item; form.elements.original.required = !item;
  $('#editor').showModal();
}
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => $('#' + button.dataset.close).close());
document.querySelectorAll('[data-view]').forEach(button => button.onclick = () => {
  mode = button.dataset.view;
  document.querySelectorAll('[data-view]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); }); render();
});
$('#add').onclick = () => openEditor(); $('#edit').onclick = () => openEditor(selected);
$('#show-clean').onclick = () => updateDetail('clean'); $('#show-original').onclick = () => updateDetail('original');
async function readImage(file) {
  if (!file) return undefined;
  if (!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('支持 PNG、JPG 和 WebP 图片。');
  if (file.size > 10 * 1024 * 1024) throw new Error('每张图片不能超过 10 MB。');
  return new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('图片读取失败。')); reader.readAsDataURL(file); });
}
$('#art-form').onsubmit = async event => {
  event.preventDefault(); const form = event.currentTarget; const save = $('#save'); save.disabled = true; save.textContent = '正在保存…'; $('#form-error').textContent = '';
  try {
    const payload = { title: form.elements.title.value, date: form.elements.date.value, notes: form.elements.notes.value, original: editing ? undefined : await readImage(form.elements.original.files[0]), clean: await readImage(form.elements.clean.files[0]) };
    const saved = await api('/api/artworks' + (editing ? '/' + editing.id : ''), { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type':'application/json' }, body:JSON.stringify(payload) });
    if (editing) artworks = artworks.map(item => item.id === saved.id ? saved : item); else artworks.unshift(saved);
    render(); $('#editor').close(); if ($('#detail').open) { selected = saved; updateDetail(); }
  } catch (error) { $('#form-error').textContent = error.message; }
  finally { save.disabled = false; save.textContent = '保存作品'; }
};
try { artworks = await api(published ? './artworks.json' : '/api/artworks'); render(); } catch { $('#status').textContent = published ? '暂时无法读取作品，请稍后刷新页面。' : '暂时无法读取作品。请确认本地服务已启动，再刷新页面。'; }
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  for (const tool of [
    { name:'list_artworks', description:'读取画廊中的作品资料。', inputSchema:{ type:'object', properties:{}, additionalProperties:false }, annotations:{readOnlyHint:true,untrustedContentHint:true}, execute:async () => artworks.map(({id,title,date,clean}) => ({id,title,date,hasCleanVersion:!!clean})) },
    { name:'open_artwork', description:'在页面中打开已有作品档案，不修改作品。', inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}, annotations:{readOnlyHint:true}, execute:async input => { if (typeof input?.id !== 'string') throw new Error('需要作品 ID。'); openDetail(input.id); return {opened:selected.id}; } }
  ]) { try { await document.modelContext.registerTool(tool,{signal:lifecycle.signal}); } catch { /* Browser support is optional. */ } }
  window.addEventListener('pagehide', () => lifecycle.abort(), {once:true});
}
