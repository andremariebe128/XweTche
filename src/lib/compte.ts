import { api, estNonConnecte } from "./api";
import { creerMagasin } from "./magasin";

// État de l'espace personnel : il vient de l'API (GET /api/moi/etat), plus du navigateur.
// Les types gardent la forme que les pages connaissent déjà.

export type Role = "locataire" | "proprietaire";

export interface Compte {
  tel: string;
  nom: string;
  role: Role;
}

export type StatutVisite = "a-venir" | "a-evaluer" | "satisfait" | "pas-satisfait" | "annulee";

export interface Visite {
  id: string;
  ref: string;
  date: string;
  code: string;
  statut: StatutVisite;
  motif?: string;
  /** Adresse exacte, donnée seulement une fois la visite réservée (7.3). */
  adresse?: string;
  agent?: string;
}

export type StatutCandidature = "envoyee" | "retenue" | "non-retenue" | "bail-signe" | "payee";

export interface Candidature {
  id: string;
  ref: string;
  date: string;
  statut: StatutCandidature;
}

export type Operateur = "MTN MoMo" | "Moov Money" | "Celtiis Cash";

export interface Recu {
  numero: string;
  ref: string;
  montant: number;
  operateur: Operateur;
  tel: string;
  date: string;
  transaction: string;
}

export interface AlerteRecherche {
  id: string;
  resume: string;
  canal: "SMS" | "WhatsApp";
}

export type StatutBien = "en-etude" | "a-corriger" | "controle" | "refusee" | "en-ligne" | "reservee" | "louee";

export interface Candidat {
  id: string;
  nom: string;
  profession: string;
  revenus: string;
  visiteLe: string;
  statut: "en-attente" | "retenu" | "non-retenu";
}

export interface CreneauVisite {
  id: string;
  date: string;
  visiteur: string;
}

export interface Bien {
  ref: string;
  type: string;
  titre: string;
  quartier: string;
  loyer: number;
  statut: StatutBien;
  soumisLe?: string;
  pauseLe?: string;
  motif?: string;
  vues: number;
  visites: CreneauVisite[];
  candidats: Candidat[];
  departLe?: string;
}

export interface Etat {
  compte: Compte | null;
  visitesGratuites: number;
  visites: Visite[];
  candidatures: Candidature[];
  recus: Recu[];
  alertes: AlerteRecherche[];
  biens: Bien[];
}

const VIDE: Etat = { compte: null, visitesGratuites: 0, visites: [], candidatures: [], recus: [], alertes: [], biens: [] };
const magasin = creerMagasin<Etat>(VIDE);
const pret = creerMagasin(false);

export const useEtat = magasin.use;
export const lireEtat = magasin.lire;
/** Faux tant que la session n'a pas été vérifiée auprès de l'API : évite de renvoyer vers /connexion à tort. */
export const useSessionPrete = pret.use;

/** Recharge tout l'espace personnel depuis l'API. À appeler après chaque action (réserver, candidater, payer…). */
export async function rafraichirEtat(): Promise<Etat> {
  try {
    const e = await api.get<Etat>("/moi/etat");
    magasin.definir(e);
    return e;
  } catch (e) {
    if (estNonConnecte(e)) magasin.definir(VIDE);
    else throw e;
    return VIDE;
  }
}

/** Au démarrage du site : la session existe-t-elle encore ? */
export async function amorcerSession() {
  try {
    const { compte } = await api.get<{ compte: Compte | null }>("/moi");
    if (compte) {
      await rafraichirEtat();
      void import("./favoris").then((m) => m.synchroniserFavoris());
    }
  } catch {
    // hors connexion : le site public reste utilisable
  } finally {
    pret.definir(true);
  }
}

// ---------------------------------------------------------------- Connexion en 3 étapes (AUT-01 à AUT-03)
/** Étape 1. En mode démonstration, l'API renvoie le code (codeDemo) au lieu de l'envoyer par SMS. */
export const demanderCode = (tel: string) => api.post<{ codeDemo?: string }>("/auth/otp", { tel });

export interface ResultatVerification {
  existe: boolean;
  compte?: Compte;
  preuve?: string;
}
/** Étape 2. Compte existant : la session est ouverte. Sinon : une preuve à présenter à inscrire(). */
export async function verifierCode(tel: string, code: string) {
  const r = await api.post<ResultatVerification>("/auth/verifier", { tel, code });
  if (r.existe) await finirConnexion();
  return r;
}
/** Étape 3, nouveaux comptes seulement. */
export async function inscrire(preuve: string, nom: string, role: Role) {
  await api.post("/auth/inscription", { preuve, nom, role });
  await finirConnexion();
}
async function finirConnexion() {
  await rafraichirEtat();
  void import("./favoris").then((m) => m.synchroniserFavoris());
}

export async function deconnecter() {
  await api.post("/auth/deconnexion").catch(() => {});
  magasin.definir(VIDE);
}

/** Passer de locataire à propriétaire (AUT-03) : le second rôle s'ajoute au premier. */
export async function changerRole(role: Role) {
  await api.patch("/moi", { role });
  await rafraichirEtat();
}

// ---------------------------------------------------------------- Utilitaires d'affichage (inchangés)
export function dateCourte(iso: string) {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

export function dateHeure(iso: string) {
  const d = new Date(iso);
  const jours = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
  return `${jours[d.getDay()]} ${dateCourte(iso)} à ${d.getHours().toString().padStart(2, "0")}h${d.getMinutes().toString().padStart(2, "0")}`;
}

// Temps restant sur les 48 h d'étude, en heures (le compte à rebours se met en pause pendant les corrections).
// L'API renvoie soumisLe déjà décalé des pauses précédentes : le calcul reste « fin − soumisLe ».
export function heuresRestantes(b: Bien, maintenant = Date.now()) {
  if (!b.soumisLe) return 48;
  const fin = b.pauseLe ? new Date(b.pauseLe).getTime() : maintenant;
  const ecoulees = (fin - new Date(b.soumisLe).getTime()) / 3600000;
  return Math.max(0, Math.round(48 - ecoulees));
}

// Numéro masqué pour l'affichage : seuls les 2 derniers chiffres restent lisibles.
export function telMasque(tel: string) {
  const c = tel.replace(/\D/g, "");
  return `+229 ${c.slice(0, -2).replace(/\d/g, "•").replace(/(.{2})/g, "$1 ").trim()} ${c.slice(-2)}`;
}

export function telLisible(tel: string) {
  return `+229 ${tel.replace(/\D/g, "").replace(/(\d{2})(?=\d)/g, "$1 ")}`;
}
