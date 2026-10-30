import { config, demoAutorisee } from "./config.js";
import { codeOtp, egal, jetonAleatoire, sha256, hmac } from "./crypto.js";
import { db, un } from "./db.js";
import { cookie, erreur, type Ctx } from "./http.js";
import { envoyer } from "./sms.js";

export type RoleAgence = "etude" | "terrain" | "finance" | "support" | "admin";
export type Module =
  | "tableau" | "etude" | "annonces" | "terrain" | "utilisateurs" | "visites" | "baux"
  | "signalements" | "parametres" | "messages" | "contenus" | "equipe" | "journal";

// Même matrice que src/lib/agence.ts (BO-13) : l'API est la source de vérité, le front ne fait que masquer.
export const PERMISSIONS: Record<Module, RoleAgence[]> = {
  tableau: ["etude", "terrain", "finance", "support", "admin"],
  etude: ["etude", "admin"],
  annonces: ["etude", "support", "admin"],
  terrain: ["etude", "terrain", "admin"],
  utilisateurs: ["support", "admin"],
  visites: ["terrain", "support", "admin"],
  baux: ["finance", "admin"],
  signalements: ["support", "admin"],
  parametres: ["admin"],
  messages: ["support", "admin"],
  contenus: ["support", "admin"],
  equipe: ["admin"],
  journal: ["admin", "finance"],
};

export const ROLES_AGENCE: Record<RoleAgence, string> = {
  etude: "Agent d'étude", terrain: "Agent terrain", finance: "Finance", support: "Support client", admin: "Responsable agence",
};

export interface Utilisateur {
  id: string; tel: string; nom: string; email: string | null; roles: string[]; role_actif: "locataire" | "proprietaire";
  profession: string | null; identite: string; statut: string; langue: string;
}
export interface Membre { id: string; nom: string; tel: string; email: string | null; role: RoleAgence; statut: string }

const COOKIE_USER = "xt_s";
const COOKIE_MEMBRE = "xt_a";
const DUREE_USER = 30 * 24 * 3600;
const DUREE_MEMBRE = 12 * 3600;

export function normaliserTel(brut: string) {
  let t = brut.replace(/\D/g, "");
  if (t.startsWith("00229")) t = t.slice(5);
  else if (t.startsWith("229") && t.length > 10) t = t.slice(3);
  if (!/^\d{8,15}$/.test(t)) throw erreur(422, "Ce numéro ne semble pas valide. Vérifiez-le et réessayez.");
  return t;
}

// ----------------------------------------------------------------------------- OTP
export async function demanderOtp(tel: string): Promise<{ codeDemo?: string }> {
  const recent = await un<{ n: number; dernier: Date | null }>(
    db, "SELECT count(*)::int AS n, max(cree_le) AS dernier FROM codes_otp WHERE tel = $1 AND cree_le > now() - interval '1 hour'", [tel]);
  if (recent && recent.n >= 5) throw erreur(429, "Trop de codes demandés. Réessayez dans une heure.");
  if (recent?.dernier && Date.now() - new Date(recent.dernier).getTime() < 30_000)
    throw erreur(429, "Un code vient d'être envoyé. Patientez 30 secondes avant d'en demander un autre.");

  const code = codeOtp();
  await db.query("INSERT INTO codes_otp (tel, code_hash, expire_le) VALUES ($1, $2, now() + interval '10 minutes')", [tel, hmac(`${tel}:${code}`)]);
  if (config.otpMode === "demo") {
    if (!demoAutorisee()) throw erreur(503, "La connexion par SMS n'est pas encore disponible.");
    return { codeDemo: code };
  }
  await envoyer({ canal: "sms", tel, texte: `Xwé Tché : votre code est ${code}. Ne le communiquez à personne, même si on vous appelle.` });
  return {};
}

export async function verifierOtp(tel: string, code: string): Promise<boolean> {
  const l = await un<{ id: string; code_hash: string; tentatives: number }>(
    db, `SELECT id, code_hash, tentatives FROM codes_otp
          WHERE tel = $1 AND consomme_le IS NULL AND expire_le > now()
          ORDER BY cree_le DESC LIMIT 1`, [tel]);
  if (!l || l.tentatives >= 5) return false;
  if (!egal(l.code_hash, hmac(`${tel}:${code}`))) {
    await db.query("UPDATE codes_otp SET tentatives = tentatives + 1 WHERE id = $1", [l.id]);
    return false;
  }
  await db.query("UPDATE codes_otp SET consomme_le = now() WHERE id = $1", [l.id]);
  return true;
}

