import { useSyncExternalStore } from "react";

// État du compte simulé, gardé dans le navigateur en attendant l'API.
// Toutes les pages d'espace personnel lisent et modifient cet état.

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

export type StatutBien = "en-etude" | "a-corriger" | "refusee" | "en-ligne" | "louee";

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

const CLE = "xt-compte";
const VIDE: Etat = { compte: null, visitesGratuites: 0, visites: [], candidatures: [], recus: [], alertes: [], biens: [] };
const abonnes = new Set<() => void>();

function lire(): Etat {
  try {
    const brut = localStorage.getItem(CLE);
    return brut ? { ...VIDE, ...JSON.parse(brut) } : VIDE;
  } catch {
    return VIDE;
  }
}

let cache = lire();

export function majEtat(f: (e: Etat) => Etat) {
  cache = f(cache);
  try {
    localStorage.setItem(CLE, JSON.stringify(cache));
  } catch {
    // stockage indisponible : l'état reste en mémoire pour la session
  }
  abonnes.forEach((a) => a());
}

export function useEtat() {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => cache,
  );
}

export function id() {
  return Math.random().toString(36).slice(2, 10);
}

export function code(n = 4) {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
}

const jour = 24 * 3600 * 1000;
const dans = (j: number, h = 10) => {
  const d = new Date(Date.now() + j * jour);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};
const ilYa = (heures: number) => new Date(Date.now() - heures * 3600 * 1000).toISOString();

// Données de démonstration chargées à la première connexion, pour que l'espace ne soit pas vide.
export function connecter(compte: Compte) {
  majEtat((e) => {
    if (e.compte?.tel === compte.tel && e.compte.role === compte.role) return { ...e, compte };
    const base: Etat = { ...VIDE, compte, visitesGratuites: 2 };
    if (compte.role === "locataire")
      return {
        ...base,
        visites: [
          { id: id(), ref: "XT-0398", date: dans(-2, 15), code: code(), statut: "a-evaluer" },
          { id: id(), ref: "XT-0409", date: dans(2, 10), code: code(), statut: "a-venir" },
          { id: id(), ref: "XT-0405", date: dans(-9, 11), code: code(), statut: "pas-satisfait", motif: "Photos non conformes" },
        ],
        candidatures: [{ id: id(), ref: "XT-0412", date: dans(-3), statut: "retenue" }],
        alertes: [{ id: id(), resume: "Chambre-salon · Fidjrossè · jusqu'à 60 000 FCFA", canal: "SMS" }],
      };
    return {
      ...base,
      biens: [
        {
          ref: "XT-0415",
          type: "Studio",
          titre: "Studio carrelé avec douche interne",
          quartier: "Cadjèhoun",
          loyer: 70000,
          statut: "en-etude",
          soumisLe: ilYa(17),
          vues: 0,
          visites: [],
          candidats: [],
        },
        {
          ref: "XT-0362",
          type: "Chambre-salon",
          titre: "Chambre-salon proche du marché",
          quartier: "Akpakpa",
          loyer: 35000,
          statut: "a-corriger",
          soumisLe: ilYa(30),
          pauseLe: ilYa(10),
          motif: "2 photos sont floues (cuisine, douche). Remplacez-les pour renvoyer l'annonce en étude.",
          vues: 0,
          visites: [],
          candidats: [],
        },
        {
          ref: "XT-0412",
          type: "Chambre-salon",
          titre: "Chambre-salon carrelée, cour fermée",
          quartier: "Fidjrossè",
          loyer: 45000,
          statut: "en-ligne",
          vues: 214,
          visites: [
            { id: id(), date: dans(1, 9), visiteur: "Koffi A." },
            { id: id(), date: dans(1, 16), visiteur: "Mariam S." },
            { id: id(), date: dans(3, 10), visiteur: "Gildas H." },
          ],
          candidats: [
            { id: id(), nom: "Esther D.", profession: "Infirmière", revenus: "150 000 à 250 000 FCFA", visiteLe: dans(-3, 10), statut: "en-attente" },
            { id: id(), nom: "Rodolphe K.", profession: "Commerçant", revenus: "100 000 à 150 000 FCFA", visiteLe: dans(-2, 15), statut: "en-attente" },
          ],
        },
        {
          ref: "XT-0366",
          type: "Chambre-salon",
          titre: "Chambre-salon à l'étage",
          quartier: "Gbégamey",
          loyer: 40000,
          statut: "louee",
          vues: 380,
          visites: [],
          candidats: [],
        },
      ],
    };
  });
}

export function deconnecter() {
  majEtat(() => VIDE);
}

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
