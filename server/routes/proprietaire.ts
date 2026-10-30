import { z } from "zod";
import { exigerRole, type Utilisateur } from "../auth.js";
import { calculerPreControle } from "../annonces.js";
import { db, tx, un, type Requetable } from "../db.js";
import { erreur, post, put } from "../http.js";
import { notifier } from "../notifier.js";
import { genererSlug, TYPES, param } from "../referentiel.js";

const photoSchema = z.object({
  cle: z.string().max(300), cleOriginale: z.string().max(300).optional(), legende: z.string().max(80).default("Photo"),
  largeur: z.number().int().positive(), hauteur: z.number().int().positive(), empreinte: z.string().regex(/^[0-9a-f]{16}$/).optional(),
});
const bienSchema = z.object({
  type: z.enum(Object.keys(TYPES) as [string, ...string[]]),
  quartier: z.string().min(2).max(80),
  adresse: z.string().trim().min(3).max(200),
  gps: z.string().max(60).optional(),
  reperes: z.union([z.string(), z.array(z.string())]).optional(),
  titre: z.string().max(120).optional(),
  chambres: z.number().int().min(0).max(20).optional(),
  surface: z.number().int().positive().max(5000).optional(),
  photos: z.array(photoSchema).max(30),
  loyer: z.number().int().positive().max(100_000_000),
  avanceMois: z.number().int().min(0).max(12), cautionMois: z.number().int().min(0).max(12),
  charges: z.number().int().min(0).max(100_000_000).default(0),
  equipements: z.array(z.string().max(30)).max(20).default([]),
  description: z.string().trim().min(10).max(3000),
  regles: z.union([z.string(), z.array(z.string())]).default([]),
  gestionnaire: z.boolean().default(false),
  pieces: z.object({ identite: z.string().uuid().optional(), propriete: z.string().uuid().optional(), mandat: z.string().uuid().optional() }).default({}),
  certifs: z.tuple([z.boolean(), z.boolean(), z.boolean()]),
});

const lignes = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v : (v ?? "").split(/\n|;/)).map((x) => x.trim()).filter(Boolean).slice(0, 12);

function coordonnees(gps?: string) {
  const m = gps?.match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
  if (!m) return { lat: null, lng: null };
  const lat = Number(m[1].replace(",", ".")), lng = Number(m[2].replace(",", "."));
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : { lat: null, lng: null };
}

