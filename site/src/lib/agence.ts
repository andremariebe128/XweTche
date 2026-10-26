import { majEtat, telLisible, type Operateur, type StatutBien } from "./compte";
import { lireParametres } from "./parametres";
import { creerStore } from "./stockage";

// Données du back-office de l'agence (8.5), simulées dans le navigateur en attendant l'API.

export type RoleAgence = "etude" | "terrain" | "finance" | "support" | "admin";

export const ROLES_AGENCE: Record<RoleAgence, string> = {
  etude: "Agent d'étude",
  terrain: "Agent terrain",
  finance: "Finance",
  support: "Support client",
  admin: "Responsable agence",
};

export type Module =
  | "tableau"
  | "etude"
  | "annonces"
  | "terrain"
  | "utilisateurs"
  | "visites"
  | "baux"
  | "signalements"
  | "parametres"
  | "messages"
  | "contenus"
  | "equipe"
  | "journal";

// Rôles et permissions (BO-12) : chaque membre ne voit que les modules de son métier.
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

export interface Membre {
  id: string;
  nom: string;
  tel: string;
  email?: string;
  role: RoleAgence;
  statut: StatutMembre;
  // Lien d'invitation envoyé par SMS et/ou e-mail ; un nouvel envoi rend l'ancien lien inutilisable.
  invitation?: { jeton: string; envoyeLe: string; expireLe: string; par: string; canaux: CanalInvitation[] };
}

export type CanalInvitation = "SMS" | "E-mail";

// Accès sur invitation (BO-12) : le responsable invite, la personne active son accès avec le lien, l'accès peut être révoqué.
export type StatutMembre = "invite" | "actif" | "revoque";

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
  paiement?: { moyen: Operateur | "Espèces"; date: string; recu: string; transaction: string; saisiPar?: string };
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
  session: string | null;
  equipe: Membre[];
  dossiers: Dossier[];
  utilisateurs: Utilisateur[];
  visites: VisiteAgence[];
  baux: Bail[];
  signalements: SignalementAgence[];
  modeles: Modele[];
  journal: EntreeJournal[];
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

const h = 3600 * 1000;
const ilYa = (heures: number) => new Date(Date.now() - heures * h).toISOString();
const dans = (heures: number) => new Date(Date.now() + heures * h).toISOString();
const ident = () => Math.random().toString(36).slice(2, 10);

function dossier(p: Partial<Dossier> & Pick<Dossier, "ref" | "type" | "quartier" | "loyer" | "proprietaire" | "soumisLe" | "statut">): Dossier {
  return {
    reperes: "",
    avanceMois: 3,
    cautionMois: 2,
    charges: 0,
    telProprietaire: "0190000000",
    gestionnaire: false,
    photos: 8,
    documents: { identite: true, propriete: true },
    auto: { photosNettes: true, champsComplets: true, doublonPhoto: false, doublonAdresse: false },
    checklist: {},
    ...p,
  };
}

const DUREE_INVITATION = 72 * h;

function invitationNeuve(par: string, canaux: CanalInvitation[], envoyeLe = new Date().toISOString()) {
  const jeton = Array.from({ length: 3 }, ident).join("");
  return { jeton, envoyeLe, expireLe: new Date(new Date(envoyeLe).getTime() + DUREE_INVITATION).toISOString(), par, canaux };
}

// Messages d'invitation, modifiables dans « Modèles de messages ».
const MODELES_INVITATION: Modele[] = [
  { id: "invitation-sms", nom: "Invitation membre", canal: "SMS", texte: "XweTche : {par} vous invite au back-office avec le rôle « {role} ». Activez votre accès avant le {expire} : {lien}" },
  {
    id: "invitation-email",
    nom: "Invitation membre",
    canal: "E-mail",
    texte:
      "Objet : Votre accès au back-office Xwé Tché\n\nBonjour {prenom},\n\n{par} vous invite à rejoindre le back-office Xwé Tché avec le rôle « {role} ».\n\nActivez votre accès avec ce lien, valable jusqu'au {expire} : {lien}\n\nVous recevrez un code par SMS au {tel} pour confirmer. Si vous n'attendiez pas cette invitation, ignorez ce message.\n\nL'équipe Xwé Tché",
  },
];

