import { creerStore } from "./stockage";

// Règles modifiables depuis le back-office sans nouveau développement (4.1, BO-09).
export interface Parametres {
  commission: number;
  plafondVisites: number;
  delaiEtude: number;
  alerteEtude: number;
  annulationVisite: number;
  motifsRefus: string[];
  motifsCorrection: string[];
  motifsVisite: string[];
  quartiers: string[];
}

export const PARAMETRES_DEFAUT: Parametres = {
  commission: 0.5,
  plafondVisites: 5,
  delaiEtude: 48,
  alerteEtude: 12,
  annulationVisite: 12,
  motifsRefus: [
    "Documents de propriété insuffisants",
    "Identité du propriétaire non vérifiée",
    "Photos ne correspondant pas au bien",
    "Annonce en double",
    "Bien non conforme à la charte",
  ],
  motifsCorrection: [
    "Photos floues ou sombres",
    "Photo manquante (pièce obligatoire)",
    "Montants incohérents",
    "Description incomplète",
    "Repères insuffisants",
  ],
  motifsVisite: ["Prix", "État du logement", "Quartier", "Taille", "Photos non conformes", "Autre"],
  quartiers: [
    "Fidjrossè",
    "Cadjèhoun",
    "Haie Vive",
    "Akpakpa",
    "Agla",
    "Gbégamey",
    "Zogbo",
    "Missèbo",
    "Vêdoko",
    "Sainte-Rita",
    "Godomey",
    "Calavi Kpota",
  ],
};

const store = creerStore<Parametres>("xt-parametres", () => PARAMETRES_DEFAUT);
export const useParametres = store.use;
export const lireParametres = store.lire;
export const majParametres = store.maj;

// « ½ mois » pour le taux par défaut, sinon le pourcentage d'un mois de loyer
export function libelleCommission(taux = lireParametres().commission) {
  if (taux === 0.5) return "½ mois";
  if (taux === 1) return "1 mois";
  return `${Math.round(taux * 100)} % d'un mois`;
}
