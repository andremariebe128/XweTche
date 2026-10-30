import { z } from "zod";
import { demanderOtp, exigerMembre, fermerSession, journaliser, membreCourant, normaliserTel, ouvrirSession, PERMISSIONS, verifierOtp, type Membre, type Module } from "../auth.js";
import { config } from "../config.js";
import { jetonAleatoire, sha256 } from "../crypto.js";
import { db, tx, un } from "../db.js";
import { erreur, get, patch, post, type Ctx } from "../http.js";
import { notifier } from "../notifier.js";
import { debutEffectif } from "./moi.js";
import { OPERATEURS, iso, tiret } from "../referentiel.js";

const peut = (m: Membre, mod: Module) => PERMISSIONS[mod].includes(m.role);
export const origine = (c: Ctx) =>
  config.appUrl || `${c.req.headers.get("x-forwarded-proto") ?? c.url.protocol.replace(":", "")}://${c.req.headers.get("x-forwarded-host") ?? c.req.headers.get("host") ?? c.url.host}`;

// ------------------------------------------------------------------ Connexion à double facteur
const telSchema = z.object({ tel: z.string().min(8).max(20) });
const membreParTel = (tel: string) =>
  un<{ id: string }>(db, "SELECT id FROM membres_agence WHERE tel = $1 AND statut = 'actif'", [tel]);

// Même réponse que le numéro soit connu ou non : on ne révèle pas qui fait partie de l'équipe.
post("/agence/otp", async (c) => {
  const { tel } = await c.body(telSchema);
  const t = normaliserTel(tel);
  return (await membreParTel(t)) ? demanderOtp(t) : {};
});

post("/agence/verifier", async (c) => {
  const b = await c.body(telSchema.extend({ code: z.string().regex(/^\d{6}$/) }));
  const t = normaliserTel(b.tel);
  const m = await membreParTel(t);
  if (!m || !(await verifierOtp(t, b.code))) throw erreur(401, "Ce code n'est pas bon ou a expiré, ou votre accès n'est pas actif.");
  await ouvrirSession(c, { membreId: m.id });
  const membre = await un<Membre>(db, "SELECT id, nom, tel, email::text, role, statut FROM membres_agence WHERE id = $1", [m.id]);
  await journaliser(membre as any, "Connexion au back-office", membre!.nom);
  return { membre };
});

post("/agence/deconnexion", async (c) => { await fermerSession(c, true); });
get("/agence/moi", async (c) => ({ membre: await membreCourant(c) }));

// ------------------------------------------------------------------ Invitations (BO-13)
async function invitation(jeton: string) {
  const i = await un<any>(db,
    `SELECT i.id, i.expire_le, i.envoye_le, m.id AS membre_id, m.nom, m.tel, m.role, m.statut, p.nom AS par
       FROM invitations_membre i JOIN membres_agence m ON m.id = i.membre_id LEFT JOIN membres_agence p ON p.id = i.invite_par
      WHERE i.jeton_hash = $1 AND i.utilise_le IS NULL AND i.annule_le IS NULL AND i.expire_le > now() AND m.statut = 'invite'`, [sha256(jeton)]);
  if (!i) throw erreur(404, "Ce lien a expiré, a déjà servi ou a été annulé.", "invitation_invalide");
  return i;
}
get("/agence/invitation/:jeton", async (c) => {
  const i = await invitation(c.params.jeton);
  return { nom: i.nom, role: i.role, tel: i.tel, par: i.par, expireLe: iso(i.expire_le) };
});
post("/agence/invitation/:jeton/otp", async (c) => demanderOtp((await invitation(c.params.jeton)).tel));
post("/agence/invitation/:jeton/activer", async (c) => {
  const { code } = await c.body(z.object({ code: z.string().regex(/^\d{6}$/) }));
  const i = await invitation(c.params.jeton);
  if (!(await verifierOtp(i.tel, code))) throw erreur(401, "Ce code n'est pas bon ou a expiré.");
  await tx(async (q) => {
    await q.query("UPDATE membres_agence SET statut = 'actif' WHERE id = $1", [i.membre_id]);
    await q.query("UPDATE invitations_membre SET utilise_le = now() WHERE id = $1", [i.id]);
  });
  await ouvrirSession(c, { membreId: i.membre_id });
  await journaliser({ id: i.membre_id, nom: i.nom, role: i.role }, "Invitation acceptée, accès activé", i.nom);
  return { membre: { id: i.membre_id, nom: i.nom, tel: i.tel, role: i.role, statut: "actif" } };
});

