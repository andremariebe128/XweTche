import { db } from "./db.js";
import { jjmm } from "./referentiel.js";

// Convertit une ligne de v_annonces_publiques en objet « Annonce » attendu par le site (src/data/annonces.ts).
export async function annoncesFront(rows: any[]) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const medias = await db.query<{ annonce_id: string; id: string; legende: string | null }>(
    "SELECT annonce_id, id, legende FROM medias WHERE annonce_id = ANY($1::uuid[]) AND controle_id IS NULL ORDER BY annonce_id, ordre", [ids]);
  const parAnnonce = new Map<string, { id: string; legende: string | null }[]>();
  for (const m of medias.rows) parAnnonce.set(m.annonce_id, [...(parAnnonce.get(m.annonce_id) ?? []), m]);

  return rows.map((r) => {
    const m = parAnnonce.get(r.id) ?? [];
    const jours = r.publiee_le ? Math.max(0, Math.floor((Date.now() - new Date(r.publiee_le).getTime()) / 86_400_000)) : 0;
    return {
      ref: r.ref,
      slug: r.slug,
      type: r.type,
      titre: r.titre,
      quartier: r.quartier,
      ville: r.ville,
      loyer: r.loyer,
      avanceMois: r.avance_mois,
      cautionMois: r.caution_mois,
      charges: r.charges,
      commission: r.commission,
      chambres: r.chambres,
      surface: r.surface_m2 ?? undefined,
      equipements: r.equipements,
      statut: r.statut_public,
      verifieLe: jjmm(r.verifie_le) ?? "",
      agent: (r.agent_verificateur ?? "").split(" ")[0],
      disponibleLe: jjmm(r.disponible_le),
      reperes: r.reperes,
      description: r.description ?? "",
      regles: r.regles,
      photos: m.map((x) => x.legende ?? "Photo"),
      images: m.map((x) => `/api/medias/${x.id}`),
      // Zone approximative (~100 m) : l'adresse exacte n'est donnée qu'après la réservation d'une visite.
      zone: r.latitude == null ? undefined : { lat: Math.round(r.latitude * 1000) / 1000, lng: Math.round(r.longitude * 1000) / 1000 },
      publieeIlYa: jours,
      miseEnAvant: r.mise_en_avant,
    };
  });
}
