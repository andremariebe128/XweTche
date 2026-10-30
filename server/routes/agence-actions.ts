import { z } from "zod";
import { exigerMembre, journaliser } from "../auth.js";
import { declencherAlertes } from "../annonces.js";
import { db, tx, un } from "../db.js";
import { erreur, post, put } from "../http.js";
import { notifier } from "../notifier.js";
import { recevoirPhoto } from "./upload.js";
import { sousTiret } from "../referentiel.js";

const NB_CHECKLIST = 7; // même longueur que CHECKLIST dans src/lib/agence.ts

async function annonce(ref: string) {
  const a = await un<any>(db,
    `SELECT a.id, a.ref, a.statut, a.pre_controle, a.agent_terrain_id, po.id AS pid, po.tel AS ptel, po.nom AS pnom
       FROM annonces a JOIN biens b ON b.id = a.bien_id JOIN utilisateurs po ON po.id = b.proprietaire_id WHERE a.ref = $1`, [ref]);
  if (!a) throw erreur(404, "Dossier introuvable.");
  return a;
}

// ------------------------------------------------------------------ Étude (BO-02, BO-03)
put("/agence/dossiers/:ref/checklist", async (c) => {
  await exigerMembre(c, "etude");
  const b = await c.body(z.object({ checklist: z.record(z.string(), z.boolean()) }));
  await db.query("UPDATE annonces SET checklist = $2, statut = CASE WHEN statut = 'soumise' THEN 'en_etude' ELSE statut END WHERE ref = $1 AND statut IN ('soumise','en_etude')", [c.params.ref, JSON.stringify(b.checklist)]);
});

post("/agence/dossiers/:ref/decision", async (c) => {
  const m = await exigerMembre(c, "etude");
  const b = await c.body(z.object({ decision: z.enum(["valider", "refuser", "corriger"]), motif: z.string().trim().max(500).optional(), checklist: z.record(z.string(), z.boolean()).optional() }));
  const a = await annonce(c.params.ref);
  if (!["soumise", "en_etude"].includes(a.statut)) throw erreur(409, "Ce dossier n'est plus en étude.");
  if (b.decision !== "valider" && !b.motif) throw erreur(422, "Le motif est obligatoire pour refuser ou demander une correction.");
  const coches = Object.values(b.checklist ?? (await un<any>(db, "SELECT checklist FROM annonces WHERE id = $1", [a.id]))?.checklist ?? {}).filter(Boolean).length;
  if (b.decision === "valider" && coches < NB_CHECKLIST) throw erreur(422, "Cochez tous les points de la liste de contrôle avant de valider.");
  await db.query("SELECT annonce_decider($1,$2,$3::decision_etude,$4,$5)", [a.id, m.id, b.decision, b.motif ?? null, JSON.stringify(b.checklist ?? {})]);
  const vars = { ref: a.ref, prenom: a.pnom.split(" ")[0], motif: b.motif, date: "prochainement" };
  const modele = { valider: "annonce-validee", refuser: "annonce-refusee", corriger: "correction" }[b.decision];
  await notifier({ modele, tel: a.ptel, utilisateurId: a.pid, vars, dedup: `decision-${a.id}-${Date.now()}` });
});

// ------------------------------------------------------------------ Contrôle terrain (BO-05, AGT-02)
post("/agence/dossiers/:ref/retirer", async (c) => {
  const m = await exigerMembre(c, "annonces");
  const b = await c.body(z.object({ motif: z.string().trim().min(5, "Indiquez le motif du retrait.").max(500) }));
  const a = await annonce(c.params.ref);
  if (!["en_ligne", "reservee"].includes(a.statut)) throw erreur(409, "Seule une annonce en ligne peut être retirée.");
  await db.query("UPDATE annonces SET statut = 'refusee', motif = $2 WHERE id = $1", [a.id, `Retirée : ${b.motif}`]);
  await journaliser(m as any, "Annonce retirée du site", `${a.ref} · ${b.motif}`);
  await notifier({ modele: "annonce-refusee", tel: a.ptel, utilisateurId: a.pid, vars: { ref: a.ref, prenom: a.pnom.split(" ")[0], motif: b.motif }, dedup: `retrait-${a.id}-${Date.now()}` });
});