function donneesInitiales(): Agence {
  const equipe: Membre[] = [
    { id: "m1", nom: "Clarisse Ahouandjinou", tel: "0161000001", email: "clarisse@xwetche.bj", role: "admin", statut: "actif" },
    { id: "m2", nom: "Fabrice Dossa", tel: "0161000002", email: "fabrice@xwetche.bj", role: "etude", statut: "actif" },
    { id: "m3", nom: "Nadège Kpadonou", tel: "0161000003", email: "nadege@xwetche.bj", role: "etude", statut: "actif" },
    { id: "m4", nom: "Serge Houngbo", tel: "0161000004", email: "serge@xwetche.bj", role: "terrain", statut: "actif" },
    { id: "m5", nom: "Rachidatou Bello", tel: "0161000005", email: "rachidatou@xwetche.bj", role: "terrain", statut: "actif" },
    { id: "m6", nom: "Brice Tossou", tel: "0161000006", email: "brice@xwetche.bj", role: "finance", statut: "actif" },
    { id: "m7", nom: "Mireille Zinsou", tel: "0161000007", email: "mireille@xwetche.bj", role: "support", statut: "actif" },
    { id: "m8", nom: "Ulrich Agossou", tel: "0161000008", email: "ulrich@xwetche.bj", role: "terrain", statut: "revoque" },
    {
      id: "m9",
      nom: "Pélagie Akakpo",
      tel: "0161000009",
      email: "pelagie.akakpo@gmail.com",
      role: "support",
      statut: "invite",
      invitation: invitationNeuve("Clarisse Ahouandjinou", ["SMS", "E-mail"], ilYa(5)),
    },
  ];
  const dossiers: Dossier[] = [
    dossier({ ref: "XT-0415", type: "Studio", quartier: "Cadjèhoun", loyer: 70000, proprietaire: "Koffi Agbo", reperes: "Derrière la station Oryx, portail gris", soumisLe: ilYa(17), statut: "en-etude" }),
    dossier({ ref: "XT-0362", type: "Chambre-salon", quartier: "Akpakpa", loyer: 35000, proprietaire: "Koffi Agbo", soumisLe: ilYa(30), pauseLe: ilYa(10), statut: "a-corriger", motif: "2 photos sont floues (cuisine, douche). Remplacez-les pour renvoyer l'annonce en étude.", etudiePar: "Fabrice Dossa", auto: { photosNettes: false, champsComplets: true, doublonPhoto: false, doublonAdresse: false } }),
    dossier({ ref: "XT-0421", type: "Appartement", quartier: "Haie Vive", loyer: 250000, avanceMois: 3, cautionMois: 3, proprietaire: "Hortense Gbaguidi", reperes: "Rue de l'ambassade, immeuble beige", soumisLe: ilYa(41), statut: "en-etude", photos: 12 }),
    dossier({ ref: "XT-0423", type: "Entrée-couchée", quartier: "Agla", loyer: 18000, avanceMois: 6, cautionMois: 2, proprietaire: "Théophile Ahokpè", soumisLe: ilYa(44), statut: "en-etude", photos: 5, auto: { photosNettes: true, champsComplets: false, doublonPhoto: false, doublonAdresse: false } }),
    dossier({ ref: "XT-0426", type: "Chambre-salon", quartier: "Godomey", loyer: 40000, proprietaire: "Pélagie Dansou", gestionnaire: true, documents: { identite: true, propriete: true, mandat: false }, soumisLe: ilYa(6), statut: "en-etude" }),
    dossier({ ref: "XT-0427", type: "Maison", quartier: "Calavi Kpota", loyer: 120000, proprietaire: "Gérard Hounsou", soumisLe: ilYa(2), statut: "en-etude", auto: { photosNettes: true, champsComplets: true, doublonPhoto: true, doublonAdresse: false } }),
    dossier({ ref: "XT-0419", type: "Studio", quartier: "Zogbo", loyer: 55000, proprietaire: "Edwige Sossou", soumisLe: ilYa(70), statut: "controle", etudiePar: "Nadège Kpadonou", agentTerrain: "Serge Houngbo", controleLe: dans(20), controle: { fait: false } }),
    dossier({ ref: "XT-0417", type: "Chambre-salon", quartier: "Vêdoko", loyer: 38000, proprietaire: "Aimé Adjovi", soumisLe: ilYa(90), statut: "controle", etudiePar: "Fabrice Dossa", controle: { fait: false } }),
    dossier({ ref: "XT-0412", type: "Chambre-salon", quartier: "Fidjrossè", loyer: 45000, avanceMois: 3, cautionMois: 1, proprietaire: "Koffi Agbo", soumisLe: ilYa(400), statut: "en-ligne", etudiePar: "Nadège Kpadonou", agentTerrain: "Rachidatou Bello", controleLe: ilYa(330), controle: { fait: true, conforme: true }, enLigneLe: ilYa(320) }),
    dossier({ ref: "XT-0398", type: "Appartement", quartier: "Haie Vive", loyer: 180000, proprietaire: "Hortense Gbaguidi", soumisLe: ilYa(600), statut: "en-ligne", etudiePar: "Fabrice Dossa", agentTerrain: "Serge Houngbo", controle: { fait: true, conforme: true }, enLigneLe: ilYa(520) }),
    dossier({ ref: "XT-0366", type: "Chambre-salon", quartier: "Gbégamey", loyer: 40000, proprietaire: "Koffi Agbo", soumisLe: ilYa(900), statut: "louee", etudiePar: "Nadège Kpadonou", controle: { fait: true, conforme: true }, enLigneLe: ilYa(850) }),
    dossier({ ref: "XT-0411", type: "Studio", quartier: "Missèbo", loyer: 30000, proprietaire: "Inconnu Tchibozo", soumisLe: ilYa(200), statut: "refusee", motif: "Documents de propriété insuffisants", etudiePar: "Fabrice Dossa", documents: { identite: true, propriete: false } }),
  ];
  const utilisateurs: Utilisateur[] = [
    { id: "u1", nom: "Koffi Agbo", tel: "0166554433", role: "proprietaire", inscritLe: ilYa(1200), identite: "verifiee", statut: "actif" },
    { id: "u2", nom: "Hortense Gbaguidi", tel: "0197441122", role: "proprietaire", inscritLe: ilYa(2000), identite: "verifiee", statut: "actif" },
    { id: "u3", nom: "Pélagie Dansou", tel: "0195221133", role: "proprietaire", inscritLe: ilYa(30), identite: "en-attente", statut: "actif" },
    { id: "u4", nom: "Gérard Hounsou", tel: "0162887744", role: "proprietaire", inscritLe: ilYa(5), identite: "en-attente", statut: "actif" },
    { id: "u5", nom: "Inconnu Tchibozo", tel: "0151000999", role: "proprietaire", inscritLe: ilYa(220), identite: "refusee", statut: "suspendu", motifSuspension: "Faux document de propriété" },
    { id: "u6", nom: "Awa Dossou", tel: "0197123456", role: "locataire", inscritLe: ilYa(300), identite: "verifiee", statut: "actif" },
    { id: "u7", nom: "Esther Dégbé", tel: "0196334455", role: "locataire", inscritLe: ilYa(150), identite: "verifiee", statut: "actif" },
    { id: "u8", nom: "Rodolphe Kiki", tel: "0167112233", role: "locataire", inscritLe: ilYa(120), identite: "en-attente", statut: "actif" },
    { id: "u9", nom: "Mariam Salami", tel: "0154778899", role: "locataire", inscritLe: ilYa(48), identite: "non-demandee", statut: "actif" },
    { id: "u10", nom: "Gildas Hounkpè", tel: "0190556677", role: "locataire", inscritLe: ilYa(20), identite: "non-demandee", statut: "actif" },
    { id: "u11", nom: "Koffi Amoussou", tel: "0161443322", role: "locataire", inscritLe: ilYa(400), identite: "verifiee", statut: "actif" },
  ];
  const visites: VisiteAgence[] = [
    { id: ident(), ref: "XT-0412", locataire: "Koffi Amoussou", date: dans(17), agent: "Rachidatou Bello", statut: "prevue" },
    { id: ident(), ref: "XT-0412", locataire: "Mariam Salami", date: dans(24), agent: "Rachidatou Bello", statut: "prevue" },
    { id: ident(), ref: "XT-0409", locataire: "Awa Dossou", date: dans(44), agent: "Serge Houngbo", statut: "prevue" },
    { id: ident(), ref: "XT-0412", locataire: "Gildas Hounkpè", date: dans(70), agent: "Rachidatou Bello", statut: "prevue" },
    { id: ident(), ref: "XT-0398", locataire: "Awa Dossou", date: ilYa(46), agent: "Serge Houngbo", statut: "faite", presence: "QR code" },
    { id: ident(), ref: "XT-0412", locataire: "Esther Dégbé", date: ilYa(70), agent: "Rachidatou Bello", statut: "faite", presence: "QR code", avis: "satisfait" },
    { id: ident(), ref: "XT-0412", locataire: "Rodolphe Kiki", date: ilYa(46), agent: "Rachidatou Bello", statut: "faite", presence: "GPS", avis: "satisfait" },
    { id: ident(), ref: "XT-0405", locataire: "Awa Dossou", date: ilYa(214), agent: "Serge Houngbo", statut: "faite", presence: "QR code", avis: "pas-satisfait", motif: "Photos non conformes" },
    { id: ident(), ref: "XT-0390", locataire: "Esther Dégbé", date: ilYa(260), agent: "Serge Houngbo", statut: "faite", presence: "QR code", avis: "pas-satisfait", motif: "Prix" },
    { id: ident(), ref: "XT-0377", locataire: "Koffi Amoussou", date: ilYa(300), agent: "Rachidatou Bello", statut: "faite", presence: "GPS", avis: "pas-satisfait", motif: "Quartier" },
    { id: ident(), ref: "XT-0388", locataire: "Mariam Salami", date: ilYa(330), agent: "Serge Houngbo", statut: "faite", presence: "QR code", avis: "satisfait" },
    { id: ident(), ref: "XT-0401", locataire: "Gildas Hounkpè", date: ilYa(150), agent: "Rachidatou Bello", statut: "absent" },
    { id: ident(), ref: "XT-0366", locataire: "Koffi Amoussou", date: ilYa(800), agent: "Serge Houngbo", statut: "faite", presence: "QR code", avis: "satisfait" },
    { id: ident(), ref: "XT-0390", locataire: "Rodolphe Kiki", date: ilYa(100), agent: "Serge Houngbo", statut: "annulee" },
  ];
  const baux: Bail[] = [
    { id: ident(), ref: "XT-0412", locataire: "Esther Dégbé", proprietaire: "Koffi Agbo", loyer: 45000, commission: 22500, statut: "a-signer" },
    { id: ident(), ref: "XT-0366", locataire: "Koffi Amoussou", proprietaire: "Koffi Agbo", loyer: 40000, commission: 20000, statut: "paye", signeLe: ilYa(700), paiement: { moyen: "MTN MoMo", date: ilYa(699), recu: "XT-R-2026-104233", transaction: "MT8812004471" } },
    { id: ident(), ref: "XT-0354", locataire: "Fatou Alassane", proprietaire: "Hortense Gbaguidi", loyer: 90000, commission: 45000, statut: "paye", signeLe: ilYa(160), paiement: { moyen: "Moov Money", date: ilYa(159), recu: "XT-R-2026-118902", transaction: "MO5530918822" } },
    { id: ident(), ref: "XT-0349", locataire: "Jules Fanou", proprietaire: "Aimé Adjovi", loyer: 30000, commission: 15000, statut: "paye", signeLe: ilYa(90), paiement: { moyen: "Espèces", date: ilYa(88), recu: "XT-R-2026-120415", transaction: "ESP-0007", saisiPar: "Brice Tossou" } },
    { id: ident(), ref: "XT-0343", locataire: "Sandrine Hodonou", proprietaire: "Edwige Sossou", loyer: 60000, commission: 30000, statut: "paye", signeLe: ilYa(40), paiement: { moyen: "Celtiis Cash", date: ilYa(39), recu: "XT-R-2026-121007", transaction: "CE2209174450" } },
    { id: ident(), ref: "XT-0340", locataire: "Paulin Gnonlonfoun", proprietaire: "Gérard Hounsou", loyer: 75000, commission: 37500, statut: "signe", signeLe: ilYa(20) },
  ];
  const signalements: SignalementAgence[] = [
    { id: ident(), numero: "SG-4127", date: ilYa(3), motif: "On m'a demandé de l'argent avant la visite", detail: "Un homme se disant agent Xwé Tché m'a demandé 5 000 FCFA par WhatsApp pour « bloquer » la visite.", ref: "XT-0412", tel: "0154778899", statut: "nouveau" },
    { id: ident(), numero: "SG-4119", date: ilYa(20), motif: "Faux compte ou faux numéro se réclamant de Xwé Tché", detail: "Page Facebook « Xwé Tché Location Cotonou » qui publie des annonces avec numéro personnel.", statut: "en-cours", assigne: "Mireille Zinsou" },
    { id: ident(), numero: "SG-4102", date: ilYa(70), motif: "Déjà loué", detail: "Le gardien dit que le logement est occupé depuis un mois.", ref: "XT-0390", statut: "en-cours", assigne: "Mireille Zinsou" },
    { id: ident(), numero: "SG-4088", date: ilYa(160), motif: "Photos non conformes à la réalité", detail: "La cuisine n'existe pas, c'est un coin dans la cour.", ref: "XT-0405", statut: "resolu", assigne: "Mireille Zinsou", decision: "Annonce suspendue, photos de contrôle refaites par l'agent terrain." },
    { id: ident(), numero: "SG-4061", date: ilYa(300), motif: "Autre", detail: "Je voulais juste savoir si on peut visiter le dimanche.", statut: "rejete", assigne: "Mireille Zinsou", decision: "Pas un signalement : réponse envoyée par le support." },
  ];
  const modeles: Modele[] = [
    ...MODELES_INVITATION,
    { id: "visite-confirmee", nom: "Visite confirmée", canal: "SMS", texte: "XweTche : visite confirmée le {date} à {heure}. Code {code}. Adresse : {adresse}. Ne payez rien avant la visite." },
    { id: "visite-rappel", nom: "Rappel la veille", canal: "WhatsApp", texte: "Bonjour {prenom}, rappel de votre visite demain à {heure} ({quartier}). Votre agent : {agent}. Empêché ? Annulez avant {limite}." },
    { id: "avis", nom: "Avis après visite", canal: "SMS", texte: "XweTche : comment s'est passée la visite de {ref} ? Répondez sur {lien}. « Pas satisfait » = prochaine visite gratuite." },
    { id: "annonce-validee", nom: "Annonce validée", canal: "SMS", texte: "XweTche : votre annonce {ref} est validée. Un agent passera pour le contrôle sur place le {date}." },
    { id: "correction", nom: "Correction demandée", canal: "WhatsApp", texte: "Bonjour {prenom}, votre annonce {ref} demande une correction : {motif}. Le compte à rebours reprend dès votre envoi." },
    { id: "paiement", nom: "Paiement reçu", canal: "SMS", texte: "XweTche : paiement de {montant} reçu ({moyen}). Reçu n° {recu}. Bienvenue chez vous !" },
    { id: "liberation", nom: "Logement bientôt libre", canal: "SMS", texte: "XweTche : le logement {ref} à {quartier} se libère le {date}. Réservez une visite : {lien}. STOP pour arrêter." },
  ];
  const journal: EntreeJournal[] = [
    { id: ident(), date: ilYa(10), auteur: "Fabrice Dossa", role: "Agent d'étude", action: "Correction demandée", cible: "XT-0362 · 2 photos floues" },
    { id: ident(), date: ilYa(20), auteur: "Mireille Zinsou", role: "Support client", action: "Signalement pris en charge", cible: "SG-4119" },
    { id: ident(), date: ilYa(39), auteur: "Système", role: "Paiement", action: "Paiement Celtiis Cash reçu", cible: "XT-0343 · 30 000 FCFA" },
    { id: ident(), date: ilYa(60), auteur: "Nadège Kpadonou", role: "Agent d'étude", action: "Annonce validée, contrôle terrain attribué", cible: "XT-0419 → Serge Houngbo" },
    { id: ident(), date: ilYa(88), auteur: "Brice Tossou", role: "Finance", action: "Paiement en espèces enregistré", cible: "XT-0349 · 15 000 FCFA" },
    { id: ident(), date: ilYa(200), auteur: "Fabrice Dossa", role: "Agent d'étude", action: "Annonce refusée", cible: "XT-0411 · Documents de propriété insuffisants" },
    { id: ident(), date: ilYa(210), auteur: "Clarisse Ahouandjinou", role: "Responsable agence", action: "Compte suspendu", cible: "Inconnu Tchibozo · Faux document de propriété" },
  ];
  return { session: null, equipe, dossiers, utilisateurs, visites, baux, signalements, modeles, journal };
}

