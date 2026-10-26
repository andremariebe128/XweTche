import { Bell, CalendarDays, FileText, Heart, LogOut, Receipt, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CarteAnnonce } from "../components/CarteAnnonce";
import { Candidater } from "../components/Candidater";
import { Porte } from "../components/Marque";
import { Photo } from "../components/Photo";
import { RetourVisite } from "../components/RetourVisite";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import { ANNONCES, TYPES } from "../data/annonces";
import { dateHeure, deconnecter, majEtat, telLisible, useEtat, type Candidature, type Visite } from "../lib/compte";
import { useFavoris } from "../lib/favoris";
import { useParametres } from "../lib/parametres";
import { fcfa, pluriel } from "../lib/format";
import { useTitre } from "../lib/titre";
import { EspaceProprietaire } from "./EspaceProprietaire";

export default function MonEspace() {
  const { compte } = useEtat();
  if (!compte) return <FavorisInvite />;
  return compte.role === "proprietaire" ? <EspaceProprietaire /> : <EspaceLocataire />;
}

// Sans compte : les favoris restent accessibles (gardés sur l'appareil).
function FavorisInvite() {
  useTitre("Mes favoris");
  return (
    <div className="wrap edito">
      <p className="eyebrow">Mon espace</p>
      <h1 className="h1">Mes favoris</h1>
      <div className="bandeau bandeau--info espace__invite">
        <span>Connectez-vous pour suivre vos visites, vos candidatures et vos reçus.</span>
        <Link to="/connexion" className="btn btn--secondaire">
          Se connecter
        </Link>
      </div>
      <ListeFavoris />
    </div>
  );
}

function ListeFavoris() {
  const { liste } = useFavoris();
  const favoris = ANNONCES.filter((a) => liste.includes(a.ref));
  return favoris.length ? (
    <div className="grille-annonces">
      {favoris.map((a, i) => (
        <CarteAnnonce key={a.ref} annonce={a} index={i} />
      ))}
    </div>
  ) : (
    <Vide
      titre="Aucun favori pour l'instant"
      texte="Touchez le cœur sur une annonce pour la retrouver ici, même sans connexion."
      action={
        <Link to="/louer" className="btn btn--principal">
          Voir les logements
        </Link>
      }
    />
  );
}

const ONGLETS = [
  ["visites", "Visites", CalendarDays],
  ["favoris", "Favoris", Heart],
  ["candidatures", "Candidatures", FileText],
  ["alertes", "Alertes", Bell],
  ["recus", "Reçus", Receipt],
] as const;
type Onglet = (typeof ONGLETS)[number][0];

export function EnteteEspace({ titre, sousTitre, children }: { titre: string; sousTitre: string; children?: React.ReactNode }) {
  const { compte } = useEtat();
  return (
    <div className="espace__tete">
      <div>
        <p className="eyebrow">{sousTitre}</p>
        <h1 className="h1">{titre}</h1>
        <p className="gris espace__qui">
          {compte?.nom} · <span className="mono">{compte && telLisible(compte.tel)}</span>
        </p>
      </div>
      <div className="espace__outils">
        {children}
        <button type="button" className="btn btn--texte" onClick={deconnecter}>
          <LogOut size={18} aria-hidden="true" /> Se déconnecter
        </button>
      </div>
    </div>
  );
}

function EspaceLocataire() {
  useTitre("Mon espace");
  const etat = useEtat();
  const { liste } = useFavoris();
  const { plafondVisites } = useParametres();
  const [params, setParams] = useSearchParams();
  const onglet = (ONGLETS.find(([k]) => k === params.get("onglet"))?.[0] ?? "visites") as Onglet;
  const compteurs: Record<Onglet, number> = {
    visites: etat.visites.length,
    favoris: liste.length,
    candidatures: etat.candidatures.length,
    alertes: etat.alertes.length,
    recus: etat.recus.length,
  };
  const prenom = etat.compte?.nom.split(" ")[0] ?? "";

  return (
    <div className="wrap edito">
      <EnteteEspace titre={`Bonjour ${prenom}`} sousTitre="Mon espace locataire">
        {/* Le compteur de visites gratuites reste visible en permanence (LOC-07). */}
        <span className="compteur-visites compteur-visites--grand" title={`Jusqu'à ${plafondVisites} visites gratuites en cours`}>
          <Porte taille={14} /> {pluriel(etat.visitesGratuites, "visite gratuite", "visites gratuites")}
        </span>
      </EnteteEspace>

      <div className="onglets" role="tablist" aria-label="Rubriques de mon espace">
        {ONGLETS.map(([k, libelle, Icone]) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`onglet-${k}`}
            aria-selected={onglet === k}
            aria-controls="panneau-espace"
            className="onglet"
            onClick={() => setParams(k === "visites" ? {} : { onglet: k }, { replace: true })}
          >
            <Icone aria-hidden="true" />
            {libelle}
            {compteurs[k] > 0 && <span className="onglet__nombre">{compteurs[k]}</span>}
          </button>
        ))}
      </div>

      <div id="panneau-espace" role="tabpanel" aria-labelledby={`onglet-${onglet}`} className="espace__panneau">
        {onglet === "visites" && <MesVisites visites={etat.visites} candidatures={etat.candidatures} />}
        {onglet === "favoris" && <ListeFavoris />}
        {onglet === "candidatures" && <MesCandidatures candidatures={etat.candidatures} />}
        {onglet === "alertes" && <MesAlertes />}
        {onglet === "recus" && <MesRecus />}
      </div>
    </div>
  );
}

