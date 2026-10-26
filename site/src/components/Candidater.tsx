import { useState } from "react";
import { ANNONCES, TYPES } from "../data/annonces";
import { id, majEtat, telLisible, useEtat } from "../lib/compte";
import { fcfa } from "../lib/format";
import { Feuille } from "./Feuille";
import { Porte } from "./Marque";

// Candidature en un clic (LOC-09) : le dossier reprend les informations du compte.
export function Candidater({ refAnnonce, onFermer }: { refAnnonce: string; onFermer: () => void }) {
  const { compte } = useEtat();
  const annonce = ANNONCES.find((a) => a.ref === refAnnonce);
  const [profession, setProfession] = useState("");
  const [envoye, setEnvoye] = useState(false);
  const soustitre = annonce ? `${TYPES[annonce.type]} · ${annonce.quartier} · ${fcfa(annonce.loyer)} / mois` : `Réf. ${refAnnonce}`;

  if (envoye)
    return (
      <Feuille titre="Candidature envoyée" soustitre={soustitre} onFermer={onFermer}>
        <div className="confirmation">
          <Porte taille={40} anime />
          <p className="gris">Le propriétaire vous répond en général sous 48 h. Vous recevrez un SMS dès qu'il a choisi.</p>
          <button type="button" className="btn btn--secondaire btn--bloc" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </Feuille>
    );

  return (
    <Feuille titre="Candidater pour ce logement" soustitre={soustitre} onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          majEtat((et) => ({
            ...et,
            candidatures: [...et.candidatures.filter((c) => c.ref !== refAnnonce), { id: id(), ref: refAnnonce, date: new Date().toISOString(), statut: "envoyee" }],
          }));
          setEnvoye(true);
        }}
      >
        <div className="recap">
          <span className="petit gris">Votre dossier envoyé au propriétaire</span>
          <strong>{compte?.nom}</strong>
          <span className="petit">{compte && telLisible(compte.tel)} · identité à vérifier</span>
        </div>
        <div className="champ">
          <label htmlFor="cand-pro">
            Profession <span className="gris">(facultatif)</span>
          </label>
          <input id="cand-pro" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Ex. enseignant, commerçante…" />
          <span className="aide">Les propriétaires répondent plus vite aux dossiers complets.</span>
        </div>
        <button type="submit" className="btn btn--principal btn--bloc">
          Envoyer ma candidature
        </button>
        <p className="petit gris" style={{ margin: 0, textAlign: "center" }}>
          Rien à payer maintenant. La commission n'est due qu'à la signature du bail.
        </p>
      </form>
    </Feuille>
  );
}