const store = creerStore<Agence>("xt-agence", donneesInitiales);
export const useAgence = store.use;
export const majAgence = store.maj;
export const reinitialiserAgence = store.reinitialiser;

// Données enregistrées avant les invitations : l'ancien drapeau « actif » devient un statut, les modèles d'invitation sont ajoutés.
if (store.lire().equipe.some((m) => !m.statut))
  majAgence((a) => ({ ...a, equipe: a.equipe.map((m) => (m.statut ? m : { ...m, statut: (m as Membre & { actif?: boolean }).actif ? "actif" : "revoque" })) }));
if (!store.lire().modeles.some((m) => m.id === "invitation-sms")) majAgence((a) => ({ ...a, modeles: [...MODELES_INVITATION, ...a.modeles] }));

// Un accès révoqué ferme la session immédiatement.
export function useMembre() {
  const a = useAgence();
  return a.equipe.find((m) => m.id === a.session && m.statut === "actif") ?? null;
}

export const lienInvitation = (jeton: string) => `${window.location.origin}/agence/invitation/${jeton}`;
export const invitationExpiree = (m: Membre) => !!m.invitation && new Date(m.invitation.expireLe).getTime() < Date.now();

export function membreParInvitation(jeton: string | undefined) {
  return store.lire().equipe.find((m) => m.statut === "invite" && m.invitation?.jeton === jeton) ?? null;
}

