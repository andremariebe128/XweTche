import { THEMES, type Theme } from "../data/aide";
import { creerStore } from "./stockage";

// Contenus du site gérés par l'agence sans développeur (WEB-07, BO-14).
export interface Contenus {
  banniere: { actif: boolean; texte: string };
  faq: Theme[];
}

const store = creerStore<Contenus>("xt-contenus", () => ({
  banniere: { actif: false, texte: "Nouveau : les visites sont désormais possibles le samedi après-midi." },
  faq: THEMES,
}));

export const useContenus = store.use;
export const majContenus = store.maj;
export const reinitialiserContenus = store.reinitialiser;
