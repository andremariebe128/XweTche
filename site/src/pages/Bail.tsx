import { ArrowLeft, Check, Lock, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Porte } from "../components/Marque";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import { ANNONCES, TYPES, commission } from "../data/annonces";
import { code, majEtat, telMasque, useEtat, type Operateur, type Recu } from "../lib/compte";
import { fcfa } from "../lib/format";
import { libelleCommission, lireParametres } from "../lib/parametres";
import { journaliser, majAgence } from "../lib/agence";
import { useTitre } from "../lib/titre";

const OPERATEURS: Operateur[] = ["MTN MoMo", "Moov Money", "Celtiis Cash"];

// Fin du parcours locataire : résumé du bail → signature électronique → paiement de la commission → bienvenue (5.3, PAY-01 à PAY-05).
export default function Bail() {
  const { ref = "" } = useParams();
  const etat = useEtat();
  const annonce = ANNONCES.find((a) => a.ref === ref);
  const candidature = etat.candidatures.find((c) => c.ref === ref);
  const [recuFrais, setRecuFrais] = useState<Recu | null>(null);
  useTitre("Mon bail");
  // Chaque étape repart du haut de la page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [candidature?.statut, recuFrais]);

  if (!etat.compte) return <Navigate to={`/connexion?retour=/bail/${ref}`} replace />;
  if (recuFrais && annonce) return <Bienvenue recu={recuFrais} quartier={annonce.quartier} />;
  if (!annonce || !candidature || candidature.statut === "envoyee" || candidature.statut === "non-retenue")
    return (
      <div className="wrap edito">
        <Vide
          titre="Aucun bail à signer pour ce logement"
          texte="Le bail apparaît ici quand le propriétaire vous a choisi comme locataire."
          action={
            <Link to="/mon-espace?onglet=candidatures" className="btn btn--secondaire">
              Voir mes candidatures
            </Link>
          }
        />
      </div>
    );

  const montant = commission(annonce);
  const recu = etat.recus.find((r) => r.ref === ref);

  return (
    <div className="wrap edito bail">
      <Link to="/mon-espace?onglet=candidatures" className="btn btn--texte bail__retour">
        <ArrowLeft size={18} aria-hidden="true" /> Mes candidatures
      </Link>
      <ol className="bail__etapes" aria-label="Étapes">
        {["Bail", "Signature", "Paiement"].map((e, i) => {
          const fait = i === 0 ? candidature.statut !== "retenue" : i === 1 ? candidature.statut !== "retenue" : candidature.statut === "payee";
          return (
            <li key={e} className={fait ? "est-fait" : ""}>
              <span className="mono">{fait ? <Check size={14} aria-hidden="true" /> : `0${i + 1}`}</span> {e}
            </li>
          );
        })}
      </ol>
      <div className="bail__grille">
        <div>
          {candidature.statut === "retenue" && <Signature refAnnonce={ref} />}
          {candidature.statut === "bail-signe" && <Paiement refAnnonce={ref} montant={montant} onPaye={setRecuFrais} />}
          {candidature.statut === "payee" && (
            <div className="carte bail__carte">
              <Badge famille="succes">Bail signé et commission payée</Badge>
              <h1 className="h2">Tout est réglé</h1>
              <p className="gris">Votre reçu est disponible à tout moment dans votre espace.</p>
              {recu && (
                <Link to={`/recu/${recu.numero}`} className="btn btn--principal">
                  Voir mon reçu
                </Link>
              )}
            </div>
          )}
        </div>
        <aside className="carte bail__resume">
          <span className="petit gris">Logement</span>
          <strong>
            {TYPES[annonce.type]} · {annonce.quartier}
          </strong>
          <span className="mono petit gris">Réf. {annonce.ref}</span>
          <dl className="bail__montants">
            <div>
              <dt>Loyer mensuel</dt>
              <dd>{fcfa(annonce.loyer)}</dd>
            </div>
            <div>
              <dt>Avance ({annonce.avanceMois} mois), au propriétaire</dt>
              <dd>{fcfa(annonce.loyer * annonce.avanceMois)}</dd>
            </div>
            <div>
              <dt>Caution ({annonce.cautionMois} mois), au propriétaire</dt>
              <dd>{fcfa(annonce.loyer * annonce.cautionMois)}</dd>
            </div>
            <div className="bail__commission">
              <dt>Commission Xwé Tché ({libelleCommission()})</dt>
              <dd>{fcfa(montant)}</dd>
            </div>
          </dl>
          <p className="petit gris" style={{ margin: 0 }}>
            Seule la commission se paie sur Xwé Tché. L'avance et la caution se règlent au propriétaire, contre reçu, à la remise des clés.
          </p>
        </aside>
      </div>
    </div>
  );
}