const nomSession = () => {
  const a = store.lire();
  return a.equipe.find((m) => m.id === a.session)?.nom ?? "Système";
};

const majMembre = (id: string, f: (m: Membre) => Membre) => majAgence((a) => ({ ...a, equipe: a.equipe.map((m) => (m.id === id ? f(m) : m)) }));

const canauxDisponibles = (m: Pick<Membre, "email">, canaux: CanalInvitation[]) => canaux.filter((c) => c === "SMS" || !!m.email);

// Texte réellement envoyé, construit à partir du modèle du canal.
export function messageInvitation(m: Membre, canal: CanalInvitation) {
  const modele = store.lire().modeles.find((x) => x.id === (canal === "SMS" ? "invitation-sms" : "invitation-email"));
  if (!modele || !m.invitation) return "";
  const valeurs: Record<string, string> = {
    prenom: m.nom.split(" ")[0],
    par: m.invitation.par,
    role: ROLES_AGENCE[m.role],
    lien: lienInvitation(m.invitation.jeton),
    expire: dateFr(m.invitation.expireLe),
    tel: telLisible(m.tel),
  };
  return modele.texte.replace(/\{(\w+)\}/g, (tout, cle: string) => valeurs[cle] ?? tout);
}

export function inviterMembre(p: { nom: string; tel: string; email?: string; role: RoleAgence; canaux: CanalInvitation[] }) {
  const { canaux, ...infos } = p;
  const membre: Membre = { id: `m${Date.now()}`, ...infos, statut: "invite", invitation: invitationNeuve(nomSession(), canauxDisponibles(infos, canaux)) };
  majAgence((a) => ({ ...a, equipe: [...a.equipe, membre] }));
  journaliser("Invitation envoyée", `${p.nom} · ${ROLES_AGENCE[p.role]} · ${membre.invitation!.canaux.join(" et ")}`);
  return membre;
}

