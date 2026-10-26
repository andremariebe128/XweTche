import { ArrowLeft, Printer } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Logo } from "../components/Marque";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import { ANNONCES, TYPES } from "../data/annonces";
import { telMasque, useEtat } from "../lib/compte";
import { fcfa } from "../lib/format";
import { useTitre } from "../lib/titre";

// Reçu de paiement imprimable (PAY-04) : numéro unique, montant, moyen, référence, date et heure.
export default function Recu() {
  const { numero = "" } = useParams();
  const { recus, compte } = useEtat();
  const recu = recus.find((r) => r.numero === numero);
  useTitre(recu ? `Reçu ${recu.numero}` : "Reçu");

  if (!recu)
    return (
      <div className="wrap edito">
        <Vide
          titre="Reçu introuvable"
          texte="Vérifiez que vous êtes connecté avec le compte qui a effectué le paiement."
          action={
            <Link to="/mon-espace?onglet=recus" className="btn btn--secondaire">
              Mes reçus
            </Link>
          }
        />
      </div>
    );

  const annonce = ANNONCES.find((a) => a.ref === recu.ref);
  const d = new Date(recu.date);
  const lignes: [string, React.ReactNode][] = [
    ["Montant", fcfa(recu.montant)],
    ["Objet", "Commission de location"],
    ["Logement", annonce ? `${TYPES[annonce.type]} · ${annonce.quartier} · Réf. ${annonce.ref}` : `Réf. ${recu.ref}`],
    ["Payé par", compte?.nom ?? ""],
    ["Moyen de paiement", `${recu.operateur} · ${telMasque(recu.tel)}`],
    ["Référence de transaction", recu.transaction],
    ["Date et heure", `${d.toLocaleDateString("fr-FR")} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`],
  ];

  return (
    <div className="wrap edito recu-page">
      <div className="recu-page__outils">
        <Link to="/mon-espace?onglet=recus" className="btn btn--texte">
          <ArrowLeft size={18} aria-hidden="true" /> Mes reçus
        </Link>
        <button type="button" className="btn btn--secondaire" onClick={() => window.print()}>
          <Printer size={18} aria-hidden="true" /> Imprimer ou enregistrer en PDF
        </button>
      </div>
      <article className="carte recu">
        <header className="recu__tete">
          <Logo largeur={130} />
          <Badge famille="succes">Paiement reçu</Badge>
        </header>
        <h1 className="h2">Reçu de paiement</h1>
        <p className="mono recu__numero">N° {recu.numero}</p>
        <dl className="recu__lignes">
          {lignes.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className={["Objet", "Logement", "Payé par"].includes(k) ? undefined : "mono"}>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="petit gris recu__pied">
          Xwé Tché, plateforme de location de logements vérifiés sur place. Ce reçu atteste du paiement de la commission de location. L'avance et la
          caution sont réglées directement au propriétaire. [Mentions légales de l'émetteur à compléter.]
        </p>
      </article>
    </div>
  );
}
