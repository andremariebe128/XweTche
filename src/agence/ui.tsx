import { FileSpreadsheet, Lock, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "../components/Statut";
import { heuresRestantesDossier, peut, useMembre, type Dossier, type Module, type StatutDossier } from "../lib/agence";
import { useParametres } from "../lib/parametres";
import { useTitre } from "../lib/titre";

export function PageBO({ titre, intro, actions, children }: { titre: string; intro?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  useTitre(`${titre} · Back-office`);
  return (
    <div className="bo-page">
      <header className="bo-page__tete">
        <div>
          <h1 className="h2">{titre}</h1>
          {intro && <p className="gris bo-page__intro">{intro}</p>}
        </div>
        {actions && <div className="bo-page__actions">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

// Garde d'accès : un module hors du rôle du membre n'est pas affiché (BO-12).
export function Acces({ module, children }: { module: Module; children: React.ReactNode }) {
  const membre = useMembre();
  if (peut(membre?.role, module)) return <>{children}</>;
  return (
    <div className="bo-page">
      <div className="vide">
        <Lock aria-hidden="true" />
        <h1 className="h3">Accès réservé</h1>
        <p className="gris">Ce module n'est pas ouvert à votre rôle. Demandez au responsable d'agence si vous en avez besoin.</p>
      </div>
    </div>
  );
}

export function Kpi({ libelle, valeur, detail, alerte }: { libelle: string; valeur: React.ReactNode; detail?: string; alerte?: boolean }) {
  return (
    <div className={`carte kpi${alerte ? " kpi--alerte" : ""}`}>
      <span className="kpi__libelle">{libelle}</span>
      <strong className="kpi__valeur">{valeur}</strong>
      {detail && <span className="kpi__detail">{detail}</span>}
    </div>
  );
}

// Barres horizontales : chaque valeur est écrite en clair à côté de la barre
export function Barres({ donnees, format = String }: { donnees: [string, number][]; format?: (n: number) => string }) {
  const max = Math.max(1, ...donnees.map(([, v]) => v));
  return (
    <ul className="barres">
      {donnees.map(([libelle, v]) => (
        <li key={libelle}>
          <span className="barres__libelle">{libelle}</span>
          <span className="barres__piste" aria-hidden="true">
            <span style={{ width: `${(v / max) * 100}%` }} />
          </span>
          <span className="barres__valeur mono">{format(v)}</span>
        </li>
      ))}
    </ul>
  );
}

export function ChampRecherche({ valeur, onChange, placeholder }: { valeur: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="bo-recherche">
      <Search aria-hidden="true" />
      <span className="sr-only">{placeholder}</span>
      <input type="search" value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Filtres<T extends string>({ options, valeur, onChange }: { options: [T, string, number?][]; valeur: T; onChange: (v: T) => void }) {
  return (
    <div className="pastilles bo-filtres" role="group" aria-label="Filtrer">
      {options.map(([v, libelle, n]) => (
        <button key={v} type="button" className="pastille" aria-pressed={valeur === v} onClick={() => onChange(v)}>
          {libelle}
          {n !== undefined && <span className="mono bo-filtres__n">{n}</span>}
        </button>
      ))}
    </div>
  );
}

// Exports (BO-10) : Excel via CSV, PDF via l'impression du navigateur
export function Exports({ onExcel }: { onExcel: () => void }) {
  return (
    <>
      <button type="button" className="btn btn--secondaire" onClick={onExcel}>
        <FileSpreadsheet size={18} aria-hidden="true" /> Excel
      </button>
      <button type="button" className="btn btn--texte" onClick={() => window.print()}>
        <Printer size={18} aria-hidden="true" /> PDF
      </button>
    </>
  );
}

const LIBELLES_DOSSIER: Record<StatutDossier, [string, "succes" | "neutre" | "info" | "action" | "erreur"]> = {
  "en-etude": ["En étude", "neutre"],
  "a-corriger": ["Correction demandée", "action"],
  controle: ["Contrôle sur place", "info"],
  "en-ligne": ["En ligne", "succes"],
  refusee: ["Refusée", "erreur"],
  louee: ["Louée", "info"],
};

export function BadgeDossier({ statut }: { statut: StatutDossier }) {
  const [l, f] = LIBELLES_DOSSIER[statut];
  return <Badge famille={f}>{l}</Badge>;
}

export function libelleDossier(s: StatutDossier) {
  return LIBELLES_DOSSIER[s][0];
}

export function useMaintenant(intervalle = 60000) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setT(Date.now()), intervalle);
    return () => clearInterval(i);
  }, [intervalle]);
  return t;
}

// Minuteur d'étude (BO-01) : urgent quand il reste moins que le seuil d'alerte
export function Minuteur({ dossier, compact }: { dossier: Dossier; compact?: boolean }) {
  const maintenant = useMaintenant();
  const { delaiEtude, alerteEtude } = useParametres();
  const reste = heuresRestantesDossier(dossier, maintenant);
  const pause = dossier.statut === "a-corriger";
  const urgent = !pause && reste <= alerteEtude;
  const texte = pause ? `En pause · ${reste} h` : reste < 0 ? `Dépassé de ${-reste} h` : `${reste} h restantes`;
  return (
    <span className={`minuteur-bo${urgent ? " minuteur-bo--urgent" : ""}${pause ? " minuteur-bo--pause" : ""}${compact ? " minuteur-bo--compact" : ""}`}>
      <span className="minuteur-bo__piste" aria-hidden="true">
        <span style={{ width: `${Math.min(100, Math.max(0, ((delaiEtude - reste) / delaiEtude) * 100))}%` }} />
      </span>
      <span className="mono">{texte}</span>
    </span>
  );
}
