import { z } from "zod";
import { exigerRole, exigerUtilisateur, type Utilisateur } from "../auth.js";
import { appliquerResultat, formatFCFA, initierChezPrestataire } from "../paiement.js";
import { config } from "../config.js";
import { db, tx, un } from "../db.js";
import { del, erreur, get, post, put } from "../http.js";
import { notifier } from "../notifier.js";
import { OPERATEURS, OPERATEUR_CODE, TYPES, iso, param, prenomInitiale, tiret } from "../referentiel.js";

// Date et heure « du Bénin » (UTC+1) pour les SMS
export function dateBJ(d: Date | string) {
  const x = new Date(new Date(d).getTime() + 3600_000);
  return `${String(x.getUTCDate()).padStart(2, "0")}/${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function heureBJ(d: Date | string) {
  const x = new Date(new Date(d).getTime() + 3600_000);
  return `${String(x.getUTCHours()).padStart(2, "0")}h${String(x.getUTCMinutes()).padStart(2, "0")}`;
}

const STATUT_BIEN: Record<string, string> = {
  brouillon: "en-etude", soumise: "en-etude", en_etude: "en-etude", a_corriger: "a-corriger", refusee: "refusee",
  controle: "controle", en_ligne: "en-ligne", reservee: "reservee", louee: "louee", liberee: "louee",
};

// Date de départ effective du compte à rebours : début + pauses déjà consommées.
// Le front calcule « soumisLe → maintenant (ou pauseLe) », donc on lui donne un début décalé.
export const debutEffectif = (soumise: Date | null, cumulee: any) => {
  if (!soumise) return undefined;
  const ms = typeof cumulee === "object" && cumulee ? ((cumulee.days ?? 0) * 86400 + (cumulee.hours ?? 0) * 3600 + (cumulee.minutes ?? 0) * 60 + (cumulee.seconds ?? 0) + (cumulee.milliseconds ?? 0) / 1000) * 1000 : 0;
  return new Date(new Date(soumise).getTime() + ms).toISOString();
};

// ----------------------------------------------------------------------------- État complet de l'espace
export async function etatUtilisateur(u: Utilisateur) {
  const [credits, visites, candidatures, recus, alertes, biens] = await Promise.all([
    un<{ n: number }>(db, "SELECT visites_gratuites_disponibles($1) AS n", [u.id]),
    db.query<any>(
      `SELECT v.id, a.ref, v.creneau_le, v.code_visite, v.statut, v.avis, v.motif_avis, b.adresse, ag.nom AS agent
         FROM visites v JOIN annonces a ON a.id = v.annonce_id JOIN biens b ON b.id = a.bien_id
         LEFT JOIN membres_agence ag ON ag.id = v.agent_id
        WHERE v.locataire_id = $1 ORDER BY v.creneau_le DESC LIMIT 200`, [u.id]),
    db.query<any>(
      `SELECT c.id, a.ref, c.cree_le, c.statut FROM candidatures c JOIN annonces a ON a.id = c.annonce_id
        WHERE c.locataire_id = $1 ORDER BY c.cree_le DESC`, [u.id]),
    db.query<any>(
      `SELECT r.numero, a.ref, p.montant, p.moyen, p.tel_payeur, p.confirme_le, p.reference_externe
         FROM recus r JOIN paiements p ON p.id = r.paiement_id JOIN baux b ON b.id = p.bail_id JOIN annonces a ON a.id = b.annonce_id
        WHERE b.locataire_id = $1 ORDER BY r.emis_le DESC`, [u.id]),
    db.query<any>(
      `SELECT al.id, al.canal, al.budget_max, al.type, q.nom AS quartier FROM alertes_recherche al
         LEFT JOIN quartiers q ON q.id = al.quartier_id WHERE al.utilisateur_id = $1 AND al.actif ORDER BY al.cree_le DESC`, [u.id]),
    u.roles.includes("proprietaire") ? biensProprietaire(u.id) : Promise.resolve([]),
  ]);
  const maintenant = Date.now();
  return {
    compte: { tel: u.tel, nom: u.nom, role: u.role_actif },
    visitesGratuites: credits?.n ?? 0,
    visites: visites.rows.map((v) => {
      const passee = new Date(v.creneau_le).getTime() < maintenant;
      const statut =
        v.statut === "annulee" || v.statut === "absent" ? "annulee"
        : v.avis === "satisfait" ? "satisfait"
        : v.avis === "pas_satisfait" ? "pas-satisfait"
        : passee ? "a-evaluer" : "a-venir";
      return { id: v.id, ref: v.ref, date: iso(v.creneau_le), code: v.code_visite, statut, motif: v.motif_avis ?? undefined,
               adresse: statut === "annulee" ? undefined : v.adresse, agent: v.agent ?? undefined };
    }),
    candidatures: candidatures.rows.map((c) => ({ id: c.id, ref: c.ref, date: iso(c.cree_le), statut: tiret(c.statut) })),
    recus: recus.rows.map((r) => ({
      numero: r.numero, ref: r.ref, montant: r.montant, operateur: OPERATEURS[r.moyen], tel: r.tel_payeur ?? "", date: iso(r.confirme_le), transaction: r.reference_externe ?? "",
    })),
    alertes: alertes.rows.map((a) => ({
      id: a.id,
      resume: [a.type ? TYPES[a.type] : "Tous types", a.quartier ?? "Tous quartiers", a.budget_max ? `jusqu'à ${formatFCFA(a.budget_max)}` : null].filter(Boolean).join(" · "),
      canal: a.canal === "whatsapp" ? "WhatsApp" : "SMS",
    })),
    biens,
  };
}

