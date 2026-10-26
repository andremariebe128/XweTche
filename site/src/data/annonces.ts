import { lireParametres } from "../lib/parametres";

// Données d'exemple : textes, prix et quartiers fictifs, à remplacer par l'API.

export type TypeBien =
  | "entree-couchee"
  | "chambre-salon"
  | "studio"
  | "appartement"
  | "maison"
  | "boutique";

export const TYPES: Record<TypeBien, string> = {
  "entree-couchee": "Entrée-couchée",
  "chambre-salon": "Chambre-salon",
  studio: "Studio",
  appartement: "Appartement",
  maison: "Maison",
  boutique: "Boutique",
};

export type Equipement =
  | "eau"
  | "electricite"
  | "cloture"
  | "parking-voiture"
  | "parking-moto"
  | "meuble"
  | "douche-interne"
  | "cuisine"
  | "carrelage"
  | "plafond"
  | "climatisation"
  | "ventilateur"
  | "groupe"
  | "forage"
  | "gardien";

export type Statut = "en-ligne" | "reservee" | "bientot";

export interface Annonce {
  ref: string;
  slug: string;
  type: TypeBien;
  titre: string;
  quartier: string;
  ville: string;
  loyer: number;
  avanceMois: number;
  cautionMois: number;
  charges: number;
  chambres: number;
  surface?: number;
  equipements: Equipement[];
  statut: Statut;
  verifieLe: string;
  agent: string;
  disponibleLe?: string;
  reperes: string[];
  description: string;
  regles: string[];
  photos: string[];
  publieeIlYa: number;
}

const PHOTOS_STANDARD = [
  "Façade et entrée",
  "Pièce principale",
  "Chambre",
  "Cuisine",
  "Douche et toilettes",
  "Cour",
  "Repère proche",
];

