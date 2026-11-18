import { neon } from '@neondatabase/serverless';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

export const sql = neon(process.env.DATABASE_URL);
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET || '');
const TZ = process.env.TZ_NAME || 'Africa/Lome';

let ready;
export function init() {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS users(
      id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      category TEXT DEFAULT '', service TEXT DEFAULT '', role TEXT NOT NULL DEFAULT 'agent',
      pass_hash TEXT NOT NULL, active BOOLEAN DEFAULT TRUE)`;
    await sql`CREATE TABLE IF NOT EXISTS attendance(
      user_id INT REFERENCES users(id) ON DELETE CASCADE, day DATE NOT NULL,
      arrive TIME, depart TIME, status TEXT, note TEXT DEFAULT '',
      PRIMARY KEY(user_id, day))`;
  })();
  return ready;
}

// Date et heure officielles, calculées côté serveur (l'agent ne peut pas les modifier)
export function now() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === '24' ? '00' : p.hour}:${p.minute}` };
}

export const sign = u => new SignJWT({ id: u.id }).setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('12h').sign(key());

export async function who(req) {
  const m = /(?:^|; )sp=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], key());
    const [u] = await sql`SELECT id,username,name,category,service,role FROM users WHERE id=${payload.id} AND active`;
    return u || null;
  } catch { return null; }
}
export const hash = p => bcrypt.hash(p, 10);
export const check = (p, h) => bcrypt.compare(p, h);
export const setCookie = (res, t, max = 43200) =>
  res.setHeader('Set-Cookie', `sp=${t}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${max}`);
