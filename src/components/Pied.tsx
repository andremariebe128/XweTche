import { Link } from "react-router-dom";
import { useQuartiers } from "../lib/annonces";
import { useEtat } from "../lib/compte";
import { Logo } from "./Marque";

export function Pied() {
  const { compte } = useEtat();
  const quartiers = useQuartiers().donnees ?? [];
  const locataire = compte?.role === "locataire";
  const proprietaire = compte?.role === "proprietaire";
  return (
    <footer className="pied">
      <div className="wrap">
        <div className="pied__haut">
          <div className="pied__marque">
            <Logo version="negatif" largeur={160} />
            <p>« Ma maison », en fon. Des logements vérifiés sur place, à Cotonou.</p>
          </div>
          <nav className="pied__colonnes" aria-label="Pied de page">
            {!proprietaire && (
            <div>
              <h2>Louer</h2>
              <ul>
                {quartiers.slice(0, 6).map((q) => (
                  <li key={q.slug}>
                    <Link to={`/louer/${q.villeSlug}/${q.slug}`}>Louer à {q.nom}</Link>
                  </li>
                ))}
              </ul>
            </div>
            )}
            <div>
              <h2>Xwé Tché</h2>
              <ul>
                {!proprietaire && <li><Link to="/comment-ca-marche">Comment ça marche</Link></li>}
                {!locataire && <li><Link to="/proprietaires">Propriétaires</Link></li>}
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
            {!locataire && <Link to="/charte-proprietaire">Charte propriétaire</Link>}
            <Link to="/remboursements">Remboursements</Link>
            <Link to="/mentions-legales">Mentions légales</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

// Dans les espaces connectés, un pied réduit : l'essentiel sans le contenu de présentation du site.
export function PiedEspace() {
  return (
    <footer className="pied-espace">
      <div className="wrap pied-espace__ligne">
        <span>© 2026 Xwé Tché</span>
        <nav aria-label="Liens utiles">
          <Link to="/aide">Aide</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/cgu">CGU</Link>
          <Link to="/confidentialite">Confidentialité</Link>
        </nav>
      </div>
    </footer>
  );
}
