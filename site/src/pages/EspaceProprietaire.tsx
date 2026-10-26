import { CalendarDays, Eye, FileText, Home, Plus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Feuille } from "../components/Feuille";
import { Photo } from "../components/Photo";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import { dateCourte, dateHeure, heuresRestantes, majEtat, useEtat, type Bien, type Candidat } from "../lib/compte";
import { fcfa, pluriel } from "../lib/format";
import { useTitre } from "../lib/titre";
import { EnteteEspace } from "./MonEspace";

const ONGLETS = [
  ["biens", "Mes biens", Home],
  ["agenda", "Visites", CalendarDays],
  ["candidats", "Candidats", Users],
] as const;
type Onglet = (typeof ONGLETS)[number][0];

const majBien = (ref: string, f: (b: Bien) => Bien) => majEtat((e) => ({ ...e, biens: e.biens.map((b) => (b.ref === ref ? f(b) : b)) }));

export function EspaceProprietaire() {
  useTitre("Mon espace propriétaire");
  const { biens, compte } = useEtat();
  const [params, setParams] = useSearchParams();
  const onglet = (ONGLETS.find(([k]) => k === params.get("onglet"))?.[0] ?? "biens") as Onglet;
  const envoye = params.get("envoye");
  const compteurs: Record<Onglet, number> = {
    biens: biens.length,
    agenda: biens.reduce((n, b) => n + b.visites.length, 0),
    candidats: biens.reduce((n, b) => n + b.candidats.filter((c) => c.statut === "en-attente").length, 0),
  };

  return (
    <div className="wrap edito">
      <EnteteEspace titre={`Bonjour ${compte?.nom.split(" ")[0] ?? ""}`} sousTitre="Mon espace propriétaire">
        <Link to="/proprietaires/deposer" className="btn btn--secondaire">
          <Plus size={18} aria-hidden="true" /> Déposer un bien
        </Link>
      </EnteteEspace>

      {envoye && (
        <div className="bandeau bandeau--succes espace__annonce" role="status">
          Annonce <span className="mono">{envoye}</span> envoyée en étude. Réponse sous 48 h, suivez le compte à rebours ci-dessous.
        </div>
      )}

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
            onClick={() => setParams(k === "biens" ? {} : { onglet: k }, { replace: true })}
          >
            <Icone aria-hidden="true" />
            {libelle}
            {compteurs[k] > 0 && <span className="onglet__nombre">{compteurs[k]}</span>}
          </button>
        ))}
      </div>

      <div id="panneau-espace" role="tabpanel" aria-labelledby={`onglet-${onglet}`} className="espace__panneau">
        {onglet === "biens" && <MesBiens biens={biens} />}
        {onglet === "agenda" && <Agenda biens={biens} />}
        {onglet === "candidats" && <Candidats biens={biens} />}
      </div>
    </div>
  );
}

function useMaintenant() {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), 60000);
    return () => clearInterval(i);
  }, []);
  return t;
}

// Compte à rebours des 48 h d'étude, en pause pendant une demande de correction (PRO-06).
function CompteARebours({ bien }: { bien: Bien }) {
  const maintenant = useMaintenant();
  const reste = heuresRestantes(bien, maintenant);
  const pause = bien.statut === "a-corriger";
  return (
    <div className={`rebours${pause ? " rebours--pause" : ""}`}>
      <div className="rebours__barre" role="progressbar" aria-valuemin={0} aria-valuemax={48} aria-valuenow={48 - reste} aria-label="Avancement de l'étude">
        <span style={{ width: `${((48 - reste) / 48) * 100}%` }} />
      </div>
      <span className="petit">{pause ? `En pause, corrections demandées · ${reste} h restantes à la reprise` : `Réponse sous ${reste} h au plus tard`}</span>
    </div>
  );
}

function BadgeBien({ bien }: { bien: Bien }) {
  const maintenant = useMaintenant();
  switch (bien.statut) {
    case "en-etude":
      return <Badge famille="neutre">En étude · {heuresRestantes(bien, maintenant)} h restantes</Badge>;
    case "a-corriger":
      return <Badge famille="action">Correction demandée</Badge>;
    case "refusee":
      return <Badge famille="erreur">Refusée</Badge>;
    case "louee":
      return <Badge famille="info">Louée</Badge>;
    default:
      return bien.departLe ? (
        <Badge famille="info">Bientôt disponible le {dateCourte(bien.departLe)}</Badge>
      ) : (
        <Badge famille="succes">En ligne · Vérifié sur place</Badge>
      );
  }
}

