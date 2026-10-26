import { KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Logo } from "../components/Marque";
import { accepterInvitation, connecterMembre, dateFr, invitationExpiree, membreParInvitation, ROLES_AGENCE, useAgence, useMembre } from "../lib/agence";
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
function CodeSMS({ tel, libelle, onValider, onRetour }: { tel: string; libelle: string; onValider: () => void; onRetour?: () => void }) {
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState(false);
  return (
    <form
      className="formulaire"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d{6}$/.test(code)) return setErreur(true);
        onValider();
      }}
    >
      <div className={`champ${erreur ? " champ--erreur" : ""}`}>
        <label htmlFor="bo-code">Code envoyé au {telLisible(tel)}</label>
        <input id="bo-code" className="champ-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
        {erreur ? <span className="champ__erreur">Le code contient 6 chiffres.</span> : <span className="aide">Démonstration : n'importe quel code à 6 chiffres.</span>}
      </div>
      <button type="submit" className="btn btn--principal btn--bloc">
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
  const { equipe } = useAgence();
  const membre = useMembre();
  const navigate = useNavigate();
  const [tel, setTel] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [trouve, setTrouve] = useState<string | null>(null);

  if (membre) return <Navigate to="/agence" replace />;
  const choisi = equipe.find((m) => m.id === trouve);

  return (
    <Cadre titre="Back-office de l'agence" intro="Accès réservé aux membres invités par le responsable de l'agence.">
      {choisi ? (
        <CodeSMS
          tel={choisi.tel}
          libelle="Se connecter"
          onRetour={() => setTrouve(null)}
          onValider={() => {
            connecterMembre(choisi.id);
            navigate("/agence");
          }}
        />
      ) : (
        <form
          className="formulaire"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const m = equipe.find((x) => x.tel === chiffres(tel));
            if (m?.statut === "actif") {
              setErreur(null);
              return setTrouve(m.id);
            }
            setErreur(
              m?.statut === "invite"
                ? "Votre accès n'est pas encore activé. Ouvrez le lien d'invitation reçu par SMS ou par e-mail."
                : "Ce numéro n'a pas accès au back-office. Adressez-vous au responsable de l'agence.",
            );
          }}
        >
          <div className={`champ${erreur ? " champ--erreur" : ""}`}>
            <label htmlFor="bo-tel">Numéro professionnel</label>
            <input id="bo-tel" type="tel" inputMode="tel" autoComplete="tel" placeholder="01 61 00 00 00" value={tel} onChange={(e) => setTel(e.target.value)} autoFocus />
            {erreur ? <span className="champ__erreur">{erreur}</span> : (
              <span className="aide">
                Démonstration : le responsable de l'agence se connecte avec le <span className="mono" style={{ whiteSpace: "nowrap" }}>01 61 00 00 01</span>.
              </span>
            )}
          </div>
          <button type="submit" className="btn btn--principal btn--bloc">
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
  const { jeton } = useParams();
  useAgence();
  const navigate = useNavigate();
  const [etape, setEtape] = useState<"accueil" | "code">("accueil");
  const invite = membreParInvitation(jeton);

  if (!invite || invitationExpiree(invite))
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
          {invite.invitation?.par} vous invite à rejoindre le back-office Xwé Tché en tant que <strong>{ROLES_AGENCE[invite.role]}</strong>.
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
              <dd className="mono">{invite.invitation && dateFr(invite.invitation.expireLe)}</dd>
            </div>
          </dl>
          <p className="petit gris" style={{ margin: 0 }}>
            Vous ne verrez que les modules de votre rôle. Le responsable peut retirer cet accès à tout moment.
          </p>
          <button type="button" className="btn btn--principal btn--bloc" onClick={() => setEtape("code")}>
            Activer mon accès
          </button>
        </div>
      ) : (
        <CodeSMS
          tel={invite.tel}
          libelle="Activer et me connecter"
          onValider={() => {
            accepterInvitation(invite.id);
            navigate("/agence");
          }}
        />
      )}
    </Cadre>
  );
}