async function biensProprietaire(uid: string) {
  const r = await db.query<any>(
    `SELECT a.id, a.ref, b.type, a.titre, q.nom AS quartier, a.loyer, a.statut, a.soumise_le, a.pause_le, a.pause_cumulee, a.motif, a.vues, a.disponible_le
       FROM annonces a JOIN biens b ON b.id = a.bien_id JOIN quartiers q ON q.id = b.quartier_id
      WHERE b.proprietaire_id = $1 OR b.depose_par_id = $1 ORDER BY a.cree_le DESC`, [uid]);
  if (!r.rows.length) return [];
  const ids = r.rows.map((x) => x.id);
  const [visites, candidats] = await Promise.all([
    db.query<any>(
      `SELECT v.id, v.annonce_id, v.creneau_le, l.nom FROM visites v JOIN utilisateurs l ON l.id = v.locataire_id
        WHERE v.annonce_id = ANY($1::uuid[]) AND v.statut IN ('prevue','faite') AND v.creneau_le > now() - interval '1 day' ORDER BY v.creneau_le`, [ids]),
    db.query<any>(
      `SELECT c.id, c.annonce_id, c.statut, c.profession AS cprof, c.revenus_tranche, l.nom, l.profession,
              (SELECT max(v.creneau_le) FROM visites v WHERE v.annonce_id = c.annonce_id AND v.locataire_id = c.locataire_id AND v.statut <> 'annulee') AS visite_le
         FROM candidatures c JOIN utilisateurs l ON l.id = c.locataire_id WHERE c.annonce_id = ANY($1::uuid[]) ORDER BY c.cree_le`, [ids]),
  ]);
  return r.rows.map((a) => ({
    ref: a.ref, type: TYPES[a.type], titre: a.titre, quartier: a.quartier, loyer: a.loyer, statut: STATUT_BIEN[a.statut],
    soumisLe: debutEffectif(a.soumise_le, a.pause_cumulee), pauseLe: iso(a.pause_le), motif: a.motif ?? undefined, vues: a.vues,
    departLe: iso(a.disponible_le),
    visites: visites.rows.filter((v) => v.annonce_id === a.id).map((v) => ({ id: v.id, date: iso(v.creneau_le), visiteur: prenomInitiale(v.nom) })),
    candidats: candidats.rows.filter((c) => c.annonce_id === a.id).map((c) => ({
      id: c.id, nom: prenomInitiale(c.nom), profession: c.cprof ?? c.profession ?? "", revenus: c.revenus_tranche ?? "", visiteLe: iso(c.visite_le) ?? "",
      statut: c.statut === "envoyee" ? "en-attente" : c.statut === "non_retenue" ? "non-retenu" : "retenu",
    })),
  }));
}

