import { Flag } from "lucide-react";
import { useState } from "react";
import { TYPES, type Annonce } from "../data/annonces";
import { Feuille } from "./Feuille";

const MOTIFS_ANNONCE = [
  "Fausse annonce : ce logement n'existe pas",
  "Déjà loué",
  "Photos non conformes à la réalité",
  "Prix ou conditions différents de l'annonce",
  "On m'a demandé de l'argent avant la visite",
  "Autre",
];

const MOTIFS_GENERAL = [
  "Faux compte ou faux numéro se réclamant de Xwé Tché",
  "On m'a demandé de l'argent avant une visite",
  "On m'a demandé mon code Mobile Money",
  "Annonce frauduleuse vue ailleurs (Facebook, WhatsApp…)",
  "Autre",
];

// Signalement d'une annonce (LOC-11) ou d'une usurpation de la marque (chapitre 15).
export function Signalement({ annonce, onFermer }: { annonce?: Annonce; onFermer: () => void }) {
  const motifs = annonce ? MOTIFS_ANNONCE : MOTIFS_GENERAL;
  const [motif, setMotif] = useState("");
  const [detail, setDetail] = useState("");
  const [tel, setTel] = useState("");
  const [numero, setNumero] = useState<string | null>(null);
  const detailRequis = motif === "Autre" || !annonce;
  const valide = motif && (!detailRequis || detail.trim().length >= 10);

  if (numero)
    return (
      <Feuille titre="Merci, c'est signalé" onFermer={onFermer}>
        <div className="confirmation">
          <span className="signal-ok">
            <Flag aria-hidden="true" />
          </span>
          <p className="gris">
            Notre équipe examine votre signalement sous 24 h.
            {annonce ? " Si l'annonce est frauduleuse, elle est retirée immédiatement." : ""}
            {tel ? " Nous vous recontacterons si besoin." : ""}
          </p>
          <div className="recap">
            <strong>{motif}</strong>
            <span className="mono gris">Signalement n° {numero}</span>
          </div>
          {motif.includes("argent") || motif.includes("Mobile Money") ? (
            <div className="bandeau bandeau--info" style={{ textAlign: "left" }}>
              Ne versez rien. Xwé Tché ne demande jamais de paiement avant la visite, ni votre code Mobile Money.
            </div>
          ) : null}
          <button type="button" className="btn btn--secondaire btn--bloc" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </Feuille>
    );

  return (
    <Feuille
      titre={annonce ? "Signaler cette annonce" : "Signaler une arnaque ou un faux compte"}
      soustitre={
        annonce ? (
          <>
            {TYPES[annonce.type]} · {annonce.quartier} · <span className="mono">Réf. {annonce.ref}</span>
          </>
        ) : (
          "Votre signalement est confidentiel."
        )
      }
      onFermer={onFermer}
    >
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (valide) setNumero(`SG-${Math.floor(1000 + Math.random() * 9000)}`);
        }}
      >
        <fieldset className="champ champ--groupe">
          <legend>Que se passe-t-il ?</legend>
          <div className="choix">
            {motifs.map((m) => (
              <label key={m} className="choix__option">
                <input type="radio" name="motif" value={m} checked={motif === m} onChange={() => setMotif(m)} />
                <span>{m}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="champ">
          <label htmlFor="sig-detail">
            Détails {detailRequis ? "" : <span className="gris">(facultatif)</span>}
          </label>
          <textarea
            id="sig-detail"
            rows={3}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={annonce ? "Ce que vous avez constaté" : "Numéro utilisé, nom affiché, lien de l'annonce…"}
          />
          {detailRequis && <span className="aide">Au moins 10 caractères.</span>}
        </div>
        <div className="champ">
          <label htmlFor="sig-tel">
            Votre numéro <span className="gris">(facultatif)</span>
          </label>
          <input id="sig-tel" type="tel" inputMode="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
          <span className="aide">Pour que nous puissions vous recontacter.</span>
        </div>
        <button type="submit" className="btn btn--principal btn--bloc" disabled={!valide}>
          Envoyer le signalement
        </button>
      </form>
    </Feuille>
  );
}
