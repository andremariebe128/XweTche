// Crée ou réinitialise un membre du back-office avec un mot de passe.
// Usage : npm run admin:creer -- "Nom Prénom" 0161000001 "mot de passe"
import pg from "pg";
import { hacherMotDePasse } from "../server/crypto.js";

const [nom, tel, mdp] = process.argv.slice(2);
if (!nom || !tel || !mdp) {
  console.error('Usage : npm run admin:creer -- "Nom Prénom" 0161000001 "mot de passe"');
  process.exit(1);
}
if (mdp.length < 8) {
  console.error("Le mot de passe doit contenir au moins 8 caractères.");
  process.exit(1);
}

const numero = tel.replace(/\D/g, "");
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquant : renseignez .env.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: true },
});
await client.connect();
try {
  const hash = await hacherMotDePasse(mdp);
  const r = await client.query(
    `INSERT INTO membres_agence (nom, tel, role, statut, mot_de_passe_hash)
     VALUES ($1, $2, 'admin', 'actif', $3)
     ON CONFLICT (tel) DO UPDATE
       SET nom = EXCLUDED.nom, role = 'admin', statut = 'actif',
           mot_de_passe_hash = EXCLUDED.mot_de_passe_hash
     RETURNING nom, tel`,
    [nom, numero, hash]);
  console.log(`Administrateur prêt : ${r.rows[0].nom} (${r.rows[0].tel})`);
} finally {
  await client.end();
}
