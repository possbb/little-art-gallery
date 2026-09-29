export function setupCleaner({save,onSaved,setBusy}) {
  const dialog=document.createElement('dialog');dialog.id='cleaner';
  dialog.innerHTML=`<div class="dialog-head"><h2>生成电子版</h2><button class="icon" id="clean-close" aria-label="关闭背景清理">×</button></div>
    <div class="clean-content"><p class="hint">保留原图，清理纸张底色和拍照阴影。浅色笔触可能变淡，请对比后保存；横线和遮挡物不会自动移除。</p>
    <div class="clean-controls"><label>画作类型<select id="clean-mode"><option value="color">彩色画 · 保留颜色</option><option value="line">铅笔线稿 · 黑白</option></select></label><label>清理强度 <output id="clean-level">40</output><input id="clean-strength" type="range" min="0" max="100" value="40"></label><button class="secondary" id="clean-run">重新预览</button></div>
    <div class="clean-compare"><figure><figcaption>原图</figcaption><canvas id="clean-original"></canvas></figure><figure><figcaption>电子版预览</figcaption><canvas id="clean-result"></canvas></figure></div>
    <p id="clean-status" role="status"></p><p class="hint" id="clean-size"></p><button class="primary" id="clean-save" disabled>确认并保存电子版</button></div>`;
  document.body.append(dialog);
  const q=s=>dialog.querySelector(s),original=q('#clean-original'),result=q('#clean-result');
  let item=null,pixels=null,worker=null,ready=false,saving=false,loading=false,generation=0;
  function close(){if(!saving)dialog.close();}
  q('#clean-close').onclick=close;
  dialog.addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  dialog.addEventListener('close',()=>{generation++;worker?.terminate();worker=null;pixels=null;item=null;});
  function preview(){
    if(!pixels||saving)return;
    worker?.terminate();ready=false;q('#clean-save').disabled=true;q('#clean-status').textContent='正在清理背景…';
    worker=new Worker('/clean-worker.js',{type:'module'});
    const job=worker;
    worker.onmessage=({data})=>{
      if(worker!==job||!dialog.open)return;
      job.terminate();worker=null;
      if(data.error){q('#clean-status').textContent=data.error;return;}
      result.getContext('2d').putImageData(new ImageData(data.pixels,result.width,result.height),0,0);
      ready=true;q('#clean-save').disabled=false;q('#clean-status').textContent='预览已生成，请检查浅色笔触是否保留。';
    };
    worker.onerror=()=>{if(worker!==job)return;job.terminate();worker=null;q('#clean-status').textContent='处理失败，请重新预览或换一张较小的图片。';};
    worker.postMessage({pixels:pixels.data,width:original.width,height:original.height,mode:q('#clean-mode').value,strength:q('#clean-strength').value});
  }
  function changed(){q('#clean-level').value=q('#clean-strength').value;ready=false;q('#clean-save').disabled=true;worker?.terminate();worker=null;q('#clean-status').textContent='设置已更改，点击“重新预览”查看效果。';}
  q('#clean-strength').oninput=changed;q('#clean-mode').onchange=changed;q('#clean-run').onclick=preview;
  q('#clean-save').onclick=async()=>{
    if(!ready||saving||!item)return;
    saving=true;setBusy(true);q('#clean-save').disabled=true;q('#clean-run').disabled=true;q('#clean-mode').disabled=true;q('#clean-strength').disabled=true;
    try{
      const blob=await new Promise(resolve=>result.toBlob(resolve,'image/png'));
      if(!blob)throw new Error('无法生成图片，请重新预览。');
      const updated=await save(blob,item,n=>{q('#clean-status').textContent='正在保存电子版 '+n+'%';});
      onSaved(updated);saving=false;dialog.close();
    }catch(e){q('#clean-status').textContent=e.message;q('#clean-save').disabled=false;}
    finally{saving=false;setBusy(false);q('#clean-run').disabled=false;q('#clean-mode').disabled=false;q('#clean-strength').disabled=false;}
  };
  return async function open(artwork){
    if(saving||loading||!artwork.original)return;
    item={...artwork};pixels=null;ready=false;loading=true;const token=++generation;
    q('#clean-save').disabled=true;q('#clean-mode').value='color';q('#clean-strength').value=40;q('#clean-level').value=40;q('#clean-status').textContent='正在读取原图…';q('#clean-size').textContent='';
    for(const canvas of [original,result]){canvas.width=1;canvas.height=1;}
    dialog.showModal();
    try{
      const response=await fetch(artwork.original);if(!response.ok)throw new Error('原图读取失败，请稍后重试。');
      const bitmap=await createImageBitmap(await response.blob());
      if(token!==generation||!dialog.open){bitmap.close();return;}
      const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));
      for(const canvas of [original,result]){canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));}
      const ctx=original.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,original.width,original.height);ctx.drawImage(bitmap,0,0,original.width,original.height);bitmap.close();
      pixels=ctx.getImageData(0,0,original.width,original.height);result.getContext('2d').putImageData(pixels,0,0);
      q('#clean-size').textContent=`电子版尺寸 ${original.width} × ${original.height} 像素${scale<1?'（最长边缩至 2200 像素；原图尺寸不变）':''}。${artwork.clean?'确认后替换当前电子版。':''}`;
      preview();
    }catch(e){if(token===generation)q('#clean-status').textContent=e.message||'图片无法读取，请换一张图片。';}
    finally{loading=false;}
  };
}