get("/moi/etat", async (c) => etatUtilisateur(await exigerUtilisateur(c)));

// ----------------------------------------------------------------------------- Favoris (WEB-06, LOC-04)
get("/favoris", async (c) => {
  const u = await exigerUtilisateur(c);
  const r = await db.query<{ ref: string }>("SELECT a.ref FROM favoris f JOIN annonces a ON a.id = f.annonce_id WHERE f.utilisateur_id = $1 ORDER BY f.cree_le", [u.id]);
  return r.rows.map((x) => x.ref);
});
put("/favoris/:ref", async (c) => {
  const u = await exigerUtilisateur(c);
  await db.query("INSERT INTO favoris (utilisateur_id, annonce_id) SELECT $1, id FROM annonces WHERE ref = $2 ON CONFLICT DO NOTHING", [u.id, c.params.ref]);
});
del("/favoris/:ref", async (c) => {
  const u = await exigerUtilisateur(c);
  await db.query("DELETE FROM favoris WHERE utilisateur_id = $1 AND annonce_id = (SELECT id FROM annonces WHERE ref = $2)", [u.id, c.params.ref]);
});
// Fusion des favoris gardés hors connexion au moment de la connexion
post("/favoris/fusion", async (c) => {
  const u = await exigerUtilisateur(c);
  const { refs } = await c.body(z.object({ refs: z.array(z.string().max(20)).max(200) }));
  await db.query("INSERT INTO favoris (utilisateur_id, annonce_id) SELECT $1, id FROM annonces WHERE ref = ANY($2) ON CONFLICT DO NOTHING", [u.id, refs]);
  const r = await db.query<{ ref: string }>("SELECT a.ref FROM favoris f JOIN annonces a ON a.id = f.annonce_id WHERE f.utilisateur_id = $1", [u.id]);
  return r.rows.map((x) => x.ref);
});

// ----------------------------------------------------------------------------- Alertes et liste d'attente
post("/alertes", async (c) => {
  const u = await exigerUtilisateur(c);
  const b = await c.body(z.object({
    quartier: z.string().max(80).optional(), type: z.string().max(30).optional(), budget: z.number().int().positive().max(100_000_000).optional(),
    canal: z.string().transform((x) => x.toLowerCase()).pipe(z.enum(["sms", "whatsapp"])).default("sms"), tel: z.string().max(20).optional(),
  }));
  const type = b.type && b.type in TYPES ? b.type : null;
  const r = await un<{ id: string }>(
    db, `INSERT INTO alertes_recherche (utilisateur_id, quartier_id, type, budget_max, canal, tel)
         VALUES ($1, (SELECT id FROM quartiers WHERE nom = $2 LIMIT 1), $3::type_bien, $4, $5::canal_message, $6) RETURNING id`,
    [u.id, b.quartier ?? null, type, b.budget ?? null, b.canal, (b.tel ?? u.tel).replace(/\D/g, "")]);
  return { id: r!.id };
});
del("/alertes/:id", async (c) => {
  const u = await exigerUtilisateur(c);
  await db.query("UPDATE alertes_recherche SET actif = false WHERE id = $1 AND utilisateur_id = $2", [c.params.id, u.id]);
});

