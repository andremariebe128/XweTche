import { lireParametres } from "../lib/parametres";

// Types et libellés des annonces. Les annonces elles-mêmes viennent de l'API (src/lib/annonces.ts).

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
  /** URL des photos (même ordre que `photos`, qui sont les légendes). */
  images?: string[];
  /** Commission calculée par l'API avec le taux en vigueur. */
  commission?: number;
  /** Zone approximative (~100 m) : l'adresse exacte n'est donnée qu'après la réservation. */
  zone?: { lat: number; lng: number };
  miseEnAvant?: boolean;
}

export function commission(a: Annonce, taux = lireParametres().commission) {
  return a.commission ?? Math.round(a.loyer * taux);
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

/** Nom d'un quartier à partir de son slug, dans la liste fournie par l'API (useQuartiers ou useParametres). */
export function quartierDepuisSlug(slug: string, quartiers: string[]) {
  return quartiers.find((q) => slugQuartier(q) === slug);
}