async function enregistrerPhotos(q: Requetable, u: Utilisateur, annonceId: string, photos: z.infer<typeof photoSchema>[]) {
  await q.query("DELETE FROM medias WHERE annonce_id = $1 AND controle_id IS NULL", [annonceId]);
  let ordre = 0;
  for (const p of photos) {
    // Une clé ne peut être utilisée que par la personne qui a envoyé le fichier
    if (!p.cle.startsWith(`u/${u.id}/photos/`) || (p.cleOriginale && !p.cleOriginale.startsWith(`u/${u.id}/originaux/`)))
      throw erreur(403, "Une des photos n'a pas été envoyée depuis votre compte. Renvoyez-la.");
    await q.query(
      `INSERT INTO medias (annonce_id, cle_webp, cle_originale, ordre, legende, largeur_px, hauteur_px, empreinte)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [annonceId, p.cle, p.cleOriginale ?? null, ordre++, p.legende, p.largeur, p.hauteur, p.empreinte ?? null]);
  }
}

// Dépôt d'un bien (PRO-01, PRO-02) : crée le bien et l'annonce, lance l'étude de 48 h.
post("/proprietaire/biens", async (c) => {
  const u = await exigerRole(c, "proprietaire");
  const b = await c.body(bienSchema);
  const min = await param("photos_min", 6);
  if (b.photos.length < min) throw erreur(422, `Ajoutez au moins ${min} photos pour envoyer votre annonce en étude.`);
  if (!b.certifs.every(Boolean)) throw erreur(422, "Cochez les trois certifications avant d'envoyer votre annonce.");
  if (!b.pieces.identite) throw erreur(422, "Ajoutez votre pièce d'identité pour envoyer votre annonce en étude.");
  if (!b.pieces.propriete) throw erreur(422, "Ajoutez le document de propriété (ou le mandat) du bien.");
  if (b.gestionnaire && !b.pieces.mandat) throw erreur(422, "Ajoutez le mandat écrit du propriétaire.");
  const { lat, lng } = coordonnees(b.gps);

  return tx(async (q) => {
    const quartier = await un<{ id: number }>(q, "SELECT id FROM quartiers WHERE nom = $1 AND actif LIMIT 1", [b.quartier]);
    if (!quartier) throw erreur(422, "Ce quartier n'est pas encore desservi. Choisissez un quartier dans la liste.");
    const docs = Object.values(b.pieces).filter(Boolean) as string[];
    const mesDocs = await q.query("SELECT id FROM documents WHERE id = ANY($1::uuid[]) AND utilisateur_id = $2", [docs, u.id]);
    if (mesDocs.rows.length !== new Set(docs).size) throw erreur(403, "Un des documents n'a pas été envoyé depuis votre compte.");

    const bien = await un<{ id: string }>(q,
      `INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, latitude, longitude, reperes, surface_m2, chambres, description, regles, gestionnaire)
       VALUES ($1,$2::type_bien,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [u.id, b.type, quartier.id, b.adresse, lat, lng, lignes(b.reperes), b.surface ?? null, b.chambres ?? 0, b.description, lignes(b.regles), b.gestionnaire]);
    const ref = (await un<{ ref: string }>(q, "SELECT 'XT-' || lpad(nextval('seq_annonce_ref')::text, 4, '0') AS ref"))!.ref;
    const slug = await genererSlug(ref, b.type, b.quartier, q);
    const a = await un<{ id: string }>(q,
      `INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, certification_photos_le)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now()) RETURNING id`,
      [ref, slug, bien!.id, b.titre?.trim() || `${TYPES[b.type]} à ${b.quartier}`, b.loyer, b.avanceMois, b.cautionMois, b.charges]);
    await enregistrerPhotos(q, u, a!.id, b.photos);
    if (b.equipements.length)
      await q.query("INSERT INTO annonce_equipements (annonce_id, equipement) SELECT $1, code FROM equipements WHERE code = ANY($2) ON CONFLICT DO NOTHING", [a!.id, b.equipements]);
    await q.query("UPDATE documents SET annonce_id = $2 WHERE id = ANY($1::uuid[]) AND type NOT IN ('cip','passeport','npi','selfie')", [docs, a!.id]);
    await calculerPreControle(a!.id, q);
    await q.query("SELECT annonce_soumettre($1)", [a!.id]);
    return { ref };
  });
});

async function annoncePossedee(q: Requetable, ref: string, uid: string) {
  const a = await un<any>(q,
    `SELECT a.id, a.ref, a.statut, a.disponible_le, b.id AS bien_id FROM annonces a JOIN biens b ON b.id = a.bien_id
      WHERE a.ref = $1 AND (b.proprietaire_id = $2 OR b.depose_par_id = $2) FOR UPDATE OF a`, [ref, uid]);
  if (!a) throw erreur(404, "Annonce introuvable.");
  return a;
}

// Renvoi en étude après « À corriger » ou « Refusée » : le compte à rebours reprend ou repart de 48 h (5.1)
post("/proprietaire/biens/:ref/renvoyer", async (c) => {
  const u = await exigerRole(c, "proprietaire");
  const b = await c.body(z.object({
    loyer: z.number().int().positive().optional(), avanceMois: z.number().int().min(0).max(12).optional(),
    cautionMois: z.number().int().min(0).max(12).optional(), charges: z.number().int().min(0).optional(),
    description: z.string().trim().min(10).max(3000).optional(), photos: z.array(photoSchema).max(30).optional(),
  }));
  return tx(async (q) => {
    const a = await annoncePossedee(q, c.params.ref, u.id);
    if (!["a_corriger", "refusee"].includes(a.statut)) throw erreur(409, "Cette annonce n'attend pas de correction.");
    await q.query(
      `UPDATE annonces SET loyer = COALESCE($2, loyer), avance_mois = COALESCE($3, avance_mois), caution_mois = COALESCE($4, caution_mois), charges = COALESCE($5, charges) WHERE id = $1`,
      [a.id, b.loyer ?? null, b.avanceMois ?? null, b.cautionMois ?? null, b.charges ?? null]);
    if (b.description) await q.query("UPDATE biens SET description = $2 WHERE id = $1", [a.bien_id, b.description]);
    if (b.photos) await enregistrerPhotos(q, u, a.id, b.photos);
    await calculerPreControle(a.id, q);
    await q.query("SELECT annonce_soumettre($1)", [a.id]);
    return { ref: a.ref };
  });
});

