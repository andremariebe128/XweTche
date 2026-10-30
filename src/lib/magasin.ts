import { useSyncExternalStore } from "react";

// Petit magasin en mémoire, partagé entre les composants (les données viennent de l'API, rien n'est gardé dans le navigateur).
export function creerMagasin<T>(initial: T) {
  let valeur = initial;
  const abonnes = new Set<() => void>();
  return {
    lire: () => valeur,
    definir(v: T) {
      valeur = v;
      abonnes.forEach((a) => a());
    },
    use: () =>
      useSyncExternalStore(
        (f) => {
          abonnes.add(f);
          return () => abonnes.delete(f);
        },
        () => valeur,
      ),
  };
}
