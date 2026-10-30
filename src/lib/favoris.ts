import { api } from "./api";
import { lireEtat } from "./compte";
import { creerMagasin } from "./magasin";

// Favoris : sur l'appareil quand on n'est pas connecté (consultables hors connexion, WEB-06),
// puis fusionnés avec le compte à la connexion.
const CLE = "xt-favoris";

function lireLocal(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "[]");
  } catch {
    return [];
  }
}
function ecrireLocal(liste: string[]) {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    // stockage indisponible : les favoris restent en mémoire pour la session
  }
}

const magasin = creerMagasin<string[]>(lireLocal());

export async function synchroniserFavoris() {
  if (!lireEtat().compte) return;
  try {
    const fusion = await api.post<string[]>("/favoris/fusion", { refs: magasin.lire() });
    magasin.definir(fusion);
    ecrireLocal(fusion);
  } catch {
    // on garde la liste locale
  }
}

export function useFavoris() {
  const liste = magasin.use();
  return {
    liste,
    estFavori: (ref: string) => liste.includes(ref),
    basculer: (ref: string) => {
      const present = liste.includes(ref);
      const suite = present ? liste.filter((r) => r !== ref) : [...liste, ref];
      magasin.definir(suite);
      ecrireLocal(suite);
      if (lireEtat().compte) void (present ? api.del(`/favoris/${ref}`) : api.put(`/favoris/${ref}`)).catch(() => {});
    },
  };
}
