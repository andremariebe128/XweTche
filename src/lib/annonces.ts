import { useEffect, useState } from "react";
import type { Annonce } from "../data/annonces";
import { api, messageErreur } from "./api";

// Annonces publiques : lues depuis l'API (filtres, tri et pagination côté serveur : 20 000 annonces ne tiennent pas dans le navigateur).

export interface Filtres {
  ville?: string; // slug : "cotonou"
  quartier?: string; // slug : "fidjrosse"
  type?: string;
  budget?: number;
  chambres?: number;
  equipements?: string[];
  disponibles?: boolean;
  tri?: "recentes" | "prix_asc" | "prix_desc";
  page?: number;
  limite?: number;
}

function requete(f: Filtres) {
  const p = new URLSearchParams();
  if (f.ville) p.set("ville", f.ville);
  if (f.quartier) p.set("quartier", f.quartier);
  if (f.type) p.set("type", f.type);
  if (f.budget) p.set("budget", String(f.budget));
  if (f.chambres) p.set("chambres", String(f.chambres));
  if (f.equipements?.length) p.set("equipements", f.equipements.join(","));
  if (f.disponibles) p.set("disponibles", "1");
  if (f.tri) p.set("tri", f.tri);
  if (f.page) p.set("page", String(f.page));
  if (f.limite) p.set("limite", String(f.limite));
  return p.toString();
}

export interface PageAnnonces {
  items: Annonce[];
  total: number;
}

export interface Chargement<T> {
  donnees: T | null;
  chargement: boolean;
  erreur: string | null;
}

function useRequete<T>(chemin: string | null): Chargement<T> {
  const [etat, setEtat] = useState<Chargement<T>>({ donnees: null, chargement: !!chemin, erreur: null });
  useEffect(() => {
    if (!chemin) {
      setEtat({ donnees: null, chargement: false, erreur: null });
      return;
    }
    let annule = false;
    setEtat((e) => ({ ...e, chargement: true, erreur: null }));
    api
      .get<T>(chemin)
      .then((d) => !annule && setEtat({ donnees: d, chargement: false, erreur: null }))
      .catch((e) => !annule && setEtat({ donnees: null, chargement: false, erreur: messageErreur(e) }));
    return () => {
      annule = true;
    };
  }, [chemin]);
  return etat;
}

/** Liste filtrée. `donnees` reste null pendant le chargement (afficher des squelettes, 6.5). */
export const useAnnonces = (f: Filtres = {}) => useRequete<PageAnnonces>(`/annonces?${requete(f)}`);

/** Une annonce par sa référence (XT-0412). `erreur` est renseignée si elle n'existe pas ou n'est plus en ligne. */
export const useAnnonce = (ref: string | undefined) => useRequete<Annonce>(ref ? `/annonces/${encodeURIComponent(ref)}` : null);

export interface QuartierInfo {
  nom: string;
  slug: string;
  ville: string;
  villeSlug: string;
  annonces: number;
}
export const useQuartiers = () => useRequete<QuartierInfo[]>("/quartiers");

export interface Creneaux {
  jours: { date: string; creneaux: { heure: string; iso: string; libre: boolean }[] }[];
}
export const useCreneaux = (ref: string | undefined) => useRequete<Creneaux>(ref ? `/annonces/${encodeURIComponent(ref)}/creneaux` : null);

/** La référence est le début du slug : « xt-0412-chambre-salon-fidjrosse » → « XT-0412 ». */
export const refDepuisSlug = (slug: string | undefined) => slug?.match(/^(xt-\d+)/i)?.[1].toUpperCase();