// --------------------------------------------------------------------------- Sessions
export async function ouvrirSession(c: Ctx, qui: { utilisateurId: string } | { membreId: string }) {
  const jeton = jetonAleatoire();
  const membre = "membreId" in qui;
  const duree = membre ? DUREE_MEMBRE : DUREE_USER;
  await db.query(
    `INSERT INTO sessions (jeton_hash, utilisateur_id, membre_id, appareil, expire_le)
     VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
    [sha256(jeton), membre ? null : (qui as any).utilisateurId, membre ? qui.membreId : null,
     (c.req.headers.get("user-agent") ?? "").slice(0, 200), duree]);
  c.setCookie.push(cookie(membre ? COOKIE_MEMBRE : COOKIE_USER, jeton, { maxAge: duree }));
}

export async function fermerSession(c: Ctx, membre: boolean) {
  const nom = membre ? COOKIE_MEMBRE : COOKIE_USER;
  const jeton = c.cookies[nom];
  if (jeton) await db.query("UPDATE sessions SET revoquee_le = now() WHERE jeton_hash = $1", [sha256(jeton)]);
  c.setCookie.push(cookie(nom, "", { maxAge: 0 }));
}

export async function utilisateurCourant(c: Ctx): Promise<Utilisateur | null> {
  if (c.cache.has("u")) return c.cache.get("u") as Utilisateur | null;
  const jeton = c.cookies[COOKIE_USER];
  const u = jeton
    ? await un<Utilisateur>(
        db,
        `SELECT u.id, u.tel, u.nom, u.email::text, u.roles::text[] AS roles, u.role_actif, u.profession, u.identite, u.statut, u.langue
           FROM sessions s JOIN utilisateurs u ON u.id = s.utilisateur_id
          WHERE s.jeton_hash = $1 AND s.revoquee_le IS NULL AND s.expire_le > now()
            AND u.statut = 'actif' AND u.supprime_le IS NULL`, [sha256(jeton)])
    : null;
  c.cache.set("u", u);
  return u;
}
export async function exigerUtilisateur(c: Ctx): Promise<Utilisateur> {
  const u = await utilisateurCourant(c);
  if (!u) throw erreur(401, "Connectez-vous pour continuer.", "non_connecte");
  return u;
}
export async function exigerRole(c: Ctx, role: "locataire" | "proprietaire"): Promise<Utilisateur> {
  const u = await exigerUtilisateur(c);
  if (!u.roles.includes(role)) throw erreur(403, role === "locataire" ? "Cette action est réservée aux locataires." : "Cette action est réservée aux propriétaires.");
  return u;
}

export async function membreCourant(c: Ctx): Promise<Membre | null> {
  if (c.cache.has("m")) return c.cache.get("m") as Membre | null;
  const jeton = c.cookies[COOKIE_MEMBRE];
  const m = jeton
    ? await un<Membre>(
        db,
        `SELECT m.id, m.nom, m.tel, m.email::text, m.role, m.statut
           FROM sessions s JOIN membres_agence m ON m.id = s.membre_id
          WHERE s.jeton_hash = $1 AND s.revoquee_le IS NULL AND s.expire_le > now() AND m.statut = 'actif'`, [sha256(jeton)])
    : null;
  c.cache.set("m", m);
  return m;
}
// Un accès révoqué ferme la session immédiatement (statut relu à chaque requête).
export async function exigerMembre(c: Ctx, module?: Module): Promise<Membre> {
  const m = await membreCourant(c);
  if (!m) throw erreur(401, "Connectez-vous au back-office pour continuer.", "non_connecte");
  if (module && !PERMISSIONS[module].includes(m.role)) throw erreur(403, "Votre rôle ne donne pas accès à cette action.");
  return m;
}

export async function journaliser(m: { id: string; nom: string; role: RoleAgence } | null, action: string, cible: string, details?: object, q = db) {
  await q.query(
    "INSERT INTO journal_audit (membre_id, auteur, role, action, cible, details) VALUES ($1,$2,$3,$4,$5,$6)",
    [m?.id ?? null, m?.nom ?? "Système", m ? ROLES_AGENCE[m.role] : "Système", action, cible, details ? JSON.stringify(details) : null]);
}
