import { api } from "./api";
import type { Operateur } from "./compte";
import { creerMagasin } from "./magasin";
import { telLisible } from "./compte";
import type { Theme } from "../data/aide";

// Back-office de l'agence (8.5). Les données viennent de l'API (GET /api/agence/etat), filtrées selon le rôle :
// un module non autorisé arrive vide, et l'API refuse de toute façon les actions interdites.

export type RoleAgence = "etude" | "terrain" | "finance" | "support" | "admin";

export const ROLES_AGENCE: Record<RoleAgence, string> = {
  etude: "Agent d'étude",
  terrain: "Agent terrain",
  finance: "Finance",
  support: "Support client",
  admin: "Responsable agence",
};

export type Module =
  | "tableau" | "etude" | "annonces" | "terrain" | "utilisateurs" | "visites" | "baux"
  | "signalements" | "parametres" | "messages" | "contenus" | "equipe" | "journal";

// Rôles et permissions (BO-13) : même matrice que l'API (server/auth.ts), qui reste la source de vérité.
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

export type CanalInvitation = "SMS" | "E-mail";
export type StatutMembre = "invite" | "actif" | "revoque";

export interface Membre {
  id: string;
  nom: string;
  tel: string;
  email?: string;
  role: RoleAgence;
  statut: StatutMembre;
  // Le lien d'invitation n'est connu qu'au moment de l'envoi (l'API n'en garde que l'empreinte).
  invitation?: { envoyeLe: string; expireLe: string; par: string; canaux: CanalInvitation[] };
}

export type StatutDossier = "en-etude" | "a-corriger" | "controle" | "en-ligne" | "refusee" | "louee";

export interface Dossier {
  ref: string;
  type: string;
  quartier: string;
  reperes: string;
  loyer: number;
  avanceMois: number;
  cautionMois: number;
  charges: number;
  proprietaire: string;
  telProprietaire: string;
  gestionnaire: boolean;
  soumisLe: string;
  pauseLe?: string;
  statut: StatutDossier;
  photos: number;
  documents: { identite: boolean; propriete: boolean; mandat?: boolean };
  // Vérification automatique préalable (BO-04)
  auto: { photosNettes: boolean; champsComplets: boolean; doublonPhoto: boolean; doublonAdresse: boolean };
  checklist: Record<string, boolean>;
  motif?: string;
  etudiePar?: string;
  agentTerrain?: string;
  controleLe?: string;
  controle?: { fait: boolean; conforme?: boolean; note?: string };
  enLigneLe?: string;
}

export interface Utilisateur {
  id: string;
  nom: string;
  tel: string;
  role: "locataire" | "proprietaire";
  inscritLe: string;
  identite: "verifiee" | "en-attente" | "refusee" | "non-demandee";
  statut: "actif" | "suspendu";
  motifSuspension?: string;
}

export interface VisiteAgence {
  id: string;
  ref: string;
  locataire: string;
  date: string;
  agent: string;
  statut: "prevue" | "faite" | "absent" | "annulee";
  presence?: "QR code" | "GPS";
  avis?: "satisfait" | "pas-satisfait";
  motif?: string;
}

export interface Bail {
  id: string;
  ref: string;
  locataire: string;
  proprietaire: string;
  loyer: number;
  commission: number;
  statut: "a-signer" | "signe" | "paye";
  signeLe?: string;
  paiement?: { id: string; moyen: Operateur | "Espèces"; date: string; recu: string; transaction: string; saisiPar?: string };
}

export interface SignalementAgence {
  id: string;
  numero: string;
  date: string;
  motif: string;
  detail: string;
  ref?: string;
  tel?: string;
  statut: "nouveau" | "en-cours" | "resolu" | "rejete";
  assigne?: string;
  assigneId?: string;
  decision?: string;
}

export interface Modele {
  id: string;
  nom: string;
  canal: "SMS" | "WhatsApp" | "E-mail";
  texte: string;
}

export interface EntreeJournal {
  id: string;
  date: string;
  auteur: string;
  role: string;
  action: string;
  cible: string;
}

