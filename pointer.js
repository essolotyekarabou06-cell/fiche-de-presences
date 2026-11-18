import { sql, init, who, now } from './_lib.js';
const LIMITE = process.env.WORK_START || '08:00';

export default async function handler(req, res) {
  await init();
  const u = await who(req);
  if (!u) return res.status(401).json({ error: 'Non connecté.' });
  const { day, time } = now();

  if (req.method === 'POST') {
    const act = req.body?.action;
    if (act === 'arrive') {
      const st = time > LIMITE ? 'Retard' : 'Présent';
      const r = await sql`INSERT INTO attendance(user_id,day,arrive,status) VALUES(${u.id},${day},${time},${st})
        ON CONFLICT (user_id,day) DO UPDATE SET arrive=EXCLUDED.arrive, status=EXCLUDED.status
        WHERE attendance.arrive IS NULL RETURNING user_id`;
      if (!r.length) return res.status(409).json({ error: 'Votre arrivée est déjà enregistrée aujourd’hui.' });
    } else if (act === 'depart') {
      const r = await sql`UPDATE attendance SET depart=${time}
        WHERE user_id=${u.id} AND day=${day} AND arrive IS NOT NULL AND depart IS NULL RETURNING user_id`;
      if (!r.length) return res.status(409).json({ error: 'Enregistrez d’abord votre arrivée (ou départ déjà enregistré).' });
    } else return res.status(400).end();
  }
  const rows = await sql`SELECT to_char(day,'YYYY-MM-DD') AS day, to_char(arrive,'HH24:MI') AS arrive,
    to_char(depart,'HH24:MI') AS depart, status, note FROM attendance
    WHERE user_id=${u.id} AND day >= date_trunc('month', ${day}::date) ORDER BY day DESC`;
  res.json({ today: day, time, limit: LIMITE, rows });
}
