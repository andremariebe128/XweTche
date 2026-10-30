import { createHmac } from "node:crypto";
import { config } from "../config.js";
import { egal } from "../crypto.js";
import { db, un } from "../db.js";
import { erreur, get, post } from "../http.js";
import { expedier, notifier } from "../notifier.js";
import { appliquerResultat } from "../paiement.js";
import { param } from "../referentiel.js";
import { dateBJ } from "./moi.js";

get("/sante", async () => {
  const r = await un<{ ok: number }>(db, "SELECT 1 AS ok");
  return { ok: r?.ok === 1 };
});

// ---------------------------------------------------------------- Webhooks des prestataires de paiement (PAY-07)
// Le corps brut est signé en HMAC-SHA256 avec PAYMENT_WEBHOOK_SECRET (en-tête x-signature, hexadécimal).
// Format normalisé attendu : { reference, statut } ; adapter normaliser() au format du prestataire choisi.
const OK = ["success", "succeeded", "approved", "paid", "completed", "recu"];
const KO = ["failed", "declined", "canceled", "cancelled", "echoue", "refused"];
function normaliser(charge: any): { reference: string; statut: "recu" | "echoue" } | null {
  const reference = String(charge?.reference ?? charge?.transaction_id ?? charge?.id ?? "");
  const s = String(charge?.statut ?? charge?.status ?? "").toLowerCase();
  if (!reference) return null;
  return OK.includes(s) ? { reference, statut: "recu" } : KO.includes(s) ? { reference, statut: "echoue" } : null;
}

post("/webhooks/paiement/:prestataire", async (c) => {
  const brut = await c.req.text();
  const sig = c.req.headers.get("x-signature") ?? "";
  const attendu = config.paymentWebhookSecret ? createHmac("sha256", config.paymentWebhookSecret).update(brut).digest("hex") : "";
  const valide = !!attendu && egal(sig, attendu);
  let charge: any = null;
  try { charge = JSON.parse(brut); } catch { /* corps illisible : journalisé quand même */ }
  const n = normaliser(charge);
  const w = await un<{ id: number }>(db,
    "INSERT INTO webhooks_paiement (prestataire, evenement, reference_externe, charge, signature_valide) VALUES ($1,$2,$3,$4,$5) RETURNING id",
    [c.params.prestataire, charge?.event ?? null, n?.reference ?? null, JSON.stringify(charge ?? { brut: brut.slice(0, 2000) }), valide]);
  if (!valide) throw erreur(401, "Signature invalide.");
  if (n) {
    const p = await un<{ id: string }>(db, "SELECT id FROM paiements WHERE reference_externe = $1 OR cle_idempotence = $1", [n.reference]);
    if (p) await appliquerResultat(p.id, n.statut, n.reference);
    else await db.query("UPDATE webhooks_paiement SET erreur = 'paiement inconnu' WHERE id = $1", [w!.id]);
  }
  await db.query("UPDATE webhooks_paiement SET traite_le = now() WHERE id = $1", [w!.id]);
  return { ok: true };
});

// ---------------------------------------------------------------- Tâches planifiées
// À appeler toutes les 15 minutes (cron externe ou plan Vercel Pro) ; une fois par jour suffit pour les rappels J-30 / J-7.
// Authentification : Authorization: Bearer <CRON_SECRET> (Vercel l'ajoute tout seul pour ses crons).
async function tachesPlanifiees() {
  const bilan: Record<string, number> = {};

  // 1. Messages en attente ou en échec récent (rappels 2 h avant visite compris)
  const aEnvoyer = await db.query<{ id: string }>(
    `SELECT id FROM notifications
      WHERE (statut = 'en_attente' AND planifie_le <= now())
         OR (statut = 'echec' AND cree_le > now() - interval '6 hours' AND COALESCE(erreur, '') NOT LIKE '%non configuré%')
      ORDER BY planifie_le LIMIT 200`);
  for (const n of aEnvoyer.rows) await expedier(n.id);
  bilan.messages = aEnvoyer.rows.length;

  // 2. Liste d'attente : rappels J-30 et J-7 avant la libération (10.3)
  for (const jours of [30, 7]) {
    const r = await db.query<any>(
      `SELECT a.id, a.ref, a.disponible_le, q.nom AS quartier, a.slug, w.canal, u.tel, u.id AS uid
         FROM annonces a JOIN biens b ON b.id = a.bien_id JOIN quartiers q ON q.id = b.quartier_id
         JOIN liste_attente w ON w.annonce_id = a.id JOIN utilisateurs u ON u.id = w.utilisateur_id
        WHERE a.statut = 'louee' AND a.disponible_le = (now() AT TIME ZONE 'Africa/Porto-Novo')::date + $1::int`, [jours]);
    for (const x of r.rows)
      await notifier({ modele: "liberation", tel: x.tel, utilisateurId: x.uid, canal: x.canal, dedup: `attente-j${jours}-${x.id}-${x.uid}`,
        vars: { ref: x.ref, quartier: x.quartier, date: dateBJ(x.disponible_le), lien: `${config.appUrl}/annonce/${x.slug}` } });
    bilan[`rappels_j${jours}`] = r.rows.length;
  }

  // 3. Biens dont la date de départ est atteinte : contrôle rapide avant republication (5.1 « Libérée »)
  const liberes = await db.query(
    "UPDATE annonces SET statut = 'liberee' WHERE statut = 'louee' AND disponible_le IS NOT NULL AND disponible_le <= (now() AT TIME ZONE 'Africa/Porto-Novo')::date RETURNING id");
  bilan.liberees = liberes.rows.length;

  // 4. Alerte avant échéance de l'étude (BO-01) : une seule fois par annonce, aux agents d'étude et au responsable
  const seuil = await param("alerte_etude_h", 12);
  const urgentes = await db.query<{ id: string; ref: string; h: number }>(
    "SELECT a.id, a.ref, round(etude_heures_restantes(a))::int AS h FROM annonces a WHERE a.statut IN ('soumise','en_etude') AND etude_heures_restantes(a) <= $1", [seuil]);
  for (const a of urgentes.rows) {
    const agents = await db.query<{ id: string; tel: string }>("SELECT id, tel FROM membres_agence WHERE statut = 'actif' AND role IN ('etude','admin')");
    for (const m of agents.rows)
      await notifier({ modele: "alerte-etude", tel: m.tel, membreId: m.id, vars: { ref: a.ref, heures: a.h }, dedup: `etude-${a.id}-${m.id}` });
  }
  bilan.alertes_etude = urgentes.rows.length;

  await db.query("SELECT nettoyer_expires()");
  return bilan;
}

get("/cron/rappels", async (c) => {
  const auth = c.req.headers.get("authorization") ?? "";
  if (!config.cronSecret || !egal(auth, `Bearer ${config.cronSecret}`)) throw erreur(401, "Accès refusé.");
  return tachesPlanifiees();
});