post("/annonces/:ref/attente", async (c) => {
  const u = await exigerUtilisateur(c);
  const b = await c.body(z.object({ canal: z.string().transform((x) => x.toLowerCase()).pipe(z.enum(["sms", "whatsapp"])).default("sms") }));
  const a = await un<{ id: string; statut: string }>(db, "SELECT id, statut FROM annonces WHERE ref = $1", [c.params.ref]);
  if (!a || !["louee", "liberee", "reservee"].includes(a.statut)) throw erreur(409, "Ce logement est disponible : vous pouvez réserver une visite.");
  await db.query("INSERT INTO liste_attente (annonce_id, utilisateur_id, canal) VALUES ($1,$2,$3::canal_message) ON CONFLICT DO NOTHING", [a.id, u.id, b.canal]);
});

// ----------------------------------------------------------------------------- Visites (LOC-05, LOC-06)
post("/visites", async (c) => {
  const u = await exigerRole(c, "locataire");
  if (u.role_actif !== "locataire") throw erreur(403, "Passez en mode locataire pour réserver une visite.");
  const b = await c.body(z.object({ ref: z.string().max(20), creneau: z.string().datetime({ offset: true }) }));
  const quand = new Date(b.creneau);

  const v = await tx(async (q) => {
    const a = await un<any>(q,
      `SELECT a.id, a.ref, a.agent_terrain_id, bi.adresse, bi.reperes, qu.nom AS quartier, bi.proprietaire_id, po.tel AS tel_proprietaire
         FROM annonces a JOIN biens bi ON bi.id = a.bien_id JOIN quartiers qu ON qu.id = bi.quartier_id JOIN utilisateurs po ON po.id = bi.proprietaire_id
        WHERE a.ref = $1 AND a.statut = 'en_ligne' FOR UPDATE OF a`, [b.ref]);
    if (!a) throw erreur(409, "Ce logement n'accepte plus de visite pour le moment.");
    if (a.proprietaire_id === u.id) throw erreur(409, "Vous ne pouvez pas visiter votre propre bien.");
    if (quand.getTime() < Date.now() + 2 * 3600_000) throw erreur(422, "Ce créneau est trop proche. Choisissez-en un autre.");
    const ok = await un<{ ok: boolean }>(q, "SELECT locataire_peut_reserver($1) AS ok", [u.id]);
    if (!ok?.ok) throw erreur(403, "Vos réservations sont limitées pour le moment (visites gratuites en cours ou absences répétées). Le support peut vous aider.", "limite");
    if (await un(q, "SELECT 1 FROM visites WHERE annonce_id = $1 AND locataire_id = $2 AND statut <> 'annulee'", [a.id, u.id]))
      throw erreur(409, "Vous avez déjà une visite pour ce logement.");
    if (await un(q, "SELECT 1 FROM visites WHERE annonce_id = $1 AND creneau_le = $2 AND statut <> 'annulee'", [a.id, quand]))
      throw erreur(409, "Ce créneau vient d'être pris. Choisissez-en un autre.");

    // Agent : celui du contrôle s'il existe, sinon l'agent terrain le moins chargé cette semaine
    const agent = a.agent_terrain_id ?? (await un<{ id: string }>(q,
      `SELECT m.id FROM membres_agence m WHERE m.role = 'terrain' AND m.statut = 'actif'
        ORDER BY (SELECT count(*) FROM visites v WHERE v.agent_id = m.id AND v.statut = 'prevue') LIMIT 1`))?.id ?? null;
    const credit = await un<{ id: string }>(q, "SELECT id FROM credits_visite WHERE locataire_id = $1 AND statut = 'disponible' ORDER BY cree_le LIMIT 1 FOR UPDATE", [u.id]);
    const r = await un<{ id: string; code_visite: string }>(q,
      "INSERT INTO visites (annonce_id, locataire_id, agent_id, creneau_le) VALUES ($1,$2,$3,$4) RETURNING id, code_visite", [a.id, u.id, agent, quand]);
    if (credit) await q.query("UPDATE credits_visite SET statut = 'utilise', visite_utilisee_id = $2 WHERE id = $1", [credit.id, r!.id]);
    return { ...r!, a, agent, gratuite: !!credit };
  });

  const vars = { ref: v.a.ref, date: dateBJ(quand), heure: heureBJ(quand), code: v.code_visite, adresse: v.a.adresse, quartier: v.a.quartier };
  await notifier({ modele: "visite-confirmee", tel: u.tel, utilisateurId: u.id, vars, dedup: `visite-${v.id}-loc` });
  await notifier({ modele: "visite-proprietaire", tel: v.a.tel_proprietaire, utilisateurId: v.a.proprietaire_id, vars, dedup: `visite-${v.id}-pro` });
  if (v.agent) {
    const ag = await un<{ tel: string }>(db, "SELECT tel FROM membres_agence WHERE id = $1", [v.agent]);
    if (ag) await notifier({ modele: "visite-agent", tel: ag.tel, membreId: v.agent, vars, dedup: `visite-${v.id}-agent` });
  }
  await notifier({ modele: "visite-rappel-2h", tel: u.tel, utilisateurId: u.id, planifieLe: new Date(quand.getTime() - 2 * 3600_000),
    vars: { heure: heureBJ(quand), repere: v.a.reperes?.[0] ?? v.a.quartier }, dedup: `visite-${v.id}-rappel` });

  return { id: v.id, ref: v.a.ref, date: quand.toISOString(), code: v.code_visite, statut: "a-venir", adresse: v.a.adresse, gratuite: v.gratuite };
});