function Signature({ refAnnonce }: { refAnnonce: string }) {
  const { compte } = useEtat();
  const [lu, setLu] = useState(false);
  const [nom, setNom] = useState("");
  const [essai, setEssai] = useState(false);
  const nomOk = nom.trim().toLowerCase() === compte?.nom.trim().toLowerCase();

  return (
    <form
      className="carte bail__carte formulaire"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setEssai(true);
        if (!lu || !nomOk) return;
        majEtat((et) => ({ ...et, candidatures: et.candidatures.map((c) => (c.ref === refAnnonce ? { ...c, statut: "bail-signe" } : c)) }));
      }}
    >
      <div>
        <Badge famille="succes">Le propriétaire vous a choisi</Badge>
        <h1 className="h2" style={{ marginTop: "var(--s3)" }}>
          Relisez et signez votre bail
        </h1>
      </div>
      <details className="bail__texte">
        <summary>Lire le bail complet</summary>
        <ol>
          <li>Durée : un an, renouvelable par tacite reconduction.</li>
          <li>Loyer payable d'avance, au plus tard le 5 de chaque mois.</li>
          <li>La caution est restituée à la sortie, déduction faite des réparations constatées à l'état des lieux.</li>
          <li>Préavis d'un mois pour le locataire, de trois mois pour le propriétaire.</li>
          <li>État des lieux d'entrée et de sortie en présence d'un agent Xwé Tché.</li>
        </ol>
        <p className="petit gris">[Modèle de bail à valider avec le juriste.]</p>
      </details>
      <label className="choix__option">
        <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} />
        <span>J'ai lu le bail et j'en accepte les conditions.</span>
      </label>
      {essai && !lu && <span className="champ__erreur">Cochez la case pour continuer.</span>}
      <div className={`champ${essai && !nomOk ? " champ--erreur" : ""}`}>
        <label htmlFor="bail-nom">Signature : écrivez votre nom</label>
        <input id="bail-nom" className="bail__signature" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" autoComplete="off" />
        {essai && !nomOk ? (
          <span className="champ__erreur">Écrivez votre nom tel qu'il figure sur votre compte : {compte?.nom}.</span>
        ) : (
          <span className="aide">Votre signature électronique a la même valeur qu'une signature manuscrite.</span>
        )}
      </div>
      <button type="submit" className="btn btn--principal btn--bloc">
        Signer le bail
      </button>
    </form>
  );
}