// Déclaration du départ du locataire (PRO-07, 10.3)
post("/proprietaire/biens/:ref/depart", async (c) => {
  const u = await exigerRole(c, "proprietaire");
  const b = await c.body(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}/) }));
  const date = b.date.slice(0, 10);
  if (date < new Date().toISOString().slice(0, 10)) throw erreur(422, "Choisissez une date à venir.");
  const a = await annoncePossedee(db, c.params.ref, u.id);
  if (!["louee", "reservee", "liberee"].includes(a.statut)) throw erreur(409, "Seul un bien loué peut être déclaré libre.");
  await db.query("UPDATE annonces SET disponible_le = $2, statut = CASE WHEN statut = 'reservee' THEN 'louee' ELSE statut END WHERE id = $1", [a.id, date]);
  return { departLe: date };
});

// Choix du locataire parmi les candidats (PRO-06). Retenir réserve le bien et prépare le bail ; refuser un candidat retenu non signataire le libère.
post("/proprietaire/biens/:ref/candidats/:id", async (c) => {
  const u = await exigerRole(c, "proprietaire");
  const { decision } = await c.body(z.object({ decision: z.enum(["retenir", "refuser"]) }));
  const notif = await tx(async (q) => {
    const a = await annoncePossedee(q, c.params.ref, u.id);
    const cand = await un<any>(q,
      `SELECT c.id, c.statut, c.locataire_id, l.tel FROM candidatures c JOIN utilisateurs l ON l.id = c.locataire_id WHERE c.id = $1 AND c.annonce_id = $2 FOR UPDATE OF c`, [c.params.id, a.id]);
    if (!cand) throw erreur(404, "Candidature introuvable.");
    if (decision === "retenir") {
      if (!["en_ligne", "reservee"].includes(a.statut)) throw erreur(409, "Ce bien n'accepte plus de choix de locataire.");
      if (await un(q, "SELECT 1 FROM candidatures WHERE annonce_id = $1 AND statut IN ('retenue','bail_signe','payee') AND id <> $2", [a.id, cand.id]))
        throw erreur(409, "Un candidat est déjà retenu pour ce bien. Libérez-le d'abord.");
      await q.query("UPDATE candidatures SET statut = 'retenue' WHERE id = $1", [cand.id]);
      await q.query("UPDATE annonces SET statut = 'reservee' WHERE id = $1", [a.id]);
      const bien = await un<any>(q, "SELECT loyer, avance_mois, caution_mois, calcul_commission(loyer) AS commission FROM annonces WHERE id = $1", [a.id]);
      await q.query(
        `INSERT INTO baux (annonce_id, candidature_id, locataire_id, proprietaire_id, loyer, avance_mois, caution_mois, commission)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING`,
        [a.id, cand.id, cand.locataire_id, u.id, bien.loyer, bien.avance_mois, bien.caution_mois, bien.commission]);
      return { tel: cand.tel, uid: cand.locataire_id, ref: a.ref, id: cand.id };
    }
    if (cand.statut === "retenue") {
      await q.query("UPDATE baux SET statut = 'annule' WHERE candidature_id = $1 AND statut = 'a_signer'", [cand.id]);
      await q.query("UPDATE annonces SET statut = 'en_ligne' WHERE id = $1 AND statut = 'reservee'", [a.id]);
    } else if (["bail_signe", "payee"].includes(cand.statut)) throw erreur(409, "Le bail est déjà signé : contactez l'agence pour le modifier.");
    await q.query("UPDATE candidatures SET statut = 'non_retenue' WHERE id = $1", [cand.id]);
    return null;
  });
  if (notif) await notifier({ modele: "candidature-retenue", tel: notif.tel, utilisateurId: notif.uid, vars: { ref: notif.ref }, dedup: `retenue-${notif.id}` });
});

// Disponibilités de visite proposées par le propriétaire (PRO-05)
put("/proprietaire/biens/:ref/creneaux", async (c) => {
  const u = await exigerRole(c, "proprietaire");
  const b = await c.body(z.object({ creneaux: z.array(z.string().datetime({ offset: true })).max(100) }));
  await tx(async (q) => {
    const a = await annoncePossedee(q, c.params.ref, u.id);
    await q.query("DELETE FROM creneaux_visite WHERE annonce_id = $1 AND debut_le > now()", [a.id]);
    for (const d of b.creneaux) {
      const debut = new Date(d);
      await q.query("INSERT INTO creneaux_visite (annonce_id, debut_le, fin_le) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [a.id, debut, new Date(debut.getTime() + 3600_000)]);
    }
  });
});

