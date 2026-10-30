import { useEffect } from "react";

// Titre unique par page (7.4).
export function useTitre(titre: string) {
  useEffect(() => {
    document.title = `${titre} · Xwé Tché`;
  }, [titre]);
}