export interface Agence {
  /** Identifiant du membre connecté (null si personne). */
  session: string | null;
  moi?: { id: string; nom: string; tel: string; role: RoleAgence };
  equipe: Membre[];
  dossiers: Dossier[];
  utilisateurs: Utilisateur[];
  visites: VisiteAgence[];
  baux: Bail[];
  signalements: SignalementAgence[];
  modeles: Modele[];
  journal: EntreeJournal[];
  contenus: { banniere: { actif: boolean; texte: string }; faq: Theme[] };
}

export const CHECKLIST = [
  "Les photos montrent bien le bien décrit (façade, pièces, sanitaires)",
  "Le type de logement et le nombre de pièces correspondent aux photos",
  "Le loyer est cohérent avec le quartier et le type",
  "L'avance et la caution respectent la charte (6 mois cumulés au plus)",
  "Les repères permettent de trouver le logement",
  "La pièce d'identité correspond au nom du compte",
  "Le document de propriété ou le mandat est lisible et au bon nom",
];

const VIDE: Agence = {
  session: null, equipe: [], dossiers: [], utilisateurs: [], visites: [], baux: [], signalements: [], modeles: [], journal: [],
  contenus: { banniere: { actif: false, texte: "" }, faq: [] },
};
const magasin = creerMagasin<Agence>(VIDE);
const pret = creerMagasin(false);

export const useAgence = magasin.use;
export const lireAgence = magasin.lire;
export const useAgencePrete = pret.use;

export async function rafraichirAgence() {
  try {
    magasin.definir(await api.get<Agence>("/agence/etat"));
  } catch {
    magasin.definir(VIDE);
  }
}

/** Au démarrage du back-office : une session de membre existe-t-elle encore ? */
export async function amorcerAgence() {
  try {
    const { membre } = await api.get<{ membre: Membre | null }>("/agence/moi");
    if (membre) await rafraichirAgence();
  } finally {
    pret.definir(true);
  }
}

/** Membre connecté, ou null. Un accès révoqué ferme la session dès la requête suivante. */
export function useMembre() {
  const a = useAgence();
  return a.moi && a.session ? { ...a.moi, statut: "actif" as const } : null;
}

export function peut(role: RoleAgence | undefined, module: Module) {
  return !!role && PERMISSIONS[module].includes(role);
}

// ---------------------------------------------------------------- Connexion à double facteur (numéro professionnel + code SMS)
export const demanderCodeAgence = (tel: string) => api.post<{ codeDemo?: string }>("/agence/otp", { tel });
export async function verifierCodeAgence(tel: string, code: string) {
  await api.post("/agence/verifier", { tel, code });
  await rafraichirAgence();
}
export async function deconnecterAgence() {
  await api.post("/agence/deconnexion").catch(() => {});
  magasin.definir(VIDE);
}

// ---------------------------------------------------------------- Invitations (BO-13)
export interface InfosInvitation {
  nom: string;
  role: RoleAgence;
  tel: string;
  par: string;
  expireLe: string;
}
/** Lève une ApiError 404 si le lien a expiré, a servi ou a été annulé. */
export const infosInvitation = (jeton: string) => api.get<InfosInvitation>(`/agence/invitation/${jeton}`);
export const demanderCodeInvitation = (jeton: string) => api.post<{ codeDemo?: string }>(`/agence/invitation/${jeton}/otp`);
export async function activerInvitation(jeton: string, code: string) {
  await api.post(`/agence/invitation/${jeton}/activer`, { code });
  await rafraichirAgence();
}

export interface InvitationEnvoyee {
  id?: string;
  lien: string;
  expireLe: string;
  canaux: CanalInvitation[];
}
export async function inviterMembre(p: { nom: string; tel: string; email?: string; role: RoleAgence; canaux: CanalInvitation[] }) {
  const r = await api.post<InvitationEnvoyee>("/agence/equipe/inviter", p);
  await rafraichirAgence();
  return r;
}
export async function renvoyerInvitation(id: string, canaux?: CanalInvitation[]) {
  const r = await api.post<InvitationEnvoyee>(`/agence/equipe/${id}/renvoyer`, canaux ? { canaux } : {});
  await rafraichirAgence();
  return r;
}
export async function revoquerAcces(id: string) {
  await api.post(`/agence/equipe/${id}/revoquer`);
  await rafraichirAgence();
}
export async function changerRoleMembre(id: string, role: RoleAgence) {
  await api.patch(`/agence/equipe/${id}`, { role });
  await rafraichirAgence();
}

