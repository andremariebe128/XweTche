import {
  AirVent,
  Bike,
  Car,
  CookingPot,
  Droplets,
  Fan,
  Fence,
  Grid2x2,
  Layers,
  Plug,
  ShieldCheck,
  ShowerHead,
  Sofa,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Equipement } from "../data/annonces";

export const EQUIPEMENTS: Record<Equipement, { libelle: string; Icone: LucideIcon }> = {
  eau: { libelle: "Eau au compteur", Icone: Droplets },
  electricite: { libelle: "Électricité au compteur", Icone: Zap },
  cloture: { libelle: "Cour clôturée", Icone: Fence },
  "parking-voiture": { libelle: "Parking voiture", Icone: Car },
  "parking-moto": { libelle: "Parking moto", Icone: Bike },
  meuble: { libelle: "Meublé", Icone: Sofa },
  "douche-interne": { libelle: "Douche interne", Icone: ShowerHead },
  cuisine: { libelle: "Cuisine", Icone: CookingPot },
  carrelage: { libelle: "Carrelage", Icone: Grid2x2 },
  plafond: { libelle: "Plafond", Icone: Layers },
  climatisation: { libelle: "Climatisation", Icone: AirVent },
  ventilateur: { libelle: "Ventilateur", Icone: Fan },
  groupe: { libelle: "Groupe électrogène", Icone: Plug },
  forage: { libelle: "Forage", Icone: Waves },
  gardien: { libelle: "Gardien", Icone: ShieldCheck },
};

// Sur les cartes, on montre d'abord ce qui distingue un logement des autres.
const PRIORITE: Equipement[] = [
  "meuble",
  "climatisation",
  "douche-interne",
  "parking-voiture",
  "groupe",
  "forage",
  "gardien",
  "cuisine",
  "parking-moto",
  "cloture",
  "plafond",
  "carrelage",
  "ventilateur",
  "eau",
  "electricite",
];

export function EquipementsCourts({ liste }: { liste: Equipement[] }) {
  const tries = [...liste].sort((a, b) => PRIORITE.indexOf(a) - PRIORITE.indexOf(b));
  return (
    <ul className="equip-courts">
      {tries.slice(0, 3).map((e) => {
        const { libelle, Icone } = EQUIPEMENTS[e];
        return (
          <li key={e}>
            <Icone aria-hidden="true" />
            <span>{libelle.replace(" au compteur", "")}</span>
          </li>
        );
      })}
    </ul>
  );
}
