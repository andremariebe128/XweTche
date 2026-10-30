# Xwé Tché — Guide de mise en place, de zéro

Ce guide part de la création de la base de données et va jusqu'à la mise en ligne.
Compter environ 45 minutes. Aucune carte bancaire n'est nécessaire (offres gratuites de Neon et Vercel).

**Vue d'ensemble**

```
Navigateur  ──►  Site (Vite/React)  ──►  API (dossier server/, exposée par api/index.ts)  ──►  Neon (PostgreSQL)
                                                     └──►  Vercel Blob privé (photos, pièces d'identité)
```

---

## Partie 1 — Créer la base de données Neon

1. Allez sur **https://neon.tech** → *Sign up* (compte Google ou GitHub possible).
2. **Create project** :
   - *Project name* : `xwetche`
   - *Postgres version* : 16 (ou la plus récente proposée)
   - *Region* : **Europe (Frankfurt)** ou la plus proche disponible (c'est la plus proche du Bénin).
3. Neon crée automatiquement une base `neondb` et une branche `main` (= votre production).
4. Cliquez sur **Connect** (en haut du tableau de bord). Vous voyez une chaîne de connexion. Il en faut **deux** :
   - Activez le bouton **Connection pooling** → copiez la chaîne (le nom d'hôte contient `-pooler`). C'est `DATABASE_URL`.
   - Désactivez-le → copiez la nouvelle chaîne (sans `-pooler`). C'est `DATABASE_URL_UNPOOLED`.
   - Cochez « Show password » avant de copier, sinon le mot de passe est masqué.
5. **Conseil — une branche pour tester** : *Branches → Create branch* `dev` (copie instantanée de `main`). Travaillez sur `dev` en local, gardez `main` pour la production.

> Pourquoi deux chaînes ? L'API tourne en « serverless » (beaucoup de petites connexions éphémères) : elle passe par le pooler. Les migrations ont besoin d'une connexion directe.

---

## Partie 2 — Préparer le projet sur votre PC (Windows)

Prérequis : **Node.js 20+** (https://nodejs.org) et Git.

1. Dézippez le projet, ouvrez un terminal dans le dossier `XweTche`.
2. Installez les dépendances :
   ```
   npm install
   ```
3. Créez votre fichier de configuration :
   ```
   copy .env.example .env
   ```
4. Ouvrez `.env` et renseignez :
   - `DATABASE_URL` et `DATABASE_URL_UNPOOLED` : les deux chaînes Neon de la partie 1.
   - `SESSION_SECRET` : générez-le avec
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - `CRON_SECRET` : même commande, une autre valeur.
   - Laissez le reste tel quel (`OTP_MODE=demo`, `PAYMENT_MODE=simule`).

**Ne publiez jamais `.env`** : il est déjà dans `.gitignore`.

---

## Partie 3 — Créer les tables et charger les données

Trois commandes, dans cet ordre :

```
npm run db:migrate     # crée les tables, règles métier, vues (3 fichiers de db/migrations)
npm run db:seed        # charge les données de référence : villes, quartiers, équipements, paramètres, modèles de messages, FAQ
npm run db:demo        # (développement seulement) équipe du back-office + comptes et annonces de démonstration
```

Vous devez voir `+ 001_schema.sql`, `+ 002_vues_fonctions.sql`, `+ 003_api.sql`, puis `+ seed/...`.
Relancer une commande est sans danger : chaque migration n'est jouée qu'une fois.

Vérifiez dans Neon → **Tables** : une trentaine de tables (`utilisateurs`, `annonces`, `visites`, `baux`, `paiements`…).

**Comptes de démonstration** (après `db:demo`)

| Rôle | Téléphone |
|---|---|
| Back-office, administrateur | 0161000001 |
| Back-office, étude | 0161000002 |
| Back-office, agent terrain | 0161000004 |
| Back-office, finance | 0161000006 |
| Propriétaire démo | 0166554433 |
| Locataire démo | 0197123456 |

En mode démo, le code à 6 chiffres s'affiche à l'écran au lieu d'être envoyé par SMS.

---

## Partie 4 — Lancer en local

Deux terminaux dans le dossier du projet :

```
npm run api:dev      # API sur http://localhost:3001
npm run dev          # site sur http://localhost:5173 (redirige /api vers l'API)
```

Ouvrez http://localhost:5173.
- Site public : `/`, `/louer`.
- Connexion locataire/propriétaire : `/connexion`.
- Back-office : `/agence`.

**Test automatique de l'API** (80 vérifications, à lancer API arrêtée ou non) :
```
node --env-file=.env server/e2e.mjs
```
⚠ Il crée et supprime des données : ne le lancez que sur la branche `dev`, jamais sur la production.

---

## Partie 5 — Mettre en ligne sur Vercel

1. Poussez le projet sur **GitHub** (dépôt privé).
2. **https://vercel.com** → *Add New → Project* → importez le dépôt. Vercel détecte Vite ; ne changez rien.
3. Avant de cliquer *Deploy*, ouvrez **Environment Variables** et ajoutez (environnement *Production*) :

| Variable | Valeur |
|---|---|
| `DATABASE_URL` | chaîne **poolée** Neon (branche `main`) |
| `SESSION_SECRET` | 32+ caractères aléatoires (différent du local) |
| `APP_URL` | l'adresse finale du site, ex. `https://xwetche.vercel.app` (ou votre domaine) |
| `CRON_SECRET` | valeur aléatoire |
| `OTP_MODE` | `demo` pour un premier essai, puis `sms` (voir partie 7) |
| `SMS_PROVIDER` | `console` puis `http` |
| `PAYMENT_MODE` | `simule` puis `webhook` |
| `ALLOW_DEMO` | `1` **uniquement** tant que vous testez la mise en ligne avec les modes démo |

   > En production, l'API **refuse** OTP démo et paiement simulé si `ALLOW_DEMO` n'est pas à `1`. C'est voulu : on ne doit jamais afficher un code de connexion à l'écran avec de vrais utilisateurs.

4. **Migrer la base de production** depuis votre PC, en mettant dans `.env` les chaînes de la branche `main` de Neon, puis :
   ```
   npm run db:migrate
   npm run db:seed
   ```
   (Pas `db:demo` en production. Il faudra créer le premier administrateur à la main, voir partie 6.)
5. **Photos et pièces d'identité** : dans le projet Vercel → **Storage → Create → Blob** → choisissez **Private**, connectez-le au projet. Vercel ajoute `BLOB_READ_WRITE_TOKEN` tout seul. (Sans cela, les envois de photos échouent en production.)
6. Cliquez **Deploy**. Ensuite, testez `https://votre-site/api/sante` : doit répondre `{"ok":true}`.
7. **Tâche planifiée** : `vercel.json` programme déjà `/api/cron/rappels` une fois par jour (envoi des messages en attente, rappels de liste d'attente J-30 et J-7, nettoyage des codes expirés ; les rappels de visite 2 h avant demandent un passage toutes les 15 minutes). L'offre gratuite n'autorise qu'un passage par jour ; pour toutes les 15 minutes, passez à l'offre Pro ou utilisez un service de cron externe qui appelle l'URL avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.

---

## Partie 6 — Créer le premier administrateur en production

La production n'a pas de comptes de démo. Dans l'éditeur SQL de Neon (*SQL Editor*, branche `main`), exécutez en remplaçant nom et numéro :

```sql
INSERT INTO membres_agence (nom, tel, role, statut)
VALUES ('Votre Nom', '01XXXXXXXX', 'admin', 'actif');
```

Connectez-vous ensuite sur `/agence` avec ce numéro. Depuis **Administration → Équipe**, invitez les autres membres (étude, terrain, finance, support) : ils reçoivent un lien d'activation par SMS.

---

## Partie 7 — Passer en « vrai » (à faire avant l'ouverture au public)

Ces trois points dépendent de choix qui vous appartiennent. Le code est prêt, il reste à brancher.

1. **SMS réels.** Choisissez un prestataire (ex. un agrégateur SMS couvrant le Bénin). Mettez `SMS_PROVIDER=http`, `SMS_API_URL`, `SMS_API_KEY`, `SMS_SENDER`, puis `OTP_MODE=sms`. L'appel HTTP est dans `server/sms.ts` ; adaptez le corps de la requête au format de votre prestataire.
2. **Paiement Mobile Money.** Le prestataire n'est pas encore choisi dans le cahier des charges (FedaPay, KkiaPay, MTN MoMo, Moov Money…). Une fois choisi :
   - écrivez l'appel d'initiation dans `initierChezPrestataire` (`server/paiement.ts`) ;
   - déclarez dans le tableau de bord du prestataire l'URL de rappel `https://votre-site/api/webhooks/paiement/<nom>` et le même secret que `PAYMENT_WEBHOOK_SECRET` (signature HMAC-SHA256 dans l'en-tête `x-signature`) ;
   - mettez `PAYMENT_MODE=webhook`.
3. **Textes juridiques** : le modèle de bail et les conditions portent la mention « À valider avec le juriste ». Faites-les relire avant l'ouverture.

**Liste de contrôle avant ouverture**
- [ ] `/api/sante` répond `ok`
- [ ] `ALLOW_DEMO` retiré, `OTP_MODE=sms`, `PAYMENT_MODE=webhook`
- [ ] Store Blob **privé** créé
- [ ] Premier administrateur créé, comptes de démo absents de la base de production
- [ ] Sauvegarde : Neon conserve l'historique (restauration à un instant donné) ; vérifiez la durée de rétention de votre offre
- [ ] Un paiement réel de petit montant testé de bout en bout

---

## Partie 8 — Au quotidien

- **Modifier la base** : ajoutez un fichier `db/migrations/004_xxx.sql` (jamais modifier les anciens), puis `npm run db:migrate`.
- **Changer commission, délais, plafonds** : back-office → Administration → Paramètres (aucun code à toucher).
- **Modifier les modèles de SMS, la FAQ, le bandeau d'accueil** : back-office → Administration.
- **Tester une nouveauté sans risque** : branche Neon `dev` + déploiement « Preview » de Vercel (une variable `DATABASE_URL` différente pour *Preview*).

## En cas de problème

| Symptôme | Piste |
|---|---|
| `DATABASE_URL manquant` | `.env` absent ou mal nommé (il doit s'appeler exactement `.env`) |
| `password authentication failed` | mot de passe masqué lors de la copie : recopiez avec « Show password » |
| Le site local affiche des erreurs réseau | l'API n'est pas lancée (`npm run api:dev`) |
| 403 « origine » en production | `APP_URL` ne correspond pas à l'adresse réelle du site |
| Envoi de photo échoue en production | store Blob privé non connecté |
| Code SMS jamais reçu | `OTP_MODE=sms` sans prestataire configuré : regarder les journaux Vercel |

## Ce qui n'est pas encore fait (à savoir)

- Prestataires réels de SMS et de paiement (partie 7).
- Reçu PDF : la page reçu s'imprime depuis le navigateur.
- Détection d'image floue : seules la résolution minimale et les doublons sont contrôlés.
- Statistiques d'usage (cahier 7.6).