// ------------------------------------------------------------------ État complet du back-office
const STATUT_DOSSIER: Record<string, string> = {
  soumise: "en-etude", en_etude: "en-etude", a_corriger: "a-corriger", controle: "controle", liberee: "controle",
  en_ligne: "en-ligne", reservee: "en-ligne", refusee: "refusee", louee: "louee",
};

async function dossiers() {
  const r = await db.query<any>(
    `SELECT a.ref, b.type, q.nom AS quartier, b.reperes, a.loyer, a.avance_mois, a.caution_mois, a.charges, po.nom AS proprietaire, po.tel AS tel_proprietaire,
            b.gestionnaire, a.soumise_le, a.pause_le, a.pause_cumulee, a.statut, a.motif, a.pre_controle, a.checklist, a.controle_planifie_le, a.publiee_le,
            ae.nom AS etudie_par, at.nom AS agent_terrain,
            (SELECT count(*)::int FROM medias m WHERE m.annonce_id = a.id AND m.controle_id IS NULL) AS photos,
            EXISTS (SELECT 1 FROM documents d WHERE d.utilisateur_id = po.id AND d.type IN ('cip','passeport','npi') AND d.statut <> 'refuse') AS doc_identite,
            EXISTS (SELECT 1 FROM documents d WHERE d.annonce_id = a.id AND d.type IN ('titre_foncier','attestation_detention','convention_vente','permis_habiter') AND d.statut <> 'refuse') AS doc_propriete,
            EXISTS (SELECT 1 FROM documents d WHERE d.annonce_id = a.id AND d.type = 'mandat' AND d.statut <> 'refuse') AS doc_mandat,
            ct.realise_le, ct.conforme, ct.note
       FROM annonces a JOIN biens b ON b.id = a.bien_id JOIN quartiers q ON q.id = b.quartier_id JOIN utilisateurs po ON po.id = b.proprietaire_id
       LEFT JOIN membres_agence ae ON ae.id = a.agent_etude_id LEFT JOIN membres_agence at ON at.id = a.agent_terrain_id
       LEFT JOIN LATERAL (SELECT realise_le, conforme, note FROM controles_terrain WHERE annonce_id = a.id ORDER BY cree_le DESC LIMIT 1) ct ON true
      WHERE a.statut <> 'brouillon' ORDER BY a.soumise_le DESC NULLS LAST LIMIT 500`);
  return r.rows.map((d) => ({
    ref: d.ref, type: d.type, quartier: d.quartier, reperes: (d.reperes ?? []).join(", "), loyer: d.loyer, avanceMois: d.avance_mois, cautionMois: d.caution_mois,
    charges: d.charges, proprietaire: d.proprietaire, telProprietaire: d.tel_proprietaire, gestionnaire: d.gestionnaire,
    soumisLe: debutEffectif(d.soumise_le, d.pause_cumulee) ?? iso(new Date()), pauseLe: iso(d.pause_le), statut: STATUT_DOSSIER[d.statut], photos: d.photos,
    documents: { identite: d.doc_identite, propriete: d.doc_propriete, mandat: d.gestionnaire ? d.doc_mandat : undefined },
    auto: { photosNettes: true, champsComplets: true, doublonPhoto: false, doublonAdresse: false, ...(d.pre_controle ?? {}) },
    checklist: d.checklist ?? {}, motif: d.motif ?? undefined, etudiePar: d.etudie_par ?? undefined, agentTerrain: d.agent_terrain ?? undefined,
    controleLe: iso(d.controle_planifie_le), controle: d.realise_le ? { fait: true, conforme: d.conforme ?? undefined, note: d.note ?? undefined } : d.statut === "controle" || d.statut === "liberee" ? { fait: false } : undefined,
    enLigneLe: iso(d.publiee_le),
  }));
}

