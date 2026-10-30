// Test de bout en bout : node --env-file=.env server/e2e.mjs (API lancée : npm run api:dev ; base de développement uniquement)
import pg from "pg";
import sharp from "sharp";
import { randomBytes } from "node:crypto";

const BASE = process.env.API ?? "http://localhost:3001/api";
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
await db.query("DELETE FROM codes_otp");
let ok = 0, ko = 0;
const verif = (nom, cond, detail = "") => { cond ? ok++ : ko++; console.log(`${cond ? "  ✔" : "  ✘"} ${nom}${cond ? "" : ` ${detail}`}`); };

class Client {
  constructor(nom) { this.nom = nom; this.cookies = {}; }
  async appel(methode, chemin, corps, brut) {
    const h = { cookie: Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join("; ") };
    let body;
    if (brut) body = brut; else if (corps !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(corps); }
    const r = await fetch(BASE + chemin, { method: methode, headers: h, body });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(";"); const i = kv.indexOf("="); this.cookies[kv.slice(0, i)] = kv.slice(i + 1); }
    const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t; }
    return { s: r.status, j };
  }
  get = (c) => this.appel("GET", c); post = (c, b) => this.appel("POST", c, b ?? {}); put = (c, b) => this.appel("PUT", c, b); patch = (c, b) => this.appel("PATCH", c, b); del = (c) => this.appel("DELETE", c);
}
async function connecter(c, tel, nom, role) {
  const o = await c.post("/auth/otp", { tel });
  const v = await c.post("/auth/verifier", { tel, code: o.j.codeDemo });
  if (!v.j.existe) await c.post("/auth/inscription", { preuve: v.j.preuve, nom, role });
}
async function connecterAgence(c, tel) {
  const o = await c.post("/agence/otp", { tel });
  return c.post("/agence/verifier", { tel, code: o.j.codeDemo ?? "123456" });
}
async function photo(i, cl) {
  const buf = await sharp({ create: { width: 1400, height: 1050, channels: 3, background: { r: (i * 40) % 255, g: (i * 77) % 255, b: (i * 23) % 255 } } })
    .composite([{ input: await sharp({ create: { width: 500 + i * 30, height: 300, channels: 3, background: { r: 255 - i * 30, g: i * 20, b: 120 } } }).png().toBuffer(), left: 50 * i, top: 100 * (i % 5) }]).jpeg().toBuffer();
  const f = new FormData(); f.append("fichier", new File([buf], "p.jpg", { type: "image/jpeg" }));
  const r = await fetch(BASE + (cl.nom === "agent" ? "/agence/upload/photo" : "/upload/photo"), { method: "POST", headers: { cookie: Object.entries(cl.cookies).map(([k, v]) => `${k}=${v}`).join("; ") }, body: f });
  return r.json();
}
const suffixe = randomBytes(2).toString("hex");
const telPro = "0150" + String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
const telLoc = "0151" + String(Math.floor(Math.random() * 1e6)).padStart(6, "0");

console.log("1. Public");
const pub = new Client("public");
verif("liste d'annonces", (await pub.get("/annonces?quartier=fidjrosse")).j.total >= 1);
verif("paramètres", (await pub.get("/parametres")).j.commission === 0.5);
verif("FAQ", (await pub.get("/contenus")).j.faq.length > 0);
verif("quartiers", (await pub.get("/quartiers")).j.length >= 10);
verif("annonce introuvable = 404", (await pub.get("/annonces/XT-9999")).s === 404);
verif("espace sans compte = 401", (await pub.get("/moi/etat")).s === 401);
verif("back-office sans session = 401", (await pub.get("/agence/etat")).s === 401);

console.log("2. Comptes");
const pro = new Client("pro"), loc = new Client("loc");
await connecter(pro, telPro, "Prosper Test", "proprietaire");
await connecter(loc, telLoc, "Laure Test", "locataire");
verif("propriétaire connecté", (await pro.get("/moi")).j.compte?.role === "proprietaire");
const mauvais = await new Client("x").post("/auth/verifier", { tel: telLoc, code: "000000" });
verif("mauvais code refusé", mauvais.s === 401);
verif("locataire ne peut pas déposer", (await loc.post("/proprietaire/biens", {})).s === 403);