function LigneBien({ refAnnonce, children, actions }: { refAnnonce: string; children?: React.ReactNode; actions?: React.ReactNode }) {
  const a = ANNONCES.find((x) => x.ref === refAnnonce);
  return (
    <article className="carte ligne-bien">
      <Photo libelle={a ? `${TYPES[a.type]} à ${a.quartier}` : refAnnonce} graine={a ? ANNONCES.indexOf(a) : 0} className="ligne-bien__photo" />
      <div className="ligne-bien__corps">
        {a ? (
          <Link to={`/annonce/${a.slug}`} className="ligne-bien__titre">
            {TYPES[a.type]} · {a.quartier}
          </Link>
        ) : (
          <span className="ligne-bien__titre">Logement</span>
        )}
        <span className="petit gris">
          {a && <>{fcfa(a.loyer)} / mois · </>}
          <span className="mono">Réf. {refAnnonce}</span>
        </span>
        {children}
      </div>
      {actions && <div className="ligne-bien__actions">{actions}</div>}
    </article>
  );
}

function BadgeVisite({ v }: { v: Visite }) {
  switch (v.statut) {
    case "a-venir":
      return <Badge famille="info">Visite prévue</Badge>;
    case "a-evaluer":
      return <Badge famille="action">Votre avis est attendu</Badge>;
    case "satisfait":
      return <Badge famille="succes">Satisfait</Badge>;
    case "pas-satisfait":
      return (
        <>
          <Badge famille="neutre">Pas satisfait</Badge>
          {v.motif && <span className="petit gris">Motif : {v.motif}</span>}
        </>
      );
    default:
      return <Badge famille="neutre">Annulée</Badge>;
  }
}

function MesVisites({ visites, candidatures }: { visites: Visite[]; candidatures: Candidature[] }) {
  const [avis, setAvis] = useState<Visite | null>(null);
  const [candidater, setCandidater] = useState<string | null>(null);
  const ordre = { "a-evaluer": 0, "a-venir": 1, satisfait: 2, "pas-satisfait": 3, annulee: 4 };
  const triees = [...visites].sort((a, b) => ordre[a.statut] - ordre[b.statut]);

  if (!visites.length)
    return (
      <Vide
        titre="Aucune visite pour l'instant"
        texte="Réservez une visite depuis une annonce : un agent Xwé Tché vous accompagne sur place."
        action={
          <Link to="/louer" className="btn btn--principal">
            Voir les logements
          </Link>
        }
      />
    );

  return (
    <>
      <div className="liste-lignes">
        {triees.map((v) => {
          const dejaCandidat = candidatures.some((c) => c.ref === v.ref);
          return (
            <LigneBien
              key={v.id}
              refAnnonce={v.ref}
              actions={
                <>
                  {v.statut === "a-evaluer" && (
                    <button type="button" className="btn btn--principal" onClick={() => setAvis(v)}>
                      Donner mon avis
                    </button>
                  )}
                  {v.statut === "satisfait" && !dejaCandidat && (
                    <button type="button" className="btn btn--secondaire" onClick={() => setCandidater(v.ref)}>
                      Candidater
                    </button>
                  )}
                  {v.statut === "a-venir" && (
                    <button
                      type="button"
                      className="btn btn--texte"
                      onClick={() => majEtat((e) => ({ ...e, visites: e.visites.map((x) => (x.id === v.id ? { ...x, statut: "annulee" } : x)) }))}
                    >
                      Annuler
                    </button>
                  )}
                </>
              }
            >
              <span className="petit">{dateHeure(v.date)}</span>
              <span className="ligne-bien__badges">
                <BadgeVisite v={v} />
                {v.statut === "a-venir" && (
                  <span className="petit gris">
                    Code de visite <span className="mono code-visite">{v.code}</span>
                  </span>
                )}
                {dejaCandidat && v.statut === "satisfait" && <Badge famille="info">Candidature envoyée</Badge>}
              </span>
            </LigneBien>
          );
        })}
      </div>
      <p className="petit gris espace__note">Empêché ? Annulez au moins 12 h avant la visite pour garder vos visites gratuites.</p>
      {avis && (
        <RetourVisite
          visite={avis}
          onFermer={() => setAvis(null)}
          onCandidater={() => {
            setCandidater(avis.ref);
            setAvis(null);
          }}
        />
      )}
      {candidater && <Candidater refAnnonce={candidater} onFermer={() => setCandidater(null)} />}
    </>
  );
}

