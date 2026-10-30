// Applique les migrations (db/migrations) puis, avec --seed, les données de référence.
//   node --env-file=.env db/migrate.mjs            -> migrations seulement
//   node --env-file=.env db/migrate.mjs --seed     -> + données de référence
//   node --env-file=.env db/migrate.mjs --demo     -> + données de démo (dev uniquement)
// Chaque migration est jouée une seule fois (table schema_migrations), dans une transaction.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const dossier = dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant : copiez .env.example en .env et collez la chaîne de connexion Neon.");
  process.exit(1);
}
const args = new Set(process.argv.slice(2));
const demo = args.has("--demo");
const seed = args.has("--seed") || demo;

if (demo && /neon\.tech/.test(url) && !args.has("--force-demo") && process.env.NODE_ENV === "production") {
  console.error("Refus de charger les données de démo en production.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true } });
await client.connect();

try {
  // Verrou consultatif : deux migrations simultanées ne se marchent pas dessus.
  await client.query("SELECT pg_advisory_lock(727001)");
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nom text PRIMARY KEY, appliquee_le timestamptz NOT NULL DEFAULT now())`);
  const faites = new Set((await client.query("SELECT nom FROM schema_migrations")).rows.map((r) => r.nom));

  for (const f of readdirSync(join(dossier, "migrations")).filter((n) => n.endsWith(".sql")).sort()) {
    if (faites.has(f)) { console.log(`= ${f} (déjà appliquée)`); continue; }
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(join(dossier, "migrations", f), "utf8"));
      await client.query("INSERT INTO schema_migrations (nom) VALUES ($1)", [f]);
      await client.query("COMMIT");
      console.log(`+ ${f}`);
    } catch (e) {
      await client.query("ROLLBACK");
      throw new Error(`${f} : ${e.message}`);
    }
  }

  if (seed) {
    const fichiers = ["001_reference.sql", ...(demo ? ["002_demo.sql"] : [])];
    for (const f of fichiers) {
      await client.query(readFileSync(join(dossier, "seed", f), "utf8"));
      console.log(`+ seed/${f}`);
    }
  }
} catch (e) {
  console.error("Échec :", e.message);
  process.exitCode = 1;
} finally {
  await client.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
  await client.end();
}
