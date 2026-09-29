const $=s=>document.querySelector(s);
const roles={owner:'家庭主人',editor:'共同管理',viewer:'只读成员'};
const statuses={pending:'待接受',joined:'已加入',expired:'已过期',revoked:'已撤销',removed:'成员已移除'};
async function api(path,method='GET',value){const r=await fetch(path,{method,...(value===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})});const result=await r.json();if(!r.ok)throw new Error(result.error||'操作失败。');return result;}
export function setupAccounts({reload,isBusy}){
  let session=null,family=null,working=false,adminFamilyId=null;
  const dialog=$('#account-dialog'),content=$('#account-content');
  let invite=new URLSearchParams(location.hash.slice(1)).get('invite')||sessionStorage.getItem('gallery-invite');
  if(invite)sessionStorage.setItem('gallery-invite',invite);
  function message(text){$('#account-error').textContent=text;}
  async function run(fn){if(working)return;working=true;message('');try{await fn();}catch(e){message(e.message);}finally{working=false;}}
  function open(title,html){if(isBusy())return false;$('#account-heading').textContent=title;content.innerHTML=html;message('');if(!dialog.open)dialog.showModal();return true;}
  function linkResult(path){
    content.querySelector('.generated-link')?.remove();
    const box=document.createElement('div');box.className='generated-link';
    const label=document.createElement('label');label.textContent='邀请 / 分享链接';const input=document.createElement('input');input.readOnly=true;input.value=new URL(path,location.origin).href;input.onclick=()=>input.select();label.append(input);
    const copy=document.createElement('button');copy.className='primary';copy.textContent='复制链接';copy.type='button';
    copy.onclick=async()=>{try{await navigator.clipboard.writeText(input.value);copy.textContent='已复制';}catch{input.select();message('请复制选中的链接。');}};
    box.append(label,copy);content.append(box);input.select();
  }
  function clearInvite(){invite=null;sessionStorage.removeItem('gallery-invite');const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);}
  async function logout(){await api('/api/auth/logout','POST',{});if(session.provider==='platform'){location.assign('/signout-with-chatgpt?return_to=%2F');return;}dialog.close();await reload();}
  function move(id){const url=new URL(location.href);url.search='';url.searchParams.set('family',id);url.hash='';history.replaceState(null,'',url);}
  function login(){
    if(!session.mailReady){
      if(!open('登录家庭画廊','<p>可继续使用你通过 Google 登录的 ChatGPT 账号。</p><a id="platform-login" class="primary" target="_top">使用现有账号登录</a><p class="hint">加入家庭时，请使用邀请指定的邮箱。</p>'))return;
      $('#platform-login').href='/signin-with-chatgpt?return_to='+encodeURIComponent(location.pathname+location.search);return;
    }
    if(!open('邮箱登录','<form id="email-form"><label>受邀邮箱<input name="email" type="email" autocomplete="email" required maxlength="254"></label><button type="button" class="secondary" id="send-code">发送验证码</button><label>验证码<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" required maxlength="6"></label><button class="primary">登录</button></form><p class="hint">仅限已加入家庭或持有有效邀请的邮箱。验证码 10 分钟有效。</p>'))return;
    if(!session.mailReady)message('邮箱登录尚未开通，正在等待发信配置。');
    const form=$('#email-form');
    $('#send-code').onclick=()=>run(async()=>{if(!form.elements.email.reportValidity())return;const result=await api('/api/auth/request-code','POST',{email:form.elements.email.value,invite});message(result.message);});
    form.onsubmit=e=>{e.preventDefault();run(async()=>{await api('/api/auth/verify','POST',{email:form.elements.email.value,code:form.elements.code.value,invite});dialog.close();await reload();});};
  }
  async function accept(){
    if(!open('家庭邀请','<p id="invite-summary">正在读取邀请…</p><div id="invite-action"></div><button id="ignore-invite" class="secondary">暂不加入</button>'))return;
    $('#ignore-invite').onclick=()=>{clearInvite();dialog.close();};
    const data=await api('/api/invitations/preview','POST',{invite});
    $('#invite-summary').textContent=data.familyName+' · '+roles[data.role]+'\n指定邮箱：'+data.email+'\n有效期至：'+new Date(data.expires).toLocaleString();
    const action=$('#invite-action'),button=document.createElement('button');button.className='primary';
    if(data.status!=='pending'){
      message(statuses[data.status]+'。'+(data.status==='joined'?'':'请联系管理员重新生成邀请。'));
      if(data.status==='joined'&&data.matchesEmail){button.textContent='进入家庭';button.onclick=()=>run(async()=>{clearInvite();move(data.familyId);dialog.close();await reload();});action.append(button);}return;
    }
    if(!session.signedIn){button.textContent='登录后加入';button.onclick=login;}
    else if(!data.matchesEmail){message('当前登录邮箱为 '+session.email+'，与受邀邮箱不同。');button.textContent='切换账号';button.onclick=()=>run(logout);}
    else{button.textContent='确认加入家庭';button.onclick=()=>run(async()=>{const result=await api('/api/invitations/accept','POST',{invite});clearInvite();move(result.familyId);dialog.close();await reload();});}
    action.append(button);
  }
  async function settings(){
    if(!open('家庭管理','<p>正在读取…</p>'))return;
    const data=await api('/api/families/'+family.id+'/settings');
    content.innerHTML='<form id="settings-form"><label>家庭名称<input name="name" required maxlength="60"></label><label class="checkbox"><input name="public" type="checkbox">启用分享链接（持有链接的人可查看全部作品）</label><button class="primary">保存设置</button></form><p class="hint">关闭分享后，旧链接失效；重新开启会生成新链接。已下载的文件无法收回。</p><h3>家庭成员</h3><div id="members"></div><h3>待接受的邀请</h3><div id="pending-invites"></div>';
    if(family.id==='yaya'){content.querySelector('.checkbox').lastChild.textContent='公开展示（无需登录即可查看全部作品）';content.querySelector('.hint').textContent='开启后，首页公开展示全部作品；关闭后恢复私密访问。管理操作始终需要登录。';}
    const form=$('#settings-form');form.elements.name.value=data.name;form.elements.public.checked=!!data.publicToken;
    if(data.publicToken)linkResult('/?family='+family.id+'&share='+data.publicToken);
    form.onsubmit=e=>{e.preventDefault();run(async()=>{await api('/api/families/'+family.id+'/settings','PATCH',{name:form.elements.name.value,public:form.elements.public.checked});await reload();await settings();message('已保存。');});};
    for(const member of data.members){
      const row=document.createElement('div');row.className='member-row';const name=document.createElement('span');name.textContent=member.email;row.append(name);
      if(member.role==='owner'){const role=document.createElement('span');role.textContent=roles.owner;row.append(role);}else{
        const select=document.createElement('select');select.setAttribute('aria-label',member.email+' 的权限');for(const role of ['editor','viewer'])select.add(new Option(roles[role],role));select.value=member.role;
        const save=document.createElement('button');save.className='secondary';save.textContent='保存权限';save.disabled=true;select.onchange=()=>{save.disabled=select.value===member.role;};save.onclick=()=>run(async()=>{await api('/api/families/'+family.id+'/members','PATCH',{email:member.email,role:select.value,expectedRole:member.role});await settings();message('成员权限已保存。');});
        const remove=document.createElement('button');remove.className='secondary danger';remove.textContent='移除';remove.onclick=()=>{if(confirm('移除 '+member.email+' 的家庭访问权限？'))run(async()=>{await api('/api/families/'+family.id+'/members','PATCH',{email:member.email,role:null,expectedRole:member.role});await settings();});};row.append(select,save,remove);
      }$('#members').append(row);
    }
    $('#pending-invites').textContent=data.invitations.map(i=>i.email+' · '+roles[i.role]+' · '+new Date(i.expires).toLocaleDateString()+' 前有效').join('；')||'暂无。邀请由平台管理员发出。';
  }
  async function admin(){
    if(!open('邀请管理','<p>正在读取…</p>'))return;
    const families=await api('/api/admin/families');
    content.innerHTML='<form id="create-family"><h3>邀请新家庭</h3><label>家庭名称<input name="name" required maxlength="60"></label><label>家庭主人邮箱<input name="email" type="email" required></label><button class="primary">创建家庭并生成邀请</button></form><hr><form id="invite-member"><h3>邀请家庭成员</h3><label>家庭<select name="family"></select></label><label>成员邮箱<input name="email" type="email" required></label><label>权限<select name="role"><option value="editor">共同管理</option><option value="viewer">只读成员</option><option value="owner">家庭主人（仅尚无主人的家庭）</option></select></label><button class="primary">生成邀请链接</button></form><p class="hint">邀请 7 天有效，只能由指定邮箱接受。生成后请复制链接，通过微信发给对方。同一家庭再次邀请同一邮箱时，旧邀请会失效。</p><h3>所选家庭的邀请记录</h3><p class="hint">显示每个邮箱最近一次邀请。</p><div id="invitation-list"></div>';
    const create=$('#create-family'),add=$('#invite-member');for(const f of families)add.elements.family.add(new Option(f.name+'（'+f.memberCount+' 位成员 / '+f.pendingCount+' 条待接受）',f.id));if(adminFamilyId&&families.some(f=>f.id===adminFamilyId))add.elements.family.value=adminFamilyId;adminFamilyId=add.elements.family.value;add.elements.family.onchange=()=>run(async()=>{adminFamilyId=add.elements.family.value;content.querySelector('.generated-link')?.remove();await invitationList();});
    create.onsubmit=e=>{e.preventDefault();run(async()=>{const result=await api('/api/admin/families','POST',{name:create.elements.name.value,email:create.elements.email.value});adminFamilyId=result.familyId;await admin();linkResult('/#invite='+result.invite);});};
    add.onsubmit=e=>{e.preventDefault();run(async()=>{const result=await api('/api/families/'+add.elements.family.value+'/invitations','POST',{email:add.elements.email.value,role:add.elements.role.value});await invitationList();linkResult('/#invite='+result.invite);});};
    await invitationList();
  }
  async function invitationList(){
    const list=$('#invitation-list'),id=$('#invite-member').elements.family.value;list.textContent='正在读取…';
    const entries=await api('/api/families/'+id+'/invitations');if(!list.isConnected)return;list.replaceChildren();const option=$('#invite-member').elements.family.selectedOptions[0];option.textContent=option.textContent.replace(/\d+ 条待接受/,entries.filter(i=>i.status==='pending').length+' 条待接受');
    if(!entries.length){list.textContent='暂无邀请记录。';return;}
    for(const entry of entries){
      const row=document.createElement('div');row.className='invitation-row';const info=document.createElement('p');info.textContent=entry.email+' · '+roles[entry.role]+'\n'+statuses[entry.status]+' · '+new Date(entry.expires).toLocaleDateString()+' 到期';row.append(info);
      if(entry.status!=='joined'){
        const renew=document.createElement('button');renew.className='secondary';renew.textContent='重新生成';renew.onclick=()=>{if(confirm('重新生成 '+entry.email+' 的邀请？旧链接将失效。'))run(async()=>{const result=await api('/api/families/'+id+'/invitations','POST',{email:entry.email,role:entry.role});await invitationList();linkResult('/#invite='+result.invite);});};row.append(renew);
      }
      if(entry.status==='pending'){
        const revoke=document.createElement('button');revoke.className='secondary danger';revoke.textContent='撤销邀请';revoke.onclick=()=>{if(confirm('撤销发给 '+entry.email+' 的邀请？'))run(async()=>{await api('/api/families/'+id+'/invitations','DELETE',{email:entry.email});content.querySelector('.generated-link')?.remove();await invitationList();message('邀请已撤销。');});};row.append(revoke);
      }
      list.append(row);
    }
  }
  $('#account-close').onclick=()=>{if(!working)dialog.close();};dialog.addEventListener('cancel',e=>{if(working)e.preventDefault();});
  $('#families').onchange=()=>{if(isBusy()){$('#families').value=family?.id;return;}move($('#families').value);reload().catch(e=>message(e.message));};
  $('#login').onclick=()=>{if(isBusy())return;if(session.signedIn)run(logout);else login();};
  $('#family-settings').onclick=()=>run(settings);$('#admin').onclick=()=>run(admin);
  return {update(next,current){session=next;family=current;$('#login').textContent=session.signedIn?'退出登录':'登录';$('#login').title=session.email||'';$('#admin').hidden=!session.isAdmin;$('#family-settings').hidden=family?.role!=='owner';const select=$('#families');select.replaceChildren();for(const f of session.families)select.add(new Option(f.name,f.id));select.hidden=!session.families.length;select.value=family?.id||'';if(invite&&(location.hash.includes('invite=')||sessionStorage.getItem('gallery-invite'))){accept().catch(e=>message(e.message));}}};
}
