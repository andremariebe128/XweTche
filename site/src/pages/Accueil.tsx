import { ArrowRight, BadgeCheck, CalendarCheck, Check, KeyRound, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { CarteAnnonce } from "../components/CarteAnnonce";
import { CoutTotal } from "../components/CoutTotal";
import { Porte } from "../components/Marque";
import { Photo } from "../components/Photo";
import { Recherche } from "../components/Recherche";
import { Badge } from "../components/Statut";
import { ANNONCES, QUARTIERS, TYPES, slugQuartier } from "../data/annonces";
import { useEtat } from "../lib/compte";
import { fcfa } from "../lib/format";

const vedette = ANNONCES[0];
const recentes = ANNONCES.filter((a) => a.statut === "en-ligne").sort((a, b) => a.publieeIlYa - b.publieeIlYa).slice(0, 6);

const quartiers = QUARTIERS.map((q) => {
  const liste = ANNONCES.filter((a) => a.quartier === q);
  return { nom: q, nombre: liste.length, min: liste.length ? Math.min(...liste.map((a) => a.loyer)) : 0 };
})
  .filter((q) => q.nombre > 0)
  .sort((a, b) => b.nombre - a.nombre);

export default function Accueil() {
  const { compte } = useEtat();
  return (
    <>
      <Hero />
      <Engagements />

      <section className="section" aria-labelledby="recentes">
        <div className="wrap">
          <div className="tete-section">
            <div>
              <p className="eyebrow">Contrôlées cette semaine</p>
              <h2 id="recentes" className="h2">Les dernières annonces vérifiées</h2>
            </div>
            <Link to="/louer" className="btn btn--texte">
              Voir les {ANNONCES.length} annonces <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
          <div className="grille-annonces">
            {recentes.map((a, i) => (
              <CarteAnnonce key={a.ref} annonce={a} index={i} />
            ))}
          </div>
        </div>
      </section>

      <QuandPayer />

      <section className="section" aria-labelledby="quartiers">
        <div className="wrap">
          <p className="eyebrow">Cotonou</p>
          <h2 id="quartiers" className="h2">Chercher par quartier</h2>
          <ul className="quartiers">
            {quartiers.map((q) => (
              <li key={q.nom}>
                <Link to={`/louer/cotonou/${slugQuartier(q.nom)}`} className="quartier">
                  <span className="quartier__nom">{q.nom}</span>
                  <span className="quartier__info">
                    {q.nombre} annonce{q.nombre > 1 ? "s" : ""} · dès {fcfa(q.min)}
                  </span>
                  <ArrowRight aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="petit gris quartiers__note">Abomey-Calavi et Porto-Novo arrivent ensuite.</p>
        </div>
      </section>

      <Jamais />
      {compte?.role !== "locataire" && <AppelProprietaires />}
    </>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="wrap hero__grille">
        <div className="hero__texte">
          <p className="eyebrow">Location vérifiée · Cotonou</p>
          <h1 className="h1 hero__titre">
            Votre chez-vous,
            <br />
            vérifié avant la visite.
          </h1>
          <p className="lede">
            Chaque logement est contrôlé sur place par un agent Xwé Tché. Tous les montants sont affichés, et vous ne payez rien
            avant la signature du bail.
          </p>
          <div className="hero__recherche">
            <Recherche />
          </div>
          <div className="pastilles hero__raccourcis" aria-label="Recherches rapides">
            {["Fidjrossè", "Cadjèhoun", "Akpakpa", "Haie Vive", "Agla"].map((q) => (
              <Link key={q} to={`/louer/cotonou/${slugQuartier(q)}`} className="pastille">
                {q}
              </Link>
            ))}
            <Link to="/louer?type=chambre-salon" className="pastille">
              Chambre-salon
            </Link>
          </div>
        </div>

        <div className="seuil" aria-hidden="true">
          <Porte taille={300} anime className="seuil__porte" />
          <div className="seuil__carte carte">
            <Photo libelle="Pièce principale" graine={2} />
            <div className="seuil__infos">
              <Badge famille="succes">Vérifié sur place</Badge>
              <p className="prix">
                {fcfa(vedette.loyer)} <small>/ mois</small>
              </p>
              <p className="seuil__type">
                {TYPES[vedette.type]} · {vedette.quartier}
              </p>
              <p className="mono gris">
                Réf. {vedette.ref} · Contrôlé le {vedette.verifieLe}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Engagements() {
  const items = [
    {
      n: "01",
      titre: "Vérifié sur place",
      texte: "Un agent se rend dans chaque logement avant sa mise en ligne : photos, compteurs, état général, repères.",
      preuve: <Badge famille="succes">Vérifié sur place le 12/11</Badge>,
    },
    {
      n: "02",
      titre: "Visite sans risque",
      texte: "Le logement ne correspond pas à l'annonce ? Dites-le après la visite : la suivante vous est offerte.",
      preuve: (
        <span className="compteur-visites">
          <Porte taille={12} /> 2 visites gratuites disponibles
        </span>
      ),
    },
    {
      n: "03",
      titre: "On ne paie qu'à la signature",
      texte: "La commission, un demi-mois de loyer, n'est demandée qu'une fois le bail signé. Jamais avant.",
      preuve: <span className="preuve-montant">Avant la signature : 0&nbsp;FCFA</span>,
    },
  ];
  return (
    <section className="section section--doux engagements" aria-labelledby="engagements">
      <div className="wrap">
        <h2 id="engagements" className="h2 engagements__titre">
          La porte ne s'ouvre que sur un logement vérifié.
        </h2>
        <ol className="engagements__liste">
          {items.map((it) => (
            <li key={it.n} className="engagement">
              <span className="engagement__n mono">{it.n}</span>
              <h3 className="h3">{it.titre}</h3>
              <p>{it.texte}</p>
              <div className="engagement__preuve">{it.preuve}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function QuandPayer() {
  const etapes = [
    { Icone: Search, titre: "Chercher", montant: "Gratuit", texte: "Recherche, favoris et alertes, sans compte." },
    { Icone: CalendarCheck, titre: "Visiter", montant: "Gratuit", texte: "Un agent vous accompagne. Une visite décevante vous en rend une." },
    { Icone: BadgeCheck, titre: "Signer le bail", montant: "½ mois de loyer", texte: "La commission Xwé Tché, payée par Mobile Money, avec reçu." },
    { Icone: KeyRound, titre: "Emménager", montant: "Avance + caution", texte: "Versées au propriétaire, aux montants affichés sur l'annonce." },
  ];
  return (
    <section className="section section--doux" aria-labelledby="quand-payer">
      <div className="wrap quand">
        <div>
          <p className="eyebrow">Aucun frais caché</p>
          <h2 id="quand-payer" className="h2">
            Ce que vous payez, et quand
          </h2>
          <p className="lede">Le coût total est affiché sur chaque annonce, avant même de réserver une visite.</p>
          <ol className="frise">
            {etapes.map(({ Icone, titre, montant, texte }) => (
              <li key={titre} className="frise__etape">
                <span className="frise__icone">
                  <Icone aria-hidden="true" />
                </span>
                <div>
                  <h3 className="frise__titre">
                    {titre} <span className="frise__montant">{montant}</span>
                  </h3>
                  <p>{texte}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="petit gris">[Gratuité de la première visite à confirmer]</p>
        </div>
        <div className="carte quand__exemple">
          <p className="mono gris quand__ref">
            Exemple · Réf. {vedette.ref} · {TYPES[vedette.type]}, {vedette.quartier}
          </p>
          <CoutTotal annonce={vedette} />
        </div>
      </div>
    </section>
  );
}

function Jamais() {
  const jamais = [
    "Payer quoi que ce soit avant d'avoir visité",
    "Votre code secret Mobile Money, par téléphone ou par message",
    "Des frais de visite en espèces à un démarcheur",
  ];
  return (
    <section className="section jamais" aria-labelledby="jamais">
      <div className="wrap jamais__grille">
        <div>
          <p className="eyebrow jamais__eyebrow">Confiance et sécurité</p>
          <h2 id="jamais" className="h2">
            Ce que Xwé Tché ne vous demandera jamais
          </h2>
          <p className="lede jamais__lede">
            Quelqu'un se présente au nom de Xwé Tché et vous demande l'une de ces choses ? C'est une arnaque. Signalez-la.
          </p>
          <Link to="/confiance" className="btn btn--secondaire-blanc jamais__lien">
            Repérer une arnaque
          </Link>
        </div>
        <ul className="jamais__liste">
          {jamais.map((j) => (
            <li key={j}>
              <span className="jamais__x">
                <X aria-hidden="true" />
              </span>
              {j}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function AppelProprietaires() {
  return (
    <section className="section proprio" aria-labelledby="proprio">
      <div className="wrap">
        <div className="proprio__grille">
        <div>
          <p className="eyebrow proprio__eyebrow">Propriétaires et gestionnaires</p>
          <h2 id="proprio" className="h2">
            Votre bien étudié en 48 h, puis visité par des locataires sérieux.
          </h2>
          <ul className="proprio__points">
            {[
              "Dépôt guidé en moins de 10 minutes",
              "Contrôle sur place et badge « Vérifié sur place »",
              "Vous choisissez votre locataire",
              "Vos coordonnées restent masquées jusqu'à la visite",
            ].map((p) => (
              <li key={p}>
                <Check aria-hidden="true" /> {p}
              </li>
            ))}
          </ul>
          <div className="proprio__actions">
            <Link to="/proprietaires/deposer" className="btn btn--blanc">
              Déposer un bien
            </Link>
            <Link to="/proprietaires" className="btn btn--texte proprio__plus">
              Comment ça se passe
            </Link>
          </div>
        </div>
        <div className="proprio__suivi carte" aria-hidden="true">
          <p className="mono gris">Réf. XT-0415 · Soumise le 13/11</p>
          <Badge famille="neutre">En étude · 31 h restantes</Badge>
          <div className="minuteur">
            <div className="minuteur__barre" style={{ width: "35%" }} />
          </div>
          <ol className="proprio__etapes">
            <li className="fait">Annonce envoyée</li>
            <li className="fait">Documents reçus</li>
            <li className="encours">Étude par l'agence</li>
            <li>Contrôle sur place</li>
            <li>En ligne</li>
          </ol>
        </div>
        </div>
      </div>
    </section>
  );
}