post("/agence/dossiers/:ref/attribuer", async (c) => {
  const m = await exigerMembre(c, "terrain");
  const b = await c.body(z.object({ agentId: z.string().uuid(), controleLe: z.string().datetime({ offset: true }).optional() }));
  const a = await annonce(c.params.ref);
  if (!["controle", "liberee"].includes(a.statut)) throw erreur(409, "Le contrôle terrain s'attribue après la validation du dossier.");
  const ag = await un<{ nom: string }>(db, "SELECT nom FROM membres_agence WHERE id = $1 AND role = 'terrain' AND statut = 'actif'", [b.agentId]);
  if (!ag) throw erreur(422, "Choisissez un agent terrain actif.");
  await tx(async (q) => {
    await q.query("UPDATE annonces SET agent_terrain_id = $2, controle_planifie_le = $3 WHERE id = $1", [a.id, b.agentId, b.controleLe ?? null]);
    await q.query("INSERT INTO controles_terrain (annonce_id, agent_id, planifie_le) VALUES ($1,$2,$3)", [a.id, b.agentId, b.controleLe ?? null]);
  });
  await journaliser(m as any, "Contrôle terrain attribué", `${a.ref} → ${ag.nom}`);
});

post("/agence/upload/photo", async (c) => recevoirPhoto(c, `m/${(await exigerMembre(c, "terrain")).id}`));

post("/agence/dossiers/:ref/controle", async (c) => {
  const m = await exigerMembre(c, "terrain");
  const b = await c.body(z.object({
    conforme: z.boolean(), note: z.string().trim().max(1000).optional(), checklist: z.record(z.string(), z.boolean()).default({}),
    compteurEau: z.string().max(40).optional(), compteurElec: z.string().max(40).optional(),
    lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional(),
    photos: z.array(z.object({ cle: z.string().max(300), cleOriginale: z.string().max(300).optional(), legende: z.string().max(80).default("Contrôle"),
      largeur: z.number().int().positive(), hauteur: z.number().int().positive(), empreinte: z.string().optional() })).max(30).default([]),
  }));
  const a = await annonce(c.params.ref);
  if (!["controle", "liberee"].includes(a.statut)) throw erreur(409, "Ce dossier n'est pas en attente de contrôle terrain.");
  if (!b.conforme && !b.note) throw erreur(422, "Expliquez ce qui n'est pas conforme : le propriétaire en sera informé.");
  const enLigne = await tx(async (q) => {
    const existant = await un<{ id: string }>(q, "SELECT id FROM controles_terrain WHERE annonce_id = $1 AND realise_le IS NULL ORDER BY cree_le DESC LIMIT 1", [a.id]);
    const cid = existant?.id ?? (await un<{ id: string }>(q, "INSERT INTO controles_terrain (annonce_id, agent_id) VALUES ($1,$2) RETURNING id", [a.id, m.id]))!.id;
    await q.query(
      `UPDATE controles_terrain SET agent_id = $2, realise_le = now(), conforme = $3, checklist = $4, compteur_eau = $5, compteur_elec = $6, latitude = $7, longitude = $8, note = $9 WHERE id = $1`,
      [cid, m.id, b.conforme, JSON.stringify(b.checklist), b.compteurEau ?? null, b.compteurElec ?? null, b.lat ?? null, b.lng ?? null, b.note ?? null]);
    let ordre = 0;
    for (const p of b.photos) {
      if (!p.cle.startsWith(`m/${m.id}/photos/`)) throw erreur(403, "Une photo de contrôle n'a pas été envoyée depuis votre compte.");
      await q.query("INSERT INTO medias (annonce_id, controle_id, cle_webp, cle_originale, ordre, legende, largeur_px, hauteur_px, empreinte, statut_controle) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'valide')",
        [a.id, cid, p.cle, p.cleOriginale ?? null, ordre++, p.legende, p.largeur, p.hauteur, p.empreinte ?? null]);
    }
    if (b.conforme) {
      await q.query(
        `UPDATE annonces SET statut = 'en_ligne', publiee_le = COALESCE(publiee_le, now()), verifie_le = now(), agent_terrain_id = COALESCE(agent_terrain_id, $2), disponible_le = NULL, motif = NULL WHERE id = $1`, [a.id, m.id]);
      return true;
    }
    await q.query("UPDATE annonces SET statut = 'a_corriger', motif = $2, pause_le = now() WHERE id = $1", [a.id, b.note]);
    return false;
  });
  await journaliser(m as any, enLigne ? "Contrôle conforme : annonce en ligne" : "Contrôle non conforme : correction demandée", `${a.ref}${b.note ? ` · ${b.note}` : ""}`);
  if (enLigne) await declencherAlertes(a.id);
  else await notifier({ modele: "correction", tel: a.ptel, utilisateurId: a.pid, vars: { ref: a.ref, prenom: a.pnom.split(" ")[0], motif: b.note }, dedup: `controle-${a.id}-${Date.now()}` });
});

