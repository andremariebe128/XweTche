import { ArrowLeft, Home, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Porte } from "../components/Marque";
import { messageErreur } from "../lib/api";
import { changerRole, demanderCode, inscrire, verifierCode as verifierCodeApi, type Role } from "../lib/compte";
import { useTitre } from "../lib/titre";

// Connexion et inscription par numéro de téléphone et code SMS (AUT-01, AUT-02, AUT-03).
export default function Connexion() {
  useTitre("Connexion");
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const retour = params.get("retour") ?? "/mon-espace";
  const roleDemande = params.get("role") as Role | null;

  const [etape, setEtape] = useState<"tel" | "code" | "profil">("tel");
  const [tel, setTel] = useState("");
  const [codeSaisi, setCodeSaisi] = useState("");
  const [nom, setNom] = useState("");
  const [role, setRole] = useState<Role>(roleDemande ?? "locataire");
  const [attente, setAttente] = useState(0);
  const [essai, setEssai] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [codeDemo, setCodeDemo] = useState<string | null>(null);
  const [preuve, setPreuve] = useState<string | null>(null);

  const chiffres = tel.replace(/\D/g, "");
  const telValide = chiffres.length >= 8;
  const codeValide = /^\d{6}$/.test(codeSaisi);

  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((a) => a - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  async function envoyerCode() {
    setEssai(true);
    if (!telValide || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await demanderCode(chiffres);
      setCodeDemo(r.codeDemo ?? null);
      setEssai(false);
      setCodeSaisi("");
      setAttente(30);
      setEtape("code");
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function verifierCode() {
    setEssai(true);
    if (!codeValide || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      const r = await verifierCodeApi(chiffres, codeSaisi);
      setEssai(false);
      if (r.existe) {
        if (roleDemande && r.compte && r.compte.role !== roleDemande) await changerRole(roleDemande).catch(() => {});
        navigate(retour);
      } else {
        setPreuve(r.preuve ?? null);
        setEtape("profil");
      }
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  async function terminer() {
    setEssai(true);
    if (nom.trim().length < 2 || !preuve || enCours) return;
    setEnCours(true);
    setErreur(null);
    try {
      await inscrire(preuve, nom.trim(), role);
      navigate(retour);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="wrap connexion">
      <div className="carte connexion__carte">
        <Porte taille={28} />

        {etape === "tel" && (
          <form
            className="formulaire"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void envoyerCode();
            }}
          >
            <div>
              <h1 className="h2">Connexion ou inscription</h1>
              <p className="gris connexion__intro">Avec votre numéro de téléphone. Pas de mot de passe à retenir.</p>
            </div>
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
                  autoFocus
                />
              </div>
              {essai && !telValide ? (
                <span className="champ__erreur">Indiquez un numéro d'au moins 8 chiffres.</span>
              ) : (
                <span className="aide">Vous allez recevoir un code à 6 chiffres par SMS.</span>
              )}
            </div>
            {erreur && <div className="bandeau bandeau--erreur" role="alert">{erreur}</div>}
            <button type="submit" className="btn btn--principal btn--bloc" disabled={enCours}>
              Recevoir le code
            </button>
            <p className="petit gris connexion__cgu">
              En continuant, vous acceptez les <Link to="/cgu">conditions d'utilisation</Link> et la{" "}
              <Link to="/confidentialite">politique de confidentialité</Link>.
            </p>
          </form>
        )}

        {etape === "code" && (
          <form
            className="formulaire"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void verifierCode();
            }}
          >
            <button type="button" className="btn btn--texte connexion__retour" onClick={() => setEtape("tel")}>
              <ArrowLeft size={18} aria-hidden="true" /> Changer de numéro
            </button>
            <div>
              <h1 className="h2">Entrez le code reçu</h1>
              <p className="gris connexion__intro">Envoyé par SMS au +229 {tel}, de la part de « XweTche ».</p>
            </div>
            <div className={`champ${essai && !codeValide ? " champ--erreur" : ""}`}>
              <label htmlFor="cx-code">Code à 6 chiffres</label>
              <input
                id="cx-code"
                className="champ-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={codeSaisi}
                onChange={(e) => setCodeSaisi(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
              {essai && !codeValide ? (
                <span className="champ__erreur">Le code contient 6 chiffres.</span>
              ) : (
                <span className="aide">{codeDemo ? `Mode démonstration : votre code est ${codeDemo}.` : "Le code est valable 10 minutes."}</span>
              )}
            </div>
            {erreur && <div className="bandeau bandeau--erreur" role="alert">{erreur}</div>}
            <button type="submit" className="btn btn--principal btn--bloc" disabled={enCours}>
              Valider
            </button>
            <button type="button" className="btn btn--texte" disabled={attente > 0} onClick={() => void envoyerCode()}>
              {attente > 0 ? `Renvoyer le code dans ${attente} s` : "Renvoyer le code"}
            </button>
            <div className="bandeau bandeau--info">
              <KeyRound aria-hidden="true" />
              Ne communiquez jamais ce code à quelqu'un qui vous appelle, même au nom de Xwé Tché.
            </div>
          </form>
        )}

        {etape === "profil" && (
          <form
            className="formulaire"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void terminer();
            }}
          >
            <div>
              <h1 className="h2">Bienvenue sur Xwé Tché</h1>
              <p className="gris connexion__intro">Encore deux informations pour créer votre compte.</p>
            </div>
            <div className={`champ${essai && nom.trim().length < 2 ? " champ--erreur" : ""}`}>
              <label htmlFor="cx-nom">Nom et prénom</label>
              <input id="cx-nom" autoComplete="name" value={nom} onChange={(e) => setNom(e.target.value)} autoFocus />
              {essai && nom.trim().length < 2 && <span className="champ__erreur">Indiquez votre nom.</span>}
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
            {erreur && <div className="bandeau bandeau--erreur" role="alert">{erreur}</div>}
            <button type="submit" className="btn btn--principal btn--bloc" disabled={enCours}>
              Créer mon compte
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