console.log("3. Dépôt d'un bien");
const photos = [];
for (let i = 1; i <= 6; i++) { const p = await photo(i, pro); photos.push({ ...p, legende: `Photo ${i}` }); }
verif("6 photos envoyées et compressées", photos.every((p) => p.cle?.endsWith(".webp") && p.largeur === 1400));
const docUp = async (cl, type) => {
  const f = new FormData(); f.append("fichier", new File([Buffer.from("%PDF-1.4 test")], "d.pdf", { type: "application/pdf" })); f.append("type", type); f.append("consentement", "1");
  const r = await fetch(BASE + "/upload/document", { method: "POST", headers: { cookie: Object.entries(cl.cookies).map(([k, v]) => `${k}=${v}`).join("; ") }, body: f }); return r.json();
};
const dId = await docUp(pro, "cip"), dProp = await docUp(pro, "titre_foncier");
verif("documents enregistrés", dId.id && dProp.id);
const bien = {
  type: "chambre-salon", quartier: "Agla", adresse: `Rue ${suffixe}, maison bleue`, gps: "6.3703, 2.3912", reperes: "Face pharmacie\nPrès du marché",
  photos, loyer: 50000, avanceMois: 3, cautionMois: 1, charges: 0, equipements: ["eau", "electricite", "cloture"],
  description: "Chambre-salon carrelée avec douche interne.", regles: "Pas d'animaux", gestionnaire: false,
  pieces: { identite: dId.id, propriete: dProp.id }, certifs: [true, true, true],
};
verif("moins de 6 photos refusé", (await pro.post("/proprietaire/biens", { ...bien, photos: photos.slice(0, 3) })).s === 422);
const dep = await pro.post("/proprietaire/biens", bien);
verif("dépôt accepté", dep.s === 200 && dep.j.ref, JSON.stringify(dep.j));
const ref = dep.j.ref;
let etat = (await pro.get("/moi/etat")).j;
const b0 = etat.biens.find((b) => b.ref === ref);
verif("bien « en étude » avec compte à rebours", b0?.statut === "en-etude" && b0.soumisLe);

console.log("4. Back-office : étude et contrôle");
const admin = new Client("admin"), etude = new Client("etude"), agent = new Client("agent"), fin = new Client("fin"), supp = new Client("supp");
verif("connexion admin", (await connecterAgence(admin, "0161000001")).s === 200);
await connecterAgence(etude, "0161000002"); await connecterAgence(agent, "0161000004"); await connecterAgence(fin, "0161000006"); await connecterAgence(supp, "0161000007");
verif("numéro inconnu refusé", (await connecterAgence(new Client("z"), "0100000000")).s === 401);
let ag = (await etude.get("/agence/etat")).j;
const d = ag.dossiers.find((x) => x.ref === ref);
verif("dossier visible par l'étude", d?.statut === "en-etude" && d.documents.identite && d.auto.photosNettes && d.auto.champsComplets);
verif("agent terrain ne peut pas décider", (await agent.post(`/agence/dossiers/${ref}/decision`, { decision: "valider" })).s === 403);
verif("refus sans motif = 422", (await etude.post(`/agence/dossiers/${ref}/decision`, { decision: "refuser" })).s === 422);
verif("validation sans checklist = 422", (await etude.post(`/agence/dossiers/${ref}/decision`, { decision: "valider" })).s === 422);
const cl = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`p${i}`, true]));
await etude.post(`/agence/dossiers/${ref}/decision`, { decision: "corriger", motif: "Photo 2 floue" });
let b1 = (await pro.get("/moi/etat")).j.biens.find((b) => b.ref === ref);
verif("« À corriger » avec motif et pause", b1.statut === "a-corriger" && b1.motif === "Photo 2 floue" && b1.pauseLe);
verif("renvoi en étude", (await pro.post(`/proprietaire/biens/${ref}/renvoyer`, {})).s === 200);
verif("validation", (await etude.post(`/agence/dossiers/${ref}/decision`, { decision: "valider", checklist: cl })).s === 200);
const equipe = (await admin.get("/agence/etat")).j.equipe;
const serge = equipe.find((m) => m.tel === "0161000004");
verif("attribution terrain", (await etude.post(`/agence/dossiers/${ref}/attribuer`, { agentId: serge.id })).s === 200);
const pc = await photo(9, agent);
verif("photo de contrôle (agent)", pc.cle?.startsWith("m/"));
const ctl = await agent.post(`/agence/dossiers/${ref}/controle`, { conforme: true, note: "RAS", photos: [{ ...pc, legende: "Façade" }] });
verif("contrôle conforme -> en ligne", ctl.s === 200, JSON.stringify(ctl.j));
const pubA = await pub.get(`/annonces/${ref}`);
verif("annonce publique, badge vérifié, commission 25 000", pubA.j.statut === "en-ligne" && pubA.j.commission === 25000 && pubA.j.verifieLe && pubA.j.images.length === 6, JSON.stringify(pubA.j).slice(0, 300));
verif("photo publique accessible", (await fetch(BASE.replace("/api", "") + pubA.j.images[0])).status === 200);
verif("pas de coordonnées exactes", !("adresse" in pubA.j));

