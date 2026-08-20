import express from 'express';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';
import { ROLES, normalizeRole, hasPermission, requirePermission } from './rbac.js';

const { Pool } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = express();
const PORT = process.env.PORT || 5000;
const production = process.env.NODE_ENV === 'production';
const secret = process.env.JWT_SECRET;
if (production && !secret) throw new Error('JWT_SECRET is required in production');
const JWT_SECRET = secret || 'local-development-secret-change-me';
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

const q = async (sql, params=[]) => {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool.query(sql, params);
};
const publicJson = (res, data, status=200) => res.status(status).json(data);

async function initDb() {
  if (!pool) return;
  await q(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'viewer',active BOOLEAN NOT NULL DEFAULT TRUE,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS audit_logs (id SERIAL PRIMARY KEY,admin_id INT REFERENCES admins(id) ON DELETE SET NULL,action TEXT NOT NULL,resource TEXT,details JSONB DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS services (id SERIAL PRIMARY KEY,name_en TEXT NOT NULL,name_ar TEXT DEFAULT '',description_en TEXT DEFAULT '',description_ar TEXT DEFAULT '',price NUMERIC(10,2),image_url TEXT DEFAULT '',active BOOLEAN DEFAULT TRUE,sort_order INT DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY,booking_code TEXT UNIQUE NOT NULL,customer_name TEXT NOT NULL,mobile TEXT NOT NULL,email TEXT,pet_type TEXT,pet_name TEXT,breed TEXT,age TEXT,gender TEXT,service_id INT REFERENCES services(id) ON DELETE SET NULL,area TEXT,address TEXT,directions TEXT,appointment_date DATE,appointment_time TEXT,status TEXT DEFAULT 'new',admin_notes TEXT DEFAULT '',created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY,name TEXT NOT NULL,mobile TEXT,email TEXT,subject TEXT,message TEXT NOT NULL,status TEXT DEFAULT 'unread',created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS site_content (id SERIAL PRIMARY KEY,content_key TEXT UNIQUE NOT NULL,value_en TEXT DEFAULT '',value_ar TEXT DEFAULT '',updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY,value TEXT DEFAULT '',updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS experts (id SERIAL PRIMARY KEY,name_en TEXT NOT NULL,name_ar TEXT DEFAULT '',title_en TEXT DEFAULT '',title_ar TEXT DEFAULT '',bio_en TEXT DEFAULT '',bio_ar TEXT DEFAULT '',image_url TEXT DEFAULT '',active BOOLEAN DEFAULT TRUE,sort_order INT DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS partnerships (id SERIAL PRIMARY KEY,name TEXT NOT NULL,logo_url TEXT DEFAULT '',website_url TEXT DEFAULT '',description TEXT DEFAULT '',active BOOLEAN DEFAULT TRUE,sort_order INT DEFAULT 0,created_at TIMESTAMPTZ DEFAULT NOW(),updated_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS media (id SERIAL PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,type TEXT DEFAULT 'image',alt_text TEXT DEFAULT '',created_at TIMESTAMPTZ DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS seo_settings (id INT PRIMARY KEY DEFAULT 1,title_en TEXT DEFAULT '',title_ar TEXT DEFAULT '',description_en TEXT DEFAULT '',description_ar TEXT DEFAULT '',keywords_en TEXT DEFAULT '',keywords_ar TEXT DEFAULT '',og_image TEXT DEFAULT '',updated_at TIMESTAMPTZ DEFAULT NOW());
  INSERT INTO seo_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;`);
  const admin = await q('SELECT id FROM admins LIMIT 1');
  if (!admin.rows.length && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await q('INSERT INTO admins(name,email,password_hash,role) VALUES($1,LOWER($2),$3,$4)', [process.env.ADMIN_NAME || 'Super Admin', process.env.ADMIN_EMAIL, hash, 'super_admin']);
  }
}

function auth(req,res,next){
  try { const token=(req.headers.authorization||'').replace(/^Bearer\s+/i,''); req.user=jwt.verify(token,JWT_SECRET); next(); }
  catch { res.status(401).json({error:'Unauthorized'}); }
}
const protect = permission => [auth, requirePermission(permission)];
async function audit(req,action,resource,details={}) { if(pool&&req.user) await q('INSERT INTO audit_logs(admin_id,action,resource,details) VALUES($1,$2,$3,$4)',[req.user.id,action,resource,JSON.stringify(details)]); }

app.get('/api/health', async (_req,res)=>{try{if(pool)await q('SELECT 1');res.json({ok:true,database:!!pool});}catch(e){res.status(503).json({ok:false,error:e.message});}});
app.post('/api/auth/login', async(req,res)=>{try{const {email,password}=req.body;if(!email||!password)return res.status(400).json({error:'Email and password are required'});const r=await q('SELECT * FROM admins WHERE LOWER(email)=LOWER($1) AND active=true LIMIT 1',[email]);if(!r.rows.length||!(await bcrypt.compare(password,r.rows[0].password_hash)))return res.status(401).json({error:'Invalid credentials'});const a=r.rows[0],role=normalizeRole(a.role);const token=jwt.sign({id:a.id,email:a.email,name:a.name,role},JWT_SECRET,{expiresIn:'12h'});res.json({token,user:{id:a.id,name:a.name,email:a.email,role}});}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/admin/me',auth,(req,res)=>res.json({user:req.user,permissions:ROLES[normalizeRole(req.user.role)]||[]}));

app.get('/api/dashboard',...protect('dashboard:read'),async(_req,res)=>{try{const [t,p,c,m,recent]=await Promise.all([q('SELECT COUNT(*)::int n FROM bookings'),q("SELECT COUNT(*)::int n FROM bookings WHERE status IN ('new','pending')"),q("SELECT COUNT(*)::int n FROM bookings WHERE status='completed'"),q("SELECT COUNT(*)::int n FROM messages WHERE status='unread'"),q('SELECT b.*,s.name_en service_name FROM bookings b LEFT JOIN services s ON s.id=b.service_id ORDER BY b.created_at DESC LIMIT 8')]);res.json({stats:{total:t.rows[0].n,pending:p.rows[0].n,completed:c.rows[0].n,unreadMessages:m.rows[0].n},recent:recent.rows});}catch(e){res.status(500).json({error:e.message});}});

app.get('/api/services',async(_req,res)=>{try{res.json((await q('SELECT * FROM services WHERE active=true ORDER BY sort_order,id')).rows);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/admin/services',...protect('services:read'),async(_req,res)=>{try{res.json((await q('SELECT * FROM services ORDER BY sort_order,id')).rows);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/admin/services',...protect('services:write'),async(req,res)=>{try{const x=req.body,r=await q('INSERT INTO services(name_en,name_ar,description_en,description_ar,price,image_url,active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[x.name_en,x.name_ar||'',x.description_en||'',x.description_ar||'',x.price||null,x.image_url||'',x.active!==false,x.sort_order||0]);await audit(req,'create','service',{id:r.rows[0].id});res.status(201).json(r.rows[0]);}catch(e){res.status(400).json({error:e.message});}});
app.patch('/api/admin/services/:id',...protect('services:write'),async(req,res)=>{try{const x=req.body,r=await q('UPDATE services SET name_en=COALESCE($1,name_en),name_ar=COALESCE($2,name_ar),description_en=COALESCE($3,description_en),description_ar=COALESCE($4,description_ar),price=COALESCE($5,price),image_url=COALESCE($6,image_url),active=COALESCE($7,active),sort_order=COALESCE($8,sort_order),updated_at=NOW() WHERE id=$9 RETURNING *',[x.name_en,x.name_ar,x.description_en,x.description_ar,x.price,x.image_url,x.active,x.sort_order,req.params.id]);await audit(req,'update','service',{id:req.params.id});res.json(r.rows[0]);}catch(e){res.status(400).json({error:e.message});}});
app.delete('/api/admin/services/:id',...protect('services:write'),async(req,res)=>{try{await q('DELETE FROM services WHERE id=$1',[req.params.id]);await audit(req,'delete','service',{id:req.params.id});res.status(204).end();}catch(e){res.status(500).json({error:e.message});}});

app.post('/api/bookings',async(req,res)=>{try{const x=req.body,code='VV-'+Date.now().toString().slice(-8);const r=await q(`INSERT INTO bookings(booking_code,customer_name,mobile,email,pet_type,pet_name,breed,age,gender,service_id,area,address,directions,appointment_date,appointment_time) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,[code,x.customer_name,x.mobile,x.email||null,x.pet_type||null,x.pet_name||null,x.breed||null,x.age||null,x.gender||null,x.service_id||null,x.area||null,x.address||null,x.directions||null,x.appointment_date||null,x.appointment_time||null]);res.status(201).json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/bookings',...protect('bookings:read'),async(req,res)=>{try{const s=req.query.status,qry=s?'SELECT b.*,s.name_en service_name FROM bookings b LEFT JOIN services s ON s.id=b.service_id WHERE b.status=$1 ORDER BY b.created_at DESC':'SELECT b.*,s.name_en service_name FROM bookings b LEFT JOIN services s ON s.id=b.service_id ORDER BY b.created_at DESC';res.json((await q(qry,s?[s]:[])).rows);}catch(e){res.status(500).json({error:e.message});}});
app.patch('/api/bookings/:id',...protect('bookings:write'),async(req,res)=>{try{const r=await q('UPDATE bookings SET status=COALESCE($1,status),admin_notes=COALESCE($2,admin_notes),updated_at=NOW() WHERE id=$3 RETURNING *',[req.body.status,req.body.admin_notes,req.params.id]);await audit(req,'update','booking',{id:req.params.id});res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});

app.post('/api/messages',async(req,res)=>{try{const x=req.body,r=await q('INSERT INTO messages(name,mobile,email,subject,message) VALUES($1,$2,$3,$4,$5) RETURNING *',[x.name,x.mobile||null,x.email||null,x.subject||null,x.message]);res.status(201).json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/admin/messages',...protect('messages:read'),async(_req,res)=>{try{res.json((await q('SELECT * FROM messages ORDER BY created_at DESC')).rows);}catch(e){res.status(500).json({error:e.message});}});
app.patch('/api/admin/messages/:id',...protect('messages:write'),async(req,res)=>{try{const r=await q('UPDATE messages SET status=COALESCE($1,status) WHERE id=$2 RETURNING *',[req.body.status,req.params.id]);res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});

// Public CMS
app.get('/api/content',async(_req,res)=>{try{const rows=(await q('SELECT content_key,value_en,value_ar FROM site_content')).rows;res.json(Object.fromEntries(rows.map(x=>[x.content_key,{en:x.value_en,ar:x.value_ar}])));}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/admin/content/:key',...protect('content:write'),async(req,res)=>{try{const r=await q('INSERT INTO site_content(content_key,value_en,value_ar) VALUES($1,$2,$3) ON CONFLICT(content_key) DO UPDATE SET value_en=EXCLUDED.value_en,value_ar=EXCLUDED.value_ar,updated_at=NOW() RETURNING *',[req.params.key,req.body.en||'',req.body.ar||'']);await audit(req,'update','content',{key:req.params.key});res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/site-settings',async(_req,res)=>{try{const rows=(await q('SELECT key,value FROM site_settings')).rows;res.json(Object.fromEntries(rows.map(x=>[x.key,x.value])));}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/admin/settings',...protect('settings:read'),async(_req,res)=>{try{const rows=(await q('SELECT key,value FROM site_settings')).rows;res.json(Object.fromEntries(rows.map(x=>[x.key,x.value])));}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/admin/settings/:key',...protect('settings:write'),async(req,res)=>{try{const r=await q('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW() RETURNING *',[req.params.key,String(req.body.value??'')]);await audit(req,'update','setting',{key:req.params.key});res.json(r.rows[0]);}catch(e){res.status(500).json({error:e.message});}});

// Generic CMS resources: experts, partnerships, media.
const resourceMap={experts:{table:'experts',permission:'experts',columns:['name_en','name_ar','title_en','title_ar','bio_en','bio_ar','image_url','active','sort_order']},partnerships:{table:'partnerships',permission:'partnerships',columns:['name','logo_url','website_url','description','active','sort_order']},media:{table:'media',permission:'media',columns:['name','url','type','alt_text']}};
function resourceRoutes(name){const cfg=resourceMap[name];app.get('/api/admin/'+name,...protect(cfg.permission+':read'),async(_req,res)=>{try{res.json((await q(`SELECT * FROM ${cfg.table} ORDER BY sort_order NULLS LAST,id`)).rows);}catch(e){res.status(500).json({error:e.message});}});app.post('/api/admin/'+name,...protect(cfg.permission+':write'),async(req,res)=>{try{const vals=cfg.columns.map(c=>req.body[c]??(c==='active'?true:c==='sort_order'?0:''));const ph=cfg.columns.map((_,i)=>'$'+(i+1)).join(',');const r=await q(`INSERT INTO ${cfg.table}(${cfg.columns.join(',')}) VALUES(${ph}) RETURNING *`,vals);await audit(req,'create',name,{id:r.rows[0].id});res.status(201).json(r.rows[0]);}catch(e){res.status(400).json({error:e.message});}});app.patch('/api/admin/'+name+'/:id',...protect(cfg.permission+':write'),async(req,res)=>{try{const cols=cfg.columns.filter(c=>Object.prototype.hasOwnProperty.call(req.body,c));if(!cols.length)return res.status(400).json({error:'No fields to update'});const vals=cols.map(c=>req.body[c]),sets=cols.map((c,i)=>`${c}=$${i+1}`).join(',');vals.push(req.params.id);const r=await q(`UPDATE ${cfg.table} SET ${sets},updated_at=NOW() WHERE id=$${vals.length} RETURNING *`,vals);await audit(req,'update',name,{id:req.params.id});res.json(r.rows[0]);}catch(e){res.status(400).json({error:e.message});}});app.delete('/api/admin/'+name+'/:id',...protect(cfg.permission+':write'),async(req,res)=>{try{await q(`DELETE FROM ${cfg.table} WHERE id=$1`,[req.params.id]);await audit(req,'delete',name,{id:req.params.id});res.status(204).end();}catch(e){res.status(500).json({error:e.message});}});}
resourceRoutes('experts');resourceRoutes('partnerships');resourceRoutes('media');

app.get('/api/admin/seo',...protect('seo:read'),async(_req,res)=>{try{res.json((await q('SELECT * FROM seo_settings WHERE id=1')).rows[0]);}catch(e){res.status(500).json({error:e.message});}});
app.put('/api/admin/seo',...protect('seo:write'),async(req,res)=>{try{const keys=['title_en','title_ar','description_en','description_ar','keywords_en','keywords_ar','og_image'];const vals=keys.map(k=>req.body[k]??'');const r=await q(`UPDATE seo_settings SET ${keys.map((k,i)=>k+'=$'+(i+1)).join(',')},updated_at=NOW() WHERE id=1 RETURNING *`,vals);await audit(req,'update','seo',{});res.json(r.rows[0]);}catch(e){res.status(400).json({error:e.message});}});
app.get('/api/admin/users',...protect('users:manage'),async(_req,res)=>{try{res.json((await q('SELECT id,name,email,role,active,created_at,updated_at FROM admins ORDER BY id')).rows);}catch(e){res.status(500).json({error:e.message});}});
app.post('/api/admin/users',...protect('users:manage'),async(req,res)=>{try{const role=normalizeRole(req.body.role||'viewer');if(!ROLES[role])return res.status(400).json({error:'Invalid role'});const hash=await bcrypt.hash(req.body.password,12);const r=await q('INSERT INTO admins(name,email,password_hash,role,active) VALUES($1,LOWER($2),$3,$4,$5) RETURNING id,name,email,role,active',[req.body.name,req.body.email,hash,role,req.body.active!==false]);await audit(req,'create','admin',{id:r.rows[0].id,role});res.status(201).json(r.rows[0]);}catch(e){res.status(400).json({error:e.code==='23505'?'Email already exists':e.message});}});
app.patch('/api/admin/users/:id',...protect('users:manage'),async(req,res)=>{try{if(String(req.params.id)===String(req.user.id)&&req.body.active===false)return res.status(400).json({error:'You cannot disable yourself'});const sets=[],vals=[];for(const k of ['name','email','role','active'])if(k in req.body){sets.push(k+'=$'+(vals.length+1));vals.push(k==='role'?normalizeRole(req.body[k]):req.body[k]);}if(req.body.password){sets.push('password_hash=$'+(vals.length+1));vals.push(await bcrypt.hash(req.body.password,12));}if(!sets.length)return res.status(400).json({error:'No fields'});sets.push('updated_at=NOW()');vals.push(req.params.id);const r=await q(`UPDATE admins SET ${sets.join(',')} WHERE id=$${vals.length} RETURNING id,name,email,role,active`,vals);res.json(r.rows[0]);}catch(e){res.status(400).json({error:e.message});}});
app.delete('/api/admin/users/:id',...protect('users:manage'),async(req,res)=>{try{if(String(req.params.id)===String(req.user.id))return res.status(400).json({error:'You cannot delete yourself'});await q('DELETE FROM admins WHERE id=$1',[req.params.id]);res.status(204).end();}catch(e){res.status(500).json({error:e.message});}});
app.get('/api/admin/audit-logs',...protect('users:manage'),async(_req,res)=>{try{res.json((await q('SELECT l.*,a.name admin_name FROM audit_logs l LEFT JOIN admins a ON a.id=l.admin_id ORDER BY l.created_at DESC LIMIT 300')).rows);}catch(e){res.status(500).json({error:e.message});}});

// Do not expose project internals. Only explicit public assets are served.
app.get('/admin/login',async(_req,res)=>res.sendFile(path.join(root,'admin','login.html')));
app.get('/admin',async(_req,res)=>{let html=await fs.readFile(path.join(root,'admin','index.html'),'utf8');if(!html.includes('cms-live.js'))html=html.replace('</body>','<script src="/admin/cms-live.js"></script></body>');res.type('html').send(html);});
app.use('/admin',express.static(path.join(root,'admin')));
app.use(express.static(root,{index:'index.html',dotfiles:'deny'}));
app.get('*',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Not found'});res.sendFile(path.join(root,'index.html'));});

initDb().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`VETS VAN server listening on ${PORT}`))).catch(e=>{console.error('Startup failed:',e);process.exit(1);});
