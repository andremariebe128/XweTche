import type { Theme } from "../data/aide";
import { api } from "./api";
import { creerMagasin } from "./magasin";

// Contenus du site gérés par l'agence sans développeur (WEB-07, BO-14) : bandeau et FAQ publiés.
export interface Contenus {
  banniere: { actif: boolean; texte: string };
  faq: Theme[];
}

const store = creerMagasin<Contenus>({ banniere: { actif: false, texte: "" }, faq: [] });
export const useContenus = store.use;

export async function chargerContenus() {
  try {
    store.definir(await api.get<Contenus>("/contenus"));
  } catch {
    // on garde le contenu précédent
  }
}

/** Back-office : enregistre le bandeau et la FAQ, puis recharge la version publiée. */
export async function enregistrerContenus(c: Contenus) {
  await api.put("/agence/contenus", c);
  await chargerContenus();
}
