const pageNames={dashboard:['OVERVIEW','Dashboard'],bookings:['MANAGEMENT','Bookings'],services:['MANAGEMENT','Services'],experts:['MANAGEMENT','Experts'],partners:['MANAGEMENT','Partnerships'],content:['WEBSITE','Website Content'],media:['WEBSITE','Media Library'],messages:['INBOX','Contact Messages'],seo:['SYSTEM','SEO & Languages'],settings:['SYSTEM','Settings'],admins:['SYSTEM','Admin Users']};
const navItems=[...document.querySelectorAll('.nav-item')];
const pages=[...document.querySelectorAll('.page')];
const title=document.getElementById('pageTitle');
const kicker=document.getElementById('pageKicker');
function showPage(name){pages.forEach(p=>p.classList.toggle('active',p.id===`page-${name}`));navItems.forEach(n=>n.classList.toggle('active',n.dataset.page===name));const meta=pageNames[name]||pageNames.dashboard;kicker.textContent=meta[0];title.textContent=meta[1];window.scrollTo({top:0,behavior:'smooth'});document.getElementById('sidebar').classList.remove('open')}
navItems.forEach(item=>item.addEventListener('click',()=>showPage(item.dataset.page)));
document.querySelectorAll('[data-page]').forEach(el=>el.addEventListener('click',()=>showPage(el.dataset.page)));
document.getElementById('mobileMenu').addEventListener('click',()=>document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('notifications').addEventListener('click',()=>alert('3 new booking notifications. Backend notifications will be connected in the next phase.'));
document.getElementById('logout').addEventListener('click',()=>alert('Authentication will be connected in the backend phase.'));
document.querySelectorAll('.lang-tabs button').forEach(btn=>btn.addEventListener('click',()=>{btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}));