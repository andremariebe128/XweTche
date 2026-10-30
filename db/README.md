# Base de données Xwé Tché (Neon / PostgreSQL)

## Mise en place sur Neon (5 minutes)
1. Créez un compte sur https://neon.com et un projet **xwe-tche** (Postgres 16 ou 17, région la plus proche : `eu-central-1` Francfort ou `eu-west-2` Londres).
2. Créez deux branches : `main` (production) et `dev` (développement ; branche enfant de `main`).
3. Bouton **Connect** : copiez la chaîne *pooled* dans `DATABASE_URL` et la chaîne *direct* dans `DATABASE_URL_UNPOOLED` (fichier `.env`, copie de `.env.example`).
4. Dans le terminal du projet :
   ```
   npm install
   npm run db:seed        # tables + vues + données de référence (villes, quartiers, FAQ, paramètres…)
   npm run db:demo        # OPTIONNEL, branche dev uniquement : 9 annonces de démonstration
   ```
   Les migrations sont rejouables : seules celles pas encore appliquées sont jouées (table `schema_migrations`).

## Fichiers
| Fichier | Rôle |
|---|---|
| `migrations/001_schema.sql` | Tables, types, contraintes, index (chapitre 14 du cahier des charges, complété) |
| `migrations/002_vues_fonctions.sql` | Règles métier en base : étude 48 h avec pause, commission, crédit de visite gratuite, reçu automatique, vues publiques et KPI |
| `seed/001_reference.sql` | Données de référence (générées) |
| `seed/002_demo.sql` | Démo (générée, dev uniquement) |
| `generate-seed.mjs` | Régénère les seeds depuis `src/data` et `src/lib/parametres.ts` (`npm run db:generate-seed`) |
| `test-regles.sql` | Scénario de test des règles métier |

Pour changer le schéma : ajoutez `003_xxx.sql`, ne modifiez jamais une migration déjà appliquée.
