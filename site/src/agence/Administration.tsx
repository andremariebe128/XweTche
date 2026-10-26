import { Check, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Feuille } from "../components/Feuille";
import { Badge } from "../components/Statut";
import { Vide } from "../components/Vide";
import {
  dateFr,
  exporterCSV,
  journaliser,
  majAgence,
  PERMISSIONS,
  reinitialiserAgence,
  ROLES_AGENCE,
  useAgence,
  useMembre,
  type Module,
  type RoleAgence,
  type SignalementAgence,
} from "../lib/agence";
import { majContenus, reinitialiserContenus, useContenus } from "../lib/contenus";
import { telLisible } from "../lib/compte";
import { majParametres, PARAMETRES_DEFAUT, useParametres, type Parametres } from "../lib/parametres";
import { RetirerAnnonce } from "./Operations";
import { ChampRecherche, Exports, Filtres, PageBO } from "./ui";

/* ============ Signalements et litiges (BO-10) ============ */

const STATUT_SIG: Record<SignalementAgence["statut"], [string, "action" | "info" | "succes" | "neutre"]> = {
  nouveau: ["Nouveau", "action"],
  "en-cours": ["En cours", "info"],
  resolu: ["Résolu", "succes"],
  rejete: ["Classé sans suite", "neutre"],
};