function MesCandidatures({ candidatures }: { candidatures: Candidature[] }) {
  const { recus } = useEtat();
  if (!candidatures.length)
    return (
      <Vide
        titre="Aucune candidature"
        texte="Après une visite « Satisfait », candidatez en un clic. Le propriétaire choisit son locataire."
        action={
          <Link to="/mon-espace" className="btn btn--secondaire">
            Voir mes visites
          </Link>
        }
      />
    );
  return (
    <div className="liste-lignes">
      {candidatures.map((c) => {
        const recu = recus.find((r) => r.ref === c.ref);
        return (
          <LigneBien
            key={c.id}
            refAnnonce={c.ref}
            actions={
              <>
                {c.statut === "retenue" && (
                  <Link to={`/bail/${c.ref}`} className="btn btn--principal">
                    Signer le bail
                  </Link>
                )}
                {c.statut === "bail-signe" && (
                  <Link to={`/bail/${c.ref}`} className="btn btn--principal">
                    Payer la commission
                  </Link>
                )}
                {c.statut === "payee" && recu && (
                  <Link to={`/recu/${recu.numero}`} className="btn btn--secondaire">
                    Voir le reçu
                  </Link>
                )}
              </>
            }
          >
            <span className="ligne-bien__badges">
              {c.statut === "envoyee" && <Badge famille="neutre">En attente du propriétaire</Badge>}
              {c.statut === "retenue" && <Badge famille="succes">Le propriétaire vous a choisi</Badge>}
              {c.statut === "non-retenue" && <Badge famille="erreur">Non retenue</Badge>}
              {c.statut === "bail-signe" && <Badge famille="action">Bail signé · commission à payer</Badge>}
              {c.statut === "payee" && <Badge famille="succes">Bail signé et payé</Badge>}
            </span>
          </LigneBien>
        );
      })}
    </div>
  );
}

function MesAlertes() {
  const { alertes } = useEtat();
  if (!alertes.length)
    return (
      <Vide
        titre="Aucune alerte"
        texte="Créez une alerte depuis la recherche : on vous prévient dès qu'un logement vérifié correspond."
        action={
          <Link to="/louer" className="btn btn--principal">
            Lancer une recherche
          </Link>
        }
      />
    );
  return (
    <div className="liste-lignes">
      {alertes.map((a) => (
        <div key={a.id} className="carte ligne-simple">
          <Bell aria-hidden="true" />
          <span>
            <strong>{a.resume}</strong>
            <span className="petit gris">Par {a.canal}</span>
          </span>
          <button
            type="button"
            className="btn-icone"
            aria-label={`Supprimer l'alerte ${a.resume}`}
            onClick={() => majEtat((e) => ({ ...e, alertes: e.alertes.filter((x) => x.id !== a.id) }))}
          >
            <Trash2 aria-hidden="true" size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}

function MesRecus() {
  const { recus } = useEtat();
  if (!recus.length)
    return <Vide titre="Aucun reçu" texte="Votre reçu apparaît ici dès le paiement de la commission, à la signature du bail." />;
  return (
    <div className="liste-lignes">
      {recus.map((r) => (
        <Link key={r.numero} to={`/recu/${r.numero}`} className="carte ligne-simple ligne-simple--lien">
          <Receipt aria-hidden="true" />
          <span>
            <strong className="mono">{r.numero}</strong>
            <span className="petit gris">
              {fcfa(r.montant)} · {r.operateur} · {dateHeure(r.date)}
            </span>
          </span>
          <Badge famille="succes">Payé</Badge>
        </Link>
      ))}
    </div>
  );
}
