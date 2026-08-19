/* VETS VAN Admin Dashboard enhancements: dynamic navigation + demo RBAC UI. */
(function () {
  const roles = {
    'Super Admin': ['All permissions'],
    'Admin': ['Dashboard','Bookings','Services','Experts','Partnerships','Website Content','Media Library','Messages','SEO & Languages','Settings'],
    'Content Manager': ['Dashboard','Services','Experts','Partnerships','Website Content','Media Library','SEO & Languages','Website Customization'],
    'Booking Manager': ['Dashboard','Bookings','Messages'],
    'Viewer': ['Dashboard','Bookings','Services','Experts','Partnerships','Website Content','Media Library','Messages','SEO & Languages']
  };

  function showOnlyPage(name) {
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === `page-${name}`));
    document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.page === name));
    const meta = {
      dashboard:['OVERVIEW','Dashboard'], bookings:['MANAGEMENT','Bookings'], services:['MANAGEMENT','Services'],
      experts:['MANAGEMENT','Experts'], partners:['MANAGEMENT','Partnerships'], content:['WEBSITE','Website Content'],
      media:['WEBSITE','Media Library'], messages:['INBOX','Contact Messages'], seo:['SYSTEM','SEO & Languages'],
      settings:['SYSTEM','Settings'], admins:['SYSTEM','Admin Users'], customization:['WEBSITE','Website Customization']
    }[name] || ['OVERVIEW','Dashboard'];
    const kicker=document.getElementById('pageKicker'), title=document.getElementById('pageTitle');
    if(kicker) kicker.textContent=meta[0];
    if(title) title.textContent=meta[1];
    const sidebar=document.getElementById('sidebar'); if(sidebar) sidebar.classList.remove('open');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function cleanupDuplicateWebsiteLabels() {
    const nav=document.querySelector('.sidebar nav'); if(!nav) return;
    const labels=Array.from(nav.querySelectorAll('.nav-label')).filter(x=>x.textContent.trim().toUpperCase()==='WEBSITE');
    // Keep the first static Website heading. Remove only duplicate headings immediately before the customization item.
    labels.slice(1).forEach(label=>{
      const next=label.nextElementSibling;
      if(next && next.dataset && next.dataset.page==='customization') label.remove();
    });
  }

  function injectStyles() {
    if(document.getElementById('vetsvan-enhancement-style')) return;
    const style=document.createElement('style'); style.id='vetsvan-enhancement-style';
    style.textContent=`
      .page:not(.active){display:none!important}.page.active{display:block!important}
      .rbac-wrap{margin-top:18px}.rbac-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin-bottom:14px}.rbac-head h3{margin:0 0 4px}.rbac-head p{margin:0;color:#777}.rbac-tools{display:flex;gap:10px;align-items:center}.rbac-tools select,.rbac-tools input{border:1px solid #ddd;border-radius:10px;padding:10px 12px;background:#fff}.rbac-table{width:100%;border-collapse:collapse}.rbac-table th,.rbac-table td{padding:13px 12px;border-bottom:1px solid #eee;text-align:left;vertical-align:middle}.rbac-table th{font-size:11px;letter-spacing:.08em;color:#777}.role-pill{display:inline-flex;padding:5px 9px;border-radius:999px;background:#f7e8f4;color:#a32890;font-weight:800;font-size:11px}.perm-chip{display:inline-flex;padding:4px 7px;border-radius:7px;background:#f4f4f5;color:#555;font-size:10px;margin:2px}.user-status{font-size:11px;font-weight:800}.user-status.active{color:#238a56}.user-status.disabled{color:#999}.rbac-modal{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;z-index:9999;padding:20px}.rbac-modal.open{display:flex}.rbac-modal-card{background:#fff;width:min(620px,100%);border-radius:18px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,.18)}.rbac-modal-card h3{margin-top:0}.rbac-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}.rbac-fields label{font-size:11px;font-weight:800}.rbac-fields input,.rbac-fields select{width:100%;margin-top:6px;border:1px solid #ddd;border-radius:10px;padding:11px}.rbac-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.rbac-actions button{border:0;border-radius:999px;padding:10px 16px;font-weight:800;cursor:pointer}.rbac-actions .primary{background:#a32890;color:#fff}
    `; document.head.appendChild(style);
  }

  function injectAdminUsers() {
    const page=document.getElementById('page-admins');
    if(!page || page.dataset.rbacReady==='1') return;
    page.dataset.rbacReady='1'; injectStyles();
    const wrap=document.createElement('div'); wrap.className='rbac-wrap';
    const users=[
      {name:'Mohamed Mostafa',email:'owner@vetsvan.com',role:'Super Admin',status:'active'},
      {name:'Ahmed',email:'ahmed@vetsvan.com',role:'Booking Manager',status:'active'},
      {name:'Sara',email:'sara@vetsvan.com',role:'Content Manager',status:'active'}
    ];
    wrap.innerHTML=`<div class="panel"><div class="rbac-head"><div><h3>Admin Users & Permissions</h3><p>Control who can view, edit and manage each part of the dashboard.</p></div><div class="rbac-tools"><button class="primary" id="rbacAddUser"><i class="fa-solid fa-plus"></i> Add User</button></div></div><div style="overflow:auto"><table class="rbac-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Permissions</th><th></th></tr></thead><tbody id="rbacUsers"></tbody></table></div></div>`;
    page.appendChild(wrap);
    const body=wrap.querySelector('#rbacUsers');
    function render(){body.innerHTML=users.map((u,i)=>`<tr><td><strong>${escapeHtml(u.name)}</strong><br><small>${escapeHtml(u.email)}</small></td><td><span class="role-pill">${escapeHtml(u.role)}</span></td><td><span class="user-status ${u.status}">● ${u.status==='active'?'Active':'Disabled'}</span></td><td>${(roles[u.role]||[]).slice(0,4).map(p=>`<span class="perm-chip">${escapeHtml(p)}</span>`).join('')}${(roles[u.role]||[]).length>4?`<span class="perm-chip">+${roles[u.role].length-4} more</span>`:''}</td><td><button class="dots" data-edit-user="${i}">•••</button></td></tr>`).join('');}
    render();
    const modal=document.createElement('div'); modal.className='rbac-modal'; modal.innerHTML=`<div class="rbac-modal-card"><h3>Add Admin User</h3><p style="color:#777">Create a user and assign the appropriate dashboard role.</p><div class="rbac-fields"><label>Name<input id="rbacName"></label><label>Email<input id="rbacEmail" type="email"></label><label>Role<select id="rbacRole">${Object.keys(roles).map(r=>`<option>${r}</option>`).join('')}</select></label><label>Status<select id="rbacStatus"><option value="active">Active</option><option value="disabled">Disabled</option></select></label></div><div id="rbacPermPreview" style="margin-top:14px"></div><div class="rbac-actions"><button id="rbacCancel">Cancel</button><button class="primary" id="rbacCreate">Create User</button></div></div>`;
    document.body.appendChild(modal);
    const roleSelect=modal.querySelector('#rbacRole'), preview=modal.querySelector('#rbacPermPreview');
    function previewPerms(){preview.innerHTML=`<strong style="font-size:11px">Permissions</strong><div>${(roles[roleSelect.value]||[]).map(p=>`<span class="perm-chip">${escapeHtml(p)}</span>`).join('')}</div>`;}
    roleSelect.addEventListener('change',previewPerms); previewPerms();
    wrap.querySelector('#rbacAddUser').addEventListener('click',()=>modal.classList.add('open'));
    modal.querySelector('#rbacCancel').addEventListener('click',()=>modal.classList.remove('open'));
    modal.querySelector('#rbacCreate').addEventListener('click',()=>{const name=modal.querySelector('#rbacName').value.trim(),email=modal.querySelector('#rbacEmail').value.trim();if(!name||!email){alert('Name and email are required.');return;}users.push({name,email,role:roleSelect.value,status:modal.querySelector('#rbacStatus').value});render();modal.classList.remove('open');modal.querySelector('#rbacName').value='';modal.querySelector('#rbacEmail').value='';alert('User added in Demo Mode.');});
  }

  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function bind() {
    injectStyles(); cleanupDuplicateWebsiteLabels(); injectAdminUsers();
    const nav=document.querySelector('.sidebar nav');
    if(nav && nav.dataset.dynamicNavigationBound!=='1'){
      nav.dataset.dynamicNavigationBound='1';
      nav.addEventListener('click',function(event){const item=event.target.closest('.nav-item[data-page]');if(!item)return;event.preventDefault();event.stopImmediatePropagation();showOnlyPage(item.dataset.page);},true);
    }
    document.addEventListener('click',function(event){const item=event.target.closest('[data-page]');if(!item||item.classList.contains('nav-item'))return;showOnlyPage(item.dataset.page);},true);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind); else bind();
})();
