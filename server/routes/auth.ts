import { z } from "zod";
import { demanderOtp, exigerUtilisateur, fermerSession, normaliserTel, ouvrirSession, utilisateurCourant, verifierOtp } from "../auth.js";
import { signer, verifierSignature } from "../crypto.js";
import { db, un } from "../db.js";
import { erreur, get, patch, post } from "../http.js";

const tel = z.string().min(8).max(20);

export const compteFront = (u: { tel: string; nom: string; role_actif: string }) => ({ tel: u.tel, nom: u.nom, role: u.role_actif });

// Étape 1 : envoi du code (AUT-01, AUT-02)
post("/auth/otp", async (c) => {
  const { tel: t } = await c.body(z.object({ tel }));
  return demanderOtp(normaliserTel(t));
});

// Étape 2 : vérification. Compte existant -> session ouverte. Sinon -> preuve à présenter à /auth/inscription.
post("/auth/verifier", async (c) => {
  const b = await c.body(z.object({ tel, code: z.string().regex(/^\d{6}$/, "6 chiffres attendus") }));
  const t = normaliserTel(b.tel);
  if (!(await verifierOtp(t, b.code))) throw erreur(401, "Ce code n'est pas bon ou a expiré. Vérifiez-le ou demandez-en un nouveau.");
  const u = await un<{ id: string; nom: string; tel: string; role_actif: string; statut: string; supprime_le: Date | null }>(
    db, "SELECT id, nom, tel, role_actif, statut, supprime_le FROM utilisateurs WHERE tel = $1", [t]);
  if (u && u.statut === "suspendu") throw erreur(403, "Ce compte est suspendu. Contactez le support Xwé Tché pour en savoir plus.", "suspendu");
  if (u && !u.supprime_le) {
    await ouvrirSession(c, { utilisateurId: u.id });
    return { existe: true, compte: compteFront(u) };
  }
  return { existe: false, preuve: signer({ tel: t, but: "inscription" }, 15 * 60) };
});

// Étape 3 (nouveaux comptes) : nom et rôle (AUT-03)
post("/auth/inscription", async (c) => {
  const b = await c.body(z.object({ preuve: z.string(), nom: z.string().trim().min(2).max(80), role: z.enum(["locataire", "proprietaire"]) }));
  const p = verifierSignature<{ tel: string; but: string }>(b.preuve);
  if (!p || p.but !== "inscription") throw erreur(401, "La vérification de votre numéro a expiré. Recommencez la connexion.");
  const r = await un<{ id: string; nom: string; tel: string; role_actif: string }>(
    db,
    `INSERT INTO utilisateurs (tel, nom, roles, role_actif) VALUES ($1, $2, ARRAY[$3]::role_utilisateur[], $3)
     ON CONFLICT (tel) DO UPDATE SET nom = EXCLUDED.nom, supprime_le = NULL, maj_le = now()
       WHERE utilisateurs.supprime_le IS NOT NULL
     RETURNING id, nom, tel, role_actif`,
    [p.tel, b.nom, b.role]);
  if (!r) throw erreur(409, "Un compte existe déjà avec ce numéro. Connectez-vous avec le code reçu.");
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