export function renvoyerInvitation(id: string, canaux?: CanalInvitation[]) {
  const par = nomSession();
  majMembre(id, (m) => ({ ...m, statut: "invite", invitation: invitationNeuve(par, canauxDisponibles(m, canaux ?? m.invitation?.canaux ?? ["SMS", "E-mail"])) }));
  const m = store.lire().equipe.find((x) => x.id === id);
  if (m) journaliser("Nouveau lien d'invitation envoyé", `${m.nom} · ${ROLES_AGENCE[m.role]} · ${m.invitation!.canaux.join(" et ")}`);
}

export function revoquerAcces(id: string) {
  const m = store.lire().equipe.find((x) => x.id === id);
  if (!m) return;
  majMembre(id, (x) => ({ ...x, statut: "revoque", invitation: undefined }));
  journaliser(m.statut === "invite" ? "Invitation annulée" : "Accès révoqué", `${m.nom} · ${ROLES_AGENCE[m.role]}`);
}

export function accepterInvitation(id: string) {
  majAgence((a) => ({ ...a, session: id, equipe: a.equipe.map((m) => (m.id === id ? { ...m, statut: "actif", invitation: undefined } : m)) }));
  journaliser("Invitation acceptée, accès activé", nomSession());
}

export function connecterMembre(id: string) {
  majAgence((a) => ({ ...a, session: id }));
}

