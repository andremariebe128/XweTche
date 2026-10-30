import { z } from "zod";
import { exigerMembre, membreCourant, utilisateurCourant } from "../auth.js";
import { db, un } from "../db.js";
import { erreur, get, post } from "../http.js";
import { annoncesFront } from "../mappers.js";
import { lire } from "../storage.js";
import { param } from "../referentiel.js";

// --------------------------------------------------------------------------- Annonces
get("/annonces", async (c) => {
  const q = c.url.searchParams;
  const cond: string[] = [];
  const val: unknown[] = [];
  const ajoute = (sql: string, v: unknown) => { val.push(v); cond.push(sql.replace("?", `$${val.length}`)); };
  if (q.get("ville")) ajoute("ville_slug = ?", q.get("ville"));
  if (q.get("quartier")) ajoute("quartier_slug = ?", q.get("quartier"));
  if (q.get("type")) ajoute("type = ?::type_bien", q.get("type"));
  if (q.get("budget")) ajoute("loyer <= ?", Number(q.get("budget")));
  if (q.get("chambres")) ajoute("chambres >= ?", Number(q.get("chambres")));
  if (q.get("equipements")) ajoute("equipements @> ?::text[]", q.get("equipements")!.split(",").filter(Boolean));
  if (q.get("disponibles") === "1") cond.push("statut_public = 'en-ligne'");
  const tri = { prix_asc: "loyer ASC", prix_desc: "loyer DESC", recentes: "mise_en_avant DESC, publiee_le DESC" }[q.get("tri") ?? "recentes"] ?? "publiee_le DESC";
  const limite = Math.min(60, Math.max(1, Number(q.get("limite") ?? 24)));
  const decalage = Math.max(0, Number(q.get("page") ?? 0)) * limite;
  const where = cond.length ? `WHERE ${cond.join(" AND ")}` : "";
  const total = await un<{ n: number }>(db, `SELECT count(*)::int AS n FROM v_annonces_publiques ${where}`, val);
  const r = await db.query(`SELECT * FROM v_annonces_publiques ${where} ORDER BY ${tri}, id LIMIT ${limite} OFFSET ${decalage}`, val);
  return { total: total?.n ?? 0, items: await annoncesFront(r.rows) };
});

get("/annonces/:ref", async (c) => {
  const r = await db.query("SELECT * FROM v_annonces_publiques WHERE ref = $1", [c.params.ref]);
  if (!r.rows.length) throw erreur(404, "Cette annonce n'existe pas ou n'est plus en ligne.");
  const [a] = await annoncesFront(r.rows);
  await db.query("UPDATE annonces SET vues = vues + 1 WHERE ref = $1", [c.params.ref]).catch(() => {});
  return a;
});

get("/quartiers", async () => {
  const r = await db.query(
    `SELECT q.nom, q.slug, v.nom AS ville, v.slug AS ville_slug,
            count(a.id) FILTER (WHERE a.statut = 'en_ligne')::int AS annonces
       FROM quartiers q JOIN villes v ON v.id = q.ville_id
       LEFT JOIN biens b ON b.quartier_id = q.id LEFT JOIN annonces a ON a.bien_id = b.id
      WHERE q.actif GROUP BY q.id, v.id ORDER BY annonces DESC, q.nom`);
  return r.rows.map((x) => ({ nom: x.nom, slug: x.slug, ville: x.ville, villeSlug: x.ville_slug, annonces: x.annonces }));
});

