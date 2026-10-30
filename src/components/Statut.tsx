import { Check, Clock, Info, AlertCircle, X } from "lucide-react";
import type { Annonce } from "../data/annonces";

// Chaque badge associe un libellé et une icône : jamais la couleur seule (6.6).
type Famille = "succes" | "neutre" | "info" | "action" | "erreur";

const ICONES = { succes: Check, neutre: Clock, info: Info, action: AlertCircle, erreur: X };

export function Badge({ famille, children, surPhoto }: { famille: Famille; children: React.ReactNode; surPhoto?: boolean }) {
  const Icone = ICONES[famille];
  return (
    <span className={`badge badge--${famille}${surPhoto ? " badge--sur-photo" : ""}`}>
      <Icone strokeWidth={2.5} aria-hidden="true" />
      {children}
    </span>
  );
}

export function BadgeAnnonce({ annonce, surPhoto, avecDate }: { annonce: Annonce; surPhoto?: boolean; avecDate?: boolean }) {
  if (annonce.statut === "bientot")
    return (
      <Badge famille="info" surPhoto={surPhoto}>
        Bientôt disponible le {annonce.disponibleLe}
      </Badge>
    );
  if (annonce.statut === "reservee")
    return (
      <Badge famille="info" surPhoto={surPhoto}>
        Réservée
      </Badge>
    );
  return (
    <Badge famille="succes" surPhoto={surPhoto}>
      Vérifié sur place{avecDate ? ` le ${annonce.verifieLe}` : ""}
    </Badge>
  );
}