console.log("5. Locataire : visite, avis, candidature");
const cr = (await pub.get(`/annonces/${ref}/creneaux`)).j;
const libre = cr.jours[0].creneaux.find((c) => c.libre);
verif("créneaux proposés", cr.jours.length > 0 && libre);
verif("réservation sans compte = 401", (await pub.post("/visites", { ref, creneau: libre.iso })).s === 401);
const rv = await loc.post("/visites", { ref, creneau: libre.iso });
verif("visite réservée avec adresse et code", rv.s === 200 && rv.j.code?.length === 4 && rv.j.adresse, JSON.stringify(rv.j));
verif("doublon de visite refusé", (await loc.post("/visites", { ref, creneau: cr.jours[1].creneaux[0].iso })).s === 409);
verif("créneau pris n'est plus libre", !(await pub.get(`/annonces/${ref}/creneaux`)).j.jours[0].creneaux.find((c) => c.iso === libre.iso).libre);
verif("avis avant la visite refusé", (await loc.post(`/visites/${rv.j.id}/avis`, { avis: "satisfait" })).s === 409);
verif("mauvais code de visite", (await agent.post(`/agence/visites/${rv.j.id}/presence`, { preuve: "qr", code: "xxxx" })).s === 422);
verif("présence validée par QR", (await agent.post(`/agence/visites/${rv.j.id}/presence`, { preuve: "qr", code: rv.j.code })).s === 200);
await db.query("UPDATE visites SET creneau_le = now() - interval '3 hours' WHERE id = $1", [rv.j.id]);
verif("candidature sans avis refusée", (await loc.post("/candidatures", { ref })).s === 409);
verif("avis satisfait", (await loc.post(`/visites/${rv.j.id}/avis`, { avis: "satisfait" })).s === 200);
verif("candidature", (await loc.post("/candidatures", { ref, profession: "Infirmière" })).s === 200);
etat = (await pro.get("/moi/etat")).j;
const cand = etat.biens.find((b) => b.ref === ref).candidats[0];
verif("propriétaire voit « Laure T. » sans coordonnées", cand?.nom === "Laure T." && cand.statut === "en-attente");
verif("signature sans être retenu refusée", (await loc.post(`/baux/${ref}/signer`, { nom: "Laure Test" })).s === 409);
verif("propriétaire retient", (await pro.post(`/proprietaire/biens/${ref}/candidats/${cand.id}`, { decision: "retenir" })).s === 200);
verif("annonce réservée", (await pub.get(`/annonces/${ref}`)).j.statut === "reservee");

console.log("6. Bail et paiement");
verif("paiement avant signature refusé", (await loc.post(`/baux/${ref}/payer`, { operateur: "MTN MoMo", tel: telLoc })).s === 409);
verif("signature", (await loc.post(`/baux/${ref}/signer`, { nom: "Laure Test" })).j.bail === "signe");
const pay = await loc.post(`/baux/${ref}/payer`, { operateur: "MTN MoMo", tel: telLoc });
verif("paiement en attente", pay.j.statut === "en-attente", JSON.stringify(pay.j));
verif("double paiement = même paiement", (await loc.post(`/baux/${ref}/payer`, { operateur: "MTN MoMo", tel: telLoc })).j.id === pay.j.id);
await db.query("UPDATE paiements SET cree_le = now() - interval '10 seconds' WHERE id = $1", [pay.j.id]);
const sp = await loc.get(`/paiements/${pay.j.id}`);
verif("paiement reçu avec reçu numéroté", sp.j.statut === "recu" && /^XT-R-\d{4}-\d+$/.test(sp.j.recu?.numero), JSON.stringify(sp.j));
etat = (await loc.get("/moi/etat")).j;
verif("reçu et candidature « payée » dans l'espace", etat.recus.length === 1 && etat.candidatures[0].statut === "payee");
verif("annonce louée (page reste en ligne)", (await pub.get(`/annonces/${ref}`)).j.statut === "bientot");

