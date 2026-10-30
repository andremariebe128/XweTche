import { api } from "./api";
import { creerMagasin } from "./magasin";

// Règles modifiables depuis le back-office sans nouveau développement (4.1, BO-09).
// Valeurs par défaut utilisées le temps que l'API réponde (ou hors connexion).
export interface Parametres {
  commission: number;
  plafondVisites: number;
  delaiEtude: number;
  alerteEtude: number;
  annulationVisite: number;
  motifsRefus: string[];
  motifsCorrection: string[];
  motifsVisite: string[];
  motifsSignalement?: string[];
  quartiers: string[];
  photosMin?: number;
  photoLargeurMin?: number;
}

export const PARAMETRES_DEFAUT: Parametres = {
  commission: 0.5,
  plafondVisites: 5,
  delaiEtude: 48,
  alerteEtude: 12,
  annulationVisite: 12,
  motifsRefus: [],
  motifsCorrection: [],
  motifsVisite: ["Prix", "État du logement", "Quartier", "Taille", "Photos non conformes", "Autre"],
  quartiers: [],
};

const store = creerMagasin<Parametres>(PARAMETRES_DEFAUT);
export const useParametres = store.use;
export const lireParametres = store.lire;

export async function chargerParametres() {
  try {
    store.definir({ ...PARAMETRES_DEFAUT, ...(await api.get<Parametres>("/parametres")) });
  } catch {
    // on garde les valeurs par défaut
  }
}

/** Back-office (responsable) : enregistre puis recharge. */
export async function enregistrerParametres(p: Parametres) {
  await api.put("/agence/parametres", {
    commission: p.commission, plafondVisites: p.plafondVisites, delaiEtude: p.delaiEtude, alerteEtude: p.alerteEtude, annulationVisite: p.annulationVisite,
    motifsRefus: p.motifsRefus, motifsCorrection: p.motifsCorrection, motifsVisite: p.motifsVisite, quartiers: p.quartiers,
  });
  await chargerParametres();
}

// « ½ mois » pour le taux par défaut, sinon le pourcentage d'un mois de loyer
export function libelleCommission(taux = lireParametres().commission) {
  if (taux === 0.5) return "½ mois";
  if (taux === 1) return "1 mois";
  return `${Math.round(taux * 100)} % d'un mois`;
}