// Créneaux de visite (5.3) : jours à venir, heures du Bénin (UTC+1, sans heure d'été), créneaux déjà pris exclus.
get("/annonces/:ref/creneaux", async (c) => {
  const a = await un<{ id: string }>(db, "SELECT id FROM annonces WHERE ref = $1 AND statut = 'en_ligne'", [c.params.ref]);
  if (!a) throw erreur(404, "Cette annonce n'accepte pas de visite pour le moment.");
  const heures = await param<string[]>("creneaux_heures", ["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"]);
  const horizon = await param<number>("horizon_visite_jours", 10);
  const sans = await param<number[]>("jours_sans_visite", [0]);
  const propres = await db.query<{ debut_le: Date }>("SELECT debut_le FROM creneaux_visite WHERE annonce_id = $1 AND debut_le > now()", [a.id]);
  const pris = new Set((await db.query<{ d: Date }>("SELECT creneau_le AS d FROM visites WHERE annonce_id = $1 AND statut <> 'annulee'", [a.id])).rows.map((x) => +new Date(x.d)));
  const minimum = Date.now() + 2 * 3600_000;
  const benin = new Date(Date.now() + 3600_000);
  const jours: { date: string; creneaux: { heure: string; iso: string; libre: boolean }[] }[] = [];
  for (let i = 1; i <= horizon; i++) {
    const j = new Date(Date.UTC(benin.getUTCFullYear(), benin.getUTCMonth(), benin.getUTCDate() + i));
    if (sans.includes(j.getUTCDay())) continue;
    const date = j.toISOString().slice(0, 10);
    const creneaux = heures
      .map((h) => {
        const [hh, mm] = h.split(":").map(Number);
        const t = new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate(), hh - 1, mm));
        return { heure: `${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")}`, iso: t.toISOString(), t: +t };
      })
      .filter((x) => x.t > minimum && (!propres.rows.length || propres.rows.some((p) => +new Date(p.debut_le) === x.t)))
      .map((x) => ({ heure: x.heure, iso: x.iso, libre: !pris.has(x.t) }));
    if (creneaux.length) jours.push({ date, creneaux });
  }
  return { jours };
});

// --------------------------------------------------------------------- Contenus et réglages
get("/parametres", async () => {
  const p = Object.fromEntries((await db.query<{ cle: string; valeur: unknown }>("SELECT cle, valeur FROM parametres")).rows.map((r) => [r.cle, r.valeur]));
  const motifs = await db.query<{ categorie: string; libelle: string }>("SELECT categorie, libelle FROM motifs WHERE actif ORDER BY categorie, ordre, id");
  const liste = (cat: string) => motifs.rows.filter((m) => m.categorie === cat).map((m) => m.libelle);
  const quartiers = await db.query<{ nom: string }>("SELECT nom FROM quartiers WHERE actif ORDER BY id");
  return {
    commission: p.commission, plafondVisites: p.plafond_visites_gratuites, delaiEtude: p.delai_etude_h,
    alerteEtude: p.alerte_etude_h, annulationVisite: p.annulation_visite_h,
    motifsRefus: liste("refus"), motifsCorrection: liste("correction"), motifsVisite: liste("visite"),
    motifsSignalement: liste("signalement"), quartiers: quartiers.rows.map((x) => x.nom),
    photosMin: p.photos_min, photoLargeurMin: p.photo_largeur_min_px,
  };
});

get("/contenus", async () => {
  const r = await db.query<any>(
    `SELECT type, theme, theme_titre, titre, texte, ordre FROM contenus_editoriaux
      WHERE statut = 'publie' AND type IN ('faq','banniere') ORDER BY theme, ordre`);
  const ban = r.rows.find((x) => x.type === "banniere");
  type Theme = { id: string; titre: string; questions: { q: string; r: string }[] };
  const themes = new Map<string, Theme>();
  for (const x of r.rows.filter((y) => y.type === "faq")) {
    const t: Theme = themes.get(x.theme) ?? { id: x.theme, titre: x.theme_titre ?? x.theme, questions: [] };
    t.questions.push({ q: x.titre, r: x.texte });
    themes.set(x.theme, t);
  }
  return {
    banniere: { actif: !!ban, texte: ban?.texte ?? "" },
    faq: [...themes.values()],
  };
});