export function Signalements() {
  const a = useAgence();
  const membre = useMembre();
  const [filtre, setFiltre] = useState<"ouverts" | SignalementAgence["statut"] | "tous">("ouverts");
  const [cloture, setCloture] = useState<{ s: SignalementAgence; issue: "resolu" | "rejete" } | null>(null);
  const [retrait, setRetrait] = useState<SignalementAgence | null>(null);
  const liste = a.signalements.filter((s) => filtre === "tous" || (filtre === "ouverts" ? s.statut === "nouveau" || s.statut === "en-cours" : s.statut === filtre));
  const dossierRetrait = retrait && a.dossiers.find((d) => d.ref === retrait.ref);
  const maj = (id: string, f: (s: SignalementAgence) => SignalementAgence) => majAgence((x) => ({ ...x, signalements: x.signalements.map((s) => (s.id === id ? f(s) : s)) }));

  return (
    <PageBO titre="Signalements et litiges" intro="Signalements envoyés depuis le site : fausses annonces, arnaques, usurpation de la marque.">
      <Filtres
        valeur={filtre}
        onChange={setFiltre}
        options={[
          ["ouverts", "Ouverts", a.signalements.filter((s) => s.statut === "nouveau" || s.statut === "en-cours").length],
          ["nouveau", "Nouveaux", a.signalements.filter((s) => s.statut === "nouveau").length],
          ["resolu", "Résolus"],
          ["rejete", "Classés"],
          ["tous", "Tous"],
        ]}
      />
      {liste.length ? (
        <div className="signalements">
          {liste.map((s) => {
            const urgent = /argent|Mobile Money/i.test(s.motif);
            return (
              <article key={s.id} className={`carte signalement${urgent && s.statut === "nouveau" ? " signalement--urgent" : ""}`}>
                <div className="signalement__tete">
                  <span className="mono">{s.numero}</span>
                  <Badge famille={STATUT_SIG[s.statut][1]}>{STATUT_SIG[s.statut][0]}</Badge>
                  {urgent && <Badge famille="erreur">Arnaque possible</Badge>}
                  <span className="petit gris mono signalement__date">{dateFr(s.date)}</span>
                </div>
                <h2 className="h3">{s.motif}</h2>
                <p>{s.detail}</p>
                <p className="petit gris">
                  {s.ref && (
                    <>
                      Annonce <Link to={`/agence/etude/${s.ref}`} className="mono">{s.ref}</Link> ·{" "}
                    </>
                  )}
                  {s.tel ? `Contact : ${telLisible(s.tel)}` : "Anonyme"}
                  {s.assigne && ` · Suivi par ${s.assigne}`}
                </p>
                {s.decision && (
                  <div className="bandeau bandeau--succes">
                    <Check aria-hidden="true" /> {s.decision}
                  </div>
                )}
                {(s.statut === "nouveau" || s.statut === "en-cours") && (
                  <div className="signalement__actions">
                    {s.statut === "nouveau" && (
                      <button
                        type="button"
                        className="btn btn--principal btn--petit"
                        onClick={() => {
                          maj(s.id, (x) => ({ ...x, statut: "en-cours", assigne: membre?.nom }));
                          journaliser("Signalement pris en charge", s.numero);
                        }}
                      >
                        Prendre en charge
                      </button>
                    )}
                    {s.ref && a.dossiers.some((d) => d.ref === s.ref && d.statut === "en-ligne") && (
                      <button type="button" className="btn btn--danger btn--petit" onClick={() => setRetrait(s)}>
                        Retirer l'annonce
                      </button>
                    )}
                    <button type="button" className="btn btn--secondaire btn--petit" onClick={() => setCloture({ s, issue: "resolu" })}>
                      Résoudre
                    </button>
                    <button type="button" className="btn btn--texte btn--petit" onClick={() => setCloture({ s, issue: "rejete" })}>
                      Classer sans suite
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <Vide titre="Aucun signalement" texte="Rien à traiter dans cette catégorie." />
      )}
      {cloture && (
        <Cloturer
          signalement={cloture.s}
          issue={cloture.issue}
          onFermer={() => setCloture(null)}
          onValider={(decision) => {
            maj(cloture.s.id, (x) => ({ ...x, statut: cloture.issue, decision, assigne: x.assigne ?? membre?.nom }));
            journaliser(cloture.issue === "resolu" ? "Signalement résolu" : "Signalement classé sans suite", `${cloture.s.numero} · ${decision}`);
            setCloture(null);
          }}
        />
      )}
      {retrait && dossierRetrait && <RetirerAnnonce dossier={dossierRetrait} motifInitial={`Signalement ${retrait.numero} : ${retrait.motif}`} onFermer={() => setRetrait(null)} />}
    </PageBO>
  );
}

function Cloturer({ signalement, issue, onFermer, onValider }: { signalement: SignalementAgence; issue: "resolu" | "rejete"; onFermer: () => void; onValider: (d: string) => void }) {
  const [decision, setDecision] = useState("");
  return (
    <Feuille titre={issue === "resolu" ? "Résoudre le signalement" : "Classer sans suite"} soustitre={`${signalement.numero} · ${signalement.motif}`} onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (decision.trim().length >= 5) onValider(decision.trim());
        }}
      >
        <div className="champ">
          <label htmlFor="sig-decision">Décision et suite donnée</label>
          <textarea id="sig-decision" rows={4} value={decision} onChange={(e) => setDecision(e.target.value)} placeholder="Ex. annonce retirée, propriétaire suspendu, locataire rappelé…" />
        </div>
        <button type="submit" className="btn btn--principal btn--bloc" disabled={decision.trim().length < 5}>
          Enregistrer la décision
        </button>
      </form>
    </Feuille>
  );
}

/* ============ Paramètres (BO-09) ============ */

export function ParametresPage() {
  const p = useParametres();
  const [brouillon, setBrouillon] = useState<Parametres>(p);
  const [enregistre, setEnregistre] = useState(false);
  const modifie = JSON.stringify(brouillon) !== JSON.stringify(p);
  const maj = (x: Partial<Parametres>) => {
    setBrouillon((b) => ({ ...b, ...x }));
    setEnregistre(false);
  };
  const nombre = (cle: keyof Parametres, libelle: string, aide: string, min: number, max: number, unite: string) => (
    <div className="champ">
      <label htmlFor={`par-${cle}`}>{libelle}</label>
      <div className="champ-unite">
        <input id={`par-${cle}`} type="number" min={min} max={max} className="mono" value={brouillon[cle] as number} onChange={(e) => maj({ [cle]: Math.max(min, Math.min(max, Number(e.target.value) || min)) })} />
        <span>{unite}</span>
      </div>
      <span className="aide">{aide}</span>
    </div>
  );

  return (
    <PageBO
      titre="Paramètres"
      intro="Règles appliquées sur tout le site, modifiables sans développement."
      actions={
        <button type="button" className="btn btn--texte" onClick={() => maj(PARAMETRES_DEFAUT)}>
          <RotateCcw size={16} aria-hidden="true" /> Valeurs par défaut
        </button>
      }
    >
      <form
        className="bo-formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          const changes = (Object.keys(brouillon) as (keyof Parametres)[]).filter((k) => JSON.stringify(brouillon[k]) !== JSON.stringify(p[k]));
          majParametres(() => brouillon);
          journaliser("Paramètres modifiés", changes.join(", "));
          setEnregistre(true);
        }}
      >
        <section className="carte bo-bloc">
          <h2 className="h3">Tarifs et visites</h2>
          <div className="bo-champs">
            <div className="champ">
              <label htmlFor="par-commission">Commission (part d'un mois de loyer)</label>
              <div className="champ-unite">
                <input
                  id="par-commission"
                  type="number"
                  min={10}
                  max={200}
                  step={5}
                  className="mono"
                  value={Math.round(brouillon.commission * 100)}
                  onChange={(e) => maj({ commission: Math.max(10, Math.min(200, Number(e.target.value) || 50)) / 100 })}
                />
                <span>%</span>
              </div>
              <span className="aide">50 % = ½ mois de loyer. Appliqué au coût total des annonces et au paiement.</span>
            </div>
            {nombre("plafondVisites", "Plafond de visites gratuites", "Visites gratuites cumulables par un locataire.", 0, 20, "visites")}
            {nombre("annulationVisite", "Annulation sans pénalité", "Délai minimum avant la visite.", 1, 72, "h")}
          </div>
        </section>
        <section className="carte bo-bloc">
          <h2 className="h3">Délais d'étude</h2>
          <div className="bo-champs">
            {nombre("delaiEtude", "Délai d'étude d'une annonce", "Compte à rebours affiché au propriétaire.", 12, 168, "h")}
            {nombre("alerteEtude", "Alerte avant échéance", "Les dossiers passent en urgent sous ce seuil.", 1, 48, "h")}
          </div>
        </section>
        <section className="carte bo-bloc">
          <h2 className="h3">Listes</h2>
          <div className="bo-listes">
            <ListeEditable titre="Motifs de refus" valeurs={brouillon.motifsRefus} onChange={(v) => maj({ motifsRefus: v })} />
            <ListeEditable titre="Motifs de correction" valeurs={brouillon.motifsCorrection} onChange={(v) => maj({ motifsCorrection: v })} />
            <ListeEditable titre="Motifs « Pas satisfait »" valeurs={brouillon.motifsVisite} onChange={(v) => maj({ motifsVisite: v })} />
            <ListeEditable titre="Quartiers couverts" valeurs={brouillon.quartiers} onChange={(v) => maj({ quartiers: v })} />
          </div>
        </section>
        <div className="bo-formulaire__pied">
          {enregistre && !modifie && (
            <span className="signal-texte">
              <Check size={18} aria-hidden="true" /> Enregistré et appliqué sur le site
            </span>
          )}
          <button type="submit" className="btn btn--principal" disabled={!modifie}>
            Enregistrer les paramètres
          </button>
        </div>
      </form>
    </PageBO>
  );
}

function ListeEditable({ titre, valeurs, onChange }: { titre: string; valeurs: string[]; onChange: (v: string[]) => void }) {
  const [nouveau, setNouveau] = useState("");
  const ajouter = () => {
    const v = nouveau.trim();
    if (v && !valeurs.includes(v)) onChange([...valeurs, v]);
    setNouveau("");
  };
  return (
    <fieldset className="liste-edit">
      <legend className="h3">{titre}</legend>
      <ul>
        {valeurs.map((v) => (
          <li key={v}>
            <span>{v}</span>
            <button type="button" className="btn-icone" aria-label={`Retirer ${v}`} onClick={() => onChange(valeurs.filter((x) => x !== v))}>
              <Trash2 size={16} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="liste-edit__ajout">
        <input
          value={nouveau}
          onChange={(e) => setNouveau(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          placeholder="Ajouter…"
          aria-label={`Ajouter à ${titre}`}
        />
        <button type="button" className="btn-icone" aria-label="Ajouter" onClick={ajouter}>
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </fieldset>
  );
}

/* ============ Modèles de messages (BO-13) ============ */

const EXEMPLE: Record<string, string> = {
  date: "mar. 28/10",
  heure: "10h00",
  code: "4821",
  adresse: "von après la pharmacie Les Cocotiers",
  prenom: "Awa",
  quartier: "Fidjrossè",
  agent: "Rachidatou",
  limite: "lun. 27/10 à 22h00",
  ref: "XT-0412",
  lien: "xwetche.bj/v/4821",
  motif: "2 photos floues",
  montant: "22 500 FCFA",
  moyen: "MTN MoMo",
  recu: "XT-R-2026-575471",
};

export function Messages() {
  const { modeles } = useAgence();
  const [choix, setChoix] = useState(modeles[0]?.id);
  const modele = modeles.find((m) => m.id === choix);
  const [texte, setTexte] = useState(modele?.texte ?? "");
  const apercu = texte.replace(/\{(\w+)\}/g, (_, k) => EXEMPLE[k] ?? `{${k}}`);
  const variables = [...new Set(texte.match(/\{\w+\}/g) ?? [])];
  const longueur = apercu.length;

  return (
    <PageBO titre="Modèles de messages" intro="SMS, WhatsApp et e-mails envoyés automatiquement. Les mots entre accolades sont remplacés à l'envoi.">
      <div className="messages">
        <nav className="messages__liste" aria-label="Modèles">
          {modeles.map((m) => (
            <button
              key={m.id}
              type="button"
              className="messages__item"
              aria-pressed={choix === m.id}
              onClick={() => {
                setChoix(m.id);
                setTexte(m.texte);
              }}
            >
              <strong>{m.nom}</strong>
              <span className="petit gris">{m.canal}</span>
            </button>
          ))}
        </nav>
        {modele && (
          <form
            className="carte bo-bloc formulaire"
            onSubmit={(e) => {
              e.preventDefault();
              majAgence((a) => ({ ...a, modeles: a.modeles.map((m) => (m.id === modele.id ? { ...m, texte } : m)) }));
              journaliser("Modèle de message modifié", modele.nom);
            }}
          >
            <h2 className="h3">
              {modele.nom} <span className="petit gris">· {modele.canal}</span>
            </h2>
            <div className="champ">
              <label htmlFor="msg-texte">Texte</label>
              <textarea id="msg-texte" rows={5} value={texte} onChange={(e) => setTexte(e.target.value)} />
              <span className="aide">
                {modele.canal === "SMS" ? `${longueur} caractères · ${Math.ceil(longueur / 160)} SMS` : `${longueur} caractères`}
                {variables.length > 0 && ` · variables : ${variables.join(" ")}`}
              </span>
            </div>
            <div className="message-apercu">
              <span className="petit gris">Aperçu avec des valeurs d'exemple</span>
              <p>{apercu}</p>
            </div>
            <button type="submit" className="btn btn--principal" disabled={texte === modele.texte || !texte.trim()}>
              Enregistrer le modèle
            </button>
          </form>
        )}
      </div>
    </PageBO>
  );
}

/* ============ Contenus du site (BO-14, WEB-07) ============ */

export function Contenus() {
  const { banniere, faq } = useContenus();
  const [theme, setTheme] = useState(faq[0]?.id ?? "");
  const courant = faq.find((t) => t.id === theme);
  const majTheme = (f: (qs: { q: string; r: string }[]) => { q: string; r: string }[]) =>
    majContenus((c) => ({ ...c, faq: c.faq.map((t) => (t.id === theme ? { ...t, questions: f(t.questions) } : t)) }));

  return (
    <PageBO
      titre="Contenus du site"
      intro="Les modifications s'appliquent immédiatement sur le site public."
      actions={
        <>
          <Link to="/aide" target="_blank" className="btn btn--secondaire">
            Voir la page Aide
          </Link>
          <button
            type="button"
            className="btn btn--texte"
            onClick={() => {
              reinitialiserContenus();
              journaliser("Contenus remis par défaut", "FAQ et bannière");
            }}
          >
            <RotateCcw size={16} aria-hidden="true" /> Par défaut
          </button>
        </>
      }
    >
      <section className="carte bo-bloc formulaire">
        <h2 className="h3">Bannière d'information</h2>
        <label className="choix__option">
          <input
            type="checkbox"
            checked={banniere.actif}
            onChange={(e) => {
              majContenus((c) => ({ ...c, banniere: { ...c.banniere, actif: e.target.checked } }));
              journaliser(e.target.checked ? "Bannière publiée" : "Bannière retirée", banniere.texte);
            }}
          />
          <span>Afficher la bannière en haut du site</span>
        </label>
        <div className="champ">
          <label htmlFor="ban-texte">Texte</label>
          <input id="ban-texte" maxLength={140} value={banniere.texte} onChange={(e) => majContenus((c) => ({ ...c, banniere: { ...c.banniere, texte: e.target.value } }))} />
          <span className="aide">{banniere.texte.length} / 140 caractères. Pas de couleur vive : la bannière reste sobre (fond lagune clair).</span>
        </div>
      </section>

      <section className="carte bo-bloc">
        <h2 className="h3">Questions fréquentes</h2>
        <Filtres valeur={theme} onChange={setTheme} options={faq.map((t) => [t.id, t.titre, t.questions.length] as [string, string, number])} />
        {courant && (
          <div className="faq-edit">
            {courant.questions.map((q, i) => (
              <div key={i} className="faq-edit__item">
                <div className="champ">
                  <label htmlFor={`faq-q-${i}`}>Question {i + 1}</label>
                  <input id={`faq-q-${i}`} value={q.q} onChange={(e) => majTheme((qs) => qs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
                </div>
                <div className="champ">
                  <label htmlFor={`faq-r-${i}`}>Réponse</label>
                  <textarea id={`faq-r-${i}`} rows={3} value={q.r} onChange={(e) => majTheme((qs) => qs.map((x, j) => (j === i ? { ...x, r: e.target.value } : x)))} />
                </div>
                <button
                  type="button"
                  className="btn btn--texte btn--petit"
                  onClick={() => {
                    majTheme((qs) => qs.filter((_, j) => j !== i));
                    journaliser("Question supprimée de la FAQ", q.q);
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" /> Supprimer
                </button>
              </div>
            ))}
            <button type="button" className="btn btn--secondaire" onClick={() => majTheme((qs) => [...qs, { q: "Nouvelle question", r: "Réponse à rédiger." }])}>
              <Plus size={18} aria-hidden="true" /> Ajouter une question
            </button>
          </div>
        )}
      </section>
    </PageBO>
  );
}

/* ============ Équipe et rôles (BO-12) ============ */

const MODULES: [Module, string][] = [
  ["tableau", "Tableau de bord"],
  ["etude", "File d'étude"],
  ["annonces", "Annonces"],
  ["terrain", "Contrôles terrain"],
  ["visites", "Visites"],
  ["baux", "Baux et commissions"],
  ["utilisateurs", "Utilisateurs"],
  ["signalements", "Signalements"],
  ["messages", "Messages"],
  ["contenus", "Contenus"],
  ["parametres", "Paramètres"],
  ["equipe", "Équipe"],
  ["journal", "Journal"],
];

export function Equipe() {
  const { equipe } = useAgence();
  const membre = useMembre();
  const [ajout, setAjout] = useState(false);
  const roles = Object.keys(ROLES_AGENCE) as RoleAgence[];
  const majMembre = (id: string, x: Partial<(typeof equipe)[number]>) => majAgence((a) => ({ ...a, equipe: a.equipe.map((m) => (m.id === id ? { ...m, ...x } : m)) }));

  return (
    <PageBO
      titre="Équipe et rôles"
      intro="Membres de l'agence et modules accessibles à chaque rôle."
      actions={
        <button type="button" className="btn btn--principal" onClick={() => setAjout(true)}>
          <Plus size={18} aria-hidden="true" /> Ajouter un membre
        </button>
      }
    >
      <div className="tbo-cadre">
        <table className="tbo">
          <thead>
            <tr>
              <th>Membre</th>
              <th>Rôle</th>
              <th>Accès</th>
            </tr>
          </thead>
          <tbody>
            {equipe.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.nom}
                  <span className="tbo__sous mono">{telLisible(m.tel)}</span>
                </td>
                <td>
                  <select
                    className="bo-select"
                    aria-label={`Rôle de ${m.nom}`}
                    value={m.role}
                    disabled={m.id === membre?.id}
                    onChange={(e) => {
                      majMembre(m.id, { role: e.target.value as RoleAgence });
                      journaliser("Rôle modifié", `${m.nom} → ${ROLES_AGENCE[e.target.value as RoleAgence]}`);
                    }}
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {ROLES_AGENCE[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  {m.id === membre?.id ? (
                    <Badge famille="info">Vous</Badge>
                  ) : (
                    <button
                      type="button"
                      className="btn btn--texte btn--petit"
                      onClick={() => {
                        majMembre(m.id, { actif: !m.actif });
                        journaliser(m.actif ? "Accès désactivé" : "Accès réactivé", m.nom);
                      }}
                    >
                      {m.actif ? "Désactiver" : "Réactiver"}
                    </button>
                  )}
                  {!m.actif && <Badge famille="neutre">Désactivé</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="carte bo-bloc" style={{ marginTop: "var(--s5)" }}>
        <h2 className="h3">Permissions par rôle</h2>
        <div className="tbo-cadre">
          <table className="tbo tbo--matrice">
            <thead>
              <tr>
                <th>Module</th>
                {roles.map((r) => (
                  <th key={r}>{ROLES_AGENCE[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULES.map(([mod, libelle]) => (
                <tr key={mod}>
                  <td>{libelle}</td>
                  {roles.map((r) => (
                    <td key={r}>
                      {PERMISSIONS[mod].includes(r) ? <Check size={18} aria-label="Oui" className="ok" /> : <span className="gris" aria-label="Non">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="carte bo-bloc" style={{ marginTop: "var(--s5)" }}>
        <h2 className="h3">Données de démonstration</h2>
        <p className="gris">Remet le back-office dans son état initial (dossiers, utilisateurs, visites, journal). Votre session est fermée.</p>
        <button type="button" className="btn btn--danger" onClick={() => window.confirm("Réinitialiser toutes les données du back-office ?") && reinitialiserAgence()}>
          Réinitialiser les données
        </button>
      </section>

      {ajout && <AjoutMembre onFermer={() => setAjout(false)} />}
    </PageBO>
  );
}

function AjoutMembre({ onFermer }: { onFermer: () => void }) {
  const [nom, setNom] = useState("");
  const [tel, setTel] = useState("");
  const [role, setRole] = useState<RoleAgence>("etude");
  const valide = nom.trim().length >= 3 && tel.replace(/\D/g, "").length >= 8;
  return (
    <Feuille titre="Ajouter un membre" onFermer={onFermer}>
      <form
        className="formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valide) return;
          majAgence((a) => ({ ...a, equipe: [...a.equipe, { id: `m${Date.now()}`, nom: nom.trim(), tel: tel.replace(/\D/g, ""), role, actif: true }] }));
          journaliser("Membre ajouté", `${nom.trim()} · ${ROLES_AGENCE[role]}`);
          onFermer();
        }}
      >
        <div className="champ">
          <label htmlFor="mb-nom">Nom et prénom</label>
          <input id="mb-nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="mb-tel">Numéro professionnel</label>
          <input id="mb-tel" type="tel" value={tel} onChange={(e) => setTel(e.target.value)} />
          <span className="aide">Sert à la connexion avec code.</span>
        </div>
        <div className="champ">
          <label htmlFor="mb-role">Rôle</label>
          <select id="mb-role" value={role} onChange={(e) => setRole(e.target.value as RoleAgence)}>
            {(Object.keys(ROLES_AGENCE) as RoleAgence[]).map((r) => (
              <option key={r} value={r}>
                {ROLES_AGENCE[r]}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn btn--principal btn--bloc" disabled={!valide}>
          Ajouter
        </button>
      </form>
    </Feuille>
  );
}

/* ============ Journal d'audit (BO-11) ============ */

export function Journal() {
  const { journal } = useAgence();
  const [q, setQ] = useState("");
  const liste = journal.filter((j) => !q || `${j.auteur} ${j.action} ${j.cible}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <PageBO
      titre="Journal d'audit"
      intro="Toutes les décisions, avec leur auteur et leur date. Ce journal ne peut pas être modifié."
      actions={<Exports onExcel={() => exporterCSV("journal", ["Date", "Auteur", "Rôle", "Action", "Objet"], liste.map((j) => [dateFr(j.date), j.auteur, j.role, j.action, j.cible]))} />}
    >
      <div className="bo-outils">
        <ChampRecherche valeur={q} onChange={setQ} placeholder="Auteur, action, référence…" />
      </div>
      <div className="tbo-cadre">
        <table className="tbo">
          <thead>
            <tr>
              <th>Date</th>
              <th>Auteur</th>
              <th>Action</th>
              <th>Objet</th>
            </tr>
          </thead>
          <tbody>
            {liste.map((j) => (
              <tr key={j.id}>
                <td className="mono">{dateFr(j.date)}</td>
                <td>
                  {j.auteur}
                  <span className="tbo__sous">{j.role}</span>
                </td>
                <td>{j.action}</td>
                <td>{j.cible}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!liste.length && <p className="gris tbo__vide">Aucune entrée.</p>}
      </div>
    </PageBO>
  );
}
