import { KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Logo } from "../components/Marque";
import { majAgence, ROLES_AGENCE, useAgence, useMembre } from "../lib/agence";
import { telLisible } from "../lib/compte";
import { useTitre } from "../lib/titre";

// Connexion à double facteur (numéro professionnel + code), réservée à l'équipe (chapitre 11).
export default function ConnexionAgence() {
  useTitre("Connexion agence");
  const { equipe } = useAgence();
  const membre = useMembre();
  const navigate = useNavigate();
  const actifs = equipe.filter((m) => m.actif);
  const [choix, setChoix] = useState(actifs[0]?.id ?? "");
  const [etape, setEtape] = useState<"compte" | "code">("compte");
  const [code, setCode] = useState("");
  const [erreur, setErreur] = useState(false);

  if (membre) return <Navigate to="/agence" replace />;
  const choisi = actifs.find((m) => m.id === choix);

  return (
    <div className="bo-connexion">
      <div className="carte bo-connexion__carte">
        <Logo largeur={140} />
        <div>
          <h1 className="h2">Back-office de l'agence</h1>
          <p className="gris" style={{ margin: "var(--s2) 0 0" }}>
            Accès réservé à l'équipe Xwé Tché.
          </p>
        </div>
        {etape === "compte" ? (
          <form
            className="formulaire"
            onSubmit={(e) => {
              e.preventDefault();
              if (choisi) setEtape("code");
            }}
          >
            <fieldset className="champ champ--groupe">
              <legend>Compte de démonstration</legend>
              <div className="choix">
                {actifs.map((m) => (
                  <label key={m.id} className="choix__option">
                    <input type="radio" name="membre" checked={choix === m.id} onChange={() => setChoix(m.id)} />
                    <span>
                      <strong>{m.nom}</strong> <span className="gris">· {ROLES_AGENCE[m.role]}</span>
                    </span>
                  </label>
                ))}
              </div>
              <span className="aide">Chaque rôle voit uniquement les modules de son métier.</span>
            </fieldset>
            <button type="submit" className="btn btn--principal btn--bloc">
              Recevoir le code
            </button>
          </form>
        ) : (
          <form
            className="formulaire"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (!/^\d{6}$/.test(code)) return setErreur(true);
              majAgence((a) => ({ ...a, session: choix }));
              navigate("/agence");
            }}
          >
            <div className={`champ${erreur ? " champ--erreur" : ""}`}>
              <label htmlFor="bo-code">Code envoyé au {choisi && telLisible(choisi.tel)}</label>
              <input id="bo-code" className="champ-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus />
              {erreur ? <span className="champ__erreur">Le code contient 6 chiffres.</span> : <span className="aide">Démonstration : n'importe quel code à 6 chiffres.</span>}
            </div>
            <button type="submit" className="btn btn--principal btn--bloc">
              <ShieldCheck size={18} aria-hidden="true" /> Se connecter
            </button>
            <button type="button" className="btn btn--texte" onClick={() => setEtape("compte")}>
              Changer de compte
            </button>
            <div className="bandeau bandeau--info">
              <KeyRound aria-hidden="true" />
              Chaque action est enregistrée dans le journal d'audit avec votre nom.
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