export async function etatAgence(m: Membre) {
  const vide = Promise.resolve({ rows: [] as any[] });
  const [equipe, utilisateurs, visites, baux, signalements, modeles, journal, contenus, ds] = await Promise.all([
    peut(m, "equipe") ? db.query<any>(
      `SELECT m.id, m.nom, m.tel, m.email::text, m.role, m.statut, i.envoye_le, i.expire_le, i.canaux::text[] AS canaux, p.nom AS par
         FROM membres_agence m LEFT JOIN LATERAL (SELECT * FROM invitations_membre WHERE membre_id = m.id AND utilise_le IS NULL AND annule_le IS NULL ORDER BY envoye_le DESC LIMIT 1) i ON true
         LEFT JOIN membres_agence p ON p.id = i.invite_par ORDER BY m.cree_le`) : db.query<any>("SELECT id, nom, tel, email::text, role, statut FROM membres_agence WHERE statut = 'actif' ORDER BY nom"),
    peut(m, "utilisateurs") ? db.query<any>(
      "SELECT id, nom, tel, role_actif, cree_le, identite, statut, motif_suspension FROM utilisateurs WHERE supprime_le IS NULL ORDER BY cree_le DESC LIMIT 1000") : vide,
    peut(m, "visites") || peut(m, "tableau") ? db.query<any>(
      `SELECT v.id, a.ref, l.nom AS locataire, v.creneau_le, ag.nom AS agent, v.statut, v.preuve, v.avis, v.motif_avis
         FROM visites v JOIN annonces a ON a.id = v.annonce_id JOIN utilisateurs l ON l.id = v.locataire_id LEFT JOIN membres_agence ag ON ag.id = v.agent_id
        ORDER BY v.creneau_le DESC LIMIT 1000`) : vide,
    peut(m, "baux") ? db.query<any>(
      `SELECT b.id, a.ref, l.nom AS locataire, po.nom AS proprietaire, b.loyer, b.commission, b.statut, b.signe_le,
              p.moyen, p.confirme_le, p.reference_externe, p.id AS paiement_id, r.numero, sp.nom AS saisi_par
         FROM baux b JOIN annonces a ON a.id = b.annonce_id JOIN utilisateurs l ON l.id = b.locataire_id JOIN utilisateurs po ON po.id = b.proprietaire_id
         LEFT JOIN paiements p ON p.bail_id = b.id AND p.type = 'commission' AND p.statut = 'recu'
         LEFT JOIN recus r ON r.paiement_id = p.id LEFT JOIN membres_agence sp ON sp.id = p.saisi_par
        WHERE b.statut <> 'annule' ORDER BY b.cree_le DESC LIMIT 1000`) : vide,
    peut(m, "signalements") ? db.query<any>(
      `SELECT s.id, s.numero, s.cree_le, s.motif, s.detail, a.ref, s.tel, s.statut, ag.nom AS assigne, s.assigne_a, s.decision
         FROM signalements s LEFT JOIN annonces a ON a.id = s.annonce_id LEFT JOIN membres_agence ag ON ag.id = s.assigne_a ORDER BY s.cree_le DESC LIMIT 1000`) : vide,
    peut(m, "messages") ? db.query<any>("SELECT id, nom, canal, texte FROM modeles_message ORDER BY nom, canal") : vide,
    peut(m, "journal") ? db.query<any>("SELECT id, cree_le, auteur, role, action, cible FROM journal_audit ORDER BY id DESC LIMIT 500") : vide,
    peut(m, "contenus") ? db.query<any>("SELECT type, theme, theme_titre, titre, texte, ordre, statut FROM contenus_editoriaux WHERE type IN ('faq','banniere') ORDER BY theme, ordre") : vide,
    dossiers(),
  ]);

  const themes = new Map<string, any>();
  for (const x of contenus.rows.filter((y) => y.type === "faq")) {
    const t = themes.get(x.theme) ?? { id: x.theme, titre: x.theme_titre ?? x.theme, questions: [] };
    t.questions.push({ q: x.titre, r: x.texte });
    themes.set(x.theme, t);
  }
  const ban = contenus.rows.find((x) => x.type === "banniere");
  const canal = (x: string) => (x === "sms" ? "SMS" : x === "whatsapp" ? "WhatsApp" : "E-mail");
  return {
    session: m.id,
    equipe: equipe.rows.map((x) => ({
      id: x.id, nom: x.nom, tel: x.tel, email: x.email ?? undefined, role: x.role, statut: x.statut,
      invitation: x.expire_le ? { envoyeLe: iso(x.envoye_le), expireLe: iso(x.expire_le), par: x.par ?? "", canaux: (x.canaux ?? []).map((k: string) => (k === "email" ? "E-mail" : "SMS")) } : undefined,
    })),
    dossiers: ds,
    utilisateurs: utilisateurs.rows.map((x) => ({ id: x.id, nom: x.nom, tel: x.tel, role: x.role_actif, inscritLe: iso(x.cree_le), identite: tiret(x.identite), statut: x.statut, motifSuspension: x.motif_suspension ?? undefined })),
    visites: visites.rows.map((x) => ({
      id: x.id, ref: x.ref, locataire: x.locataire, date: iso(x.creneau_le), agent: x.agent ?? "", statut: x.statut,
      presence: x.preuve === "qr" ? "QR code" : x.preuve === "gps" ? "GPS" : undefined, avis: x.avis ? tiret(x.avis) : undefined, motif: x.motif_avis ?? undefined,
    })),
    baux: baux.rows.map((x) => ({
      id: x.id, ref: x.ref, locataire: x.locataire, proprietaire: x.proprietaire, loyer: x.loyer, commission: x.commission, statut: tiret(x.statut), signeLe: iso(x.signe_le),
      paiement: x.paiement_id ? { id: x.paiement_id, moyen: OPERATEURS[x.moyen], date: iso(x.confirme_le), recu: x.numero ?? "", transaction: x.reference_externe ?? "", saisiPar: x.saisi_par ?? undefined } : undefined,
    })),
    signalements: signalements.rows.map((x) => ({
      id: x.id, numero: x.numero, date: iso(x.cree_le), motif: x.motif, detail: x.detail, ref: x.ref ?? undefined, tel: x.tel ?? undefined, statut: tiret(x.statut),
      assigne: x.assigne ?? undefined, assigneId: x.assigne_a ?? undefined, decision: x.decision ?? undefined,
    })),
    modeles: modeles.rows.map((x) => ({ id: x.id, nom: x.nom, canal: canal(x.canal), texte: x.texte })),
    journal: journal.rows.map((x) => ({ id: String(x.id), date: iso(x.cree_le), auteur: x.auteur, role: x.role, action: x.action, cible: x.cible })),
    contenus: { banniere: { actif: ban?.statut === "publie", texte: ban?.texte ?? "" }, faq: [...themes.values()] },
    moi: { id: m.id, nom: m.nom, tel: m.tel, role: m.role },
  };
}