// ------------------------------------------------------------------ Utilisateurs (BO-06)
post("/agence/utilisateurs/:id/identite", async (c) => {
  const m = await exigerMembre(c, "utilisateurs");
  const b = await c.body(z.object({ decision: z.enum(["valider", "refuser"]), motif: z.string().max(300).optional() }));
  if (b.decision === "refuser" && !b.motif) throw erreur(422, "Indiquez le motif du refus.");
  const u = await un<{ nom: string }>(db, "SELECT nom FROM utilisateurs WHERE id = $1", [c.params.id]);
  if (!u) throw erreur(404, "Utilisateur introuvable.");
  await tx(async (q) => {
    await q.query("UPDATE utilisateurs SET identite = $2::statut_identite WHERE id = $1", [c.params.id, b.decision === "valider" ? "verifiee" : "refusee"]);
    await q.query("UPDATE documents SET statut = $2::statut_validation, valide_par = $3, motif = $4 WHERE utilisateur_id = $1 AND type IN ('cip','passeport','npi','selfie') AND statut = 'en_attente'",
      [c.params.id, b.decision === "valider" ? "valide" : "refuse", m.id, b.motif ?? null]);
  });
  await journaliser(m as any, b.decision === "valider" ? "Identité vérifiée" : "Identité refusée", `${u.nom}${b.motif ? ` · ${b.motif}` : ""}`);
});

post("/agence/utilisateurs/:id/suspendre", async (c) => {
  const m = await exigerMembre(c, "utilisateurs");
  const { motif } = await c.body(z.object({ motif: z.string().trim().min(3).max(300) }));
  const u = await un<{ nom: string }>(db, "SELECT nom FROM utilisateurs WHERE id = $1", [c.params.id]);
  if (!u) throw erreur(404, "Utilisateur introuvable.");
  await tx(async (q) => {
    await q.query("UPDATE utilisateurs SET statut = 'suspendu', motif_suspension = $2 WHERE id = $1", [c.params.id, motif]);
    await q.query("UPDATE sessions SET revoquee_le = now() WHERE utilisateur_id = $1 AND revoquee_le IS NULL", [c.params.id]);
  });
  await journaliser(m as any, "Compte suspendu", `${u.nom} · ${motif}`);
});

post("/agence/utilisateurs/:id/reactiver", async (c) => {
  const m = await exigerMembre(c, "utilisateurs");
  const u = await un<{ nom: string }>(db, "UPDATE utilisateurs SET statut = 'actif', motif_suspension = NULL WHERE id = $1 RETURNING nom", [c.params.id]);
  if (!u) throw erreur(404, "Utilisateur introuvable.");
  await journaliser(m as any, "Compte réactivé", u.nom);
});

