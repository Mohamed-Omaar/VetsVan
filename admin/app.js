const demoMode = new URLSearchParams(location.search).get('demo') === '1' || localStorage.getItem('vetsvan_demo') === '1';
if (demoMode) localStorage.setItem('vetsvan_demo', '1');
const token=localStorage.getItem('vetsvan_token');
if(!token && !demoMode) location.replace('/admin/login');
const demoData={
  dashboard:{stats:{total:128,pending:12,completed:96,unreadMessages:2},recent:[
    {booking_code:'VV-0128',customer_name:'Ahmed Alqahtani',service_name:'Vaccinations',appointment_date:'2026-08-19',appointment_time:'6:00 PM',status:'pending'},
    {booking_code:'VV-0127',customer_name:'Laura Smith',service_name:'Wellness Exams',appointment_date:'2026-08-19',appointment_time:'7:30 PM',status:'confirmed'},
    {booking_code:'VV-0126',customer_name:'Omar Hassan',service_name:'Dental Care',appointment_date:'2026-08-20',appointment_time:'4:00 PM',status:'confirmed'},
    {booking_code:'VV-0125',customer_name:'Sarah Ali',service_name:'Lab Tests',appointment_date:'2026-08-20',appointment_time:'8:00 PM',status:'completed'}]},
  bookings:[
    {id:128,booking_code:'VV-0128',customer_name:'Ahmed Alqahtani',pet_name:'Max',pet_type:'Dog',service_name:'Vaccinations',appointment_date:'2026-08-19',appointment_time:'6:00 PM',status:'pending'},
    {id:127,booking_code:'VV-0127',customer_name:'Laura Smith',pet_name:'Luna',pet_type:'Cat',service_name:'Wellness Exams',appointment_date:'2026-08-19',appointment_time:'7:30 PM',status:'confirmed'},
    {id:126,booking_code:'VV-0126',customer_name:'Omar Hassan',pet_name:'Oscar',pet_type:'Dog',service_name:'Dental Care',appointment_date:'2026-08-20',appointment_time:'4:00 PM',status:'confirmed'},
    {id:125,booking_code:'VV-0125',customer_name:'Sarah Ali',pet_name:'Simba',pet_type:'Cat',service_name:'Lab Tests',appointment_date:'2026-08-20',appointment_time:'8:00 PM',status:'completed'}],
  services:[
    {id:1,name_en:'Vaccinations',description_en:'Essential vaccines for a healthy and protected pet.',active:true,image_url:''},
    {id:2,name_en:'Wellness Exams',description_en:'Complete preventive health assessments at home.',active:true,image_url:''},
    {id:3,name_en:'Diagnostic Lab Tests',description_en:'Fast and convenient diagnostic testing.',active:true,image_url:''},
    {id:4,name_en:'Dental Care',description_en:'Professional dental assessment and care.',active:true,image_url:''}],
  messages:[
    {id:1,name:'Mohammed Ali',mobile:'05xxxxxxxx',subject:'General enquiry',message:'I would like to know more about your mobile veterinary services.',created_at:'2026-08-19T08:40:00Z',status:'unread'},
    {id:2,name:'Rana Ahmed',mobile:'05xxxxxxxx',subject:'Booking question',message:'Can I book a visit for my cat this week?',created_at:'2026-08-18T10:30:00Z',status:'read'}]
};
const demoApi=async(path,options={})=>{
  const p=path.split('?')[0];
  if(p==='/dashboard') return demoData.dashboard;
  if(p==='/bookings') return demoData.bookings;
  if(p==='/admin/services') return demoData.services;
  if(p==='/admin/messages') return demoData.messages;
  if(p.startsWith('/bookings/') && options.method==='PATCH') return {ok:true};
  if(p.startsWith('/admin/services/') && options.method==='PATCH') return {ok:true};
  if(p.startsWith('/admin/services/') && options.method==='DELETE') return {ok:true};
  return {};
};
const api=async(path,options={})=>demoMode?demoApi(path,options):(async()=>{const r=await fetch('/api'+path,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(options.headers||{})}});if(r.status===401){localStorage.removeItem('vetsvan_token');location.replace('/admin/login');throw new Error('Session expired')}const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||'Request failed');return data})();
const pageNames={dashboard:['OVERVIEW','Dashboard'],bookings:['MANAGEMENT','Bookings'],services:['MANAGEMENT','Services'],experts:['MANAGEMENT','Experts'],partners:['MANAGEMENT','Partnerships'],content:['WEBSITE','Website Content'],media:['WEBSITE','Media Library'],messages:['INBOX','Contact Messages'],seo:['SYSTEM','SEO & Languages'],settings:['SYSTEM','Settings'],admins:['SYSTEM','Admin Users']};
const navItems=[...document.querySelectorAll('.nav-item')],pages=[...document.querySelectorAll('.page')],title=document.getElementById('pageTitle'),kicker=document.getElementById('pageKicker');
function showPage(name){pages.forEach(p=>p.classList.toggle('active',p.id===`page-${name}`));navItems.forEach(n=>n.classList.toggle('active',n.dataset.page===name));const meta=pageNames[name]||pageNames.dashboard;kicker.textContent=meta[0];title.textContent=meta[1];window.scrollTo({top:0,behavior:'smooth'});document.getElementById('sidebar').classList.remove('open');if(name==='dashboard')loadDashboard();if(name==='bookings')loadBookings();if(name==='services')loadServices();if(name==='messages')loadMessages();}
navItems.forEach(item=>item.addEventListener('click',()=>showPage(item.dataset.page)));document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>showPage(el.dataset.page)));document.getElementById('mobileMenu').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('logout').addEventListener('click',()=>{localStorage.removeItem('vetsvan_token');localStorage.removeItem('vetsvan_user');localStorage.removeItem('vetsvan_demo');location.replace('/admin/login')});
document.getElementById('notifications').addEventListener('click',()=>showPage('bookings'));
document.querySelectorAll('.lang-tabs button').forEach(btn=>btn.addEventListener('click',()=>{btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}));
function setStat(i,v){const el=document.querySelectorAll('.stats-grid .stat strong')[i];if(el)el.textContent=v}
async function loadDashboard(){try{const d=await api('/dashboard');setStat(0,d.stats.total);setStat(1,d.stats.pending);setStat(2,d.stats.completed);setStat(3,d.stats.unreadMessages);const badge=document.querySelector('.nav-item[data-page="bookings"] .badge');if(badge)badge.textContent=d.stats.pending;const list=document.querySelector('.booking-list');if(list&&d.recent.length)list.innerHTML=d.recent.map(b=>`<div class="booking-row"><div class="pet">${(b.customer_name||'V').charAt(0)}</div><div><strong>${esc(b.customer_name)}</strong><small>${esc(b.service_name||'Service')} · ${esc(b.appointment_date||'No date')} ${esc(b.appointment_time||'')}</small></div><span class="status ${statusClass(b.status)}">${esc(b.status)}</span></div>`).join('')}catch(e){console.error(e)}}
async function loadBookings(){try{const rows=await api('/bookings');const body=document.querySelector('#page-bookings tbody');if(!body)return;body.innerHTML=rows.map(b=>`<tr><td><strong>#${esc(b.booking_code)}</strong></td><td>${esc(b.customer_name)}</td><td>${esc(b.pet_name||'-')} · ${esc(b.pet_type||'-')}</td><td>${esc(b.service_name||'-')}</td><td>${esc(b.appointment_date||'-')} · ${esc(b.appointment_time||'-')}</td><td><span class="status ${statusClass(b.status)}">${esc(b.status)}</span></td><td><button class="dots" onclick="updateBooking(${b.id},'confirmed')">✓</button></td></tr>`).join('')||'<tr><td colspan="7">No bookings yet.</td></tr>'}catch(e){console.error(e)}}
async function updateBooking(id,status){try{await api(`/bookings/${id}`,{method:'PATCH',body:JSON.stringify({status})});if(demoMode){const row=demoData.bookings.find(x=>x.id===id);if(row)row.status=status;}await loadBookings();await loadDashboard()}catch(e){alert(e.message)}}
async function loadServices(){try{const rows=await api('/admin/services');const page=document.getElementById('page-services');const grid=page.querySelector('.cards-grid');if(!grid)return;grid.innerHTML=rows.map(s=>`<div class="service-card"><div class="service-image">${s.image_url?`<img src="${esc(s.image_url)}" alt="">`:'🩺'}</div><div><span class="live">${s.active?'ACTIVE':'INACTIVE'}</span><h3>${esc(s.name_en)}</h3><p>${esc(s.description_en||'')}</p><div class="card-actions"><button onclick="toggleService(${s.id},${!s.active})">${s.active?'Disable':'Enable'}</button><button onclick="deleteService(${s.id})" class="danger">Delete</button></div></div></div>`).join('')||'<p>No services yet.</p>'}catch(e){console.error(e)}}
async function toggleService(id,active){try{await api(`/admin/services/${id}`,{method:'PATCH',body:JSON.stringify({active})});if(demoMode){const row=demoData.services.find(x=>x.id===id);if(row)row.active=active;}loadServices()}catch(e){alert(e.message)}}
async function deleteService(id){if(!confirm('Delete this service?'))return;try{await api(`/admin/services/${id}`,{method:'DELETE'});if(demoMode)demoData.services=demoData.services.filter(x=>x.id!==id);loadServices()}catch(e){alert(e.message)}}
async function loadMessages(){try{const rows=await api('/admin/messages');const body=document.querySelector('#page-messages tbody');if(!body)return;body.innerHTML=rows.map(m=>`<tr><td><strong>${esc(m.name)}</strong><small>${esc(m.mobile||'')}</small></td><td>${esc(m.subject||'-')}</td><td>${esc((m.message||'').slice(0,70))}</td><td>${new Date(m.created_at).toLocaleString()}</td><td><span class="status ${m.status==='unread'?'pending':'confirmed'}">${esc(m.status)}</span></td><td><button class="dots">•••</button></td></tr>`).join('')||'<tr><td colspan="6">No messages yet.</td></tr>'}catch(e){console.error(e)}}
function statusClass(s){return s==='completed'?'completed':s==='confirmed'?'confirmed':s==='cancelled'?'cancelled':'pending'}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
loadDashboard();
