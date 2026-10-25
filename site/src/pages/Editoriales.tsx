import { Check, FileText, Flag, Timer, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { CarteAnnonce } from "../components/CarteAnnonce";
import { Signalement } from "../components/Signalement";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import { ANNONCES } from "../data/annonces";
import { useFavoris } from "../lib/favoris";
import { useTitre } from "../lib/titre";

export function CommentCaMarche() {
  useTitre("Comment ça marche");
  const etapes = [
    ["Cherchez", "Par quartier, budget ou repère. Chaque annonce affiche le loyer, l'avance, la caution, les charges et la commission. Aucun compte n'est nécessaire pour chercher."],
    ["Réservez une visite", "Choisissez un créneau. Vous recevez la confirmation par SMS ou WhatsApp, avec un code de visite et l'adresse exacte."],
    ["Visitez avec un agent", "Un agent Xwé Tché vous attend sur place. Votre présence est validée par QR code."],
    ["Donnez votre avis", "« Satisfait » : vous pouvez candidater. « Pas satisfait » : dites pourquoi, et votre prochaine visite est gratuite."],
    ["Signez le bail", "Le propriétaire choisit son locataire. Vous signez le bail en ligne."],
    ["Payez la commission", "Un demi-mois de loyer, par MTN MoMo, Moov Money ou Celtiis Cash. Reçu immédiat par SMS et en PDF. Bienvenue chez vous."],
  ];
  return (
    <div className="wrap edito">
      <p className="eyebrow">Locataires</p>
      <h1 className="h1">De la recherche au bail, sans mauvaise surprise</h1>
      <p className="lede">Six étapes, et un seul paiement à Xwé Tché : à la signature du bail.</p>
      <ol className="parcours">
        {etapes.map(([t, p], i) => (
          <li key={t}>
            <h2 className="h3">{t}</h2>
            <p>{p}</p>
            {i === 3 && <Badge famille="info">Pas satisfait : 1 visite gratuite créditée</Badge>}
            {i === 5 && <Badge famille="succes">Paiement reçu</Badge>}
          </li>
        ))}
      </ol>
      <div className="encart">
        <h2 className="h3">Ce qui est gratuit, ce qui est payant</h2>
        <ul className="liste-check">
          <li><Check aria-hidden="true" /> Gratuit : inscription, recherche, favoris, alertes.</li>
          <li><Check aria-hidden="true" /> Gratuit : la visite suivant une visite « Pas satisfait » (jusqu'à 5 visites gratuites en cours).</li>
          <li><Check aria-hidden="true" /> Payant : la commission de ½ mois de loyer, uniquement à la signature du bail.</li>
        </ul>
        <p className="petit gris">[Première visite gratuite ou payante : à confirmer. Montant de la commission : à valider juridiquement.]</p>
      </div>
      <Link to="/louer" className="btn btn--principal" style={{ marginTop: "var(--s6)" }}>
        Voir les logements
      </Link>
    </div>
  );
}

export function Proprietaires() {
  useTitre("Mettre un bien en location");
  return (
    <div className="wrap edito">
      <p className="eyebrow">Propriétaires et gestionnaires</p>
      <h1 className="h1">Louez à des locataires qui ont déjà vu votre bien</h1>
      <p className="lede">
        Xwé Tché vérifie votre bien, organise les visites et vous présente des candidats. Vous gardez le choix de votre locataire.
      </p>
      <div className="edito__grille edito__grille--3">
        <div className="carte edito-carte">
          <span className="mono">01 · Dépôt</span>
          <h2 className="h3">Moins de 10 minutes</h2>
          <p>Photos guidées, adresse, repères, loyer, avance, caution et équipements. Votre brouillon est enregistré à chaque étape.</p>
        </div>
        <div className="carte edito-carte">
          <span className="mono">02 · Étude</span>
          <h2 className="h3">Réponse sous 48 h</h2>
          <p>Un compte à rebours vous montre où en est votre dossier. Si une correction est nécessaire, on vous dit exactement laquelle.</p>
          <p><Badge famille="neutre">En étude · 31 h restantes</Badge></p>
        </div>
        <div className="carte edito-carte">
          <span className="mono">03 · Contrôle</span>
          <h2 className="h3">Un agent passe sur place</h2>
          <p>Votre annonce reçoit le badge « Vérifié sur place », la marque de confiance que les locataires recherchent.</p>
          <p><Badge famille="succes">Vérifié sur place</Badge></p>
        </div>
      </div>
      <div className="encart">
        <h2 className="h3">Documents demandés</h2>
        <ul className="liste-check">
          <li><FileText aria-hidden="true" /> Une pièce d'identité (CIP, passeport ou NPI)</li>
          <li><FileText aria-hidden="true" /> Un document de propriété : titre foncier, attestation de détention coutumière, convention de vente ou permis d'habiter</li>
          <li><FileText aria-hidden="true" /> Pour un gestionnaire : le mandat écrit du propriétaire</li>
        </ul>
        <p className="petit gris">[Liste définitive à arrêter avec le juriste.]</p>
      </div>
      <Link to="/proprietaires/deposer" className="btn btn--principal" style={{ marginTop: "var(--s6)" }}>
        Déposer un bien
      </Link>
    </div>
  );
}

export function Confiance() {
  useTitre("Confiance et sécurité");
  const [signaler, setSignaler] = useState(false);
  return (
    <div className="wrap edito">
      <p className="eyebrow">Confiance et sécurité</p>
      <h1 className="h1">Comment un logement est vérifié</h1>
      <p className="lede">Aucune annonce n'est publiée sans être passée par ces quatre contrôles.</p>
      <div className="edito__grille edito__grille--2">
        {[
          ["Identité", "L'identité du propriétaire est vérifiée : pièce officielle et selfie."],
          ["Propriété", "Un document de propriété ou un mandat écrit est examiné par l'agence."],
          ["Étude", "Un agent d'étude contrôle les photos, les montants et les informations sous 48 h."],
          ["Sur place", "Un agent se rend dans le logement : photos de contrôle horodatées, GPS, compteurs, état général."],
        ].map(([t, p], i) => (
          <div key={t} className="carte edito-carte">
            <span className="mono">0{i + 1}</span>
            <h2 className="h3">{t}</h2>
            <p>{p}</p>
          </div>
        ))}
      </div>
      <div className="edito__grille edito__grille--2">
        <div className="encart" style={{ marginTop: 0 }}>
          <h2 className="h3">Xwé Tché ne vous demandera jamais</h2>
          <ul className="liste-check liste-x">
            <li><X aria-hidden="true" /> De payer avant d'avoir visité</li>
            <li><X aria-hidden="true" /> Votre code secret Mobile Money</li>
            <li><X aria-hidden="true" /> De verser de l'argent à un démarcheur ou sur un numéro personnel</li>
          </ul>
        </div>
        <div className="encart" style={{ marginTop: 0 }}>
          <h2 className="h3">Repérer une fausse annonce</h2>
          <ul className="liste-check">
            <li><Check aria-hidden="true" /> Sur Xwé Tché, chaque annonce porte une référence (ex. <span className="mono">XT-0412</span>) et une date de contrôle.</li>
            <li><Check aria-hidden="true" /> Nos messages viennent uniquement de l'expéditeur SMS « XweTche » et de notre WhatsApp vérifié.</li>
            <li><Timer aria-hidden="true" /> On vous presse de payer « avant les autres » ? C'est un signal d'arnaque.</li>
          </ul>
        </div>
      </div>
      <button type="button" className="btn btn--secondaire" style={{ marginTop: "var(--s6)" }} onClick={() => setSignaler(true)}>
        <Flag size={18} aria-hidden="true" /> Signaler une arnaque ou un faux compte
      </button>
      {signaler && <Signalement onFermer={() => setSignaler(false)} />}
    </div>
  );
}

export function MonEspace() {
  useTitre("Mes favoris");
  const { liste } = useFavoris();
  const favoris = ANNONCES.filter((a) => liste.includes(a.ref));
  return (
    <div className="wrap edito">
      <p className="eyebrow">Mon espace</p>
      <h1 className="h1">Mes favoris</h1>
      <div style={{ marginTop: "var(--s6)" }}>
        {favoris.length ? (
          <div className="grille-annonces">
            {favoris.map((a, i) => (
              <CarteAnnonce key={a.ref} annonce={a} index={i} />
            ))}
          </div>
        ) : (
          <Vide
            titre="Aucun favori pour l'instant"
            texte="Touchez le cœur sur une annonce pour la retrouver ici, même sans connexion."
            action={<Link to="/louer" className="btn btn--principal">Voir les logements</Link>}
          />
        )}
      </div>
    </div>
  );
}

export function BientotPage({ titre }: { titre: string }) {
  useTitre(titre);
  return (
    <div className="wrap edito">
      <h1 className="h1">{titre}</h1>
      <div style={{ marginTop: "var(--s6)" }}>
        <Vide
          titre="Cette page arrive bientôt"
          texte="Elle fait partie des prochaines étapes du site."
          action={<Link to="/" className="btn btn--secondaire">Retour à l'accueil</Link>}
        />
      </div>
    </div>
  );
}
