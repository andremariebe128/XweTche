import { ArrowLeft, Camera, Check, FileText, MapPin, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CoutTotal } from "../components/CoutTotal";
import { Vide } from "../components/Vide";
import { EQUIPEMENTS } from "../components/Equipements";
import { TYPES, type Annonce, type Equipement, type TypeBien } from "../data/annonces";
import { recevoirDossier } from "../lib/agence";
import { code, majEtat, useEtat } from "../lib/compte";
import { fcfa } from "../lib/format";
import { useParametres } from "../lib/parametres";
import { useTitre } from "../lib/titre";

// Ordre de prise de vue recommandé (PRO-02) : le locataire découvre le logement comme s'il le visitait.
const PHOTOS_CONSEILLEES = ["Façade et entrée", "Pièce principale", "Chambre", "Cuisine", "Douche et toilettes", "Cour", "Repère proche"];
const MIN_PHOTOS = 6;

interface Brouillon {
  type: TypeBien | "";
  quartier: string;
  adresse: string;
  gps: string;
  photos: string[];
  loyer: string;
  avanceMois: number;
  cautionMois: number;
  charges: string;
  equipements: Equipement[];
  description: string;
  regles: string;
  gestionnaire: boolean;
  pieces: { identite?: string; propriete?: string; mandat?: string };
  certifs: [boolean, boolean, boolean];
}

const NEUF: Brouillon = {
  type: "",
  quartier: "",
  adresse: "",
  gps: "",
  photos: [],
  loyer: "",
  avanceMois: 3,
  cautionMois: 2,
  charges: "",
  equipements: [],
  description: "",
  regles: "",
  gestionnaire: false,
  pieces: {},
  certifs: [false, false, false],
};
const CLE = "xt-brouillon-depot";

function lireBrouillon(): Brouillon {
  try {
    const b = localStorage.getItem(CLE);
    return b ? { ...NEUF, ...JSON.parse(b) } : NEUF;
  } catch {
    return NEUF;
  }
}

const ETAPES = ["Le bien", "Photos", "Montants", "Description", "Documents", "Vérification"];

