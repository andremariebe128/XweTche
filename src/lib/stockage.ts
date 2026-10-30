import { useSyncExternalStore } from "react";

// Petit magasin de données gardé dans le navigateur, partagé entre le site et le back-office en attendant l'API.
export function creerStore<T extends object>(cle: string, defaut: () => T) {
  const abonnes = new Set<() => void>();

  function charger(): T {
    try {
      const brut = localStorage.getItem(cle);
      return brut ? { ...defaut(), ...JSON.parse(brut) } : defaut();
    } catch {
      return defaut();
    }
  }

  let cache = charger();

  function maj(f: (e: T) => T) {
    cache = f(cache);
    try {
      localStorage.setItem(cle, JSON.stringify(cache));
    } catch {
      // stockage indisponible : l'état reste en mémoire pour la session
    }
    abonnes.forEach((a) => a());
  }

  function use() {
    return useSyncExternalStore(
      (f) => {
        abonnes.add(f);
        return () => abonnes.delete(f);
      },
      () => cache,
    );
  }

  return { lire: () => cache, maj, use, reinitialiser: () => maj(() => defaut()) };
}