console.log("7. Finance, support, administration");
const fa = (await fin.get("/agence/etat")).j;
const bail = fa.baux.find((b) => b.ref === ref);
verif("bail payé visible par la finance", bail?.statut === "paye" && bail.paiement.moyen === "MTN MoMo");
verif("support ne voit pas les baux", (await supp.get("/agence/etat")).j.baux.length === 0);
verif("remboursement par le support refusé", (await supp.post(`/agence/paiements/${bail.paiement.id}/rembourser`, { motif: "erreur de montant" })).s === 403);
verif("remboursement par la finance", (await fin.post(`/agence/paiements/${bail.paiement.id}/rembourser`, { motif: "Bail annulé avant l'entrée" })).s === 200);
verif("annonce de nouveau en ligne", (await pub.get(`/annonces/${ref}`)).j.statut === "en-ligne");
const sg = await pub.post("/signalements", { ref, tel: "0155000000", motif: "Déjà loué", detail: "test" });
verif("signalement sans compte", /^SG-\d+$/.test(sg.j.numero));
const sid = (await supp.get("/agence/etat")).j.signalements.find((s) => s.numero === sg.j.numero).id;
verif("clôture sans décision refusée", (await supp.post(`/agence/signalements/${sid}`, { statut: "resolu" })).s === 422);
verif("prise en charge", (await supp.post(`/agence/signalements/${sid}`, { statut: "en-cours" })).s === 200);
verif("résolution", (await supp.post(`/agence/signalements/${sid}`, { statut: "resolu", decision: "Vérifié, annonce correcte" })).s === 200);
const u = (await supp.get("/agence/etat")).j.utilisateurs.find((x) => x.nom === "Laure Test");
verif("suspension d'un compte", (await supp.post(`/agence/utilisateurs/${u.id}/suspendre`, { motif: "Test" })).s === 200);
verif("compte suspendu : session coupée", (await loc.get("/moi/etat")).s === 401);
await supp.post(`/agence/utilisateurs/${u.id}/reactiver`);
const par = (await admin.get("/parametres")).j;
verif("changement de commission", (await admin.put("/agence/parametres", { ...par, commission: 0.4 })).s === 200 && (await pub.get("/parametres")).j.commission === 0.4);
await admin.put("/agence/parametres", { ...par, commission: 0.5 });
verif("paramètres réservés à l'admin", (await supp.put("/agence/parametres", par)).s === 403);
const cont = (await admin.get("/agence/etat")).j.contenus;
verif("bandeau publié", (await admin.put("/agence/contenus", { ...cont, banniere: { actif: true, texte: "Info test" } })).s === 200 && (await pub.get("/contenus")).j.banniere.actif);
await admin.put("/agence/contenus", cont);

console.log("8. Équipe et journal");
const inv = await admin.post("/agence/equipe/inviter", { nom: "Nouveau Membre", tel: "0161999" + suffixe.slice(0, 3).replace(/\D/g, "1"), role: "support", canaux: ["SMS"] });
verif("invitation créée avec lien", inv.s === 200 && inv.j.lien?.includes("/agence/invitation/"), JSON.stringify(inv.j));
const jeton = inv.j.lien.split("/").pop();
const info = await pub.get(`/agence/invitation/${jeton}`);
verif("lien d'invitation valide", info.j.role === "support");
const nvl = await admin.post(`/agence/equipe/${inv.j.id}/renvoyer`, { canaux: ["SMS"] });
verif("nouveau lien invalide l'ancien", (await pub.get(`/agence/invitation/${jeton}`)).s === 404 && nvl.j.lien !== inv.j.lien);
const j2 = nvl.j.lien.split("/").pop();
const act = await new Client("n2").post(`/agence/invitation/${j2}/activer`, { code: "000000" });
verif("activation avec mauvais code refusée", act.s === 401);
const nm = new Client("n3"); const oi2 = await nm.post(`/agence/invitation/${j2}/otp`);
verif("activation avec bon code", (await nm.post(`/agence/invitation/${j2}/activer`, { code: oi2.j.codeDemo })).s === 200 && (await nm.get("/agence/moi")).j.membre?.role === "support");
verif("révocation coupe la session", (await admin.post(`/agence/equipe/${inv.j.id}/revoquer`)).s === 200 && (await nm.get("/agence/etat")).s === 401);
const jr = (await admin.get("/agence/etat")).j.journal;
verif("journal d'audit alimenté", jr.length >= 10 && jr.some((x) => x.action.includes("Commission remboursée")));
verif("journal en ajout seul", await db.query("DELETE FROM journal_audit").then(() => false, () => true));

console.log("9. Favoris, alertes, cron, webhook");
verif("favori", (await pro.put("/favoris/XT-0409")).s === 200 && (await pro.get("/favoris")).j.includes("XT-0409"));
verif("alerte de recherche", (await pro.post("/alertes", { quartier: "Agla", type: "chambre-salon", budget: 60000, canal: "sms" })).s === 200);
verif("cron sans secret refusé", (await pub.get("/cron/rappels")).s === 401);
const cron = await new Client("c").appel("GET", "/cron/rappels"); void cron;
const rc = await fetch(BASE + "/cron/rappels", { headers: { authorization: "Bearer cron-secret" } });
verif("cron exécuté", rc.status === 200, await rc.text());
const wh = await fetch(BASE + "/webhooks/paiement/test", { method: "POST", body: JSON.stringify({ reference: "x", status: "success" }), headers: { "x-signature": "faux" } });
verif("webhook non signé refusé", wh.status === 401);
verif("CSRF : origine étrangère refusée", (await fetch(BASE + "/auth/otp", { method: "POST", headers: { origin: "https://evil.example", "content-type": "application/json" }, body: JSON.stringify({ tel: telLoc }) })).status === 403);

console.log(`\n${ok} vérifications réussies, ${ko} échec(s)`);
await db.end();
process.exit(ko ? 1 : 0);