// ------------------------------------------------------------------ Visites (BO-07, AGT-05)
post("/agence/visites/:id/presence", async (c) => {
  const m = await exigerMembre(c, "visites");
  const b = await c.body(z.object({ preuve: z.enum(["qr", "gps"]), code: z.string().max(8).optional(), lat: z.number().optional(), lng: z.number().optional() }));
  const v = await un<any>(db, "SELECT id, code_visite, statut FROM visites WHERE id = $1", [c.params.id]);
  if (!v) throw erreur(404, "Visite introuvable.");
  if (v.statut !== "prevue") throw erreur(409, "Cette visite n'est plus à venir.");
  if (b.preuve === "qr" && b.code !== v.code_visite) throw erreur(422, "Ce code de visite ne correspond pas. Demandez-le au visiteur.");
  if (b.preuve === "gps" && (b.lat == null || b.lng == null)) throw erreur(422, "La position GPS est nécessaire.");
  await db.query("UPDATE visites SET statut = 'faite', preuve = $2::preuve_visite, preuve_lat = $3, preuve_lng = $4, preuve_le = now(), agent_id = COALESCE(agent_id, $5) WHERE id = $1",
    [v.id, b.preuve, b.lat ?? null, b.lng ?? null, m.id]);
});

post("/agence/visites/:id/absent", async (c) => {
  const m = await exigerMembre(c, "visites");
  const v = await un<any>(db, "UPDATE visites SET statut = 'absent' WHERE id = $1 AND statut = 'prevue' RETURNING id", [c.params.id]);
  if (!v) throw erreur(409, "Cette visite n'est plus à venir.");
  await journaliser(m as any, "Visiteur absent", c.params.id);
});

post("/agence/visites/:id/agent", async (c) => {
  const m = await exigerMembre(c, "visites");
  const b = await c.body(z.object({ agentId: z.string().uuid() }));
  const ok = await un(db, "SELECT 1 FROM membres_agence WHERE id = $1 AND role = 'terrain' AND statut = 'actif'", [b.agentId]);
  if (!ok) throw erreur(422, "Choisissez un agent terrain actif.");
  await db.query("UPDATE visites SET agent_id = $2 WHERE id = $1 AND statut = 'prevue'", [c.params.id, b.agentId]);
  await journaliser(m as any, "Agent de visite changé", c.params.id);
});

// ------------------------------------------------------------------ Baux et paiements (BO-08, PAY-03, PAY-08)
post("/agence/baux/:id/especes", async (c) => {
  const m = await exigerMembre(c, "baux");
  const bail = await un<any>(db, "SELECT b.id, b.commission, b.statut, a.ref FROM baux b JOIN annonces a ON a.id = b.annonce_id WHERE b.id = $1", [c.params.id]);
  if (!bail) throw erreur(404, "Bail introuvable.");
  if (bail.statut !== "signe") throw erreur(409, bail.statut === "paye" ? "La commission est déjà payée." : "Le bail doit être signé avant l'encaissement.");
  const p = await un<{ id: string }>(db,
    `INSERT INTO paiements (bail_id, type, montant, moyen, prestataire, reference_externe, cle_idempotence, statut, saisi_par)
     VALUES ($1,'commission',$2,'especes','caisse','ESP-' || lpad(nextval('seq_recu_num')::text, 6, '0'),'especes:' || $1::text,'recu',$3)
     ON CONFLICT (cle_idempotence) DO NOTHING RETURNING id`, [bail.id, bail.commission, m.id]);
  if (!p) throw erreur(409, "Un encaissement en espèces existe déjà pour ce bail.");
  const r = await un<{ numero: string }>(db, "SELECT numero FROM recus WHERE paiement_id = $1", [p.id]);
  await journaliser(m as any, "Paiement en espèces enregistré", `${bail.ref} · ${bail.commission} FCFA`);
  return { recu: r?.numero };
});

