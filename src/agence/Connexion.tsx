import { Eye, EyeOff, KeyRound, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Logo } from "../components/Marque";
import {
  activerInvitation,
  connecterAgence,
  dateFr,
  infosInvitation,
  ROLES_AGENCE,
  useMembre,
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

function ChampMotDePasse({
  id,
  label,
  value,
  onChange,
  autoComplete,
  erreur,
  aide,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  erreur?: string | null;
  aide?: string;
}) {
  const [voir, setVoir] = useState(false);
  return (
    <div className={`champ${erreur ? " champ--erreur" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="champ-mdp">
        <input
          id={id}
          type={voir ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="champ-mdp__bouton"
          aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={voir}
          onClick={() => setVoir((v) => !v)}
        >
          {voir ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {erreur ? <span className="champ__erreur">{erreur}</span> : aide ? <span className="aide">{aide}</span> : null}
    </div>
  );
}

// Connexion au back-office : numéro professionnel + mot de passe.
export default function ConnexionAgence() {
  useTitre("Connexion agence");
  const membre = useMembre();
  const navigate = useNavigate();
  const [tel, setTel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [essai, setEssai] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  if (membre) return <Navigate to="/agence" replace />;

  const t = chiffres(tel);
  const telValide = t.length === 10;
  const mdpValide = motDePasse.length >= 8;

  return (
    <Cadre titre="Back-office de l'agence" intro="Accès réservé aux membres invités par le responsable de l'agence.">
      <form
        className="formulaire"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setEssai(true);
          if (!telValide || !mdpValide || envoi) return;
          setEnvoi(true);
          setErreur(null);
          try {
            await connecterAgence(t, motDePasse);
            navigate("/agence");
          } catch (err) {
            setErreur(messageErreur(err));
          } finally {
            setEnvoi(false);
          }
        }}
      >
        <div className={`champ${essai && !telValide ? " champ--erreur" : ""}`}>
          <label htmlFor="bo-tel">Numéro professionnel</label>
          <input
            id="bo-tel"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="01 61 00 00 00"
            value={tel}
            onChange={(e) => setTel(e.target.value)}
            autoFocus
          />
          {essai && !telValide && <span className="champ__erreur">Saisissez les 10 chiffres de votre numéro professionnel.</span>}
        </div>

        <ChampMotDePasse
          id="bo-mdp"
          label="Mot de passe"
          value={motDePasse}
          onChange={setMotDePasse}
          autoComplete="current-password"
          erreur={essai && !mdpValide ? "Le mot de passe doit contenir au moins 8 caractères." : null}
          aide="Utilisez le mot de passe choisi lors de l'activation de votre invitation."
        />

        {erreur && (
          <div className="bandeau bandeau--erreur" role="alert">
            {erreur}
          </div>
        )}

        <button type="submit" className="btn btn--principal btn--bloc" disabled={envoi}>
          Se connecter
        </button>

        <div className="bandeau bandeau--info">
          <KeyRound aria-hidden="true" />
          Chaque action est enregistrée dans le journal d'audit avec votre nom.
        </div>
      </form>
    </Cadre>
  );
}

// Lien reçu par SMS ou e-mail : la personne choisit son mot de passe, puis entre directement.
export function Invitation() {
  useTitre("Invitation · Back-office");
  const { jeton = "" } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InfosInvitation | null | "chargement">("chargement");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [essai, setEssai] = useState(false);
  const [envoi, setEnvoi] = useState(false);

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

  const mdpValide = motDePasse.length >= 8;
  const confirmationValide = confirmation === motDePasse;

  return (
    <Cadre
      titre={`Bienvenue ${invite.nom.split(" ")[0]}`}
      intro={
        <>
          {invite.par} vous invite à rejoindre le back-office Xwé Tché en tant que <strong>{ROLES_AGENCE[invite.role]}</strong>.
        </>
      }
    >
      <form
        className="formulaire"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          setEssai(true);
          if (!mdpValide || !confirmationValide || envoi) return;
          setEnvoi(true);
          setErreur(null);
          try {
            await activerInvitation(jeton, motDePasse);
            navigate("/agence");
          } catch (err) {
            setErreur(messageErreur(err));
          } finally {
            setEnvoi(false);
          }
        }}
      >
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
          Choisissez votre mot de passe : il vous servira à chaque connexion. Vous ne verrez que les modules de votre rôle, et le
          responsable peut retirer cet accès à tout moment.
        </p>

        <ChampMotDePasse
          id="inv-mdp"
          label="Nouveau mot de passe"
          value={motDePasse}
          onChange={setMotDePasse}
          autoComplete="new-password"
          erreur={essai && !mdpValide ? "Le mot de passe doit contenir au moins 8 caractères." : null}
          aide="Au moins 8 caractères."
        />
        <div className={`champ${essai && !confirmationValide ? " champ--erreur" : ""}`}>
          <label htmlFor="inv-mdp2">Confirmer le mot de passe</label>
          <input
            id="inv-mdp2"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
          {essai && !confirmationValide && <span className="champ__erreur">Les deux mots de passe ne sont pas identiques.</span>}
        </div>

        {erreur && (
          <div className="bandeau bandeau--erreur" role="alert">
            {erreur}
          </div>
        )}

        <button type="submit" className="btn btn--principal btn--bloc" disabled={envoi}>
          Activer mon accès
        </button>
      </form>
    </Cadre>
  );
}
