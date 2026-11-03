import { z } from "zod";
import { exigerUtilisateur, fermerSession, normaliserTel, noterTentative, ouvrirSession, utilisateurCourant, verifierTentatives } from "../auth.js";
import { hacherMotDePasse, verifierMotDePasse } from "../crypto.js";
import { db, un } from "../db.js";
import { erreur, get, patch, post, type Ctx } from "../http.js";

const tel = z.string().min(8).max(20);
const motDePasse = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères.").max(128);

export const compteFront = (u: { tel: string; nom: string; role_actif: string }) => ({ tel: u.tel, nom: u.nom, role: u.role_actif });

const ipDe = (c: Ctx) => (c.req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 60) || "inconnu";

// Connexion par numéro + mot de passe (AUT-01, AUT-02).
post("/auth/connexion", async (c) => {
  const b = await c.body(z.object({ tel, motDePasse }));
  const t = normaliserTel(b.tel);
  const cle = `u:${t}`;
  await verifierTentatives(cle);
  const u = await un<{ id: string; nom: string; tel: string; role_actif: string; statut: string; supprime_le: Date | null; pin_hash: string | null }>(
    db, "SELECT id, nom, tel, role_actif, statut, supprime_le, pin_hash FROM utilisateurs WHERE tel = $1", [t]);
  const ok = !!u && !u.supprime_le && u.statut === "actif" && (await verifierMotDePasse(b.motDePasse, u.pin_hash));
  await noterTentative(cle, ipDe(c), ok);
  if (u?.statut === "suspendu") throw erreur(403, "Ce compte est suspendu. Contactez le support Xwé Tché pour en savoir plus.", "suspendu");
  if (!ok) throw erreur(401, "Numéro ou mot de passe incorrect.");
  await ouvrirSession(c, { utilisateurId: u!.id });
  return { compte: compteFront(u!) };
});

// Inscription : nom, numéro, rôle et mot de passe (AUT-03).
post("/auth/inscription", async (c) => {
  const b = await c.body(z.object({ tel, nom: z.string().trim().min(2).max(80), role: z.enum(["locataire", "proprietaire"]), motDePasse }));
  const t = normaliserTel(b.tel);
  const existant = await un<{ id: string }>(db, "SELECT id FROM utilisateurs WHERE tel = $1 AND supprime_le IS NULL", [t]);
  if (existant) throw erreur(409, "Un compte existe déjà avec ce numéro. Connectez-vous.");
  const hash = await hacherMotDePasse(b.motDePasse);
  const r = await un<{ id: string; nom: string; tel: string; role_actif: string }>(
    db,
    `INSERT INTO utilisateurs (tel, nom, roles, role_actif, pin_hash) VALUES ($1, $2, ARRAY[$3]::role_utilisateur[], $3, $4)
     ON CONFLICT (tel) DO UPDATE SET nom = EXCLUDED.nom, roles = EXCLUDED.roles, role_actif = EXCLUDED.role_actif,
       pin_hash = EXCLUDED.pin_hash, statut = 'actif', supprime_le = NULL, maj_le = now()
       WHERE utilisateurs.supprime_le IS NOT NULL
     RETURNING id, nom, tel, role_actif`,
    [t, b.nom, b.role, hash]);
  if (!r) throw erreur(409, "Un compte existe déjà avec ce numéro. Connectez-vous.");
  await ouvrirSession(c, { utilisateurId: r.id });
  return { compte: compteFront(r) };
});


post("/auth/deconnexion", async (c) => {
  await fermerSession(c, false);
});

get("/moi", async (c) => {
  const u = await utilisateurCourant(c);
  return { compte: u ? compteFront(u) : null };
});

// Changement de rôle ou de nom (AUT-03, AUT-05). Passer propriétaire ajoute le rôle sans retirer l'ancien.
patch("/moi", async (c) => {
  const u = await exigerUtilisateur(c);
  const b = await c.body(z.object({
    nom: z.string().trim().min(2).max(80).optional(), role: z.enum(["locataire", "proprietaire"]).optional(),
    profession: z.string().max(80).optional(), email: z.string().email().max(120).optional(),
    langue: z.enum(["fr", "fon", "yo"]).optional(),
  }));
  await db.query(
    `UPDATE utilisateurs SET nom = COALESCE($2, nom), profession = COALESCE($3, profession),
            email = COALESCE($4, email), langue = COALESCE($5, langue),
            roles = CASE WHEN $6::role_utilisateur IS NOT NULL AND NOT ($6::role_utilisateur = ANY (roles)) THEN roles || $6::role_utilisateur ELSE roles END,
            role_actif = COALESCE($6::role_utilisateur, role_actif)
      WHERE id = $1`,
    [u.id, b.nom ?? null, b.profession ?? null, b.email ?? null, b.langue ?? null, b.role ?? null]);
  const r = await un<{ tel: string; nom: string; role_actif: string }>(db, "SELECT tel, nom, role_actif FROM utilisateurs WHERE id = $1", [u.id]);
  return { compte: compteFront(r!) };
});

// Droit de suppression (15) : le compte est désactivé et les données personnelles effacées ; les baux et reçus restent pour la comptabilité.
post("/moi/supprimer", async (c) => {
  const u = await exigerUtilisateur(c);
  await db.query(
    `UPDATE utilisateurs SET supprime_le = now(), nom = 'Compte supprimé', email = NULL, photo_cle = NULL, profession = NULL,
            pin_hash = NULL, tel = lpad((floor(random() * 1e12))::bigint::text, 12, '0') WHERE id = $1`, [u.id]);
  await db.query("UPDATE sessions SET revoquee_le = now() WHERE utilisateur_id = $1", [u.id]);
  await fermerSession(c, false);
});
