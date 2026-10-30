import {
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  ExternalLink,
  FileSignature,
  Flag,
  History,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquareText,
  Newspaper,
  Settings,
  ShieldCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Logo } from "../components/Marque";
import { deconnecterAgence, peut, ROLES_AGENCE, useAgence, useMembre, type Module } from "../lib/agence";

const MENU: [Module, string, string, LucideIcon][] = [
  ["tableau", "/agence", "Tableau de bord", LayoutDashboard],
  ["etude", "/agence/etude", "File d'étude", ClipboardCheck],
  ["annonces", "/agence/annonces", "Annonces", Home],
  ["terrain", "/agence/terrain", "Contrôles terrain", ShieldCheck],
  ["visites", "/agence/visites", "Visites et retours", CalendarDays],
  ["baux", "/agence/baux", "Baux et commissions", FileSignature],
  ["utilisateurs", "/agence/utilisateurs", "Utilisateurs", Users],
  ["signalements", "/agence/signalements", "Signalements", Flag],
  ["messages", "/agence/messages", "Modèles de messages", MessageSquareText],
  ["contenus", "/agence/contenus", "Contenus du site", Newspaper],
  ["parametres", "/agence/parametres", "Paramètres", Settings],
  ["equipe", "/agence/equipe", "Équipe et rôles", BarChart3],
  ["journal", "/agence/journal", "Journal d'audit", History],
];

// Back-office : même charte que le site, en version plus dense (8.5).
export default function GabaritAgence() {
  const membre = useMembre();
  const agence = useAgence();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!membre) return <Navigate to="/agence/connexion" replace />;

  const urgents = agence.dossiers.filter((d) => d.statut === "en-etude").length;
  const nouveauxSignalements = agence.signalements.filter((s) => s.statut === "nouveau").length;
  const compteurs: Partial<Record<Module, number>> = { etude: urgents, signalements: nouveauxSignalements };
  const liens = MENU.filter(([m]) => peut(membre.role, m));

  return (
    <div className="bo">
      <header className="bo-barre">
        <button type="button" className="btn-icone bo-barre__menu" aria-expanded={menu} aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"} onClick={() => setMenu((m) => !m)}>
          {menu ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <Link to="/agence" className="bo-barre__logo" aria-label="Back-office Xwé Tché">
          <Logo largeur={120} />
          <span className="bo-barre__etiquette mono">Agence</span>
        </Link>
        <div className="bo-barre__droite">
          <Link to="/" className="btn btn--texte bo-barre__site" target="_blank">
            <ExternalLink size={16} aria-hidden="true" /> Voir le site
          </Link>
          <span className="bo-barre__membre">
            <span className="entete__initiale" aria-hidden="true">
              {membre.nom[0]}
            </span>
            <span>
              <strong>{membre.nom}</strong>
              <span className="petit gris">{ROLES_AGENCE[membre.role]}</span>
            </span>
          </span>
        </div>
      </header>
      <div className="bo-corps">
        <nav className={`bo-menu${menu ? " est-ouvert" : ""}`} aria-label="Modules du back-office">
          {liens.map(([m, to, libelle, Icone]) => (
            <NavLink key={m} to={to} end={m === "tableau"} className="bo-menu__lien">
              <Icone aria-hidden="true" />
              <span>{libelle}</span>
              {!!compteurs[m] && <span className="bo-menu__n mono">{compteurs[m]}</span>}
            </NavLink>
          ))}
          <button type="button" className="bo-menu__lien bo-menu__sortie" onClick={() => void deconnecterAgence()}>
            <LogOut aria-hidden="true" />
            <span>Se déconnecter</span>
          </button>
        </nav>
        <main id="contenu" className="bo-contenu">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
