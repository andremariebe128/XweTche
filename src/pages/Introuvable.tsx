import { Link } from "react-router-dom";
import { Vide } from "../components/Vide";
import { useTitre } from "../lib/titre";

export default function Introuvable() {
  useTitre("Page introuvable");
  return (
    <div className="wrap edito">
      <Vide
        titre="Cette porte ne mène nulle part"
        texte="La page que vous cherchez n'existe pas ou a été déplacée."
        action={
          <Link to="/louer" className="btn btn--principal">
            Voir les logements
          </Link>
        }
      />
    </div>
  );
}
