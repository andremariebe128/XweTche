import { useSyncExternalStore } from "react";

// Favoris gardés dans le navigateur : consultables hors connexion (WEB-06).
const CLE = "xt-favoris";
const abonnes = new Set<() => void>();

function lire(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "[]");
  } catch {
    return [];
  }
}

let cache = lire();

function ecrire(liste: string[]) {
  cache = liste;
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
  } catch {
    // stockage indisponible : les favoris restent en mémoire pour la session
  }
  abonnes.forEach((f) => f());
}

export function useFavoris() {
  const liste = useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => cache,
  );
  return {
    liste,
    estFavori: (ref: string) => liste.includes(ref),
    basculer: (ref: string) => ecrire(liste.includes(ref) ? liste.filter((r) => r !== ref) : [...liste, ref]),
  };
}
