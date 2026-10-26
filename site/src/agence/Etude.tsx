import { AlertTriangle, ArrowLeft, Check, FileText, X } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Feuille } from "../components/Feuille";
import { Photo } from "../components/Photo";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import {
  CHECKLIST,
  dateFr,
  heuresRestantesDossier,
  journaliser,
  majDossier,
  repercuterChezProprietaire,
  useAgence,
  useMembre,
  type Dossier,
} from "../lib/agence";
import { telLisible } from "../lib/compte";
import { fcfa } from "../lib/format";
import { useParametres } from "../lib/parametres";
import { BadgeDossier, Filtres, Minuteur, PageBO } from "./ui";

// Défauts relevés par la vérification automatique préalable (BO-04)
function defautsAuto(d: Dossier) {
  const l: string[] = [];
  if (!d.auto.photosNettes) l.push("Photos floues ou trop petites");
  if (!d.auto.champsComplets) l.push("Champs obligatoires manquants");
  if (d.auto.doublonPhoto) l.push("Photo déjà utilisée sur une autre annonce");
  if (d.auto.doublonAdresse) l.push("Adresse déjà publiée");
  if (d.photos < 6) l.push(`${d.photos} photos sur 6 minimum`);
  if (!d.documents.identite || !d.documents.propriete || d.documents.mandat === false) l.push("Document manquant");
  return l;
}

