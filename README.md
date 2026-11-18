# Suivi des présences — déploiement Vercel

1. Créez un **nouveau dépôt GitHub** avec le contenu de ce dossier, puis sur Vercel : *Add New → Project* → importez ce dépôt
   (Framework Preset : **Other**, aucun build nécessaire).
2. Dans le projet Vercel : **Storage / Marketplace → Neon (Postgres) → Connect**. Vercel ajoute automatiquement `DATABASE_URL`.
3. **Settings → Environment Variables** : ajoutez
   - `AUTH_SECRET` : une longue chaîne aléatoire (32 caractères ou plus),
   - `WORK_START` : heure limite d'arrivée, ex. `08:00` (après, l'agent est marqué « Retard »),
   - `TZ_NAME` (optionnel) : fuseau horaire, par défaut `Africa/Lome`.
4. **Redéployez**, ouvrez le site : le premier écran crée le compte administrateur.
5. Onglet **Comptes** : créez un compte par agent (identifiant + mot de passe provisoire), puis partagez le lien du site.

Chaque matin : l'agent ouvre le lien → se connecte → « Je suis arrivé » ; le soir → « Je pars ».
L'heure est celle du serveur. Les tables sont créées automatiquement au premier appel.