post("/visites/:id/annuler", async (c) => {
  const u = await exigerUtilisateur(c);
  const limite = await param("annulation_visite_h", 12);
  return tx(async (q) => {
    const v = await un<any>(q, "SELECT id, creneau_le, statut FROM visites WHERE id = $1 AND locataire_id = $2 FOR UPDATE", [c.params.id, u.id]);
    if (!v) throw erreur(404, "Visite introuvable.");
    if (v.statut !== "prevue") throw erreur(409, "Cette visite ne peut plus être annulée.");
    const tard = new Date(v.creneau_le).getTime() - Date.now() < limite * 3600_000;
    // Annulation tardive = absence (5.3) : elle compte pour le blocage après 3 absences, sans pénalité financière.
    await q.query("UPDATE visites SET statut = $2, annulee_le = now() WHERE id = $1", [v.id, tard ? "absent" : "annulee"]);
    if (!tard) await q.query("UPDATE credits_visite SET statut = 'disponible', visite_utilisee_id = NULL WHERE visite_utilisee_id = $1", [v.id]);
    return { tardive: tard, creditRendu: !tard };
  });
});

post("/visites/:id/avis", async (c) => {
  const u = await exigerUtilisateur(c);
  const b = await c.body(z.object({ avis: z.enum(["satisfait", "pas-satisfait"]), motif: z.string().max(200).optional() }));
  if (b.avis === "pas-satisfait" && !b.motif?.trim()) throw erreur(422, "Indiquez le motif : cela nous aide à corriger l'annonce.");
  const v = await un<any>(db, "SELECT id, creneau_le, statut, avis FROM visites WHERE id = $1 AND locataire_id = $2", [c.params.id, u.id]);
  if (!v) throw erreur(404, "Visite introuvable.");
  if (v.avis) throw erreur(409, "Vous avez déjà donné votre avis sur cette visite.");
  if (new Date(v.creneau_le).getTime() > Date.now()) throw erreur(409, "Vous pourrez donner votre avis après la visite.");
  if (!["prevue", "faite"].includes(v.statut)) throw erreur(409, "Cette visite n'a pas eu lieu.");
  // Le trigger credit_apres_avis crédite une visite gratuite si « pas satisfait »
  await db.query("UPDATE visites SET statut = 'faite', avis = $2::avis_visite, motif_avis = $3 WHERE id = $1",
    [v.id, b.avis === "satisfait" ? "satisfait" : "pas_satisfait", b.avis === "satisfait" ? null : b.motif!.trim()]);
  const n = await un<{ n: number }>(db, "SELECT visites_gratuites_disponibles($1) AS n", [u.id]);
  return { visitesGratuites: n?.n ?? 0 };
});

