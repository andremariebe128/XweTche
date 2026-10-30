import { ArrowLeft, Check, Lock, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Porte } from "../components/Marque";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import { TYPES } from "../data/annonces";
import { api, messageErreur } from "../lib/api";
import { useAnnonce } from "../lib/annonces";
import { rafraichirEtat, telMasque, useEtat, type Operateur, type Recu } from "../lib/compte";
import { fcfa } from "../lib/format";
import { libelleCommission } from "../lib/parametres";
import { useTitre } from "../lib/titre";

interface InfoBail {
  commission: number;
  candidature: "retenue" | "bail-signe" | "payee" | "envoyee" | "non-retenue" | null;
  autorise: boolean;
}

const OPERATEURS: Operateur[] = ["MTN MoMo", "Moov Money", "Celtiis Cash"];

// Fin du parcours locataire : résumé du bail → signature électronique → paiement de la commission → bienvenue (5.3, PAY-01 à PAY-05).
export default function Bail() {
  const { ref = "" } = useParams();
  const etat = useEtat();
  const { donnees: annonce } = useAnnonce(ref);
  const [info, setInfo] = useState<InfoBail | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const charger = () =>
    api
      .get<InfoBail>(`/baux/${encodeURIComponent(ref)}`)
      .then((i) => {
        setInfo(i);
        setErreur(null);
      })
      .catch((e) => setErreur(messageErreur(e)));
  useEffect(() => {
    if (etat.compte) void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, etat.compte?.tel]);
  const candidature = info?.candidature ? { statut: info.candidature } : undefined;
  const [recuFrais, setRecuFrais] = useState<Recu | null>(null);
  useTitre("Mon bail");
  // Chaque étape repart du haut de la page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [candidature?.statut, recuFrais]);

  if (!etat.compte) return <Navigate to={`/connexion?retour=/bail/${ref}`} replace />;
  if (recuFrais && annonce) return <Bienvenue recu={recuFrais} quartier={annonce.quartier} />;
  if (erreur && !info) return <div className="wrap edito"><div className="bandeau bandeau--erreur" role="alert">{erreur}</div></div>;
  if (!annonce || !info) return <div className="wrap edito" aria-busy="true">Chargement…</div>;
  if (!candidature || candidature.statut === "envoyee" || candidature.statut === "non-retenue")
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

  const montant = info.commission;
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
          {candidature.statut === "retenue" && <Signature refAnnonce={ref} onFait={charger} />}
          {candidature.statut === "bail-signe" && <Paiement refAnnonce={ref} montant={montant} onPaye={(r) => { setRecuFrais(r); void charger(); }} />}
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

function Signature({ refAnnonce, onFait }: { refAnnonce: string; onFait: () => void }) {
  const { compte } = useEtat();
  const [lu, setLu] = useState(false);
  const [nom, setNom] = useState("");
  const [essai, setEssai] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const nomOk = nom.trim().toLowerCase() === compte?.nom.trim().toLowerCase();

  return (
    <form
      className="carte bail__carte formulaire"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setEssai(true);
        if (!lu || !nomOk) return;
        setEnvoi(true);
        setErreur(null);
        api
          .post(`/baux/${encodeURIComponent(refAnnonce)}/signer`, { nom: nom.trim() })
          .then(async () => {
            await rafraichirEtat();
            onFait();
          })
          .catch((er) => setErreur(messageErreur(er)))
          .finally(() => setEnvoi(false));
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
      {erreur && <div className="bandeau bandeau--erreur" role="alert">{erreur}</div>}
      <button type="submit" className="btn btn--principal btn--bloc" disabled={envoi}>
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
  const [idPaiement, setIdPaiement] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const numero = autre ? tel.replace(/\D/g, "") : (compte?.tel ?? "");
  const pret = operateur && numero.length >= 8;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  // Interroge l'API jusqu'à confirmation (le prestataire, ou la simulation en démo, change l'état)
  useEffect(() => {
    if (phase !== "attente" || !idPaiement) return;
    let arrete = false;
    const t = setInterval(() => {
      api
        .get<{ statut: string; recu?: Recu }>(`/paiements/${idPaiement}`)
        .then(async (p) => {
          if (arrete) return;
          if (p.statut === "recu" && p.recu) {
            arrete = true;
            clearInterval(t);
            await rafraichirEtat();
            onPaye(p.recu);
          } else if (p.statut === "echoue") {
            arrete = true;
            clearInterval(t);
            setPhase("echec");
          }
        })
        .catch(() => undefined);
    }, 2000);
    return () => {
      arrete = true;
      clearInterval(t);
    };
  }, [phase, idPaiement, onPaye]);

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
        if (!pret || !operateur) return;
        setErreur(null);
        api
          .post<{ id: string }>(`/baux/${encodeURIComponent(refAnnonce)}/payer`, { operateur, tel: numero })
          .then((r) => {
            setIdPaiement(r.id);
            setPhase("attente");
          })
          .catch((er) => setErreur(messageErreur(er)));
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
      {erreur && <div className="bandeau bandeau--erreur" role="alert">{erreur}</div>}
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