post("/agence/paiements/:id/rembourser", async (c) => {
  const m = await exigerMembre(c, "baux");
  const { motif } = await c.body(z.object({ motif: z.string().trim().min(5).max(300) }));
  const ref = await tx(async (q) => {
    const p = await un<any>(q, "SELECT p.id, p.bail_id, p.montant, p.moyen, p.type, p.statut, a.ref, a.id AS annonce_id, b.candidature_id FROM paiements p JOIN baux b ON b.id = p.bail_id JOIN annonces a ON a.id = b.annonce_id WHERE p.id = $1 FOR UPDATE OF p", [c.params.id]);
    if (!p) throw erreur(404, "Paiement introuvable.");
    if (p.type !== "commission" || p.statut !== "recu") throw erreur(409, "Seule une commission payée peut être remboursée.");
    await q.query("UPDATE paiements SET statut = 'rembourse' WHERE id = $1", [p.id]);
    await q.query(
      `INSERT INTO paiements (bail_id, type, montant, moyen, prestataire, cle_idempotence, statut, paiement_origine_id, motif, decide_par)
       VALUES ($1,'remboursement',$2,$3,'caisse',$4,'recu',$5,$6,$7)`, [p.bail_id, p.montant, p.moyen, `remb:${p.id}`, p.id, motif, m.id]);
    await q.query("UPDATE baux SET statut = 'annule' WHERE id = $1", [p.bail_id]);
    await q.query("UPDATE candidatures SET statut = 'non_retenue' WHERE id = $1", [p.candidature_id]);
    await q.query("UPDATE annonces SET statut = 'en_ligne' WHERE id = $1 AND statut IN ('louee','reservee')", [p.annonce_id]);
    return p.ref;
  });
  await journaliser(m as any, "Commission remboursée", `${ref} · ${motif}`);
});

// ------------------------------------------------------------------ Signalements (BO-10)
post("/agence/signalements/:id", async (c) => {
  const m = await exigerMembre(c, "signalements");
  const b = await c.body(z.object({ statut: z.enum(["nouveau", "en-cours", "resolu", "rejete"]), assigneId: z.string().uuid().optional(), decision: z.string().trim().max(500).optional() }));
  if (["resolu", "rejete"].includes(b.statut) && !b.decision) throw erreur(422, "Notez la décision prise avant de clôturer.");
  const s = await un<{ numero: string }>(db,
    "UPDATE signalements SET statut = $2::statut_signalement, assigne_a = COALESCE($3, assigne_a, CASE WHEN $2 = 'nouveau' THEN NULL ELSE $5::uuid END), decision = COALESCE($4, decision) WHERE id = $1 RETURNING numero",
    [c.params.id, sousTiret(b.statut), b.assigneId ?? null, b.decision ?? null, m.id]);
  if (!s) throw erreur(404, "Signalement introuvable.");
  await journaliser(m as any, `Signalement : ${b.statut}`, `${s.numero}${b.decision ? ` · ${b.decision}` : ""}`);
});