// ----------------------------------------------------------------------------- Candidature, bail, paiement
post("/candidatures", async (c) => {
  const u = await exigerRole(c, "locataire");
  const b = await c.body(z.object({ ref: z.string().max(20), profession: z.string().max(80).optional(), revenus: z.string().max(60).optional() }));
  const a = await un<{ id: string }>(db, "SELECT id FROM annonces WHERE ref = $1 AND statut IN ('en_ligne')", [b.ref]);
  if (!a) throw erreur(409, "Ce logement n'accepte plus de candidature.");
  const ok = await un(db, "SELECT 1 FROM visites WHERE annonce_id = $1 AND locataire_id = $2 AND avis = 'satisfait'", [a.id, u.id]);
  if (!ok) throw erreur(409, "Visitez d'abord le logement et répondez « Satisfait » pour candidater.");
  if (b.profession) await db.query("UPDATE utilisateurs SET profession = $2 WHERE id = $1", [u.id, b.profession]);
  await db.query(
    "INSERT INTO candidatures (annonce_id, locataire_id, profession, revenus_tranche) VALUES ($1,$2,$3,$4) ON CONFLICT (annonce_id, locataire_id) DO NOTHING",
    [a.id, u.id, b.profession ?? u.profession, b.revenus ?? null]);
});

async function contexteBail(u: Utilisateur, ref: string) {
  const r = await un<any>(db,
    `SELECT a.id AS annonce_id, a.ref, a.titre, a.loyer, a.statut AS statut_annonce, bi.proprietaire_id, qu.nom AS quartier,
            c.id AS cand_id, c.statut AS cand_statut, ba.id AS bail_id, ba.statut AS bail_statut, ba.commission, ba.locataire_id AS bail_locataire
       FROM annonces a JOIN biens bi ON bi.id = a.bien_id JOIN quartiers qu ON qu.id = bi.quartier_id
       LEFT JOIN candidatures c ON c.annonce_id = a.id AND c.locataire_id = $2
       LEFT JOIN baux ba ON ba.annonce_id = a.id AND ba.statut IN ('a_signer','signe','paye')
      WHERE a.ref = $1`, [ref, u.id]);
  if (!r) throw erreur(404, "Ce logement n'existe pas.");
  if (r.bail_id && r.bail_locataire !== u.id) throw erreur(409, "Ce logement est déjà attribué.");
  return r;
}

get("/baux/:ref", async (c) => {
  const u = await exigerRole(c, "locataire");
  const r = await contexteBail(u, c.params.ref);
  const commission = r.commission ?? (await un<{ c: number }>(db, "SELECT calcul_commission($1) AS c", [r.loyer]))!.c;
  return {
    ref: r.ref, titre: r.titre, quartier: r.quartier, loyer: r.loyer, commission,
    candidature: r.cand_statut ? tiret(r.cand_statut) : null, bail: r.bail_statut ? tiret(r.bail_statut) : null,
    autorise: ["retenue", "bail_signe", "payee"].includes(r.cand_statut ?? ""),
  };
});

post("/baux/:ref/signer", async (c) => {
  const u = await exigerRole(c, "locataire");
  const b = await c.body(z.object({ nom: z.string().trim().min(2).max(120) }));
  const r = await contexteBail(u, c.params.ref);
  if (!["retenue", "bail_signe"].includes(r.cand_statut ?? "")) throw erreur(409, "Le propriétaire n'a pas encore retenu votre candidature.");
  if (r.bail_statut === "signe" || r.bail_statut === "paye") return { bail: tiret(r.bail_statut) };
  await tx(async (q) => {
    const commission = (await un<{ c: number }>(q, "SELECT calcul_commission($1) AS c", [r.loyer]))!.c;
    const signature = JSON.stringify({ nom_saisi: b.nom, ip: c.ip, appareil: (c.req.headers.get("user-agent") ?? "").slice(0, 150), signe_le: new Date().toISOString() });
    if (r.bail_id) await q.query("UPDATE baux SET statut = 'signe', signe_le = now(), signature_locataire = $2 WHERE id = $1", [r.bail_id, signature]);
    else await q.query(
      `INSERT INTO baux (annonce_id, candidature_id, locataire_id, proprietaire_id, loyer, commission, statut, signe_le, signature_locataire)
       VALUES ($1,$2,$3,$4,$5,$6,'signe',now(),$7)`, [r.annonce_id, r.cand_id, u.id, r.proprietaire_id, r.loyer, commission, signature]);
    await q.query("UPDATE candidatures SET statut = 'bail_signe' WHERE id = $1", [r.cand_id]);
    await q.query("UPDATE annonces SET statut = 'reservee' WHERE id = $1 AND statut = 'en_ligne'", [r.annonce_id]);
  });
  return { bail: "signe" };
});

