import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { TYPES, totalEntree, type Annonce } from "../data/annonces";
import { fcfa } from "../lib/format";
import { useFavoris } from "../lib/favoris";
import { EquipementsCourts } from "./Equipements";
import { Photo } from "./Photo";
import { BadgeAnnonce } from "./Statut";

export function CarteAnnonce({ annonce, index = 0 }: { annonce: Annonce; index?: number }) {
  const { estFavori, basculer } = useFavoris();
  const favori = estFavori(annonce.ref);
  return (
    <article className="carte carte-annonce">
      <Link to={`/annonce/${annonce.slug}`} className="carte-annonce__lien">
        <Photo libelle={`${TYPES[annonce.type]} à ${annonce.quartier}, photo 1`} graine={index}>
          <span className="carte-annonce__badge">
            <BadgeAnnonce annonce={annonce} surPhoto />
          </span>
        </Photo>
        <div className="carte-annonce__corps">
          <p className="prix">
            {fcfa(annonce.loyer)} <small>/ mois</small>
          </p>
          <h3 className="carte-annonce__titre">
            {TYPES[annonce.type]} · {annonce.quartier}
          </h3>
          <EquipementsCourts liste={annonce.equipements} />
          <p className="carte-annonce__total">
            Total à l'entrée <strong>{fcfa(totalEntree(annonce))}</strong>
          </p>
        </div>
      </Link>
      <button
        type="button"
        className="carte-annonce__favori"
        aria-pressed={favori}
        aria-label={favori ? "Retirer des favoris" : "Ajouter aux favoris"}
        onClick={() => basculer(annonce.ref)}
      >
        <Heart aria-hidden="true" fill={favori ? "currentColor" : "none"} />
      </button>
    </article>
  );
}
