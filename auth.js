import { sql, init, who, sign, hash, check, setCookie } from './_lib.js';

export default async function handler(req, res) {
  await init();
  const a = req.query.a;
  const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM users`;
  if (a === 'me') return res.json({ user: await who(req), setup: n === 0 });
  if (a === 'logout') { setCookie(res, '', 0); return res.json({ ok: true }); }
  if (req.method !== 'POST') return res.status(405).end();
  const { username = '', password = '', name = '' } = req.body || {};
  const id = username.trim().toLowerCase();

  if (a === 'setup') { // création du tout premier compte (admin), possible une seule fois
    if (n > 0 || password.length < 6 || !id) return res.status(400).json({ error: 'Impossible.' });
    const [u] = await sql`INSERT INTO users(username,name,role,pass_hash)
      VALUES(${id},${name || id},'admin',${await hash(password)}) RETURNING id`;
    setCookie(res, await sign(u));
    return res.json({ ok: true });
  }
  if (a === 'login') {
    const [u] = await sql`SELECT * FROM users WHERE username=${id} AND active`;
    if (!u || !(await check(password, u.pass_hash))) {
      await new Promise(r => setTimeout(r, 800));
      return res.status(401).json({ error: 'Identifiant ou mot de passe incorrect.' });
    }
    setCookie(res, await sign(u));
    return res.json({ ok: true });
  }
  res.status(400).end();
}