// File d'étude triée par urgence (BO-01)
export function FileEtude() {
  const { dossiers } = useAgence();
  const { alerteEtude } = useParametres();
  const [filtre, setFiltre] = useState<"a-etudier" | "a-corriger" | "tous">("a-etudier");
  const aEtudier = dossiers.filter((d) => d.statut === "en-etude");
  const aCorriger = dossiers.filter((d) => d.statut === "a-corriger");
  const liste = (filtre === "a-etudier" ? aEtudier : filtre === "a-corriger" ? aCorriger : [...aEtudier, ...aCorriger]).sort(
    (x, y) => heuresRestantesDossier(x) - heuresRestantesDossier(y),
  );
  const urgents = aEtudier.filter((d) => heuresRestantesDossier(d) <= alerteEtude).length;

  return (
    <PageBO titre="File d'étude" intro="Annonces à étudier, la plus urgente en premier. Le minuteur se met en pause pendant les corrections.">
      {urgents > 0 && (
        <div className="bandeau bandeau--erreur bo-alerte" role="alert">
          <AlertTriangle aria-hidden="true" />
          {urgents} annonce{urgents > 1 ? "s arrivent" : " arrive"} à échéance dans moins de {alerteEtude} h.
        </div>
      )}
      <Filtres
        valeur={filtre}
        onChange={setFiltre}
        options={[
          ["a-etudier", "À étudier", aEtudier.length],
          ["a-corriger", "En attente de correction", aCorriger.length],
          ["tous", "Tout"],
        ]}
      />
      {liste.length ? (
        <div className="tbo-cadre">
          <table className="tbo">
            <thead>
              <tr>
                <th>Annonce</th>
                <th>Propriétaire</th>
                <th>Soumise le</th>
                <th>Vérification auto</th>
                <th>Délai</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {liste.map((d) => {
                const defauts = defautsAuto(d);
                return (
                  <tr key={d.ref}>
                    <td>
                      <Link to={`/agence/etude/${d.ref}`} className="mono">
                        {d.ref}
                      </Link>
                      <span className="tbo__sous">
                        {d.type} · {d.quartier} · {fcfa(d.loyer)}
                      </span>
                    </td>
                    <td>
                      {d.proprietaire}
                      {d.gestionnaire && <span className="tbo__sous">Gestionnaire mandaté</span>}
                    </td>
                    <td className="mono">{dateFr(d.soumisLe)}</td>
                    <td>{defauts.length ? <Badge famille="action">{defauts.length} point(s) à vérifier</Badge> : <Badge famille="succes">RAS</Badge>}</td>
                    <td>
                      <Minuteur dossier={d} compact />
                    </td>
                    <td>
                      <Link to={`/agence/etude/${d.ref}`} className="btn btn--secondaire btn--petit">
                        {d.statut === "en-etude" ? "Étudier" : "Voir"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Vide titre="File vide" texte="Aucune annonce dans cette catégorie." />
      )}
    </PageBO>
  );
}

type Decision = "valider" | "corriger" | "refuser" | null;

export function DossierEtude() {
  const { ref = "" } = useParams();
  const a = useAgence();
  const membre = useMembre();
  const p = useParametres();
  const d = a.dossiers.find((x) => x.ref === ref);
  const [decision, setDecision] = useState<Decision>(null);

  if (!d)
    return (
      <PageBO titre="Dossier introuvable">
        <Link to="/agence/etude" className="btn btn--secondaire">
          Retour à la file d'étude
        </Link>
      </PageBO>
    );

  const defauts = defautsAuto(d);
  const coches = CHECKLIST.filter((c) => d.checklist[c]).length;
  const modifiable = d.statut === "en-etude";
  const total = d.loyer * (d.avanceMois + d.cautionMois);

  return (
    <PageBO
      titre={`${d.type} · ${d.quartier}`}
      intro={`Réf. ${d.ref} · soumise le ${dateFr(d.soumisLe)}${d.etudiePar ? ` · étudiée par ${d.etudiePar}` : ""}`}
      actions={
        <Link to="/agence/etude" className="btn btn--texte">
          <ArrowLeft size={18} aria-hidden="true" /> File d'étude
        </Link>
      }
    >
      <div className="dossier__statut">
        <BadgeDossier statut={d.statut} />
        {(d.statut === "en-etude" || d.statut === "a-corriger") && <Minuteur dossier={d} />}
      </div>
      {d.motif && (
        <div className={`bandeau ${d.statut === "refusee" ? "bandeau--erreur" : "bandeau--info"}`}>
          <FileText aria-hidden="true" />
          <span>
            <strong>{d.statut === "refusee" ? "Motif du refus : " : "Correction demandée : "}</strong>
            {d.motif}
          </span>
        </div>
      )}

      <div className="dossier">
        <div className="dossier__principal">
          <section className="carte bo-bloc">
            <h2 className="h3">Photos ({d.photos})</h2>
            <div className="dossier__photos">
              {Array.from({ length: d.photos }, (_, i) => (
                <Photo key={i} libelle={["Façade", "Pièce principale", "Chambre", "Cuisine", "Douche", "Cour", "Repère", "Autre"][i] ?? `Photo ${i + 1}`} graine={i} />
              ))}
            </div>
          </section>

          <section className="carte bo-bloc">
            <h2 className="h3">Informations</h2>
            <dl className="bo-infos">
              <div>
                <dt>Loyer</dt>
                <dd className="mono">{fcfa(d.loyer)}</dd>
              </div>
              <div>
                <dt>Avance</dt>
                <dd className="mono">
                  {d.avanceMois} mois · {fcfa(d.loyer * d.avanceMois)}
                </dd>
              </div>
              <div>
                <dt>Caution</dt>
                <dd className="mono">
                  {d.cautionMois} mois · {fcfa(d.loyer * d.cautionMois)}
                </dd>
              </div>
              <div>
                <dt>Charges</dt>
                <dd className="mono">{fcfa(d.charges)}</dd>
              </div>
              <div>
                <dt>Entrée hors commission</dt>
                <dd className="mono">{fcfa(total)}</dd>
              </div>
              <div>
                <dt>Repères</dt>
                <dd>{d.reperes || "Non renseignés"}</dd>
              </div>
              <div>
                <dt>Propriétaire</dt>
                <dd>
                  {d.proprietaire} · <span className="mono">{telLisible(d.telProprietaire)}</span>
                  {d.gestionnaire && " · gestionnaire mandaté"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="carte bo-bloc">
            <h2 className="h3">Documents</h2>
            <ul className="bo-verifs">
              <Verif ok={d.documents.identite} texte="Pièce d'identité" />
              <Verif ok={d.documents.propriete} texte="Document de propriété" />
              {d.documents.mandat !== undefined && <Verif ok={d.documents.mandat} texte="Mandat du propriétaire" />}
            </ul>
          </section>
        </div>

        <aside className="dossier__cote">
          <section className="carte bo-bloc">
            <h2 className="h3">Vérification automatique</h2>
            <ul className="bo-verifs">
              <Verif ok={d.auto.photosNettes && d.photos >= 6} texte={`Photos : ${d.photos}, netteté et taille`} />
              <Verif ok={d.auto.champsComplets} texte="Champs obligatoires remplis" />
              <Verif ok={!d.auto.doublonPhoto} texte="Aucune photo en double" />
              <Verif ok={!d.auto.doublonAdresse} texte="Adresse non publiée ailleurs" />
            </ul>
            {defauts.length > 0 && <p className="petit gris">{defauts.length} point(s) à examiner avant de valider.</p>}
          </section>

          <section className="carte bo-bloc">
            <h2 className="h3">
              Liste de contrôle{" "}
              <span className="mono petit gris">
                {coches}/{CHECKLIST.length}
              </span>
            </h2>
            <div className="choix">
              {CHECKLIST.map((c) => (
                <label key={c} className="choix__option">
                  <input
                    type="checkbox"
                    disabled={!modifiable}
                    checked={!!d.checklist[c]}
                    onChange={(e) => majDossier(d.ref, (x) => ({ ...x, checklist: { ...x.checklist, [c]: e.target.checked } }))}
                  />
                  <span>{c}</span>
                </label>
              ))}
            </div>
          </section>

          {modifiable && (
            <section className="carte bo-bloc dossier__decision">
              <h2 className="h3">Décision</h2>
              <button type="button" className="btn btn--principal btn--bloc" disabled={coches < CHECKLIST.length} onClick={() => setDecision("valider")}>
                Valider l'annonce
              </button>
              {coches < CHECKLIST.length && <span className="petit gris">Cochez toute la liste de contrôle pour valider.</span>}
              <button type="button" className="btn btn--secondaire btn--bloc" onClick={() => setDecision("corriger")}>
                Demander des modifications
              </button>
              <button type="button" className="btn btn--danger btn--bloc" onClick={() => setDecision("refuser")}>
                Refuser
              </button>
            </section>
          )}
        </aside>
      </div>

      {decision === "valider" && <Valider dossier={d} equipeTerrain={a.equipe.filter((m) => m.role === "terrain" && m.actif).map((m) => m.nom)} onFermer={() => setDecision(null)} etudiePar={membre?.nom} />}
      {(decision === "corriger" || decision === "refuser") && (
        <Motiver
          dossier={d}
          type={decision}
          motifs={decision === "corriger" ? p.motifsCorrection : p.motifsRefus}
          etudiePar={membre?.nom}
          onFermer={() => setDecision(null)}
        />
      )}
    </PageBO>
  );
}

function Verif({ ok, texte }: { ok: boolean; texte: string }) {
  return (
    <li className={ok ? "est-ok" : "est-ko"}>
      {ok ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
      <span>
        {texte}
        <span className="sr-only">{ok ? " : conforme" : " : à vérifier"}</span>
      </span>
    </li>
  );
}

function Valider({ dossier, equipeTerrain, etudiePar, onFermer }: { dossier: Dossier; equipeTerrain: string[]; etudiePar?: string; onFermer: () => void }) {
  const [agent, setAgent] = useState(equipeTerrain[0] ?? "");
  const [date, setDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  return (
    <Feuille titre="Valider l'annonce" soustitre={`${dossier.ref} · ${dossier.type} · ${dossier.quartier}`} onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          majDossier(dossier.ref, (x) => ({ ...x, statut: "controle", etudiePar, agentTerrain: agent || undefined, controleLe: agent ? new Date(`${date}T10:00`).toISOString() : undefined, controle: { fait: false } }));
          repercuterChezProprietaire(dossier.ref, "controle");
          journaliser("Annonce validée, contrôle terrain programmé", `${dossier.ref}${agent ? ` → ${agent}` : ""}`);
          onFermer();
        }}
      >
        <p className="gris" style={{ margin: 0 }}>
          L'annonce passe au contrôle sur place. Elle sera publiée avec le badge « Vérifié sur place » après la visite de l'agent.
        </p>
        <div className="formulaire__deux">
          <div className="champ">
            <label htmlFor="val-agent">Agent terrain</label>
            <select id="val-agent" value={agent} onChange={(e) => setAgent(e.target.value)}>
              <option value="">Attribuer plus tard</option>
              {equipeTerrain.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="val-date">Date du contrôle</label>
            <input id="val-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} disabled={!agent} />
          </div>
        </div>
        <button type="submit" className="btn btn--principal btn--bloc">
          Confirmer la validation
        </button>
      </form>
    </Feuille>
  );
}

function Motiver({ dossier, type, motifs, etudiePar, onFermer }: { dossier: Dossier; type: "corriger" | "refuser"; motifs: string[]; etudiePar?: string; onFermer: () => void }) {
  const [motif, setMotif] = useState("");
  const [detail, setDetail] = useState("");
  const [essai, setEssai] = useState(false);
  const texte = [motif, detail.trim()].filter(Boolean).join(" : ");
  return (
    <Feuille titre={type === "corriger" ? "Demander des modifications" : "Refuser l'annonce"} soustitre={`${dossier.ref} · ${dossier.proprietaire}`} onFermer={onFermer}>
      <form
        className="formulaire"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setEssai(true);
          if (!motif) return;
          if (type === "corriger") {
            const pauseLe = new Date().toISOString();
            majDossier(dossier.ref, (x) => ({ ...x, statut: "a-corriger", motif: texte, pauseLe, etudiePar }));
            repercuterChezProprietaire(dossier.ref, "a-corriger", { motif: texte, pauseLe });
            journaliser("Correction demandée", `${dossier.ref} · ${texte}`);
          } else {
            majDossier(dossier.ref, (x) => ({ ...x, statut: "refusee", motif: texte, etudiePar }));
            repercuterChezProprietaire(dossier.ref, "refusee", { motif: texte });
            journaliser("Annonce refusée", `${dossier.ref} · ${texte}`);
          }
          onFermer();
        }}
      >
        <fieldset className={`champ champ--groupe${essai && !motif ? " champ--erreur" : ""}`}>
          <legend>Motif {type === "refuser" && "(obligatoire)"}</legend>
          <div className="choix">
            {motifs.map((m) => (
              <label key={m} className="choix__option">
                <input type="radio" name="motif" checked={motif === m} onChange={() => setMotif(m)} />
                <span>{m}</span>
              </label>
            ))}
          </div>
          {essai && !motif && <span className="champ__erreur">Choisissez un motif.</span>}
        </fieldset>
        <div className="champ">
          <label htmlFor="mot-detail">Précision pour le propriétaire</label>
          <textarea id="mot-detail" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Ex. photos de la cuisine et de la douche" />
          <span className="aide">{type === "corriger" ? "Le compte à rebours se met en pause jusqu'à son renvoi." : "Le propriétaire est prévenu par SMS avec ce motif."}</span>
        </div>
        <button type="submit" className={`btn btn--bloc ${type === "corriger" ? "btn--principal" : "btn--danger"}`}>
          {type === "corriger" ? "Envoyer la demande" : "Confirmer le refus"}
        </button>
      </form>
    </Feuille>
  );
}
