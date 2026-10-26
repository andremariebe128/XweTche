import { useState } from "react";
import { Link } from "react-router-dom";
import { ANNONCES, TYPES, slugQuartier } from "../data/annonces";
import { majEtat, type Visite } from "../lib/compte";
import { useParametres } from "../lib/parametres";
import { Feuille } from "./Feuille";
import { Porte } from "./Marque";


// Retour obligatoire après la visite : « Satisfait » ou « Pas satisfait » avec motif (5.3, LOC-06).
export function RetourVisite({ visite, onFermer, onCandidater }: { visite: Visite; onFermer: () => void; onCandidater: () => void }) {
  const annonce = ANNONCES.find((a) => a.ref === visite.ref);
  const { motifsVisite, plafondVisites } = useParametres();
  const [avis, setAvis] = useState<"satisfait" | "pas-satisfait" | null>(null);
  const [motif, setMotif] = useState("");
  const [fait, setFait] = useState(false);
  const valide = avis === "satisfait" || (avis === "pas-satisfait" && motif);

  function envoyer() {
    if (!valide) return;
    majEtat((e) => ({
      ...e,
      visitesGratuites: avis === "pas-satisfait" ? Math.min(e.visitesGratuites + 1, plafondVisites) : e.visitesGratuites,
      visites: e.visites.map((v) => (v.id === visite.id ? { ...v, statut: avis!, motif: avis === "pas-satisfait" ? motif : undefined } : v)),
    }));
    setFait(true);
  }

  const soustitre = annonce ? `${TYPES[annonce.type]} · ${annonce.quartier} · Réf. ${annonce.ref}` : `Réf. ${visite.ref}`;

  if (fait && avis === "satisfait")
    return (
      <Feuille titre="Merci pour votre avis" soustitre={soustitre} onFermer={onFermer}>
        <div className="confirmation">
          <Porte taille={40} anime />
          <p className="gris">Ce logement vous plaît ? Candidatez maintenant : le propriétaire voit les candidatures dans l'ordre d'arrivée.</p>
          <button type="button" className="btn btn--principal btn--bloc" onClick={onCandidater}>
            Candidater pour ce logement
          </button>
          <button type="button" className="btn btn--texte" onClick={onFermer}>
            Plus tard
          </button>
        </div>
      </Feuille>
    );

  if (fait)
    return (
      <Feuille titre="Une visite gratuite vous est offerte" soustitre={soustitre} onFermer={onFermer}>
        <div className="confirmation">
          <span className="compteur-visites compteur-visites--grand">
            <Porte taille={16} /> +1 visite gratuite
          </span>
          <p className="gris">Désolé que ce logement ne vous ait pas convenu. Votre avis aide nos agents à améliorer les annonces.</p>
          {annonce && (
            <Link to={`/louer/cotonou/${slugQuartier(annonce.quartier)}`} className="btn btn--principal btn--bloc" onClick={onFermer}>
              Voir d'autres logements à {annonce.quartier}
            </Link>
          )}
          <button type="button" className="btn btn--texte" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </Feuille>
    );

  return (
    <Feuille titre="Comment s'est passée la visite ?" soustitre={soustitre} onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          envoyer();
        }}
      >
        <fieldset className="champ champ--groupe">
          <legend>Le logement correspond-il à l'annonce ?</legend>
          <div className="choix">
            <label className="choix__option">
              <input type="radio" name="avis" checked={avis === "satisfait"} onChange={() => setAvis("satisfait")} />
              <span>Satisfait</span>
            </label>
            <label className="choix__option">
              <input type="radio" name="avis" checked={avis === "pas-satisfait"} onChange={() => setAvis("pas-satisfait")} />
              <span>Pas satisfait</span>
            </label>
          </div>
        </fieldset>
        {avis === "pas-satisfait" && (
          <fieldset className="champ champ--groupe">
            <legend>Pourquoi ?</legend>
            <div className="pastilles pastilles--multi">
              {motifsVisite.map((m) => (
                <button key={m} type="button" className="pastille" aria-pressed={motif === m} onClick={() => setMotif(m)}>
                  {m}
                </button>
              ))}
            </div>
            <span className="aide">Votre prochaine visite sera gratuite.</span>
          </fieldset>
        )}
        <button type="submit" className="btn btn--principal btn--bloc" disabled={!valide}>
          Envoyer mon avis
        </button>
      </form>
    </Feuille>
  );
}
