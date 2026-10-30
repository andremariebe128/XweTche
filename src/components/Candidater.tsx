import { useState } from "react";
import { TYPES } from "../data/annonces";
import { api, messageErreur } from "../lib/api";
import { useAnnonce } from "../lib/annonces";
import { rafraichirEtat, telLisible, useEtat } from "../lib/compte";
import { fcfa } from "../lib/format";
import { Feuille } from "./Feuille";
import { Porte } from "./Marque";

// Candidature en un clic (LOC-09) : le dossier reprend les informations du compte.
export function Candidater({ refAnnonce, onFermer }: { refAnnonce: string; onFermer: () => void }) {
  const { compte } = useEtat();
  const annonce = useAnnonce(refAnnonce).donnees;
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
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
        onSubmit={async (e) => {
          e.preventDefault();
          if (enCours) return;
          setEnCours(true);
          setErreur(null);
          try {
            await api.post("/candidatures", { ref: refAnnonce, profession: profession.trim() || undefined });
            await rafraichirEtat();
            setEnvoye(true);
          } catch (er) {
            setErreur(messageErreur(er));
          } finally {
            setEnCours(false);
          }
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
        {erreur && <div className="bandeau bandeau--erreur" role="alert">{erreur}</div>}
        <button type="submit" className="btn btn--principal btn--bloc" disabled={enCours}>
          Envoyer ma candidature
        </button>
        <p className="petit gris" style={{ margin: 0, textAlign: "center" }}>
          Rien à payer maintenant. La commission n'est due qu'à la signature du bail.
        </p>
      </form>
    </Feuille>
  );
}
