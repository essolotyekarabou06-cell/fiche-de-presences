import { sql, init, who, hash } from './_lib.js';
const ROLES = ['agent', 'gestionnaire', 'admin'];

export default async function handler(req, res) {
  await init();
  const me = await who(req);
  if (!me || me.role === 'agent') return res.status(403).json({ error: 'Accès refusé.' });
  const admin = me.role === 'admin', q = req.query.q;

  if (req.method === 'GET') {
    if (q === 'day') return res.json(await sql`
      SELECT u.id,u.name,u.category,u.service, to_char(a.arrive,'HH24:MI') arrive, to_char(a.depart,'HH24:MI') depart,
        a.status, COALESCE(a.note,'') note
      FROM users u LEFT JOIN attendance a ON a.user_id=u.id AND a.day=${req.query.date}::date
      WHERE u.active ORDER BY u.name`);
    if (q === 'month') return res.json(await sql`
      SELECT u.id,u.name,u.category,u.service,
        COUNT(*) FILTER (WHERE a.status='Présent')::int AS present, COUNT(*) FILTER (WHERE a.status='Absent')::int AS absent,
        COUNT(*) FILTER (WHERE a.status='Retard')::int AS retard, COUNT(*) FILTER (WHERE a.status='Permission')::int AS permission,
        COUNT(*) FILTER (WHERE a.status='Congé')::int AS conge, COUNT(*) FILTER (WHERE a.status='Maladie')::int AS maladie,
        ROUND(AVG(EXTRACT(EPOCH FROM a.arrive)/60))::int AS arr
      FROM users u LEFT JOIN attendance a ON a.user_id=u.id AND to_char(a.day,'YYYY-MM')=${req.query.month}
      WHERE u.active GROUP BY u.id ORDER BY u.name`);
    if (q === 'users' && admin) return res.json(await sql`
      SELECT id,username,name,category,service,role,active FROM users ORDER BY name`);
    return res.status(400).end();
  }

  const b = req.body || {};
  if (b.action === 'set') { // correction / saisie manuelle d'une journée
    const t = v => v || null;
    await sql`INSERT INTO attendance(user_id,day,arrive,depart,status,note)
      VALUES(${b.user_id},${b.day},${t(b.arrive)},${t(b.depart)},${t(b.status)},${b.note || ''})
      ON CONFLICT (user_id,day) DO UPDATE SET arrive=EXCLUDED.arrive, depart=EXCLUDED.depart,
        status=EXCLUDED.status, note=EXCLUDED.note`;
    return res.json({ ok: true });
  }
  if (!admin) return res.status(403).json({ error: 'Réservé à l’admin.' });

  if (b.action === 'user_add') {
    const id = (b.username || '').trim().toLowerCase();
    if (!id || (b.password || '').length < 6 || !ROLES.includes(b.role))
      return res.status(400).json({ error: 'Identifiant, rôle et mot de passe (6 caractères min.) requis.' });
    try {
      await sql`INSERT INTO users(username,name,category,service,role,pass_hash)
        VALUES(${id},${b.name || id},${b.category || ''},${b.service || ''},${b.role},${await hash(b.password)})`;
    } catch { return res.status(409).json({ error: 'Cet identifiant existe déjà.' }); }
    return res.json({ ok: true });
  }
  if (b.action === 'user_update') {
    if (b.id === me.id && ((b.role && b.role !== 'admin') || b.active === false))
      return res.status(400).json({ error: 'Vous ne pouvez pas retirer vos propres droits.' });
    if (b.password) {
      if (b.password.length < 6) return res.status(400).json({ error: '6 caractères minimum.' });
      await sql`UPDATE users SET pass_hash=${await hash(b.password)} WHERE id=${b.id}`;
    }
    if (ROLES.includes(b.role)) await sql`UPDATE users SET role=${b.role} WHERE id=${b.id}`;
    if (typeof b.active === 'boolean') await sql`UPDATE users SET active=${b.active} WHERE id=${b.id}`;
    return res.json({ ok: true });
  }
  res.status(400).end();
}
