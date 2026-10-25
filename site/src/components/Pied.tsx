import { Link } from "react-router-dom";
import { QUARTIERS, slugQuartier } from "../data/annonces";
import { Logo } from "./Marque";

export function Pied() {
  return (
    <footer className="pied">
      <div className="wrap">
        <div className="pied__haut">
          <div className="pied__marque">
            <Logo version="negatif" largeur={160} />
            <p>« Ma maison », en fon. Des logements vérifiés sur place, à Cotonou.</p>
          </div>
          <nav className="pied__colonnes" aria-label="Pied de page">
            <div>
              <h2>Louer</h2>
              <ul>
                {QUARTIERS.slice(0, 6).map((q) => (
                  <li key={q}>
                    <Link to={`/louer/cotonou/${slugQuartier(q)}`}>Louer à {q}</Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2>Xwé Tché</h2>
              <ul>
                <li><Link to="/comment-ca-marche">Comment ça marche</Link></li>
                <li><Link to="/proprietaires">Propriétaires</Link></li>
                <li><Link to="/confiance">Confiance et sécurité</Link></li>
                <li><Link to="/a-propos">À propos</Link></li>
                <li><Link to="/aide">Aide</Link></li>
                <li><Link to="/contact">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h2>Nos seuls canaux officiels</h2>
              <ul className="pied__officiel">
                <li>Site : xwetche.bj <span>[à réserver]</span></li>
                <li>WhatsApp : +229 [numéro]</li>
                <li>SMS : expéditeur « XweTche »</li>
              </ul>
              <p className="pied__alerte">Xwé Tché ne vous demandera jamais de payer avant une visite, ni votre code Mobile Money.</p>
            </div>
          </nav>
        </div>
        <div className="pied__bas">
          <span>© 2026 Xwé Tché</span>
          <span className="pied__legal">
            <Link to="/cgu">CGU</Link>
            <Link to="/confidentialite">Confidentialité</Link>
            <Link to="/charte-proprietaire">Charte propriétaire</Link>
            <Link to="/remboursements">Remboursements</Link>
            <Link to="/mentions-legales">Mentions légales</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
