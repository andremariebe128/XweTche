# Xwé Tché

Plateforme de location de logements au Bénin : annonces vérifiées, visites accompagnées, candidatures, baux et paiement Mobile Money.

- **Site public** : recherche d'annonces, réservation de visite, espace locataire / propriétaire.
- **Back-office agence** : étude des annonces, contrôle terrain, visites, baux, finance, support, équipe et journal d'audit.
- **API** : fonctions serverless (dossier `server/`), base PostgreSQL hébergée sur Neon.

## Technologies

React 19 · TypeScript · Vite · React Router · API TypeScript maison · PostgreSQL (Neon) · Vercel Blob · Zod.

## Démarrage rapide

```bash
npm install
copy .env.example .env    # puis renseigner DATABASE_URL, DATABASE_URL_UNPOOLED et SESSION_SECRET
npm run db:migrate
npm run db:seed
npm run db:demo           # développement uniquement : données et comptes de démonstration
```

Deux terminaux :

```bash
npm run api:dev           # API sur http://localhost:3001
npm run dev               # site sur http://localhost:5173
```

La connexion se fait par **numéro de téléphone + mot de passe**, sans code SMS. Les comptes de démonstration utilisent tous le mot de passe `Demo1234` :

| Rôle | Téléphone |
|---|---|
| Back-office, administrateur | 0161000001 |
| Back-office, étude | 0161000002 |
| Back-office, agent terrain | 0161000004 |
| Back-office, finance | 0161000006 |
| Propriétaire démo | 0166554433 |
| Locataire démo | 0197123456 |

## Scripts utiles

| Commande | Rôle |
|---|---|
| `npm run dev` | Site en développement |
| `npm run api:dev` | API en développement |
| `npm run build` | Vérification TypeScript + build de production |
| `npm run lint` | Analyse ESLint |
| `npm run typecheck:api` | Vérification TypeScript de l'API |
| `npm run db:migrate` | Applique les migrations |
| `npm run db:seed` | Charge les données de référence |
| `npm run db:demo` | Charge les données de démonstration (dev) |
| `npm run db:generate-seed` | Régénère le seed de référence |
| `npm run admin:creer -- "Nom" 0161000001 "motdepasse"` | Crée ou réinitialise un administrateur |

## Tests

Avec l'API lancée sur le port 3001 et une base de développement :

```bash
node --env-file=.env server/e2e.mjs
```

Le scénario couvre le parcours complet : inscription, dépôt d'annonce, étude, contrôle terrain, visite, candidature, bail, paiement, back-office, invitations et sécurité.

## Documentation

Le guide complet de mise en place et de déploiement est dans [`GUIDE.md`](./GUIDE.md). Le détail de la base est dans [`db/README.md`](./db/README.md).

> Ne jamais charger `db:demo` en production : les comptes et annonces de démonstration sont fictifs. Créez le premier administrateur avec `npm run admin:creer`.