get("/agence/etat", async (c) => etatAgence(await exigerMembre(c, "tableau")));

// ------------------------------------------------------------------ Équipe (admin)
const canauxSchema = z.array(z.enum(["SMS", "E-mail"])).min(1).default(["SMS"]);

async function envoyerInvitation(c: Ctx, m: { id: string; nom: string; tel: string; email: string | null; role: string }, par: Membre, canaux: ("SMS" | "E-mail")[]) {
  const dispo = canaux.filter((k) => k === "SMS" || m.email);
  const jeton = jetonAleatoire(24);
  await db.query("UPDATE invitations_membre SET annule_le = now() WHERE membre_id = $1 AND utilise_le IS NULL AND annule_le IS NULL", [m.id]);
  const i = await un<{ expire_le: Date }>(db,
    `INSERT INTO invitations_membre (membre_id, jeton_hash, canaux, invite_par, expire_le)
     VALUES ($1,$2,$3::canal_message[],$4, now() + interval '72 hours') RETURNING expire_le`,
    [m.id, sha256(jeton), dispo.map((k) => (k === "SMS" ? "sms" : "email")), par.id]);
  const lien = `${origine(c)}/agence/invitation/${jeton}`;
  const dateExp = new Date(i!.expire_le).toLocaleString("fr-FR", { timeZone: "Africa/Porto-Novo", dateStyle: "short", timeStyle: "short" });
  const vars = { prenom: m.nom.split(" ")[0], par: par.nom, role: ({ etude: "Agent d'étude", terrain: "Agent terrain", finance: "Finance", support: "Support client", admin: "Responsable agence" } as any)[m.role], lien, expire: dateExp, tel: m.tel };
  if (dispo.includes("SMS")) await notifier({ modele: "invitation-sms", tel: m.tel, membreId: m.id, vars });
  if (dispo.includes("E-mail")) await notifier({ modele: "invitation-email", tel: m.tel, membreId: m.id, vars });
  return { lien, expireLe: iso(i!.expire_le), canaux: dispo };
}