// ---------------------------------------------------------------- Étude et contrôle (BO-01 à BO-05)
export async function enregistrerChecklist(ref: string, checklist: Record<string, boolean>) {
  await api.put(`/agence/dossiers/${ref}/checklist`, { checklist });
  await rafraichirAgence();
}
export async function deciderDossier(ref: string, decision: "valider" | "refuser" | "corriger", motif?: string, checklist?: Record<string, boolean>) {
  await api.post(`/agence/dossiers/${ref}/decision`, { decision, motif, checklist });
  await rafraichirAgence();
}
export async function attribuerControle(ref: string, agentId: string, controleLe?: string) {
  await api.post(`/agence/dossiers/${ref}/attribuer`, { agentId, controleLe });
  await rafraichirAgence();
}
export interface ResultatControle {
  conforme: boolean;
  note?: string;
  checklist?: Record<string, boolean>;
  compteurEau?: string;
  compteurElec?: string;
  lat?: number;
  lng?: number;
  photos?: { cle: string; cleOriginale?: string; legende?: string; largeur: number; hauteur: number; empreinte?: string }[];
}
export async function enregistrerControle(ref: string, r: ResultatControle) {
  await api.post(`/agence/dossiers/${ref}/controle`, r);
  await rafraichirAgence();
}

// ---------------------------------------------------------------- Utilisateurs, visites, baux, signalements
export async function verifierIdentite(id: string, decision: "valider" | "refuser", motif?: string) {
  await api.post(`/agence/utilisateurs/${id}/identite`, { decision, motif });
  await rafraichirAgence();
}
export async function suspendreUtilisateur(id: string, motif: string) {
  await api.post(`/agence/utilisateurs/${id}/suspendre`, { motif });
  await rafraichirAgence();
}
export async function reactiverUtilisateur(id: string) {
  await api.post(`/agence/utilisateurs/${id}/reactiver`);
  await rafraichirAgence();
}
export async function validerPresence(id: string, preuve: "qr" | "gps", extra: { code?: string; lat?: number; lng?: number } = {}) {
  await api.post(`/agence/visites/${id}/presence`, { preuve, ...extra });
  await rafraichirAgence();
}
export async function marquerAbsent(id: string) {
  await api.post(`/agence/visites/${id}/absent`);
  await rafraichirAgence();
}
export async function changerAgentVisite(id: string, agentId: string) {
  await api.post(`/agence/visites/${id}/agent`, { agentId });
  await rafraichirAgence();
}
export async function encaisserEspeces(bailId: string) {
  const r = await api.post<{ recu?: string }>(`/agence/baux/${bailId}/especes`);
  await rafraichirAgence();
  return r;
}
export async function rembourserCommission(paiementId: string, motif: string) {
  await api.post(`/agence/paiements/${paiementId}/rembourser`, { motif });
  await rafraichirAgence();
}
export async function traiterSignalement(id: string, p: { statut: SignalementAgence["statut"]; assigneId?: string; decision?: string }) {
  await api.post(`/agence/signalements/${id}`, p);
  await rafraichirAgence();
}

// ---------------------------------------------------------------- Messages (BO-14)
export async function enregistrerModele(id: string, texte: string) {
  await api.put(`/agence/modeles/${id}`, { texte });
  await rafraichirAgence();
}

// ---------------------------------------------------------------- Utilitaires (inchangés)
export function heuresRestantesDossier(d: Dossier, delaiEtude: number, maintenant = Date.now()) {
  const fin = d.pauseLe ? new Date(d.pauseLe).getTime() : maintenant;
  const ecoulees = (fin - new Date(d.soumisLe).getTime()) / 3600000;
  return Math.round(delaiEtude - ecoulees);
}

export const invitationExpiree = (m: Membre) => !!m.invitation && new Date(m.invitation.expireLe).getTime() < Date.now();

export function dateFr(iso: string, heure = true) {
  const d = new Date(iso);
  const j = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
  return heure ? `${j} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : j;
}

// Export Excel (CSV avec séparateur « ; » et BOM pour les accents)
export function exporterCSV(nom: string, entetes: string[], lignes: (string | number)[][]) {
  const echap = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const contenu = "﻿" + [entetes, ...lignes].map((l) => l.map(echap).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenu], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nom}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export { telLisible };
