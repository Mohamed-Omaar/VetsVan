import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-render';
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..')));

async function query(text, params = []) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool.query(text, params);
}

async function bootstrap() {
  if (!pool) return;
  await query(`CREATE TABLE IF NOT EXISTS admins (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'admin', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS services (id SERIAL PRIMARY KEY, name_en TEXT NOT NULL, name_ar TEXT NOT NULL DEFAULT '', description_en TEXT NOT NULL DEFAULT '', description_ar TEXT NOT NULL DEFAULT '', price NUMERIC(10,2), image_url TEXT, active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS bookings (id SERIAL PRIMARY KEY, booking_code TEXT UNIQUE NOT NULL, customer_name TEXT NOT NULL, mobile TEXT NOT NULL, email TEXT, pet_type TEXT, pet_name TEXT, breed TEXT, age TEXT, gender TEXT, service_id INT REFERENCES services(id) ON DELETE SET NULL, area TEXT, address TEXT, directions TEXT, appointment_date DATE, appointment_time TEXT, status TEXT NOT NULL DEFAULT 'new', admin_notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS messages (id SERIAL PRIMARY KEY, name TEXT NOT NULL, mobile TEXT, email TEXT, subject TEXT, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'unread', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS site_content (id SERIAL PRIMARY KEY, content_key TEXT UNIQUE NOT NULL, value_en TEXT NOT NULL DEFAULT '', value_ar TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
  const admin = await query('SELECT id FROM admins LIMIT 1');
  if (!admin.rows.length && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await query('INSERT INTO admins(name,email,password_hash,role) VALUES($1,$2,$3,$4)', [process.env.ADMIN_NAME || 'Admin', process.env.ADMIN_EMAIL.toLowerCase(), hash, 'super_admin']);
  }
}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Unauthorized' }); }
}

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
    const result = await query('SELECT * FROM admins WHERE LOWER(email)=LOWER($1) AND active=true LIMIT 1', [email]);
    if (!result.rows.length || !(await bcrypt.compare(password, result.rows[0].password_hash))) return res.status(401).json({ error: 'Invalid credentials' });
    const admin = result.rows[0];
    const token = jwt.sign({ id: admin.id, email: admin.email, name: admin.name, role: admin.role }, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/health', async (_req, res) => res.json({ ok: true, database: !!pool }));

app.get('/api/admin/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/api/dashboard', auth, async (_req, res) => {
  try {
    const [total, pending, completed, messages, recent] = await Promise.all([
      query('SELECT COUNT(*)::int AS n FROM bookings'), query("SELECT COUNT(*)::int AS n FROM bookings WHERE status IN ('new','pending')"), query("SELECT COUNT(*)::int AS n FROM bookings WHERE status='completed'"), query("SELECT COUNT(*)::int AS n FROM messages WHERE status='unread'"), query(`SELECT b.*, s.name_en AS service_name FROM bookings b LEFT JOIN services s ON s.id=b.service_id ORDER BY b.created_at DESC LIMIT 8`)
    ]);
    res.json({ stats: { total: total.rows[0].n, pending: pending.rows[0].n, completed: completed.rows[0].n, unreadMessages: messages.rows[0].n }, recent: recent.rows });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/bookings', auth, async (req, res) => {
  try {
    const q = String(req.query.search || '').trim();
    const status = String(req.query.status || '').trim();
    const params = []; const where = [];
    if (q) { params.push(`%${q}%`); where.push(`(b.customer_name ILIKE $${params.length} OR b.pet_name ILIKE $${params.length} OR b.booking_code ILIKE $${params.length})`); }
    if (status) { params.push(status); where.push(`b.status=$${params.length}`); }
    const sql = `SELECT b.*, s.name_en AS service_name FROM bookings b LEFT JOIN services s ON s.id=b.service_id ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY b.appointment_date DESC NULLS LAST, b.created_at DESC`;
    res.json((await query(sql, params)).rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const b = req.body; const code = 'VV-' + Date.now().toString().slice(-7);
    const r = await query(`INSERT INTO bookings(booking_code,customer_name,mobile,email,pet_type,pet_name,breed,age,gender,service_id,area,address,directions,appointment_date,appointment_time,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'new') RETURNING *`, [code,b.customer_name,b.mobile,b.email||null,b.pet_type||null,b.pet_name||null,b.breed||null,b.age||null,b.gender||null,b.service_id||null,b.area||null,b.address||null,b.directions||null,b.appointment_date||null,b.appointment_time||null]);
    res.status(201).json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/bookings/:id', auth, async (req, res) => {
  try { const { status, admin_notes } = req.body; const r = await query('UPDATE bookings SET status=COALESCE($1,status), admin_notes=COALESCE($2,admin_notes), updated_at=NOW() WHERE id=$3 RETURNING *',[status,admin_notes,req.params.id]); res.json(r.rows[0]); } catch(e){res.status(500).json({error:e.message});}
});

app.get('/api/services', async (_req,res)=>{ try { res.json((await query('SELECT * FROM services WHERE active=true ORDER BY sort_order,id')).rows); } catch(e){res.status(500).json({error:e.message});} });
app.get('/api/admin/services', auth, async (_req,res)=>{ try { res.json((await query('SELECT * FROM services ORDER BY sort_order,id')).rows); } catch(e){res.status(500).json({error:e.message});} });
app.post('/api/admin/services', auth, async (req,res)=>{ try { const x=req.body; const r=await query('INSERT INTO services(name_en,name_ar,description_en,description_ar,price,image_url,active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[x.name_en,x.name_ar||'',x.description_en||'',x.description_ar||'',x.price||null,x.image_url||null,x.active!==false,x.sort_order||0]); res.status(201).json(r.rows[0]); }catch(e){res.status(500).json({error:e.message});} });
app.patch('/api/admin/services/:id', auth, async (req,res)=>{ try { const x=req.body; const r=await query('UPDATE services SET name_en=COALESCE($1,name_en),name_ar=COALESCE($2,name_ar),description_en=COALESCE($3,description_en),description_ar=COALESCE($4,description_ar),price=COALESCE($5,price),image_url=COALESCE($6,image_url),active=COALESCE($7,active),sort_order=COALESCE($8,sort_order),updated_at=NOW() WHERE id=$9 RETURNING *',[x.name_en,x.name_ar,x.description_en,x.description_ar,x.price,x.image_url,x.active,x.sort_order,req.params.id]); res.json(r.rows[0]); }catch(e){res.status(500).json({error:e.message});} });
app.delete('/api/admin/services/:id', auth, async (req,res)=>{ try { await query('DELETE FROM services WHERE id=$1',[req.params.id]); res.status(204).end(); }catch(e){res.status(500).json({error:e.message});} });

app.get('/api/content', async (_req,res)=>{ try { const rows=(await query('SELECT content_key,value_en,value_ar FROM site_content')).rows; res.json(Object.fromEntries(rows.map(x=>[x.content_key,{en:x.value_en,ar:x.value_ar}]))); }catch(e){res.status(500).json({error:e.message});} });
app.put('/api/admin/content/:key', auth, async (req,res)=>{ try { const {en='',ar=''}=req.body; const r=await query('INSERT INTO site_content(content_key,value_en,value_ar) VALUES($1,$2,$3) ON CONFLICT(content_key) DO UPDATE SET value_en=$2,value_ar=$3,updated_at=NOW() RETURNING *',[req.params.key,en,ar]); res.json(r.rows[0]); }catch(e){res.status(500).json({error:e.message});} });

app.get('/api/admin/messages', auth, async (_req,res)=>{ try { res.json((await query('SELECT * FROM messages ORDER BY created_at DESC')).rows); }catch(e){res.status(500).json({error:e.message});} });
app.post('/api/messages', async (req,res)=>{ try { const x=req.body; const r=await query('INSERT INTO messages(name,mobile,email,subject,message) VALUES($1,$2,$3,$4,$5) RETURNING id',[x.name,x.mobile||null,x.email||null,x.subject||null,x.message]); res.status(201).json({ok:true,id:r.rows[0].id}); }catch(e){res.status(500).json({error:e.message});} });

app.get('/api/admin/settings', auth, async (_req,res)=>{ try { const rows=(await query('SELECT key,value FROM site_settings')).rows; res.json(Object.fromEntries(rows.map(x=>[x.key,x.value]))); }catch(e){res.status(500).json({error:e.message});} });
app.put('/api/admin/settings/:key', auth, async (req,res)=>{ try { const r=await query('INSERT INTO site_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2,updated_at=NOW() RETURNING *',[req.params.key,String(req.body.value??'')]); res.json(r.rows[0]); }catch(e){res.status(500).json({error:e.message});} });

app.get('/admin/login', (_req,res)=>res.sendFile(path.join(__dirname,'..','admin','login.html')));
app.get('/admin', (_req,res)=>res.sendFile(path.join(__dirname,'..','admin','index.html')));

bootstrap().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`VETS VAN server listening on ${PORT}`))).catch(e=>{console.error(e); process.exit(1);});