post("/agence/equipe/inviter", async (c) => {
  const me = await exigerMembre(c, "equipe");
  const b = await c.body(z.object({
    nom: z.string().trim().min(2).max(80), tel: z.string().min(8).max(20), email: z.string().email().max(120).optional(),
    role: z.enum(["etude", "terrain", "finance", "support", "admin"]), canaux: canauxSchema,
  }));
  const tel = normaliserTel(b.tel);
  if (await un(db, "SELECT 1 FROM membres_agence WHERE tel = $1 OR (email IS NOT NULL AND email = $2)", [tel, b.email ?? null]))
    throw erreur(409, "Un membre existe déjà avec ce numéro ou cet e-mail.");
  const m = await un<any>(db, "INSERT INTO membres_agence (nom, tel, email, role) VALUES ($1,$2,$3,$4) RETURNING id, nom, tel, email::text, role", [b.nom, tel, b.email ?? null, b.role]);
  const inv = await envoyerInvitation(c, m, me, b.canaux);
  await journaliser(me as any, "Invitation envoyée", `${m.nom} · ${b.role} · ${inv.canaux.join(" et ")}`);
  return { id: m.id, ...inv };
});

post("/agence/equipe/:id/renvoyer", async (c) => {
  const me = await exigerMembre(c, "equipe");
  const b = await c.body(z.object({ canaux: canauxSchema }));
  const m = await un<any>(db, "SELECT id, nom, tel, email::text, role, statut FROM membres_agence WHERE id = $1", [c.params.id]);
  if (!m) throw erreur(404, "Membre introuvable.");
  if (m.statut === "actif") throw erreur(409, "Ce membre a déjà activé son accès.");
  await db.query("UPDATE membres_agence SET statut = 'invite' WHERE id = $1", [m.id]);
  const inv = await envoyerInvitation(c, m, me, b.canaux);
  await journaliser(me as any, "Nouveau lien d'invitation envoyé", `${m.nom} · ${inv.canaux.join(" et ")}`);
  return inv;
});

post("/agence/equipe/:id/revoquer", async (c) => {
  const me = await exigerMembre(c, "equipe");
  const m = await un<any>(db, "SELECT id, nom, role, statut FROM membres_agence WHERE id = $1", [c.params.id]);
  if (!m) throw erreur(404, "Membre introuvable.");
  if (m.id === me.id) throw erreur(409, "Vous ne pouvez pas révoquer votre propre accès.");
  if (m.role === "admin" && m.statut === "actif" && (await un<{ n: number }>(db, "SELECT count(*)::int AS n FROM membres_agence WHERE role='admin' AND statut='actif'"))!.n <= 1)
    throw erreur(409, "Il faut garder au moins un responsable actif.");
  await tx(async (q) => {
    await q.query("UPDATE membres_agence SET statut = 'revoque' WHERE id = $1", [m.id]);
    await q.query("UPDATE invitations_membre SET annule_le = now() WHERE membre_id = $1 AND utilise_le IS NULL AND annule_le IS NULL", [m.id]);
    await q.query("UPDATE sessions SET revoquee_le = now() WHERE membre_id = $1 AND revoquee_le IS NULL", [m.id]);
  });
  await journaliser(me as any, m.statut === "invite" ? "Invitation annulée" : "Accès révoqué", `${m.nom} · ${m.role}`);
});

patch("/agence/equipe/:id", async (c) => {
  const me = await exigerMembre(c, "equipe");
  const b = await c.body(z.object({ role: z.enum(["etude", "terrain", "finance", "support", "admin"]) }));
  const m = await un<any>(db, "SELECT id, nom, role FROM membres_agence WHERE id = $1", [c.params.id]);
  if (!m) throw erreur(404, "Membre introuvable.");
  if (m.id === me.id) throw erreur(409, "Vous ne pouvez pas changer votre propre rôle.");
  await db.query("UPDATE membres_agence SET role = $2 WHERE id = $1", [m.id, b.role]);
  await journaliser(me as any, "Rôle modifié", `${m.nom} : ${m.role} → ${b.role}`);
});