// Dépôt d'un bien en 6 étapes, brouillon enregistré à chaque modification (PRO-01 à PRO-05).
export default function Deposer() {
  useTitre("Déposer un bien");
  const { compte } = useEtat();
  const { quartiers } = useParametres();
  const navigate = useNavigate();
  const [b, setB] = useState<Brouillon>(lireBrouillon);
  const [etape, setEtape] = useState(0);
  const [essai, setEssai] = useState(false);
  const [apercus, setApercus] = useState<Record<string, string>>({});
  const [gpsMsg, setGpsMsg] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(CLE, JSON.stringify(b));
    } catch {
      // brouillon gardé en mémoire seulement
    }
  }, [b]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [etape]);

  // Les aperçus ne vivent que le temps de la page : libérés en la quittant.
  const urls = useRef<string[]>([]);
  useEffect(() => {
    const liste = urls.current;
    return () => liste.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  if (compte?.role === "locataire")
    return (
      <div className="wrap edito">
        <Vide
          titre="Réservé aux comptes propriétaires"
          texte="Votre compte est un compte locataire. Pour mettre un bien en location, créez un compte propriétaire avec un autre numéro."
          action={
            <Link to="/mon-espace" className="btn btn--secondaire">
              Retour à mon espace
            </Link>
          }
        />
      </div>
    );
  if (!compte) return <Navigate to="/connexion?role=proprietaire&retour=/proprietaires/deposer" replace />;

  const maj = (p: Partial<Brouillon>) => setB((x) => ({ ...x, ...p }));
  const loyer = Number(b.loyer) || 0;
  const erreurs: string[][] = [
    [!b.type && "type", !b.quartier && "quartier", b.adresse.trim().length < 10 && "adresse"].filter(Boolean) as string[],
    b.photos.length < MIN_PHOTOS ? ["photos"] : [],
    loyer < 5000 ? ["loyer"] : [],
    [b.description.trim().length < 40 && "description"].filter(Boolean) as string[],
    [!b.pieces.identite && "identite", !b.pieces.propriete && "propriete", b.gestionnaire && !b.pieces.mandat && "mandat", b.certifs.includes(false) && "certifs"].filter(Boolean) as string[],
    [],
  ];
  const err = (k: string) => essai && erreurs[etape].includes(k);

  function suivant() {
    setEssai(true);
    if (erreurs[etape].length) return;
    setEssai(false);
    setEtape((e) => e + 1);
  }

  function envoyer() {
    const ref = `XT-0${430 + Math.floor(Math.random() * 70)}`;
    // Le dossier arrive dans la file d'étude de l'agence
    recevoirDossier({
      ref,
      type: TYPES[b.type as TypeBien],
      quartier: b.quartier,
      reperes: b.adresse,
      loyer,
      avanceMois: b.avanceMois,
      cautionMois: b.cautionMois,
      charges: Number(b.charges) || 0,
      proprietaire: compte!.nom,
      telProprietaire: compte!.tel,
      gestionnaire: b.gestionnaire,
      soumisLe: new Date().toISOString(),
      statut: "en-etude",
      photos: b.photos.length,
      documents: { identite: !!b.pieces.identite, propriete: !!b.pieces.propriete, ...(b.gestionnaire ? { mandat: !!b.pieces.mandat } : {}) },
      auto: { photosNettes: true, champsComplets: true, doublonPhoto: false, doublonAdresse: false },
      checklist: {},
    });
    majEtat((e) => ({
      ...e,
      biens: [
        {
          ref,
          type: TYPES[b.type as TypeBien],
          titre: b.description.split(".")[0].slice(0, 60),
          quartier: b.quartier,
          loyer,
          statut: "en-etude",
          soumisLe: new Date().toISOString(),
          vues: 0,
          visites: [],
          candidats: [],
        },
        ...e.biens,
      ],
    }));
    try {
      localStorage.removeItem(CLE);
    } catch {
      // rien à nettoyer
    }
    navigate(`/mon-espace?envoye=${ref}`);
  }

  function ajouterPhotos(fichiers: FileList | null) {
    if (!fichiers) return;
    const nouveaux = Array.from(fichiers).filter((f) => f.type.startsWith("image/"));
    const noms = nouveaux.map((f) => `${f.name}#${code(4)}`);
    const liens = nouveaux.map((f) => URL.createObjectURL(f));
    urls.current.push(...liens);
    setApercus((a) => ({ ...a, ...Object.fromEntries(noms.map((n, i) => [n, liens[i]])) }));
    maj({ photos: [...b.photos, ...noms] });
  }

  function localiser() {
    if (!navigator.geolocation) return setGpsMsg("La localisation n'est pas disponible sur cet appareil.");
    setGpsMsg("Localisation en cours…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        maj({ gps: `${p.coords.latitude.toFixed(5)}, ${p.coords.longitude.toFixed(5)}` });
        setGpsMsg("");
      },
      () => setGpsMsg("Impossible d'obtenir la position. L'agent la relèvera lors de sa visite."),
    );
  }

  const apercu = { ref: "apercu", loyer, avanceMois: b.avanceMois, cautionMois: b.cautionMois, charges: Number(b.charges) || 0 } as Annonce;

  return (
    <div className="wrap edito depot">
      <div className="depot__tete">
        {etape > 0 ? (
          <button type="button" className="btn btn--texte" onClick={() => setEtape((e) => e - 1)}>
            <ArrowLeft size={18} aria-hidden="true" /> {ETAPES[etape - 1]}
          </button>
        ) : (
          <Link to="/mon-espace" className="btn btn--texte">
            <ArrowLeft size={18} aria-hidden="true" /> Mon espace
          </Link>
        )}
        <span className="petit gris">Brouillon enregistré</span>
      </div>
      <p className="etapes-ind">
        Étape {etape + 1} sur {ETAPES.length}
      </p>
      <div className="depot__progression" aria-hidden="true">
        {ETAPES.map((e, i) => (
          <span key={e} className={i <= etape ? "est-fait" : ""} />
        ))}
      </div>
      <h1 className="h2">{ETAPES[etape]}</h1>

      <form
        className="formulaire depot__formulaire"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (etape < ETAPES.length - 1) suivant();
          else envoyer();
        }}
      >
        {etape === 0 && (
          <>
            <div className="formulaire__deux">
              <div className={`champ${err("type") ? " champ--erreur" : ""}`}>
                <label htmlFor="dp-type">Type de logement</label>
                <select id="dp-type" value={b.type} onChange={(e) => maj({ type: e.target.value as TypeBien })}>
                  <option value="">Choisir</option>
                  {Object.entries(TYPES).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                {err("type") && <span className="champ__erreur">Choisissez un type.</span>}
              </div>
              <div className={`champ${err("quartier") ? " champ--erreur" : ""}`}>
                <label htmlFor="dp-quartier">Quartier</label>
                <select id="dp-quartier" value={b.quartier} onChange={(e) => maj({ quartier: e.target.value })}>
                  <option value="">Choisir</option>
                  {quartiers.map((q) => (
                    <option key={q}>{q}</option>
                  ))}
                </select>
                {err("quartier") && <span className="champ__erreur">Choisissez un quartier.</span>}
              </div>
            </div>
            <div className={`champ${err("adresse") ? " champ--erreur" : ""}`}>
              <label htmlFor="dp-adresse">Adresse et repères</label>
              <textarea
                id="dp-adresse"
                rows={3}
                value={b.adresse}
                onChange={(e) => maj({ adresse: e.target.value })}
                placeholder="Ex. von après la pharmacie Les Cocotiers, 2e maison à gauche, portail bleu"
              />
              {err("adresse") ? (
                <span className="champ__erreur">Décrivez comment trouver le logement (10 caractères minimum).</span>
              ) : (
                <span className="aide">L'adresse exacte n'est communiquée qu'aux locataires ayant réservé une visite.</span>
              )}
            </div>
            <div className="champ">
              <span className="champ__libelle">Position GPS <span className="gris">(facultatif)</span></span>
              <div className="depot__gps">
                <button type="button" className="btn btn--secondaire" onClick={localiser}>
                  <MapPin size={18} aria-hidden="true" /> Utiliser ma position
                </button>
                {b.gps && <span className="mono petit">{b.gps}</span>}
              </div>
              <span className="aide">{gpsMsg || "À faire depuis le logement. Sinon, l'agent la relève lors de sa visite."}</span>
            </div>
          </>
        )}

        {etape === 1 && (
          <>
            <div className="encart depot__conseil">
              <strong>Dans cet ordre, en plein jour, téléphone à l'horizontale</strong>
              <ol className="depot__ordre">
                {PHOTOS_CONSEILLEES.map((p, i) => (
                  <li key={p} className={i < b.photos.length ? "est-fait" : ""}>
                    {i < b.photos.length ? <Check size={14} aria-hidden="true" /> : <span className="mono">{i + 1}</span>} {p}
                  </li>
                ))}
              </ol>
            </div>
            <label className={`depot__ajout${err("photos") ? " depot__ajout--erreur" : ""}`}>
              <Camera aria-hidden="true" />
              <strong>Ajouter des photos</strong>
              <span className="petit gris">
                {b.photos.length} sur {MIN_PHOTOS} minimum
              </span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => ajouterPhotos(e.target.files)} />
            </label>
            {err("photos") && <span className="champ__erreur">Ajoutez au moins {MIN_PHOTOS} photos.</span>}
            {b.photos.length > 0 && (
              <ul className="depot__photos">
                {b.photos.map((p, i) => (
                  <li key={p}>
                    {apercus[p] ? <img src={apercus[p]} alt="" /> : <span className="depot__photo-vide"><Camera aria-hidden="true" /></span>}
                    <span className="petit">{PHOTOS_CONSEILLEES[i] ?? `Photo ${i + 1}`}</span>
                    <button
                      type="button"
                      className="btn-icone depot__retirer"
                      aria-label={`Retirer la photo ${i + 1}`}
                      onClick={() => maj({ photos: b.photos.filter((x) => x !== p) })}
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {etape === 2 && (
          <div className="depot__montants">
            <div className="formulaire">
              <div className={`champ${err("loyer") ? " champ--erreur" : ""}`}>
                <label htmlFor="dp-loyer">Loyer mensuel (FCFA)</label>
                <input id="dp-loyer" inputMode="numeric" className="mono" value={b.loyer} onChange={(e) => maj({ loyer: e.target.value.replace(/\D/g, "") })} placeholder="45000" />
                {err("loyer") ? <span className="champ__erreur">Indiquez le loyer mensuel.</span> : loyer > 0 && <span className="aide mono">{fcfa(loyer)}</span>}
              </div>
              <div className="formulaire__deux">
                <div className="champ">
                  <label htmlFor="dp-avance">Avance (mois)</label>
                  <select id="dp-avance" value={b.avanceMois} onChange={(e) => maj({ avanceMois: Number(e.target.value) })}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div className="champ">
                  <label htmlFor="dp-caution">Caution (mois)</label>
                  <select id="dp-caution" value={b.cautionMois} onChange={(e) => maj({ cautionMois: Number(e.target.value) })}>
                    {Array.from({ length: 7 }, (_, i) => i).map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="champ">
                <label htmlFor="dp-charges">
                  Charges mensuelles (FCFA) <span className="gris">(facultatif)</span>
                </label>
                <input id="dp-charges" inputMode="numeric" className="mono" value={b.charges} onChange={(e) => maj({ charges: e.target.value.replace(/\D/g, "") })} placeholder="0" />
                <span className="aide">Gardiennage, ordures, eau commune… Tout ce qui s'ajoute au loyer.</span>
              </div>
            </div>
            <div className="carte depot__apercu">
              <span className="petit gris">Ce que verra le locataire</span>
              {loyer > 0 ? <CoutTotal annonce={apercu} /> : <p className="gris">Indiquez le loyer pour voir l'aperçu.</p>}
            </div>
          </div>
        )}

        {etape === 3 && (
          <>
            <fieldset className="champ champ--groupe">
              <legend>Équipements</legend>
              <div className="pastilles pastilles--multi">
                {(Object.keys(EQUIPEMENTS) as Equipement[]).map((k) => {
                  const { libelle, Icone } = EQUIPEMENTS[k];
                  const actif = b.equipements.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      className="pastille"
                      aria-pressed={actif}
                      onClick={() => maj({ equipements: actif ? b.equipements.filter((x) => x !== k) : [...b.equipements, k] })}
                    >
                      <Icone aria-hidden="true" /> {libelle}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className={`champ${err("description") ? " champ--erreur" : ""}`}>
              <label htmlFor="dp-desc">Description</label>
              <textarea id="dp-desc" rows={5} value={b.description} onChange={(e) => maj({ description: e.target.value })} placeholder="Ex. Chambre-salon carrelée au rez-de-chaussée, dans une cour de 4 logements…" />
              {err("description") ? (
                <span className="champ__erreur">Décrivez le logement en quelques phrases (40 caractères minimum).</span>
              ) : (
                <span className="aide">{b.description.trim().length} caractères. Restez factuel : l'agent vérifie sur place.</span>
              )}
            </div>
            <div className="champ">
              <label htmlFor="dp-regles">
                Règles de la maison <span className="gris">(facultatif)</span>
              </label>
              <textarea id="dp-regles" rows={3} value={b.regles} onChange={(e) => maj({ regles: e.target.value })} placeholder="Une règle par ligne. Ex. Portail fermé à 23 h" />
            </div>
          </>
        )}

        {etape === 4 && (
          <>
            <label className="choix__option">
              <input type="checkbox" checked={b.gestionnaire} onChange={(e) => maj({ gestionnaire: e.target.checked })} />
              <span>Je gère ce bien pour le compte du propriétaire</span>
            </label>
            {(
              [
                ["identite", "Pièce d'identité", "CIP, passeport ou NPI"],
                ["propriete", "Document de propriété", "Titre foncier, attestation de détention coutumière, convention de vente ou permis d'habiter"],
                ...(b.gestionnaire ? [["mandat", "Mandat écrit du propriétaire", "Signé et daté"]] : []),
              ] as [keyof Brouillon["pieces"], string, string][]
            ).map(([k, titre, detail]) => (
              <label key={k} className={`depot__piece carte${err(k) ? " depot__piece--erreur" : ""}`}>
                {b.pieces[k] ? <Check className="depot__piece-ok" aria-hidden="true" /> : <FileText aria-hidden="true" />}
                <span>
                  <strong>{titre}</strong>
                  <span className="petit gris">{b.pieces[k] ?? detail}</span>
                </span>
                <span className="btn btn--secondaire">
                  <Upload size={16} aria-hidden="true" /> {b.pieces[k] ? "Remplacer" : "Ajouter"}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="sr-only"
                  onChange={(e) => e.target.files?.[0] && maj({ pieces: { ...b.pieces, [k]: e.target.files[0].name } })}
                />
              </label>
            ))}
            {essai && ["identite", "propriete", "mandat"].some((k) => erreurs[4].includes(k)) && (
              <span className="champ__erreur">Ajoutez les documents demandés.</span>
            )}
            <fieldset className="champ champ--groupe">
              <legend>Je certifie sur l'honneur</legend>
              <div className="choix">
                {[
                  "Être propriétaire de ce bien, ou mandaté par son propriétaire.",
                  "Que les photos et les informations sont exactes et à jour.",
                  "Accepter la visite d'un agent Xwé Tché pour le contrôle sur place.",
                ].map((t, i) => (
                  <label key={t} className="choix__option">
                    <input
                      type="checkbox"
                      checked={b.certifs[i]}
                      onChange={(e) => maj({ certifs: b.certifs.map((c, j) => (j === i ? e.target.checked : c)) as Brouillon["certifs"] })}
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
              {err("certifs") && <span className="champ__erreur">Cochez les trois certifications.</span>}
            </fieldset>
            <p className="petit gris">Vos documents ne sont jamais publiés. Ils servent uniquement à la vérification par l'agence.</p>
          </>
        )}

        {etape === 5 && (
          <>
            <dl className="depot__recap">
              {(
                [
                  [0, "Logement", `${TYPES[b.type as TypeBien]} · ${b.quartier}`],
                  [0, "Repères", b.adresse],
                  [1, "Photos", `${b.photos.length} photos`],
                  [2, "Montants", `${fcfa(loyer)} / mois · avance ${b.avanceMois} mois · caution ${b.cautionMois} mois${Number(b.charges) ? ` · charges ${fcfa(Number(b.charges))}` : ""}`],
                  [3, "Équipements", b.equipements.map((e) => EQUIPEMENTS[e].libelle).join(", ") || "Aucun indiqué"],
                  [4, "Documents", `${Object.keys(b.pieces).length} document(s), certifications acceptées`],
                ] as [number, string, string][]
              ).map(([i, k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                  <button type="button" className="btn btn--texte" onClick={() => setEtape(i)}>
                    Modifier
                  </button>
                </div>
              ))}
            </dl>
            <div className="bandeau bandeau--info">
              Réponse sous 48 h. Vous suivez l'étude en direct dans votre espace, et un agent passe ensuite sur place avant la mise en ligne.
            </div>
          </>
        )}

        <button type="submit" className="btn btn--principal btn--bloc depot__suivant">
          {etape < ETAPES.length - 1 ? "Continuer" : "Envoyer mon annonce en étude"}
        </button>
      </form>
    </div>
  );
}
