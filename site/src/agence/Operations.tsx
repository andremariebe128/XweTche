import { useState } from "react";
import { Link } from "react-router-dom";
import { Feuille } from "../components/Feuille";
import { Photo } from "../components/Photo";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import {
  dateFr,
  exporterCSV,
  journaliser,
  majAgence,
  majDossier,
  repercuterChezProprietaire,
  useAgence,
  useMembre,
  type Bail,
  type Dossier,
  type StatutDossier,
  type Utilisateur,
  type VisiteAgence,
} from "../lib/agence";
import { telLisible } from "../lib/compte";
import { fcfa } from "../lib/format";
import { BadgeDossier, Barres, ChampRecherche, Exports, Filtres, Kpi, libelleDossier, PageBO } from "./ui";

const contient = (texte: string, q: string) => texte.toLowerCase().includes(q.trim().toLowerCase());

/* ============ Annonces ============ */

export function Annonces() {
  const { dossiers } = useAgence();
  const [filtre, setFiltre] = useState<StatutDossier | "tous">("tous");
  const [q, setQ] = useState("");
  const [retrait, setRetrait] = useState<Dossier | null>(null);
  const statuts: StatutDossier[] = ["en-etude", "a-corriger", "controle", "en-ligne", "louee", "refusee"];
  const liste = dossiers.filter((d) => (filtre === "tous" || d.statut === filtre) && (!q || contient(`${d.ref} ${d.type} ${d.quartier} ${d.proprietaire}`, q)));

  return (
    <PageBO
      titre="Annonces"
      intro="Toutes les annonces, de la soumission à la location."
      actions={
        <Exports
          onExcel={() =>
            exporterCSV(
              "annonces",
              ["Référence", "Type", "Quartier", "Loyer", "Propriétaire", "Statut", "Soumise le", "En ligne le"],
              liste.map((d) => [d.ref, d.type, d.quartier, d.loyer, d.proprietaire, libelleDossier(d.statut), dateFr(d.soumisLe), d.enLigneLe ? dateFr(d.enLigneLe) : ""]),
            )
          }
        />
      }
    >
      <div className="bo-outils">
        <ChampRecherche valeur={q} onChange={setQ} placeholder="Référence, quartier, propriétaire…" />
        <Filtres
          valeur={filtre}
          onChange={setFiltre}
          options={[["tous", "Toutes", dossiers.length] as [StatutDossier | "tous", string, number], ...statuts.map((s) => [s, libelleDossier(s), dossiers.filter((d) => d.statut === s).length] as [StatutDossier, string, number])]}
        />
      </div>
      <div className="tbo-cadre">
        <table className="tbo">
          <thead>
            <tr>
              <th>Annonce</th>
              <th>Loyer</th>
              <th>Propriétaire</th>
              <th>Statut</th>
              <th>Étude / contrôle</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {liste.map((d) => (
              <tr key={d.ref}>
                <td>
                  <Link to={`/agence/etude/${d.ref}`} className="mono">
                    {d.ref}
                  </Link>
                  <span className="tbo__sous">
                    {d.type} · {d.quartier}
                  </span>
                </td>
                <td className="mono">{fcfa(d.loyer)}</td>
                <td>{d.proprietaire}</td>
                <td>
                  <BadgeDossier statut={d.statut} />
                </td>
                <td>
                  <span className="tbo__sous">{d.etudiePar ?? "Non étudiée"}</span>
                  {d.agentTerrain && <span className="tbo__sous">Terrain : {d.agentTerrain}</span>}
                </td>
                <td>
                  {d.statut === "en-ligne" && (
                    <button type="button" className="btn btn--texte btn--petit" onClick={() => setRetrait(d)}>
                      Retirer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!liste.length && <p className="gris tbo__vide">Aucune annonce ne correspond.</p>}
      </div>
      {retrait && <RetirerAnnonce dossier={retrait} onFermer={() => setRetrait(null)} />}
    </PageBO>
  );
}

function RetirerAnnonce({ dossier, onFermer, motifInitial = "" }: { dossier: Dossier; onFermer: () => void; motifInitial?: string }) {
  const [motif, setMotif] = useState(motifInitial);
  return (
    <Feuille titre="Retirer l'annonce du site" soustitre={`${dossier.ref} · ${dossier.type} · ${dossier.quartier}`} onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (motif.trim().length < 5) return;
          majDossier(dossier.ref, (x) => ({ ...x, statut: "refusee", motif: `Retirée : ${motif.trim()}` }));
          repercuterChezProprietaire(dossier.ref, "refusee", { motif: `Retirée : ${motif.trim()}` });
          journaliser("Annonce retirée du site", `${dossier.ref} · ${motif.trim()}`);
          onFermer();
        }}
      >
        <div className="champ">
          <label htmlFor="ret-motif">Motif (communiqué au propriétaire)</label>
          <textarea id="ret-motif" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
        </div>
        <button type="submit" className="btn btn--danger btn--bloc" disabled={motif.trim().length < 5}>
          Retirer l'annonce
        </button>
      </form>
    </Feuille>
  );
}

/* ============ Contrôles terrain (BO-05) ============ */

export function Terrain() {
  const a = useAgence();
  const membre = useMembre();
  const [resultat, setResultat] = useState<Dossier | null>(null);
  const agents = a.equipe.filter((m) => m.role === "terrain" && m.actif).map((m) => m.nom);
  const estTerrain = membre?.role === "terrain";
  const missions = a.dossiers.filter((d) => d.statut === "controle" && (!estTerrain || d.agentTerrain === membre?.nom));
  const visitesAgent = estTerrain ? a.visites.filter((v) => v.statut === "prevue" && v.agent === membre?.nom) : [];

  return (
    <PageBO
      titre={estTerrain ? "Mes missions" : "Contrôles terrain"}
      intro={estTerrain ? "Contrôles sur place et visites qui vous sont attribués." : "Attribuez les contrôles sur place et saisissez leur résultat."}
    >
      {!estTerrain && (
        <div className="kpis kpis--3">
          <Kpi libelle="Contrôles à faire" valeur={missions.length} />
          <Kpi libelle="Sans agent" valeur={missions.filter((d) => !d.agentTerrain).length} alerte={missions.some((d) => !d.agentTerrain)} />
          <Kpi libelle="Agents terrain actifs" valeur={agents.length} />
        </div>
      )}
      {missions.length ? (
        <div className="tbo-cadre">
          <table className="tbo">
            <thead>
              <tr>
                <th>Annonce</th>
                <th>Repères</th>
                <th>Agent</th>
                <th>Date prévue</th>
                <th>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {missions.map((d) => (
                <tr key={d.ref}>
                  <td>
                    <span className="mono">{d.ref}</span>
                    <span className="tbo__sous">
                      {d.type} · {d.quartier}
                    </span>
                  </td>
                  <td>
                    {d.reperes || "—"}
                    <span className="tbo__sous mono">{telLisible(d.telProprietaire)}</span>
                  </td>
                  <td>
                    {estTerrain ? (
                      d.agentTerrain
                    ) : (
                      <select
                        className="bo-select"
                        aria-label={`Agent pour ${d.ref}`}
                        value={d.agentTerrain ?? ""}
                        onChange={(e) => {
                          const agent = e.target.value || undefined;
                          majDossier(d.ref, (x) => ({ ...x, agentTerrain: agent, controleLe: x.controleLe ?? new Date(Date.now() + 86400000).toISOString() }));
                          journaliser("Contrôle terrain attribué", `${d.ref} → ${agent ?? "personne"}`);
                        }}
                      >
                        <option value="">À attribuer</option>
                        {agents.map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td>
                    <input
                      type="date"
                      className="bo-select"
                      aria-label={`Date du contrôle ${d.ref}`}
                      value={d.controleLe?.slice(0, 10) ?? ""}
                      onChange={(e) => majDossier(d.ref, (x) => ({ ...x, controleLe: new Date(`${e.target.value}T10:00`).toISOString() }))}
                    />
                  </td>
                  <td>
                    <button type="button" className="btn btn--secondaire btn--petit" disabled={!d.agentTerrain} onClick={() => setResultat(d)}>
                      Saisir le résultat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Vide titre="Aucun contrôle en attente" texte="Les annonces validées par l'étude apparaissent ici." />
      )}

      {estTerrain && (
        <section className="carte bo-bloc" style={{ marginTop: "var(--s5)" }}>
          <h2 className="h3">Visites à accompagner</h2>
          {visitesAgent.length ? (
            <ul className="bo-liste">
              {visitesAgent.map((v) => (
                <li key={v.id}>
                  <span>
                    <strong>{v.locataire}</strong>
                    <span className="petit gris mono">{v.ref}</span>
                  </span>
                  <span className="mono petit">{dateFr(v.date)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="gris">Aucune visite prévue.</p>
          )}
        </section>
      )}
      {resultat && <ResultatControle dossier={resultat} onFermer={() => setResultat(null)} />}
    </PageBO>
  );
}

// Formulaire de contrôle (AGT-02), en version web pour l'agence
function ResultatControle({ dossier, onFermer }: { dossier: Dossier; onFermer: () => void }) {
  const points = ["Photos conformes au logement", "Position GPS relevée", "Compteur d'eau présent", "Compteur d'électricité présent", "État général correct"];
  const [ok, setOk] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState("");
  const conforme = points.every((p) => ok[p]);
  return (
    <Feuille titre="Résultat du contrôle sur place" soustitre={`${dossier.ref} · ${dossier.type} · ${dossier.quartier}`} onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (!conforme && note.trim().length < 5) return;
          if (conforme) {
            const maintenant = new Date().toISOString();
            majDossier(dossier.ref, (x) => ({ ...x, statut: "en-ligne", enLigneLe: maintenant, controle: { fait: true, conforme: true, note } }));
            repercuterChezProprietaire(dossier.ref, "en-ligne");
            journaliser("Contrôle conforme, annonce publiée", `${dossier.ref} · badge « Vérifié sur place »`);
          } else {
            const pauseLe = new Date().toISOString();
            majDossier(dossier.ref, (x) => ({ ...x, statut: "a-corriger", pauseLe, motif: `Contrôle sur place : ${note.trim()}`, controle: { fait: true, conforme: false, note } }));
            repercuterChezProprietaire(dossier.ref, "a-corriger", { motif: `Contrôle sur place : ${note.trim()}`, pauseLe });
            journaliser("Contrôle non conforme, correction demandée", `${dossier.ref} · ${note.trim()}`);
          }
          onFermer();
        }}
      >
        <div className="dossier__photos dossier__photos--petit">
          {["Façade (contrôle)", "Pièce principale (contrôle)", "Compteurs"].map((l, i) => (
            <Photo key={l} libelle={l} graine={i + 2} />
          ))}
        </div>
        <span className="petit gris">Photos de contrôle horodatées et géolocalisées, envoyées depuis l'application agent.</span>
        <div className="choix">
          {points.map((p) => (
            <label key={p} className="choix__option">
              <input type="checkbox" checked={!!ok[p]} onChange={(e) => setOk({ ...ok, [p]: e.target.checked })} />
              <span>{p}</span>
            </label>
          ))}
        </div>
        <div className="champ">
          <label htmlFor="ctl-note">{conforme ? "Remarque (facultatif)" : "Ce qui ne va pas (obligatoire)"}</label>
          <textarea id="ctl-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <button type="submit" className="btn btn--principal btn--bloc" disabled={!conforme && note.trim().length < 5}>
          {conforme ? "Publier avec le badge « Vérifié sur place »" : "Demander une correction"}
        </button>
      </form>
    </Feuille>
  );
}

/* ============ Utilisateurs (BO-06) ============ */

const IDENTITE: Record<Utilisateur["identite"], [string, "succes" | "neutre" | "action" | "erreur"]> = {
  verifiee: ["Identité vérifiée", "succes"],
  "en-attente": ["À vérifier", "action"],
  refusee: ["Identité refusée", "erreur"],
  "non-demandee": ["Non demandée", "neutre"],
};

export function Utilisateurs() {
  const { utilisateurs } = useAgence();
  const [filtre, setFiltre] = useState<"tous" | "locataire" | "proprietaire" | "a-verifier" | "suspendus">("tous");
  const [q, setQ] = useState("");
  const [identite, setIdentite] = useState<Utilisateur | null>(null);
  const [suspension, setSuspension] = useState<Utilisateur | null>(null);
  const liste = utilisateurs.filter(
    (u) =>
      (filtre === "tous" ||
        (filtre === "locataire" && u.role === "locataire") ||
        (filtre === "proprietaire" && u.role === "proprietaire") ||
        (filtre === "a-verifier" && u.identite === "en-attente") ||
        (filtre === "suspendus" && u.statut === "suspendu")) &&
      (!q || contient(`${u.nom} ${u.tel}`, q)),
  );
  const maj = (id: string, f: (u: Utilisateur) => Utilisateur) => majAgence((a) => ({ ...a, utilisateurs: a.utilisateurs.map((u) => (u.id === id ? f(u) : u)) }));

  return (
    <PageBO
      titre="Utilisateurs"
      intro="Locataires et propriétaires inscrits, vérification d'identité et suspension."
      actions={
        <Exports
          onExcel={() =>
            exporterCSV(
              "utilisateurs",
              ["Nom", "Téléphone", "Rôle", "Inscrit le", "Identité", "Statut"],
              liste.map((u) => [u.nom, telLisible(u.tel), u.role === "locataire" ? "Locataire" : "Propriétaire", dateFr(u.inscritLe, false), IDENTITE[u.identite][0], u.statut]),
            )
          }
        />
      }
    >
      <div className="bo-outils">
        <ChampRecherche valeur={q} onChange={setQ} placeholder="Nom ou numéro…" />
        <Filtres
          valeur={filtre}
          onChange={setFiltre}
          options={[
            ["tous", "Tous", utilisateurs.length],
            ["locataire", "Locataires", utilisateurs.filter((u) => u.role === "locataire").length],
            ["proprietaire", "Propriétaires", utilisateurs.filter((u) => u.role === "proprietaire").length],
            ["a-verifier", "Identité à vérifier", utilisateurs.filter((u) => u.identite === "en-attente").length],
            ["suspendus", "Suspendus", utilisateurs.filter((u) => u.statut === "suspendu").length],
          ]}
        />
      </div>
      <div className="tbo-cadre">
        <table className="tbo">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Rôle</th>
              <th>Inscrit le</th>
              <th>Identité</th>
              <th>Compte</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {liste.map((u) => (
              <tr key={u.id}>
                <td>
                  {u.nom}
                  <span className="tbo__sous mono">{telLisible(u.tel)}</span>
                </td>
                <td>{u.role === "locataire" ? "Locataire" : "Propriétaire"}</td>
                <td className="mono">{dateFr(u.inscritLe, false)}</td>
                <td>
                  <Badge famille={IDENTITE[u.identite][1]}>{IDENTITE[u.identite][0]}</Badge>
                </td>
                <td>
                  {u.statut === "actif" ? <Badge famille="succes">Actif</Badge> : <Badge famille="erreur">Suspendu</Badge>}
                  {u.motifSuspension && <span className="tbo__sous">{u.motifSuspension}</span>}
                </td>
                <td className="tbo__actions">
                  {u.identite === "en-attente" && (
                    <button type="button" className="btn btn--secondaire btn--petit" onClick={() => setIdentite(u)}>
                      Vérifier
                    </button>
                  )}
                  {u.statut === "actif" ? (
                    <button type="button" className="btn btn--texte btn--petit" onClick={() => setSuspension(u)}>
                      Suspendre
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--texte btn--petit"
                      onClick={() => {
                        maj(u.id, (x) => ({ ...x, statut: "actif", motifSuspension: undefined }));
                        journaliser("Compte réactivé", u.nom);
                      }}
                    >
                      Réactiver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!liste.length && <p className="gris tbo__vide">Aucun utilisateur ne correspond.</p>}
      </div>

      {identite && (
        <Feuille titre="Vérifier l'identité" soustitre={`${identite.nom} · ${telLisible(identite.tel)}`} onFermer={() => setIdentite(null)}>
          <div className="formulaire">
            <div className="dossier__photos dossier__photos--petit">
              <Photo libelle="Pièce d'identité (recto)" graine={1} />
              <Photo libelle="Pièce d'identité (verso)" graine={3} />
              <Photo libelle="Selfie" graine={4} />
            </div>
            <p className="petit gris" style={{ margin: 0 }}>
              Comparez le nom, la date de validité et le visage du selfie avec la photo de la pièce.
            </p>
            <button
              type="button"
              className="btn btn--principal btn--bloc"
              onClick={() => {
                maj(identite.id, (x) => ({ ...x, identite: "verifiee" }));
                journaliser("Identité vérifiée", identite.nom);
                setIdentite(null);
              }}
            >
              Identité conforme
            </button>
            <button
              type="button"
              className="btn btn--danger btn--bloc"
              onClick={() => {
                maj(identite.id, (x) => ({ ...x, identite: "refusee" }));
                journaliser("Identité refusée", identite.nom);
                setIdentite(null);
              }}
            >
              Refuser
            </button>
          </div>
        </Feuille>
      )}
      {suspension && (
        <Suspendre
          utilisateur={suspension}
          onFermer={() => setSuspension(null)}
          onValider={(motif) => {
            maj(suspension.id, (x) => ({ ...x, statut: "suspendu", motifSuspension: motif }));
            journaliser("Compte suspendu", `${suspension.nom} · ${motif}`);
            setSuspension(null);
          }}
        />
      )}
    </PageBO>
  );
}

function Suspendre({ utilisateur, onFermer, onValider }: { utilisateur: Utilisateur; onFermer: () => void; onValider: (m: string) => void }) {
  const [motif, setMotif] = useState("");
  return (
    <Feuille titre="Suspendre le compte" soustitre={utilisateur.nom} onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (motif.trim().length >= 5) onValider(motif.trim());
        }}
      >
        <div className="champ">
          <label htmlFor="sus-motif">Motif (obligatoire)</label>
          <textarea id="sus-motif" rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Ex. faux document, demande d'argent avant visite…" />
          <span className="aide">Le compte ne peut plus se connecter. Ses annonces sont masquées.</span>
        </div>
        <button type="submit" className="btn btn--danger btn--bloc" disabled={motif.trim().length < 5}>
          Suspendre
        </button>
      </form>
    </Feuille>
  );
}

/* ============ Visites et retours (BO-07) ============ */

const STATUT_VISITE: Record<VisiteAgence["statut"], [string, "info" | "succes" | "erreur" | "neutre"]> = {
  prevue: ["Prévue", "info"],
  faite: ["Faite", "succes"],
  absent: ["Locataire absent", "erreur"],
  annulee: ["Annulée", "neutre"],
};

export function Visites() {
  const { visites } = useAgence();
  const [filtre, setFiltre] = useState<VisiteAgence["statut"] | "toutes">("toutes");
  const [q, setQ] = useState("");
  const liste = visites
    .filter((v) => (filtre === "toutes" || v.statut === filtre) && (!q || contient(`${v.ref} ${v.locataire} ${v.agent}`, q)))
    .sort((x, y) => y.date.localeCompare(x.date));
  const avis = visites.filter((v) => v.avis);
  const satisfaits = avis.filter((v) => v.avis === "satisfait").length;
  const motifs = new Map<string, number>();
  avis.filter((v) => v.motif).forEach((v) => motifs.set(v.motif!, (motifs.get(v.motif!) ?? 0) + 1));
  const majVisite = (id: string, statut: VisiteAgence["statut"]) => {
    majAgence((a) => ({ ...a, visites: a.visites.map((v) => (v.id === id ? { ...v, statut, presence: statut === "faite" ? "GPS" : v.presence } : v)) }));
    journaliser(statut === "faite" ? "Visite marquée faite" : "Absence du locataire", id);
  };

  return (
    <PageBO
      titre="Visites et retours"
      intro="Suivi des visites accompagnées et de la satisfaction des locataires."
      actions={
        <Exports
          onExcel={() =>
            exporterCSV(
              "visites",
              ["Date", "Annonce", "Locataire", "Agent", "Statut", "Présence", "Avis", "Motif"],
              liste.map((v) => [dateFr(v.date), v.ref, v.locataire, v.agent, STATUT_VISITE[v.statut][0], v.presence ?? "", v.avis === "satisfait" ? "Satisfait" : v.avis ? "Pas satisfait" : "", v.motif ?? ""]),
            )
          }
        />
      }
    >
      <div className="kpis">
        <Kpi libelle="Visites prévues" valeur={visites.filter((v) => v.statut === "prevue").length} />
        <Kpi libelle="Visites faites" valeur={visites.filter((v) => v.statut === "faite").length} />
        <Kpi libelle="Satisfaction" valeur={`${avis.length ? Math.round((satisfaits / avis.length) * 100) : 0} %`} detail={`${satisfaits} satisfait(s) sur ${avis.length} avis`} />
        <Kpi libelle="Absences" valeur={visites.filter((v) => v.statut === "absent").length} alerte={visites.some((v) => v.statut === "absent")} />
      </div>
      <div className="bo-grille bo-grille--large">
        <div>
          <div className="bo-outils">
            <ChampRecherche valeur={q} onChange={setQ} placeholder="Annonce, locataire, agent…" />
            <Filtres
              valeur={filtre}
              onChange={setFiltre}
              options={[
                ["toutes", "Toutes"],
                ["prevue", "Prévues"],
                ["faite", "Faites"],
                ["absent", "Absents"],
                ["annulee", "Annulées"],
              ]}
            />
          </div>
          <div className="tbo-cadre">
            <table className="tbo">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Annonce</th>
                  <th>Locataire</th>
                  <th>Agent</th>
                  <th>Statut</th>
                  <th>Avis</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((v) => (
                  <tr key={v.id}>
                    <td className="mono">{dateFr(v.date)}</td>
                    <td className="mono">{v.ref}</td>
                    <td>{v.locataire}</td>
                    <td>{v.agent}</td>
                    <td>
                      <Badge famille={STATUT_VISITE[v.statut][1]}>{STATUT_VISITE[v.statut][0]}</Badge>
                      {v.presence && <span className="tbo__sous">Présence : {v.presence}</span>}
                      {v.statut === "prevue" && new Date(v.date).getTime() < Date.now() + 3 * 3600 * 1000 && (
                        <span className="tbo__actions">
                          <button type="button" className="btn btn--texte btn--petit" onClick={() => majVisite(v.id, "faite")}>
                            Faite
                          </button>
                          <button type="button" className="btn btn--texte btn--petit" onClick={() => majVisite(v.id, "absent")}>
                            Absent
                          </button>
                        </span>
                      )}
                    </td>
                    <td>
                      {v.avis === "satisfait" && <Badge famille="succes">Satisfait</Badge>}
                      {v.avis === "pas-satisfait" && (
                        <>
                          <Badge famille="neutre">Pas satisfait</Badge>
                          <span className="tbo__sous">{v.motif}</span>
                        </>
                      )}
                      {!v.avis && v.statut === "faite" && <span className="tbo__sous">En attente</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <section className="carte bo-bloc">
          <h2 className="h3">Motifs « Pas satisfait »</h2>
          {motifs.size ? <Barres donnees={[...motifs.entries()].sort((x, y) => y[1] - x[1])} /> : <p className="gris">Aucun.</p>}
          <p className="petit gris">Chaque « Pas satisfait » crédite une visite gratuite au locataire.</p>
        </section>
      </div>
    </PageBO>
  );
}

/* ============ Baux et commissions (BO-08, PAY-03) ============ */

const STATUT_BAIL: Record<Bail["statut"], [string, "neutre" | "action" | "succes"]> = {
  "a-signer": ["À signer", "neutre"],
  signe: ["Signé · paiement attendu", "action"],
  paye: ["Payé", "succes"],
};

export function Baux() {
  const { baux } = useAgence();
  const membre = useMembre();
  const [filtre, setFiltre] = useState<Bail["statut"] | "tous">("tous");
  const [especes, setEspeces] = useState<Bail | null>(null);
  const liste = baux.filter((b) => filtre === "tous" || b.statut === filtre);
  const payes = baux.filter((b) => b.statut === "paye");
  const parMoyen = new Map<string, number>();
  payes.forEach((b) => parMoyen.set(b.paiement!.moyen, (parMoyen.get(b.paiement!.moyen) ?? 0) + b.commission));

  return (
    <PageBO
      titre="Baux et commissions"
      intro="Suivi des baux signés et des commissions encaissées."
      actions={
        <Exports
          onExcel={() =>
            exporterCSV(
              "commissions",
              ["Annonce", "Locataire", "Propriétaire", "Loyer", "Commission", "Statut", "Moyen", "Date de paiement", "Reçu", "Transaction"],
              liste.map((b) => [b.ref, b.locataire, b.proprietaire, b.loyer, b.commission, STATUT_BAIL[b.statut][0], b.paiement?.moyen ?? "", b.paiement ? dateFr(b.paiement.date) : "", b.paiement?.recu ?? "", b.paiement?.transaction ?? ""]),
            )
          }
        />
      }
    >
      <div className="kpis">
        <Kpi libelle="Commissions encaissées" valeur={fcfa(payes.reduce((n, b) => n + b.commission, 0))} detail={`${payes.length} paiement(s)`} />
        <Kpi libelle="En attente de paiement" valeur={fcfa(baux.filter((b) => b.statut === "signe").reduce((n, b) => n + b.commission, 0))} alerte={baux.some((b) => b.statut === "signe")} />
        <Kpi libelle="Baux à signer" valeur={baux.filter((b) => b.statut === "a-signer").length} />
        <Kpi libelle="Payé en espèces" valeur={payes.filter((b) => b.paiement!.moyen === "Espèces").length} detail="saisis manuellement" />
      </div>
      <div className="bo-grille bo-grille--large">
        <div>
          <Filtres
            valeur={filtre}
            onChange={setFiltre}
            options={[
              ["tous", "Tous", baux.length],
              ["a-signer", "À signer", baux.filter((b) => b.statut === "a-signer").length],
              ["signe", "Paiement attendu", baux.filter((b) => b.statut === "signe").length],
              ["paye", "Payés", payes.length],
            ]}
          />
          <div className="tbo-cadre">
            <table className="tbo">
              <thead>
                <tr>
                  <th>Annonce</th>
                  <th>Locataire</th>
                  <th>Commission</th>
                  <th>Statut</th>
                  <th>Paiement</th>
                </tr>
              </thead>
              <tbody>
                {liste.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span className="mono">{b.ref}</span>
                      <span className="tbo__sous">{b.proprietaire ? `Propriétaire : ${b.proprietaire}` : ""}</span>
                    </td>
                    <td>{b.locataire}</td>
                    <td className="mono">
                      {fcfa(b.commission)}
                      <span className="tbo__sous">loyer {fcfa(b.loyer)}</span>
                    </td>
                    <td>
                      <Badge famille={STATUT_BAIL[b.statut][1]}>{STATUT_BAIL[b.statut][0]}</Badge>
                    </td>
                    <td>
                      {b.paiement ? (
                        <>
                          {b.paiement.moyen} · <span className="mono">{dateFr(b.paiement.date)}</span>
                          <span className="tbo__sous mono">
                            {b.paiement.recu} · {b.paiement.transaction}
                          </span>
                          {b.paiement.saisiPar && <span className="tbo__sous">Saisi par {b.paiement.saisiPar}</span>}
                        </>
                      ) : b.statut === "signe" ? (
                        <button type="button" className="btn btn--secondaire btn--petit" onClick={() => setEspeces(b)}>
                          Enregistrer un paiement en espèces
                        </button>
                      ) : (
                        <span className="tbo__sous">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <section className="carte bo-bloc">
          <h2 className="h3">Par moyen de paiement</h2>
          <Barres donnees={[...parMoyen.entries()].sort((x, y) => y[1] - x[1])} format={fcfa} />
        </section>
      </div>
      {especes && (
        <Feuille titre="Paiement en espèces" soustitre={`${especes.ref} · ${especes.locataire}`} onFermer={() => setEspeces(null)}>
          <div className="formulaire">
            <div className="recap">
              <span className="petit gris">Montant reçu</span>
              <strong className="mono">{fcfa(especes.commission)}</strong>
            </div>
            <p className="petit gris" style={{ margin: 0 }}>
              Un reçu numérique est envoyé au locataire par SMS. Cette saisie est enregistrée à votre nom dans le journal d'audit.
            </p>
            <button
              type="button"
              className="btn btn--principal btn--bloc"
              onClick={() => {
                const recu = `XT-R-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
                majAgence((a) => ({
                  ...a,
                  baux: a.baux.map((x) =>
                    x.id === especes.id ? { ...x, statut: "paye", paiement: { moyen: "Espèces", date: new Date().toISOString(), recu, transaction: `ESP-${Math.floor(1000 + Math.random() * 9000)}`, saisiPar: membre?.nom } } : x,
                  ),
                }));
                journaliser("Paiement en espèces enregistré", `${especes.ref} · ${fcfa(especes.commission)} · reçu ${recu}`);
                setEspeces(null);
              }}
            >
              Confirmer et émettre le reçu
            </button>
          </div>
        </Feuille>
      )}
    </PageBO>
  );
}

export { RetirerAnnonce };