export function peut(role: RoleAgence | undefined, module: Module) {
  return !!role && PERMISSIONS[module].includes(role);
}

// Journal d'audit (BO-11) : chaque décision est tracée avec son auteur.
export function journaliser(action: string, cible: string) {
  majAgence((a) => {
    const m = a.equipe.find((x) => x.id === a.session);
    return {
      ...a,
      journal: [
        { id: ident(), date: new Date().toISOString(), auteur: m?.nom ?? "Système", role: m ? ROLES_AGENCE[m.role] : "Système", action, cible },
        ...a.journal,
      ],
    };
  });
}

export function majDossier(ref: string, f: (d: Dossier) => Dossier) {
  majAgence((a) => ({ ...a, dossiers: a.dossiers.map((d) => (d.ref === ref ? f(d) : d)) }));
}

// Une décision de l'agence se répercute dans l'espace du propriétaire (même référence).
export function repercuterChezProprietaire(ref: string, statut: StatutBien, extra: { motif?: string; pauseLe?: string } = {}) {
  majEtat((e) => ({
    ...e,
    biens: e.biens.map((b) => (b.ref === ref ? { ...b, statut, motif: extra.motif, pauseLe: extra.pauseLe } : b)),
  }));
}

// À l'ouverture de l'espace propriétaire, reprend les décisions déjà prises par l'agence.
export function alignerBiensSurAgence() {
  const { dossiers } = store.lire();
  majEtat((e) => {
    let change = false;
    const biens = e.biens.map((b) => {
      const d = dossiers.find((x) => x.ref === b.ref);
      if (!d || d.statut === b.statut) return b;
      change = true;
      return { ...b, statut: d.statut, motif: d.motif, pauseLe: d.pauseLe };
    });
    return change ? { ...e, biens } : e;
  });
}

export function heuresRestantesDossier(d: Dossier, maintenant = Date.now()) {
  const fin = d.pauseLe ? new Date(d.pauseLe).getTime() : maintenant;
  const ecoulees = (fin - new Date(d.soumisLe).getTime()) / h;
  return Math.round(lireParametres().delaiEtude - ecoulees);
}

// Ajouts venant du site public
export function recevoirDossier(d: Dossier) {
  majAgence((a) => ({ ...a, dossiers: [d, ...a.dossiers.filter((x) => x.ref !== d.ref)] }));
}

export function recevoirSignalement(s: Omit<SignalementAgence, "id" | "statut">) {
  majAgence((a) => ({ ...a, signalements: [{ ...s, id: ident(), statut: "nouveau" }, ...a.signalements] }));
}

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