// ------------------------------------------------------------------ Paramétrage (BO-09, 4.1)
const listeMotifs = z.array(z.string().trim().min(1).max(120)).max(40);
put("/agence/parametres", async (c) => {
  const m = await exigerMembre(c, "parametres");
  const b = await c.body(z.object({
    commission: z.number().min(0).max(1.5), plafondVisites: z.number().int().min(1).max(50), delaiEtude: z.number().int().min(1).max(240),
    alerteEtude: z.number().int().min(1).max(240), annulationVisite: z.number().int().min(0).max(72),
    motifsRefus: listeMotifs, motifsCorrection: listeMotifs, motifsVisite: listeMotifs, quartiers: z.array(z.string().trim().min(2).max(60)).max(300),
  }));
  await tx(async (q) => {
    const params: [string, unknown][] = [["commission", b.commission], ["plafond_visites_gratuites", b.plafondVisites], ["delai_etude_h", b.delaiEtude], ["alerte_etude_h", b.alerteEtude], ["annulation_visite_h", b.annulationVisite]];
    for (const [k, v] of params)
      await q.query("INSERT INTO parametres (cle, valeur, maj_par) VALUES ($1,$2,$3) ON CONFLICT (cle) DO UPDATE SET valeur = EXCLUDED.valeur, maj_le = now(), maj_par = EXCLUDED.maj_par", [k, JSON.stringify(v), m.id]);
    for (const [cat, liste] of [["refus", b.motifsRefus], ["correction", b.motifsCorrection], ["visite", b.motifsVisite]] as const) {
      await q.query("UPDATE motifs SET actif = false WHERE categorie = $1::categorie_motif", [cat]);
      for (const [i, l] of liste.entries())
        await q.query("INSERT INTO motifs (categorie, libelle, ordre, actif) VALUES ($1::categorie_motif,$2,$3,true) ON CONFLICT (categorie, libelle) DO UPDATE SET actif = true, ordre = EXCLUDED.ordre", [cat, l, i]);
    }
    // Quartiers : un nom absent de la liste est désactivé (jamais supprimé : des annonces peuvent y être rattachées)
    await q.query("UPDATE quartiers SET actif = (nom = ANY($1))", [b.quartiers]);
    for (const nom of b.quartiers) {
      const slug = nom.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      await q.query("INSERT INTO quartiers (ville_id, nom, slug) SELECT id, $1, $2 FROM villes WHERE slug = 'cotonou' ON CONFLICT (ville_id, slug) DO NOTHING", [nom, slug]);
    }
  });
  await journaliser(m as any, "Paramètres modifiés", `commission ${b.commission} · étude ${b.delaiEtude} h · ${b.quartiers.length} quartiers`);
});

put("/agence/modeles/:id", async (c) => {
  const m = await exigerMembre(c, "messages");
  const b = await c.body(z.object({ texte: z.string().trim().min(5).max(2000) }));
  const r = await un<{ nom: string }>(db, "UPDATE modeles_message SET texte = $2, maj_le = now(), maj_par = $3 WHERE id = $1 RETURNING nom", [c.params.id, b.texte, m.id]);
  if (!r) throw erreur(404, "Modèle introuvable.");
  await journaliser(m as any, "Modèle de message modifié", r.nom);
});

// ------------------------------------------------------------------ Contenus du site (WEB-07, BO-15)
put("/agence/contenus", async (c) => {
  const m = await exigerMembre(c, "contenus");
  const b = await c.body(z.object({
    banniere: z.object({ actif: z.boolean(), texte: z.string().max(300) }),
    faq: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{1,40}$/), titre: z.string().min(1).max(120), questions: z.array(z.object({ q: z.string().min(1).max(300), r: z.string().min(1).max(3000) })).max(50) })).max(30),
  }));
  await tx(async (q) => {
    await q.query(
      `INSERT INTO contenus_editoriaux (type, slug, titre, texte, statut, maj_par) VALUES ('banniere','principale','Bandeau du site',$1,$2::statut_publication,$3)
       ON CONFLICT (type, slug, langue) DO UPDATE SET texte = EXCLUDED.texte, statut = EXCLUDED.statut, maj_par = EXCLUDED.maj_par`, [b.banniere.texte, b.banniere.actif ? "publie" : "brouillon", m.id]);
    await q.query("DELETE FROM contenus_editoriaux WHERE type = 'faq'");
    for (const t of b.faq)
      for (const [i, x] of t.questions.entries())
        await q.query("INSERT INTO contenus_editoriaux (type, slug, theme, theme_titre, titre, texte, ordre, statut, maj_par) VALUES ('faq',$1,$2,$3,$4,$5,$6,'publie',$7)", [`${t.id}-${i + 1}`, t.id, t.titre, x.q, x.r, i, m.id]);
  });
  await journaliser(m as any, "Contenus du site modifiés", "FAQ et bandeau");
});

