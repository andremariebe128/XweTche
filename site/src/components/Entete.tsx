import { Heart, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useEtat } from "../lib/compte";
import { useFavoris } from "../lib/favoris";
import { Logo } from "./Marque";

const LIENS = [
  ["/louer", "Louer"],
  ["/comment-ca-marche", "Comment ça marche"],
  ["/proprietaires", "Propriétaires"],
  ["/confiance", "Confiance et sécurité"],
] as const;

export function Entete() {
  const [menu, setMenu] = useState(false);
  const { liste } = useFavoris();
  const { compte } = useEtat();
  const { pathname } = useLocation();

  useEffect(() => {
    setMenu(false);
  }, [pathname]);

  return (
    <header className="entete">
      <div className="wrap entete__barre">
        <Link to="/" className="entete__logo" aria-label="Xwé Tché, accueil">
          <Logo largeur={140} />
        </Link>
        <nav className="entete__nav" aria-label="Navigation principale">
          {LIENS.map(([to, libelle]) => (
            <NavLink key={to} to={to} className="entete__lien">
              {libelle}
            </NavLink>
          ))}
        </nav>
        <div className="entete__actions">
          <Link to={compte ? "/mon-espace?onglet=favoris" : "/mon-espace"} className="btn-icone entete__favoris" aria-label={`Mes favoris (${liste.length})`}>
            <Heart aria-hidden="true" size={20} />
            {liste.length > 0 && <span className="entete__compteur">{liste.length}</span>}
          </Link>
          {compte ? (
            <Link to="/mon-espace" className="btn btn--texte entete__connexion entete__compte">
              <span className="entete__initiale" aria-hidden="true">
                {compte.nom[0]}
              </span>
              Mon espace
            </Link>
          ) : (
            <Link to="/connexion" className="btn btn--texte entete__connexion">
              Se connecter
            </Link>
          )}
          <Link to="/proprietaires/deposer" className="btn btn--secondaire entete__deposer">
            Déposer un bien
          </Link>
          <button
            type="button"
            className="btn-icone entete__burger"
            aria-expanded={menu}
            aria-controls="menu-mobile"
            aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setMenu((m) => !m)}
          >
            {menu ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      {menu && (
        <div id="menu-mobile" className="menu-mobile">
          <nav className="wrap" aria-label="Navigation mobile">
            {LIENS.map(([to, libelle]) => (
              <NavLink key={to} to={to} className="menu-mobile__lien">
                {libelle}
              </NavLink>
            ))}
            <NavLink to="/aide" className="menu-mobile__lien">
              Aide
            </NavLink>
            <div className="menu-mobile__actions">
              <Link to="/proprietaires/deposer" className="btn btn--secondaire btn--bloc">
                Déposer un bien
              </Link>
              <Link to={compte ? "/mon-espace" : "/connexion"} className="btn btn--texte btn--bloc">
                {compte ? "Mon espace" : "Se connecter"}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