post("/baux/:ref/payer", async (c) => {
  const u = await exigerRole(c, "locataire");
  const b = await c.body(z.object({ operateur: z.enum(["MTN MoMo", "Moov Money", "Celtiis Cash"]), tel: z.string().min(8).max(20) }));
  const r = await contexteBail(u, c.params.ref);
  if (r.bail_statut !== "signe") throw erreur(409, r.bail_statut === "paye" ? "Cette commission est déjà payée." : "Signez d'abord le bail.");
  const existant = await un<any>(db, "SELECT id, statut FROM paiements WHERE bail_id = $1 AND type = 'commission' AND statut IN ('en_attente','recu') ", [r.bail_id]);
  if (existant) return { id: existant.id, statut: tiret(existant.statut) };
  const cle = `${r.bail_id}:commission:${Date.now()}`;
  const prest = await initierChezPrestataire({ montant: r.commission, operateur: b.operateur, tel: b.tel, cle });
  const p = await un<{ id: string }>(db,
    `INSERT INTO paiements (bail_id, type, montant, moyen, prestataire, reference_externe, cle_idempotence, tel_payeur)
     VALUES ($1,'commission',$2,$3::moyen_paiement,$4,$5,$6,$7) RETURNING id`,
    [r.bail_id, r.commission, OPERATEUR_CODE[b.operateur], config.paymentMode === "simule" ? "simulation" : "prestataire", prest.reference, cle, b.tel.replace(/\D/g, "")]);
  return { id: p!.id, statut: "en-attente" };
});

// Interrogé par l'écran « Paiement en attente ». En mode simulé, le paiement se confirme après quelques secondes,
// sauf si le numéro se termine par 00 (échec simulé). En mode réel, seul le webhook du prestataire change l'état.
get("/paiements/:id", async (c) => {
  const u = await exigerUtilisateur(c);
  const p = await un<any>(db,
    `SELECT p.id, p.statut, p.cree_le, p.tel_payeur, p.moyen, p.montant, p.reference_externe, a.ref
       FROM paiements p JOIN baux b ON b.id = p.bail_id JOIN annonces a ON a.id = b.annonce_id WHERE p.id = $1 AND b.locataire_id = $2`, [c.params.id, u.id]);
  if (!p) throw erreur(404, "Paiement introuvable.");
  if (p.statut === "en_attente" && config.paymentMode === "simule" && Date.now() - new Date(p.cree_le).getTime() > 5000) {
    await appliquerResultat(p.id, String(p.tel_payeur).endsWith("00") ? "echoue" : "recu");
    p.statut = String(p.tel_payeur).endsWith("00") ? "echoue" : "recu";
  }
  const recu = p.statut === "recu"
    ? await un<any>(db, "SELECT numero, emis_le FROM recus WHERE paiement_id = $1", [p.id])
    : null;
  return {
    id: p.id, statut: tiret(p.statut),
    recu: recu ? { numero: recu.numero, ref: p.ref, montant: p.montant, operateur: OPERATEURS[p.moyen], tel: p.tel_payeur ?? "", date: iso(recu.emis_le), transaction: p.reference_externe ?? "" } : undefined,
  };
});