// ---------------------------------------------------------------------------- Signalements
// Possible sans compte (LOC-11) : le numéro sert alors à recontacter la personne.
post("/signalements", async (c) => {
  const b = await c.body(z.object({
    ref: z.string().max(20).optional(), tel: z.string().max(20).optional(),
    motif: z.string().min(2).max(200), detail: z.string().max(2000).default(""),
  }));
  const u = await utilisateurCourant(c);
  const a = b.ref ? await un<{ id: string }>(db, "SELECT id FROM annonces WHERE ref = $1", [b.ref]) : null;
  const tel = (b.tel ?? u?.tel ?? "").replace(/\D/g, "") || null;
  if (!u && !tel) throw erreur(422, "Indiquez un numéro de téléphone pour que nous puissions vous recontacter.");
  const recent = await un<{ n: number }>(db,
    "SELECT count(*)::int AS n FROM signalements WHERE (auteur_id = $1 OR tel = $2) AND cree_le > now() - interval '1 hour'", [u?.id ?? null, tel]);
  if ((recent?.n ?? 0) >= 5) throw erreur(429, "Vous avez déjà envoyé plusieurs signalements. Nous les traitons au plus vite.");
  const r = await un<{ numero: string }>(db,
    "INSERT INTO signalements (annonce_id, auteur_id, tel, motif, detail) VALUES ($1,$2,$3,$4,$5) RETURNING numero",
    [a?.id ?? null, u?.id ?? null, tel, b.motif, b.detail]);
  return { numero: r!.numero };
});

// --------------------------------------------------------------------------- Fichiers
type Corps = ConstructorParameters<typeof Response>[0];
function flux(corps: ReadableStream | Buffer): Corps {
  return corps instanceof Buffer ? new Uint8Array(corps) : (corps as ReadableStream);
}

// Photos : publiques tant que l'annonce est visible ; avant cela, réservées au propriétaire et à l'agence.
get("/medias/:id", async (c) => {
  const m = await un<{ cle_webp: string; controle_id: string | null; statut: string; proprietaire_id: string }>(
    db, `SELECT m.cle_webp, m.controle_id, a.statut, b.proprietaire_id
           FROM medias m JOIN annonces a ON a.id = m.annonce_id JOIN biens b ON b.id = a.bien_id WHERE m.id = $1`, [c.params.id]);
  if (!m) throw erreur(404, "Photo introuvable.");
  const publique = !m.controle_id && ["en_ligne", "reservee", "louee", "liberee"].includes(m.statut);
  if (!publique) {
    const u = await utilisateurCourant(c);
    const membre = await membreCourant(c);
    if (!(u && u.id === m.proprietaire_id) && !membre) throw erreur(404, "Photo introuvable.");
  }
  const f = await lire(m.cle_webp);
  if (!f) throw erreur(404, "Photo introuvable.");
  return new Response(flux(f.corps), {
    headers: { "content-type": f.typeMime, "x-content-type-options": "nosniff",
      "cache-control": publique ? "public, max-age=31536000, immutable" : "private, no-store" },
  });
});

// Documents d'identité et de propriété : propriétaire du document ou agence habilitée, jamais en cache.
get("/documents/:id", async (c) => {
  const d = await un<{ utilisateur_id: string; fichier_cle: string; type_mime: string | null }>(
    db, "SELECT utilisateur_id, fichier_cle, type_mime FROM documents WHERE id = $1", [c.params.id]);
  if (!d) throw erreur(404, "Document introuvable.");
  const u = await utilisateurCourant(c);
  if (!(u && u.id === d.utilisateur_id)) {
    const m = await exigerMembre(c);
    if (!["etude", "support", "admin"].includes(m.role)) throw erreur(403, "Votre rôle ne donne pas accès aux documents.");
  }
  const f = await lire(d.fichier_cle);
  if (!f) throw erreur(404, "Document introuvable.");
  return new Response(flux(f.corps), {
    headers: { "content-type": d.type_mime ?? f.typeMime, "x-content-type-options": "nosniff", "cache-control": "private, no-store" },
  });
});

