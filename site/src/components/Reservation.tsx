import { useState } from "react";
import { Link } from "react-router-dom";
import { TYPES, type Annonce } from "../data/annonces";
import { code, id, majEtat, useEtat } from "../lib/compte";
import { Feuille } from "./Feuille";
import { Porte } from "./Marque";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const CRENEAUX = ["08h00", "09h00", "10h00", "11h00", "14h00", "15h00", "16h00", "17h00", "18h00"];

function prochainsJours() {
  const auj = new Date();
  return Array.from({ length: 10 }, (_, i) => {
    const d = new Date(auj);
    d.setDate(auj.getDate() + i + 1);
    return d;
  }).filter((d) => d.getDay() !== 0);
}

// Feuille de réservation de visite : créneau → téléphone → confirmation.
export function Reservation({ annonce, onFermer }: { annonce: Annonce; onFermer: () => void }) {
  const jours = prochainsJours();
  const [jour, setJour] = useState(0);
  const [creneau, setCreneau] = useState<string | null>(null);
  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const { compte } = useEtat();
  const [tel, setTel] = useState(compte?.tel ?? "");

  const d = jours[jour];
  const dateTexte = `${JOURS[d.getDay()]} ${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
  // Créneaux déjà pris, pour l'exemple
  const pris = (c: string) => (c.charCodeAt(1) + jour) % 4 === 0;
  const telValide = tel.replace(/\D/g, "").length >= 8;

  return (
    <Feuille
      titre={etape === 1 ? "Choisissez un créneau" : etape === 2 ? "Votre numéro de téléphone" : "Visite demandée"}
      surtitre={etape < 3 ? `Étape ${etape} sur 2` : undefined}
      soustitre={
        etape < 3 ? (
          <>
            {TYPES[annonce.type]} · {annonce.quartier} · <span className="mono">Réf. {annonce.ref}</span>
          </>
        ) : undefined
      }
      onFermer={onFermer}
    >
        {etape === 1 && (
          <>
            <div className="jours" role="group" aria-label="Jour de la visite">
              {jours.map((j, i) => (
                <button key={i} type="button" className="jour" aria-pressed={i === jour} onClick={() => { setJour(i); setCreneau(null); }}>
                  {JOURS[j.getDay()]}
                  <strong>{j.getDate()}</strong>
                </button>
              ))}
            </div>
            <div className="creneaux" role="group" aria-label="Heure de la visite">
              {CRENEAUX.map((c) => (
                <button key={c} type="button" className="creneau" disabled={pris(c)} aria-pressed={creneau === c} onClick={() => setCreneau(c)}>
                  {c}
                </button>
              ))}
            </div>
            <div className="feuille__pied">
              <button type="button" className="btn btn--principal btn--bloc" disabled={!creneau} onClick={() => setEtape(2)}>
                Continuer
              </button>
              <p className="petit gris" style={{ margin: 0, textAlign: "center" }}>
                Un agent Xwé Tché vous accompagne pendant la visite.
              </p>
            </div>
          </>
        )}

        {etape === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!telValide) return;
              if (compte) {
                const [h, m] = creneau!.split("h").map(Number);
                const quand = new Date(d);
                quand.setHours(h, m, 0, 0);
                majEtat((et) => ({
                  ...et,
                  visites: [...et.visites, { id: id(), ref: annonce.ref, date: quand.toISOString(), code: code(), statut: "a-venir" }],
                }));
              }
              setEtape(3);
            }}
          >
            <div className="champ">
              <label htmlFor="resa-tel">Numéro de téléphone</label>
              <input id="resa-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="01 97 00 00 00" value={tel} onChange={(e) => setTel(e.target.value)} />
              <span className="aide">Vous recevrez un code par SMS pour confirmer, puis le rendez-vous par SMS ou WhatsApp.</span>
            </div>
            <div className="recap" style={{ marginTop: "var(--s4)" }}>
              <strong>
                {dateTexte} à {creneau}
              </strong>
              <span className="petit gris">Rien à payer pour réserver.</span>
            </div>
            <div className="feuille__pied">
              <button type="submit" className="btn btn--principal btn--bloc" disabled={!telValide}>
                Réserver la visite
              </button>
              <button type="button" className="btn btn--texte" onClick={() => setEtape(1)}>
                Changer de créneau
              </button>
            </div>
          </form>
        )}

        {etape === 3 && (
          <div className="confirmation">
            <Porte taille={40} anime />
            <p className="h3">
              {dateTexte} à {creneau}
            </p>
            <p className="gris">
              Vous allez recevoir un SMS avec votre code de visite et l'adresse exacte. Empêché ? Annulez au moins 12 h avant pour garder vos
              visites gratuites.
            </p>
            <div className="recap">
              <span className="petit">
                {TYPES[annonce.type]} · {annonce.quartier}
              </span>
              <span className="mono gris">Réf. {annonce.ref}</span>
            </div>
            <div className="bandeau bandeau--info" style={{ textAlign: "left" }}>
              Ne payez rien en dehors de Xwé Tché. Nous ne demandons jamais d'argent avant la visite.
            </div>
            {compte ? (
              <Link to="/mon-espace" className="btn btn--secondaire btn--bloc">
                Voir mes visites
              </Link>
            ) : (
              <button type="button" className="btn btn--secondaire btn--bloc" onClick={onFermer}>
                Retour à l'annonce
              </button>
            )}
          </div>
        )}
    </Feuille>
  );
}
