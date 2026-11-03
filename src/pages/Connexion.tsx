import { Eye, EyeOff, Home } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Porte } from "../components/Marque";
import { messageErreur } from "../lib/api";
import { changerRole, connecter, inscrire, lireEtat, type Role } from "../lib/compte";
import { useTitre } from "../lib/titre";

type Onglet = "connexion" | "inscription";

// Connexion et inscription : numéro de téléphone + mot de passe, sans code SMS.
export default function Connexion() {
  useTitre("Connexion");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const retour = params.get("retour") ?? "/mon-espace";
  const roleDemande = params.get("role") as Role | null;

  const [onglet, setOnglet] = useState<Onglet>("connexion");
  const [tel, setTel] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<Role>(roleDemande === "proprietaire" ? "proprietaire" : "locataire");
  const [voirMotDePasse, setVoirMotDePasse] = useState(false);
  const [essai, setEssai] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const chiffres = tel.replace(/\D/g, "");
  const telValide = chiffres.length >= 8;
  const motDePasseValide = motDePasse.length >= 8;
  const confirmationValide = onglet === "connexion" || confirmation === motDePasse;
  const nomValide = nom.trim().length >= 2;
  const formulaireValide = telValide && motDePasseValide && (onglet === "connexion" || (nomValide && confirmationValide));

  function changerOnglet(o: Onglet) {
    setOnglet(o);
    setEssai(false);
    setErreur(null);
    setMotDePasse("");
    setConfirmation("");
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    setEssai(true);
    if (!formulaireValide || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      if (onglet === "connexion") {
        await connecter(chiffres, motDePasse);
        if (roleDemande && lireEtat().compte?.role !== roleDemande) await changerRole(roleDemande).catch(() => {});
      } else {
        await inscrire({ tel: chiffres, nom: nom.trim(), role, motDePasse });
      }
      navigate(retour);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="wrap connexion">
      <div className="carte connexion__carte">
        <Porte taille={28} />

        <div className="onglets connexion__onglets" role="tablist" aria-label="Connexion ou inscription">
          <button
            type="button"
            role="tab"
            aria-selected={onglet === "connexion"}
            className="onglet"
            onClick={() => changerOnglet("connexion")}
          >
            Connexion
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={onglet === "inscription"}
            className="onglet"
            onClick={() => changerOnglet("inscription")}
          >
            Inscription
          </button>
        </div>

        <form className="formulaire" noValidate onSubmit={soumettre}>
          <div>
            <h1 className="h2">{onglet === "connexion" ? "Bon retour" : "Créer mon compte"}</h1>
            <p className="gris connexion__intro">
              {onglet === "connexion"
                ? "Connectez-vous avec votre numéro et votre mot de passe."
                : "Quelques informations suffisent pour commencer."}
            </p>
          </div>

          {onglet === "inscription" && (
            <div className={`champ${essai && !nomValide ? " champ--erreur" : ""}`}>
              <label htmlFor="cx-nom">Nom et prénom</label>
              <input id="cx-nom" autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
              {essai && !nomValide && <span className="champ__erreur">Indiquez votre nom.</span>}
            </div>
          )}

          <div className={`champ${essai && !telValide ? " champ--erreur" : ""}`}>
            <label htmlFor="cx-tel">Numéro de téléphone</label>
            <div className="champ-tel">
              <span className="champ-tel__indicatif">+229</span>
              <input
                id="cx-tel"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="01 97 00 00 00"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
                autoFocus={onglet === "connexion"}
              />
            </div>
            {essai && !telValide ? (
              <span className="champ__erreur">Indiquez un numéro d'au moins 8 chiffres.</span>
            ) : (
              <span className="aide">Le numéro utilisé lors de votre inscription.</span>
            )}
          </div>

          <div className={`champ${essai && !motDePasseValide ? " champ--erreur" : ""}`}>
            <label htmlFor="cx-mdp">Mot de passe</label>
            <div className="champ-mdp">
              <input
                id="cx-mdp"
                type={voirMotDePasse ? "text" : "password"}
                autoComplete={onglet === "connexion" ? "current-password" : "new-password"}
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
              />
              <button
                type="button"
                className="champ-mdp__bouton"
                aria-label={voirMotDePasse ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                aria-pressed={voirMotDePasse}
                onClick={() => setVoirMotDePasse((v) => !v)}
              >
                {voirMotDePasse ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {essai && !motDePasseValide ? (
              <span className="champ__erreur">Le mot de passe doit contenir au moins 8 caractères.</span>
            ) : (
              <span className="aide">{onglet === "connexion" ? "Mot de passe oublié ? Contactez le support Xwé Tché." : "Au moins 8 caractères."}</span>
            )}
          </div>

          {onglet === "inscription" && (
            <>
              <div className={`champ${essai && !confirmationValide ? " champ--erreur" : ""}`}>
                <label htmlFor="cx-mdp2">Confirmer le mot de passe</label>
                <input
                  id="cx-mdp2"
                  type={voirMotDePasse ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
                {essai && !confirmationValide && <span className="champ__erreur">Les deux mots de passe ne sont pas identiques.</span>}
              </div>

              <fieldset className="champ champ--groupe">
                <legend>Vous êtes</legend>
                <div className="roles">
                  <label className="role">
                    <input type="radio" name="role" checked={role === "locataire"} onChange={() => setRole("locataire")} />
                    <span>
                      <strong>Je cherche un logement</strong>
                      <span className="gris">Locataire</span>
                    </span>
                  </label>
                  <label className="role">
                    <input type="radio" name="role" checked={role === "proprietaire"} onChange={() => setRole("proprietaire")} />
                    <span>
                      <strong>
                        <Home size={16} aria-hidden="true" /> Je mets un bien en location
                      </strong>
                      <span className="gris">Propriétaire ou gestionnaire</span>
                    </span>
                  </label>
                </div>
                <span className="aide">Un compte locataire sert à louer, un compte propriétaire à mettre en location.</span>
              </fieldset>
            </>
          )}

          {erreur && (
            <div className="bandeau bandeau--erreur" role="alert">
              {erreur}
            </div>
          )}

          <button type="submit" className="btn btn--principal btn--bloc" disabled={enCours}>
            {onglet === "connexion" ? "Se connecter" : "Créer mon compte"}
          </button>

          <p className="petit gris connexion__cgu">
            En continuant, vous acceptez les <Link to="/cgu">conditions d'utilisation</Link> et la{" "}
            <Link to="/confidentialite">politique de confidentialité</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
