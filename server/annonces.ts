import { db, un, type Requetable } from "./db.js";
import { notifier } from "./notifier.js";
import { param } from "./referentiel.js";

// Vérification automatique préalable (BO-04), recalculée à chaque (re)soumission.
//  - photosNettes : assez de photos et toutes assez larges (la netteté fine n'est pas mesurée : l'agent d'étude juge)
//  - champsComplets : champs obligatoires de 5.2 renseignés
//  - doublonPhoto : une photo quasi identique (empreinte à ≤ 4 bits d'écart) existe sur une AUTRE annonce
//  - doublonAdresse : même adresse et même quartier sur une autre annonce non refusée
export async function calculerPreControle(annonceId: string, q: Requetable = db) {
  const [photosMin, largeurMin] = await Promise.all([param("photos_min", 6, q), param("photo_largeur_min_px", 1280, q)]);
  const a = await un<any>(q,
    `SELECT a.loyer, a.certification_photos_le, b.description, b.adresse, b.latitude, b.quartier_id, b.reperes,
            (SELECT count(*) FROM medias m WHERE m.annonce_id = a.id AND m.controle_id IS NULL) AS nb,
            (SELECT count(*) FROM medias m WHERE m.annonce_id = a.id AND m.controle_id IS NULL AND COALESCE(m.largeur_px, 0) < $2) AS petites,
            EXISTS (SELECT 1 FROM medias m JOIN medias o ON o.empreinte IS NOT NULL AND o.annonce_id <> m.annonce_id AND o.controle_id IS NULL
                     WHERE m.annonce_id = a.id AND m.controle_id IS NULL AND m.empreinte IS NOT NULL
                       AND bit_count(('x' || m.empreinte)::bit(64) # ('x' || o.empreinte)::bit(64)) <= 4) AS doublon_photo,
            EXISTS (SELECT 1 FROM annonces a2 JOIN biens b2 ON b2.id = a2.bien_id
                     WHERE a2.id <> a.id AND b2.quartier_id = b.quartier_id AND lower(trim(b2.adresse)) = lower(trim(b.adresse))
                       AND a2.statut NOT IN ('refusee','brouillon')) AS doublon_adresse
       FROM annonces a JOIN biens b ON b.id = a.bien_id WHERE a.id = $1`, [annonceId, largeurMin]);
  const pre = {
    photosNettes: Number(a.nb) >= photosMin && Number(a.petites) === 0,
    champsComplets: !!(a.description?.trim() && a.adresse?.trim() && a.latitude != null && a.reperes?.length && a.loyer > 0 && a.certification_photos_le),
    doublonPhoto: a.doublon_photo,
    doublonAdresse: a.doublon_adresse,
  };
  await q.query("UPDATE annonces SET pre_controle = $2 WHERE id = $1", [annonceId, JSON.stringify(pre)]);
  return pre;
}

// Mise en ligne : alerte les locataires dont la recherche correspond (LOC-04) et la liste d'attente d'un bien libéré.
export async function declencherAlertes(annonceId: string) {
  const a = await un<any>(db,
    `SELECT a.ref, a.slug, a.loyer, b.type, q.nom AS quartier, b.quartier_id FROM annonces a JOIN biens b ON b.id = a.bien_id
       JOIN quartiers q ON q.id = b.quartier_id WHERE a.id = $1`, [annonceId]);
  if (!a) return;
  const alertes = await db.query<any>(
    `SELECT al.id, al.canal, COALESCE(al.tel, u.tel) AS tel, u.id AS uid FROM alertes_recherche al JOIN utilisateurs u ON u.id = al.utilisateur_id
      WHERE al.actif AND u.statut = 'actif' AND (al.quartier_id IS NULL OR al.quartier_id = $1)
        AND (al.type IS NULL OR al.type = $2) AND (al.budget_max IS NULL OR al.budget_max >= $3)`, [a.quartier_id, a.type, a.loyer]);
  const lien = `${process.env.APP_URL ?? ""}/annonce/${a.slug}`;
  for (const al of alertes.rows)
    await notifier({ modele: "alerte-annonce", tel: al.tel, utilisateurId: al.uid, canal: al.canal, dedup: `alerte-${al.id}-${annonceId}`,
      vars: { type: a.type, quartier: a.quartier, loyer: a.loyer, lien } });
  const attente = await db.query<any>(
    `SELECT w.canal, u.tel, u.id AS uid FROM liste_attente w JOIN utilisateurs u ON u.id = w.utilisateur_id WHERE w.annonce_id = $1`, [annonceId]);
  for (const w of attente.rows)
    await notifier({ modele: "liberation", tel: w.tel, utilisateurId: w.uid, canal: w.canal, dedup: `attente-${annonceId}-${w.uid}-republie`,
      vars: { ref: a.ref, quartier: a.quartier, date: "maintenant", lien } });
}
