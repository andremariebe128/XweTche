import { useState } from "react";
import { Link } from "react-router-dom";
import { TYPES, type Annonce } from "../data/annonces";
import { api, messageErreur } from "../lib/api";
import { useCreneaux } from "../lib/annonces";
import { rafraichirEtat, useEtat } from "../lib/compte";
import { Feuille } from "./Feuille";
import { Porte } from "./Marque";

const JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
// Feuille de réservation de visite : créneau → téléphone → confirmation. Les créneaux libres viennent de l'API.
export function Reservation({ annonce, onFermer }: { annonce: Annonce; onFermer: () => void }) {
  const { donnees: dispo, chargement, erreur: erreurDispo } = useCreneaux(annonce.ref);
  const jours = (dispo?.jours ?? []).map((j) => ({ ...j, d: new Date(`${j.date}T12:00:00Z`) }));
  const [jour, setJour] = useState(0);
  const [creneau, setCreneau] = useState<string | null>(null); // iso du créneau
  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const { compte } = useEtat();
  const [tel, setTel] = useState(compte?.tel ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [gratuite, setGratuite] = useState(false);

  const courant = jours[jour];
  const choisi = courant?.creneaux.find((c) => c.iso === creneau);
  const dateTexte = courant ? `${JOURS[courant.d.getUTCDay()]} ${courant.d.getUTCDate().toString().padStart(2, "0")}/${(courant.d.getUTCMonth() + 1).toString().padStart(2, "0")}` : "";
  const telValide = tel.replace(/\D/g, "").length >= 8;

  async function reserver() {
    if (!choisi || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await api.post<{ gratuite: boolean }>("/visites", { ref: annonce.ref, creneau: choisi.iso });
      setGratuite(r.gratuite);
      await rafraichirEtat();
      setEtape(3);
    } catch (er) {
      setErreur(messageErreur(er));
    } finally {
      setEnCours(false);
    }
  }

  if (!compte)
    return (
      <Feuille titre="Connectez-vous pour réserver" onFermer={onFermer}>
        <div className="confirmation">
          <p className="gris">Un numéro de téléphone vérifié par SMS est nécessaire pour réserver une visite. C'est rapide et gratuit.</p>
          <Link to="/connexion" className="btn btn--principal btn--bloc">
            Me connecter
          </Link>
        </div>
      </Feuille>
    );

  if (compte?.role === "proprietaire")
    return (
      <Feuille titre="Réservé aux locataires" onFermer={onFermer}>
        <div className="confirmation">
          <p className="gris">Vous êtes connecté avec un compte propriétaire. Les visites se réservent avec un compte locataire.</p>
          <button type="button" className="btn btn--secondaire btn--bloc" onClick={onFermer}>
            Fermer
          </button>
        </div>
      </Feuille>
    );

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
                <button key={j.date} type="button" className="jour" aria-pressed={i === jour} onClick={() => { setJour(i); setCreneau(null); }}>
                  {JOURS[j.d.getUTCDay()]}
                  <strong>{j.d.getUTCDate()}</strong>
                </button>
              ))}
            </div>
            {chargement && <p className="gris" role="status">Chargement des créneaux…</p>}
            {erreurDispo && <div className="bandeau bandeau--erreur" role="alert">{erreurDispo}</div>}
            {!chargement && !erreurDispo && jours.length === 0 && <p className="gris">Aucun créneau n'est ouvert pour le moment. Revenez bientôt.</p>}
            <div className="creneaux" role="group" aria-label="Heure de la visite">
              {(courant?.creneaux ?? []).map((c) => (
                <button key={c.iso} type="button" className="creneau" disabled={!c.libre} aria-pressed={creneau === c.iso} onClick={() => setCreneau(c.iso)}>
                  {c.heure}
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
              void reserver();
            }}
          >
            <div className="champ">
              <label htmlFor="resa-tel">Numéro de téléphone</label>
              <input id="resa-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="01 97 00 00 00" value={tel} onChange={(e) => setTel(e.target.value)} />
              <span className="aide">Vous recevrez un code par SMS pour confirmer, puis le rendez-vous par SMS ou WhatsApp.</span>
            </div>
            <div className="recap" style={{ marginTop: "var(--s4)" }}>
              <strong>
                {dateTexte} à {choisi?.heure}
              </strong>
              <span className="petit gris">Rien à payer pour réserver.</span>
            </div>
            {erreur && <div className="bandeau bandeau--erreur" role="alert" style={{ marginTop: "var(--s3)" }}>{erreur}</div>}
            <div className="feuille__pied">
              <button type="submit" className="btn btn--principal btn--bloc" disabled={!telValide || enCours}>
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
              {dateTexte} à {choisi?.heure}
            </p>
            {gratuite && <p className="petit">Cette visite utilise l'une de vos visites gratuites.</p>}
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