export const ANNONCES: Annonce[] = [
  {
    ref: "XT-0412",
    slug: "xt-0412-chambre-salon-fidjrosse",
    type: "chambre-salon",
    titre: "Chambre-salon carrelée, cour fermée",
    quartier: "Fidjrossè",
    ville: "Cotonou",
    loyer: 45000,
    avanceMois: 3,
    cautionMois: 1,
    charges: 0,
    chambres: 1,
    surface: 32,
    equipements: ["eau", "electricite", "cloture", "parking-moto", "douche-interne", "carrelage", "plafond"],
    statut: "en-ligne",
    verifieLe: "12/11",
    agent: "Rodrigue",
    reperes: ["Face pharmacie Fidjrossè Plage", "200 m de la route des Pêches"],
    description:
      "Chambre-salon au rez-de-chaussée d'une maison de 4 logements. Carrelage récent, plafond posé, douche et toilettes internes. Eau et électricité au compteur individuel. Cour fermée avec portail, place pour une moto.",
    regles: ["Pas d'animaux", "Visites du lundi au samedi", "Locataire seul ou couple"],
    photos: PHOTOS_STANDARD,
    publieeIlYa: 1,
  },
  {
    ref: "XT-0398",
    slug: "xt-0398-appartement-haie-vive",
    type: "appartement",
    titre: "Appartement 2 chambres climatisé",
    quartier: "Haie Vive",
    ville: "Cotonou",
    loyer: 180000,
    avanceMois: 3,
    cautionMois: 2,
    charges: 15000,
    chambres: 2,
    surface: 85,
    equipements: ["eau", "electricite", "cloture", "parking-voiture", "climatisation", "cuisine", "douche-interne", "groupe", "gardien"],
    statut: "en-ligne",
    verifieLe: "10/11",
    agent: "Aïcha",
    reperes: ["Derrière l'église Saint-Michel", "Rue des ambassades"],
    description:
      "Appartement au 1er étage, deux chambres climatisées avec placards, salon lumineux, cuisine équipée. Groupe électrogène pour les parties communes, gardien de jour et de nuit.",
    regles: ["Pas de fête après 22 h", "Charges : gardiennage et entretien"],
    photos: [...PHOTOS_STANDARD, "Salon", "Balcon"],
    publieeIlYa: 2,
  },
  {
    ref: "XT-0405",
    slug: "xt-0405-entree-couchee-akpakpa",
    type: "entree-couchee",
    titre: "Entrée-couchée propre, proche marché",
    quartier: "Akpakpa",
    ville: "Cotonou",
    loyer: 20000,
    avanceMois: 3,
    cautionMois: 1,
    charges: 0,
    chambres: 0,
    surface: 16,
    equipements: ["eau", "electricite", "cloture", "carrelage", "ventilateur"],
    statut: "en-ligne",
    verifieLe: "11/11",
    agent: "Rodrigue",
    reperes: ["Carrefour Sègbèya", "À côté de la boulangerie Le Bon Pain"],
    description:
      "Entrée-couchée dans une cour commune de 6 logements. Douche et toilettes communes, entretenues. Compteur d'eau partagé, électricité au compteur individuel.",
    regles: ["Locataire seul", "Pas de commerce dans la cour"],
    photos: PHOTOS_STANDARD.slice(0, 6),
    publieeIlYa: 1,
  },
  {
    ref: "XT-0377",
    slug: "xt-0377-studio-meuble-cadjehoun",
    type: "studio",
    titre: "Studio meublé avec climatisation",
    quartier: "Cadjèhoun",
    ville: "Cotonou",
    loyer: 95000,
    avanceMois: 2,
    cautionMois: 1,
    charges: 5000,
    chambres: 1,
    surface: 30,
    equipements: ["eau", "electricite", "meuble", "climatisation", "cuisine", "douche-interne", "cloture", "parking-moto"],
    statut: "reservee",
    verifieLe: "04/11",
    agent: "Aïcha",
    reperes: ["Près de l'aéroport", "Rue du supermarché Erevan"],
    description:
      "Studio entièrement meublé : lit double, armoire, coin cuisine équipé, climatisation. Idéal pour un jeune actif. Internet non inclus.",
    regles: ["Pas d'animaux", "Locataire seul"],
    photos: PHOTOS_STANDARD,
    publieeIlYa: 6,
  },
  {
    ref: "XT-0390",
    slug: "xt-0390-maison-agla",
    type: "maison",
    titre: "Maison 3 chambres avec cour",
    quartier: "Agla",
    ville: "Cotonou",
    loyer: 150000,
    avanceMois: 3,
    cautionMois: 2,
    charges: 0,
    chambres: 3,
    surface: 140,
    equipements: ["eau", "electricite", "cloture", "parking-voiture", "cuisine", "douche-interne", "forage", "carrelage", "plafond"],
    statut: "en-ligne",
    verifieLe: "09/11",
    agent: "Fidèle",
    reperes: ["Agla Hlazounto, après le collège", "Église des Assemblées de Dieu"],
    description:
      "Maison individuelle de 3 chambres dont une avec douche interne, salon, cuisine, grande cour fermée avec forage. Place pour deux voitures.",
    regles: ["Bail d'un an minimum", "Famille de préférence"],
    photos: [...PHOTOS_STANDARD, "Chambre 2", "Chambre 3"],
    publieeIlYa: 3,
  },
  {
    ref: "XT-0366",
    slug: "xt-0366-chambre-salon-gbegamey",
    type: "chambre-salon",
    titre: "Chambre-salon à l'étage",
    quartier: "Gbégamey",
    ville: "Cotonou",
    loyer: 40000,
    avanceMois: 3,
    cautionMois: 1,
    charges: 0,
    chambres: 1,
    surface: 28,
    equipements: ["eau", "electricite", "cloture", "douche-interne", "carrelage"],
    statut: "bientot",
    disponibleLe: "01/12",
    verifieLe: "02/11",
    agent: "Fidèle",
    reperes: ["Derrière le stade de l'Amitié", "Pharmacie Gbégamey"],
    description:
      "Chambre-salon au premier étage, bien ventilée, douche interne. Le locataire actuel part fin novembre.",
    regles: ["Pas d'animaux"],
    photos: PHOTOS_STANDARD.slice(0, 6),
    publieeIlYa: 9,
  },
  {
    ref: "XT-0401",
    slug: "xt-0401-appartement-zogbo",
    type: "appartement",
    titre: "Appartement 3 chambres, résidence calme",
    quartier: "Zogbo",
    ville: "Cotonou",
    loyer: 120000,
    avanceMois: 3,
    cautionMois: 1,
    charges: 10000,
    chambres: 3,
    surface: 110,
    equipements: ["eau", "electricite", "cloture", "parking-voiture", "cuisine", "douche-interne", "carrelage", "plafond", "gardien"],
    statut: "en-ligne",
    verifieLe: "11/11",
    agent: "Rodrigue",
    reperes: ["Zogbo, von après le carrefour Vêdoko", "Station Total"],
    description:
      "Appartement au rez-de-chaussée d'une résidence de 4 logements. Trois chambres, deux douches, salon et salle à manger. Gardien la nuit.",
    regles: ["Bail d'un an minimum"],
    photos: [...PHOTOS_STANDARD, "Chambre 2", "Salon"],
    publieeIlYa: 2,
  },
  {
    ref: "XT-0388",
    slug: "xt-0388-boutique-dantokpa",
    type: "boutique",
    titre: "Boutique en bord de voie pavée",
    quartier: "Missèbo",
    ville: "Cotonou",
    loyer: 60000,
    avanceMois: 6,
    cautionMois: 1,
    charges: 0,
    chambres: 0,
    surface: 20,
    equipements: ["electricite", "carrelage"],
    statut: "en-ligne",
    verifieLe: "07/11",
    agent: "Aïcha",
    reperes: ["À 300 m du marché Dantokpa", "Face au pressing Le Blanc"],
    description: "Boutique de 20 m² avec rideau métallique, en bord de voie pavée très passante.",
    regles: ["Pas de restauration", "Activité à déclarer au propriétaire"],
    photos: ["Façade", "Intérieur", "Rideau métallique", "Voie", "Repère proche", "Compteur"],
    publieeIlYa: 4,
  },
  {
    ref: "XT-0409",
    slug: "xt-0409-studio-fidjrosse",
    type: "studio",
    titre: "Studio neuf à 5 minutes de la plage",
    quartier: "Fidjrossè",
    ville: "Cotonou",
    loyer: 60000,
    avanceMois: 3,
    cautionMois: 1,
    charges: 0,
    chambres: 1,
    surface: 26,
    equipements: ["eau", "electricite", "cloture", "parking-moto", "douche-interne", "cuisine", "carrelage", "plafond", "ventilateur"],
    statut: "en-ligne",
    verifieLe: "12/11",
    agent: "Rodrigue",
    reperes: ["Fidjrossè Kpota", "Église catholique Sainte-Rita"],
    description: "Studio neuf avec coin cuisine, douche interne, plafond et ventilateur. Maison récente de 3 logements.",
    regles: ["Pas d'animaux", "Locataire seul ou couple"],
    photos: PHOTOS_STANDARD,
    publieeIlYa: 1,
  },
];

export const QUARTIERS = [
  "Fidjrossè",
  "Cadjèhoun",
  "Haie Vive",
  "Akpakpa",
  "Agla",
  "Gbégamey",
  "Zogbo",
  "Missèbo",
  "Vêdoko",
  "Sainte-Rita",
  "Godomey",
  "Calavi Kpota",
];

export function commission(a: Annonce, taux = lireParametres().commission) {
  return Math.round(a.loyer * taux);
}

export function totalEntree(a: Annonce) {
  return a.loyer * a.avanceMois + a.loyer * a.cautionMois + commission(a);
}

export function slugQuartier(q: string) {
  return q
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function quartierDepuisSlug(slug: string) {
  return QUARTIERS.find((q) => slugQuartier(q) === slug) ?? ANNONCES.find((a) => slugQuartier(a.quartier) === slug)?.quartier;
}
