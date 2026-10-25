import { commission, totalEntree, type Annonce } from "../data/annonces";
import { fcfa, pluriel } from "../lib/format";

// Bloc « Coût total » : le locataire connaît tout avant de réserver (règle d'affichage 4.1).
export function CoutTotal({ annonce }: { annonce: Annonce }) {
  const lignes: [string, string, number][] = [
    ["Loyer mensuel", "payé au propriétaire", annonce.loyer],
    ["Avance", `${pluriel(annonce.avanceMois, "mois", "mois")} de loyer, au propriétaire`, annonce.loyer * annonce.avanceMois],
    ["Caution", `${pluriel(annonce.cautionMois, "mois", "mois")}, restituée en fin de bail`, annonce.loyer * annonce.cautionMois],
    ["Commission Xwé Tché", "½ mois, payée seulement à la signature", commission(annonce)],
  ];
  return (
    <section className="cout" aria-labelledby={`cout-${annonce.ref}`}>
      <h2 id={`cout-${annonce.ref}`} className="h3">
        Coût total
      </h2>
      <dl className="cout__lignes">
        {lignes.map(([nom, detail, montant]) => (
          <div key={nom} className="cout__ligne">
            <dt>
              {nom}
              <span>{detail}</span>
            </dt>
            <dd>{fcfa(montant)}</dd>
          </div>
        ))}
        <div className="cout__ligne">
          <dt>
            Charges
            <span>{annonce.charges ? "par mois, en plus du loyer" : "aucune charge en plus du loyer"}</span>
          </dt>
          <dd>{annonce.charges ? fcfa(annonce.charges) : "0 FCFA"}</dd>
        </div>
        <div className="cout__ligne cout__ligne--total">
          <dt>
            À prévoir à l'entrée
            <span>avance + caution + commission</span>
          </dt>
          <dd>{fcfa(totalEntree(annonce))}</dd>
        </div>
      </dl>
    </section>
  );
}
