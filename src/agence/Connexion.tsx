import { KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Logo } from "../components/Marque";
import {
  activerInvitation,
  dateFr,
  demanderCodeAgence,
  demanderCodeInvitation,
  infosInvitation,
  ROLES_AGENCE,
  useMembre,
  verifierCodeAgence,
  type InfosInvitation,
} from "../lib/agence";
import { messageErreur } from "../lib/api";
import { telLisible } from "../lib/compte";
import { useTitre } from "../lib/titre";

const chiffres = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length === 13 && d.startsWith("229") ? d.slice(3) : d;
};

function Cadre({ titre, intro, children }: { titre: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bo-connexion">
      <div className="carte bo-connexion__carte">
        <Logo largeur={140} />
        <div>
          <h1 className="h2">{titre}</h1>
          <p className="gris" style={{ margin: "var(--s2) 0 0" }}>
            {intro}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

// Second facteur : code reçu par SMS sur le numéro professionnel.
function CodeSMS({ tel, libelle, codeDemo, onValider, onRetour }: { tel: string; libelle: string; codeDemo?: string; onValider: (code: string) => Promise<void>; onRetour?: () => void }) {
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  return (
    <form
      className="formulaire"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        if (!/^\d{6}$/.test(code)) return setErreur("Le code contient 6 chiffres.");
        setEnvoi(true);
        setErreur(null);
        try {
          await onValider(code);
        } catch (err) {
          setErreur(messageErreur(err));
          setEnvoi(false);
        }
      }}
    >
      <div className={`champ${erreur ? " champ--erreur" : ""}`}>
        <label htmlFor="bo-code">Code envoyé au {telLisible(tel)}</label>
        <input id="bo-code" className="champ-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
        {erreur ? <span className="champ__erreur">{erreur}</span> : codeDemo ? <span className="aide">Démonstration : votre code est <span className="mono">{codeDemo}</span>.</span> : null}
      </div>
      <button type="submit" className="btn btn--principal btn--bloc" disabled={envoi}>
        <ShieldCheck size={18} aria-hidden="true" /> {libelle}
      </button>
      {onRetour && (
        <button type="button" className="btn btn--texte" onClick={onRetour}>
          Changer de numéro
        </button>
      )}
      <div className="bandeau bandeau--info">
        <KeyRound aria-hidden="true" />
        Chaque action est enregistrée dans le journal d'audit avec votre nom.
      </div>
    </form>
  );
}

// Connexion à double facteur (numéro professionnel + code), réservée aux membres dont l'accès est actif (chapitre 11).
export default function ConnexionAgence() {
  useTitre("Connexion agence");
  const membre = useMembre();
  const navigate = useNavigate();
  const [tel, setTel] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [etape, setEtape] = useState<{ tel: string; codeDemo?: string } | null>(null);

  if (membre) return <Navigate to="/agence" replace />;

  return (
    <Cadre titre="Back-office de l'agence" intro="Accès réservé aux membres invités par le responsable de l'agence.">
      {etape ? (
        <CodeSMS
          tel={etape.tel}
          codeDemo={etape.codeDemo}
          libelle="Se connecter"
          onRetour={() => setEtape(null)}
          onValider={async (code) => {
            await verifierCodeAgence(etape.tel, code);
            navigate("/agence");
          }}
        />
      ) : (
        <form
          className="formulaire"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const t = chiffres(tel);
            if (t.length !== 10) return setErreur("Saisissez les 10 chiffres de votre numéro professionnel.");
            setEnvoi(true);
            setErreur(null);
            try {
              const r = await demanderCodeAgence(t);
              setEtape({ tel: t, codeDemo: r.codeDemo });
            } catch (err) {
              setErreur(messageErreur(err));
            } finally {
              setEnvoi(false);
            }
          }}
        >
          <div className={`champ${erreur ? " champ--erreur" : ""}`}>
            <label htmlFor="bo-tel">Numéro professionnel</label>
            <input id="bo-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="01 61 00 00 00" value={tel} onChange={(e) => setTel(e.target.value)} autoFocus />
            {erreur ? <span className="champ__erreur">{erreur}</span> : <span className="aide">Un code à 6 chiffres vous sera envoyé par SMS.</span>}
          </div>
          <button type="submit" className="btn btn--principal btn--bloc" disabled={envoi}>
            Recevoir le code
          </button>
        </form>
      )}
    </Cadre>
  );
}

// Lien reçu par SMS : la personne active l'accès que le responsable lui a ouvert, avec le rôle choisi par lui.
export function Invitation() {
  useTitre("Invitation · Back-office");
  const { jeton = "" } = useParams();
  const navigate = useNavigate();
  const [etape, setEtape] = useState<"accueil" | "code">("accueil");
  const [invite, setInvite] = useState<InfosInvitation | null | "chargement">("chargement");
  const [codeDemo, setCodeDemo] = useState<string>();
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let vivant = true;
    infosInvitation(jeton)
      .then((i) => vivant && setInvite(i))
      .catch(() => vivant && setInvite(null));
    return () => {
      vivant = false;
    };
  }, [jeton]);

  if (invite === "chargement") return <Cadre titre="Invitation" intro="Vérification du lien…">{null}</Cadre>;

  if (!invite)
    return (
      <Cadre titre="Lien d'invitation invalide" intro="Ce lien a expiré, a déjà servi ou a été annulé.">
        <div className="bandeau bandeau--erreur">
          <TriangleAlert aria-hidden="true" />
          Demandez au responsable de l'agence de vous renvoyer un nouveau lien.
        </div>
      </Cadre>
    );

  return (
    <Cadre
      titre={`Bienvenue ${invite.nom.split(" ")[0]}`}
      intro={
        <>
          {invite.par} vous invite à rejoindre le back-office Xwé Tché en tant que <strong>{ROLES_AGENCE[invite.role]}</strong>.
        </>
      }
    >
      {etape === "accueil" ? (
        <div className="formulaire">
          <dl className="bo-invitation">
            <div>
              <dt>Nom</dt>
              <dd>{invite.nom}</dd>
            </div>
            <div>
              <dt>Numéro professionnel</dt>
              <dd className="mono">{telLisible(invite.tel)}</dd>
            </div>
            <div>
              <dt>Rôle</dt>
              <dd>{ROLES_AGENCE[invite.role]}</dd>
            </div>
            <div>
              <dt>Lien valable jusqu'au</dt>
              <dd className="mono">{dateFr(invite.expireLe)}</dd>
            </div>
          </dl>
          <p className="petit gris" style={{ margin: 0 }}>
            Vous ne verrez que les modules de votre rôle. Le responsable peut retirer cet accès à tout moment.
          </p>
          {erreur && <span className="champ__erreur">{erreur}</span>}
          <button
            type="button"
            className="btn btn--principal btn--bloc"
            onClick={async () => {
              try {
                const r = await demanderCodeInvitation(jeton);
                setCodeDemo(r.codeDemo);
                setErreur(null);
                setEtape("code");
              } catch (err) {
                setErreur(messageErreur(err));
              }
            }}
          >
            Activer mon accès
          </button>
        </div>
      ) : (
        <CodeSMS
          tel={invite.tel}
          codeDemo={codeDemo}
          libelle="Activer et me connecter"
          onValider={async (code) => {
            await activerInvitation(jeton, code);
            navigate("/agence");
          }}
        />
      )}
    </Cadre>
  );
}