function Paiement({ refAnnonce, montant, onPaye }: { refAnnonce: string; montant: number; onPaye: (r: Recu) => void }) {
  const { compte } = useEtat();
  const [operateur, setOperateur] = useState<Operateur | null>(null);
  const [autre, setAutre] = useState(false);
  const [tel, setTel] = useState("");
  const [phase, setPhase] = useState<"choix" | "attente" | "echec">("choix");
  const numero = autre ? tel.replace(/\D/g, "") : (compte?.tel ?? "");
  const pret = operateur && numero.length >= 8;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  // Simulation de la confirmation de l'opérateur
  useEffect(() => {
    if (phase !== "attente" || !operateur) return;
    const t = setTimeout(() => {
      const maintenant = new Date();
      const recu: Recu = {
        numero: `XT-R-${maintenant.getFullYear()}-${code(6)}`,
        ref: refAnnonce,
        montant,
        operateur,
        tel: numero,
        date: maintenant.toISOString(),
        transaction: `${operateur.slice(0, 2).toUpperCase()}${code(10)}`,
      };
      majEtat((e) => ({
        ...e,
        recus: [recu, ...e.recus],
        candidatures: e.candidatures.map((c) => (c.ref === refAnnonce ? { ...c, statut: "payee" } : c)),
      }));
      // Côté agence : le bail passe en « payé » et le paiement entre dans le suivi des commissions
      majAgence((a) => ({
        ...a,
        baux: [
          {
            id: recu.numero,
            ref: refAnnonce,
            locataire: compte?.nom ?? "",
            proprietaire: "",
            loyer: Math.round(montant / lireParametres().commission),
            commission: montant,
            statut: "paye",
            signeLe: maintenant.toISOString(),
            paiement: { moyen: operateur, date: recu.date, recu: recu.numero, transaction: recu.transaction },
          },
          ...a.baux.filter((b) => !(b.ref === refAnnonce && b.locataire === compte?.nom)),
        ],
      }));
      journaliser(`Paiement ${operateur} reçu`, `${refAnnonce} · ${fcfa(montant)}`);
      onPaye(recu);
    }, 6000);
    return () => clearTimeout(t);
  }, [phase, operateur, numero, montant, refAnnonce, onPaye, compte?.nom]);

  if (phase === "attente")
    return (
      <div className="carte bail__carte paiement-attente" role="status">
        <span className="signal-ok">
          <Smartphone aria-hidden="true" />
        </span>
        <Badge famille="neutre">Paiement en attente</Badge>
        <h1 className="h2">Validez sur votre téléphone</h1>
        <ol className="paiement-attente__etapes">
          <li>
            Une demande de paiement <strong>{operateur}</strong> de <strong className="mono">{fcfa(montant)}</strong> arrive sur le {telMasque(numero)}.
          </li>
          <li>Ouvrez-la et entrez votre code secret, sur votre téléphone uniquement.</li>
          <li>Cette page se met à jour toute seule dès la confirmation.</li>
        </ol>
        <div className="paiement-attente__barre" aria-hidden="true" />
        <div className="bandeau bandeau--info">
          <Lock aria-hidden="true" />
          Xwé Tché ne vous demandera jamais votre code secret, ni par téléphone ni par message.
        </div>
        <button type="button" className="btn btn--texte" onClick={() => setPhase("echec")}>
          Je n'ai rien reçu
        </button>
      </div>
    );

  return (
    <form
      className="carte bail__carte formulaire"
      onSubmit={(e) => {
        e.preventDefault();
        if (pret) setPhase("attente");
      }}
    >
      <div>
        <Badge famille="succes">Bail signé</Badge>
        <h1 className="h2" style={{ marginTop: "var(--s3)" }}>
          Payez la commission
        </h1>
        <p className="gris" style={{ margin: "var(--s2) 0 0" }}>
          Le seul paiement à Xwé Tché, pour tout le parcours.
        </p>
      </div>
      {phase === "echec" && (
        <div className="bandeau bandeau--erreur" role="alert">
          Le paiement n'a pas abouti. Aucun montant n'a été débité. Vérifiez votre solde et réessayez.
        </div>
      )}
      <fieldset className="champ champ--groupe">
        <legend>Moyen de paiement</legend>
        <div className="choix">
          {OPERATEURS.map((o) => (
            <label key={o} className="choix__option">
              <input type="radio" name="operateur" checked={operateur === o} onChange={() => setOperateur(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {autre ? (
        <div className="champ">
          <label htmlFor="paie-tel">Numéro Mobile Money</label>
          <div className="champ-tel">
            <span className="champ-tel__indicatif">+229</span>
            <input id="paie-tel" type="tel" inputMode="tel" value={tel} onChange={(e) => setTel(e.target.value)} autoFocus />
          </div>
        </div>
      ) : (
        <div className="recap">
          <span className="petit gris">Numéro débité</span>
          <strong className="mono">{telMasque(numero)}</strong>
          <button type="button" className="btn btn--texte paiement__autre" onClick={() => setAutre(true)}>
            Payer avec un autre numéro
          </button>
        </div>
      )}
      <button type="submit" className="btn btn--principal btn--bloc" disabled={!pret}>
        Payer {fcfa(montant)}
      </button>
      <p className="petit gris" style={{ margin: 0, textAlign: "center" }}>
        Reçu immédiat par SMS et dans votre espace.
      </p>
    </form>
  );
}

// Moment de marque : la porte grande ouverte sur fond lagune (6.7).
function Bienvenue({ recu, quartier }: { recu: Recu; quartier: string }) {
  useTitre("Bienvenue chez vous");
  return (
    <section className="bienvenue">
      <div className="wrap bienvenue__contenu">
        <Porte taille={96} battant="var(--blanc)" anime className="bienvenue__porte" />
        <h1 className="h1">Bienvenue chez vous</h1>
        <p className="lede">Votre bail à {quartier} est signé et la commission est payée. Un agent vous contacte pour l'état des lieux et la remise des clés.</p>
        <p className="mono bienvenue__recu">
          Reçu {recu.numero} · {fcfa(recu.montant)}
        </p>
        <div className="bienvenue__actions">
          <Link to={`/recu/${recu.numero}`} className="btn btn--blanc">
            Voir mon reçu
          </Link>
          <Link to="/mon-espace" className="btn btn--secondaire-blanc">
            Retour à mon espace
          </Link>
        </div>
      </div>
    </section>
  );
}