function MesBiens({ biens }: { biens: Bien[] }) {
  const [depart, setDepart] = useState<Bien | null>(null);
  if (!biens.length)
    return (
      <Vide
        titre="Aucun bien pour l'instant"
        texte="Déposez votre premier bien en moins de 10 minutes. Votre brouillon est enregistré à chaque étape."
        action={
          <Link to="/proprietaires/deposer" className="btn btn--principal">
            Déposer un bien
          </Link>
        }
      />
    );
  return (
    <>
      <div className="liste-lignes">
        {biens.map((b, i) => (
          <article key={b.ref} className="carte bien">
            <div className="bien__haut">
              <Photo libelle={`${b.type} à ${b.quartier}`} graine={i} className="ligne-bien__photo" />
              <div className="ligne-bien__corps">
                <strong className="ligne-bien__titre">
                  {b.type} · {b.quartier}
                </strong>
                <span className="petit gris">
                  {fcfa(b.loyer)} / mois · <span className="mono">Réf. {b.ref}</span>
                </span>
                <span className="ligne-bien__badges">
                  <BadgeBien bien={b} />
                </span>
              </div>
            </div>

            {(b.statut === "en-etude" || b.statut === "a-corriger") && <CompteARebours bien={b} />}

            {b.statut === "a-corriger" && (
              <div className="bien__correction">
                <div className="bandeau bandeau--info">
                  <FileText aria-hidden="true" />
                  <span>
                    <strong>À corriger : </strong>
                    {b.motif}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--principal"
                  onClick={() =>
                    majBien(b.ref, (x) => ({
                      ...x,
                      statut: "en-etude",
                      // Le temps passé en pause ne compte pas dans les 48 h
                      soumisLe: new Date(new Date(x.soumisLe!).getTime() + (Date.now() - new Date(x.pauseLe!).getTime())).toISOString(),
                      pauseLe: undefined,
                      motif: undefined,
                    }))
                  }
                >
                  J'ai corrigé, renvoyer en étude
                </button>
              </div>
            )}

            {(b.statut === "en-ligne" || b.statut === "louee") && (
              <div className="bien__chiffres">
                <span>
                  <Eye aria-hidden="true" /> {pluriel(b.vues, "vue", "vues")}
                </span>
                <span>
                  <CalendarDays aria-hidden="true" /> {pluriel(b.visites.length, "visite prévue", "visites prévues")}
                </span>
                <span>
                  <Users aria-hidden="true" /> {pluriel(b.candidats.length, "candidat", "candidats")}
                </span>
                {b.statut === "en-ligne" && !b.departLe && (
                  <button type="button" className="btn btn--texte" onClick={() => setDepart(b)}>
                    Déclarer un départ
                  </button>
                )}
                {b.statut === "louee" && (
                  <button type="button" className="btn btn--texte" onClick={() => setDepart(b)}>
                    Le locataire part
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      {depart && <DeclarerDepart bien={depart} onFermer={() => setDepart(null)} />}
    </>
  );
}

// Départ annoncé : le bien repasse en « Bientôt disponible » et les personnes en liste d'attente sont prévenues (PRO-09, LOC-12).
function DeclarerDepart({ bien, onFermer }: { bien: Bien; onFermer: () => void }) {
  const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [date, setDate] = useState("");
  return (
    <Feuille titre="Déclarer un départ" soustitre={`${bien.type} · ${bien.quartier} · Réf. ${bien.ref}`} onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (!date) return;
          majBien(bien.ref, (x) => ({ ...x, statut: "en-ligne", departLe: new Date(date).toISOString() }));
          onFermer();
        }}
      >
        <div className="champ">
          <label htmlFor="depart-date">Date de libération du logement</label>
          <input id="depart-date" type="date" min={demain} value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="aide">L'annonce passe en « Bientôt disponible » et les personnes en liste d'attente sont prévenues par SMS.</span>
        </div>
        <button type="submit" className="btn btn--principal btn--bloc" disabled={!date}>
          Confirmer la date
        </button>
      </form>
    </Feuille>
  );
}

function Agenda({ biens }: { biens: Bien[] }) {
  const creneaux = biens
    .flatMap((b) => b.visites.map((v) => ({ ...v, bien: b })))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!creneaux.length)
    return <Vide titre="Aucune visite prévue" texte="Les visites réservées par les locataires s'affichent ici, avec le nom du visiteur et l'agent présent." />;
  const parJour = new Map<string, typeof creneaux>();
  creneaux.forEach((c) => parJour.set(c.date.slice(0, 10), [...(parJour.get(c.date.slice(0, 10)) ?? []), c]));
  return (
    <div className="agenda">
      {[...parJour.entries()].map(([jour, liste]) => (
        <section key={jour} className="agenda__jour">
          <h2 className="h3">{dateHeure(liste[0].date).split(" à ")[0]}</h2>
          <ul className="liste-lignes">
            {liste.map((c) => (
              <li key={c.id} className="carte ligne-simple">
                <span className="mono agenda__heure">{dateHeure(c.date).split(" à ")[1]}</span>
                <span>
                  <strong>{c.visiteur}</strong>
                  <span className="petit gris">
                    {c.bien.type} · {c.bien.quartier} · <span className="mono">{c.bien.ref}</span>
                  </span>
                </span>
                <Badge famille="info">Agent présent</Badge>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="petit gris espace__note">Vous n'avez pas besoin d'être présent : un agent Xwé Tché accueille chaque visiteur.</p>
    </div>
  );
}

function Candidats({ biens }: { biens: Bien[] }) {
  const [choix, setChoix] = useState<{ bien: Bien; candidat: Candidat } | null>(null);
  const avec = biens.filter((b) => b.candidats.length);
  if (!avec.length)
    return <Vide titre="Aucun candidat pour l'instant" texte="Après une visite « Satisfait », les locataires peuvent candidater. Vous choisissez qui signe le bail." />;
  return (
    <>
      {avec.map((b) => {
        const retenu = b.candidats.find((c) => c.statut === "retenu");
        return (
          <section key={b.ref} className="candidats">
            <h2 className="h3">
              {b.type} · {b.quartier} <span className="mono petit gris">Réf. {b.ref}</span>
            </h2>
            {retenu && (
              <div className="bandeau bandeau--succes">
                Vous avez choisi {retenu.nom}. Le bail lui est envoyé pour signature en ligne ; vous êtes prévenu dès qu'il est signé.
              </div>
            )}
            <ul className="liste-lignes">
              {b.candidats.map((c) => (
                <li key={c.id} className="carte ligne-simple candidat">
                  <span className="candidat__initiale" aria-hidden="true">
                    {c.nom[0]}
                  </span>
                  <span>
                    <strong>{c.nom}</strong>
                    <span className="petit gris">
                      {c.profession} · revenus {c.revenus} · visite le {dateCourte(c.visiteLe)}
                    </span>
                  </span>
                  {c.statut === "en-attente" && !retenu && (
                    <button type="button" className="btn btn--secondaire" onClick={() => setChoix({ bien: b, candidat: c })}>
                      Choisir
                    </button>
                  )}
                  {c.statut === "retenu" && <Badge famille="succes">Choisi</Badge>}
                  {c.statut === "non-retenu" && <Badge famille="neutre">Non retenu</Badge>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {choix && (
        <Feuille titre={`Choisir ${choix.candidat.nom} ?`} soustitre={`${choix.bien.type} · ${choix.bien.quartier}`} onFermer={() => setChoix(null)}>
          <div className="formulaire">
            <p className="gris" style={{ margin: 0 }}>
              {choix.candidat.nom} recevra le bail à signer. Les autres candidats seront prévenus que le logement n'est plus disponible.
            </p>
            <button
              type="button"
              className="btn btn--principal btn--bloc"
              onClick={() => {
                majBien(choix.bien.ref, (x) => ({
                  ...x,
                  candidats: x.candidats.map((c) => ({ ...c, statut: c.id === choix.candidat.id ? "retenu" : "non-retenu" })),
                }));
                setChoix(null);
              }}
            >
              Confirmer mon choix
            </button>
            <button type="button" className="btn btn--texte" onClick={() => setChoix(null)}>
              Annuler
            </button>
          </div>
        </Feuille>
      )}
    </>
  );
}
