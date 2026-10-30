import { config, demoAutorisee } from "./config.js";
import { tx, un, db } from "./db.js";
import { erreur } from "./http.js";
import { notifier } from "./notifier.js";
import { OPERATEURS } from "./referentiel.js";

// Le prestataire de paiement n'est pas encore choisi (cahier des charges, points 9 et 11 : FedaPay, KkiaPay ou API directe).
// Tout passe par ces deux fonctions : seule initierChezPrestataire() est à écrire une fois le choix fait.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function initierChezPrestataire(_p: { montant: number; operateur: string; tel: string; cle: string }): Promise<{ reference: string | null }> {
  if (config.paymentMode === "simule") {
    if (!demoAutorisee()) throw erreur(503, "Le paiement en ligne n'est pas encore disponible.");
    return { reference: `SIM${Date.now().toString(36).toUpperCase()}` };
  }
  throw erreur(503, "Le paiement en ligne n'est pas encore configuré.");
}

// Applique le résultat d'un paiement, quelle que soit sa source (webhook, simulation, finance). Idempotent.
export async function appliquerResultat(paiementId: string, statut: "recu" | "echoue", reference?: string | null) {
  const change = await tx(async (q) => {
    const p = await un<{ statut: string }>(q, "SELECT statut FROM paiements WHERE id = $1 FOR UPDATE", [paiementId]);
    if (!p || p.statut !== "en_attente") return false;
    await q.query(
      "UPDATE paiements SET statut = $2, reference_externe = COALESCE($3, reference_externe) WHERE id = $1", [paiementId, statut, reference ?? null]);
    return true;
  });
  if (!change) return;
  const d = await un<any>(
    db, `SELECT p.montant, p.moyen, l.tel, l.id AS uid, a.ref, r.numero
           FROM paiements p JOIN baux b ON b.id = p.bail_id JOIN utilisateurs l ON l.id = b.locataire_id
           JOIN annonces a ON a.id = b.annonce_id LEFT JOIN recus r ON r.paiement_id = p.id WHERE p.id = $1`, [paiementId]);
  if (statut === "recu" && d)
    await notifier({ modele: "paiement", tel: d.tel, utilisateurId: d.uid, dedup: `paiement-${paiementId}`,
      vars: { montant: `${new Intl.NumberFormat("fr-FR").format(d.montant).replace(/[\u202f\u00a0]/g, " ")} FCFA`, moyen: OPERATEURS[d.moyen], recu: d.numero } });
}

export function formatFCFA(n: number) {
  return `${new Intl.NumberFormat("fr-FR").format(n).replace(/[\u202f\u00a0]/g, " ")} FCFA`;
}
