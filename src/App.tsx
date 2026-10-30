import { lazy, Suspense, useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Entete } from "./components/Entete";
import { Pied, PiedEspace } from "./components/Pied";
import Accueil from "./pages/Accueil";
import Aide from "./pages/Aide";
import APropos from "./pages/APropos";
import Contact from "./pages/Contact";
import Annonce from "./pages/Annonce";
import Bail from "./pages/Bail";
import Connexion from "./pages/Connexion";
import Deposer from "./pages/Deposer";
import { CommentCaMarche, Confiance, Proprietaires } from "./pages/Editoriales";
import MonEspace from "./pages/MonEspace";
import Recu from "./pages/Recu";
import Introuvable from "./pages/Introuvable";
import Legal from "./pages/Legal";
import Louer from "./pages/Louer";
import { DOCS_LEGAUX } from "./data/legal";
import { useTitre } from "./lib/titre";
import { useContenus } from "./lib/contenus";
import { useSessionPrete } from "./lib/compte";

// Bannière d'information publiée depuis le back-office
function Banniere() {
  const { banniere } = useContenus();
  if (!banniere.actif || !banniere.texte.trim()) return null;
  return (
    <div className="banniere" role="note">
      <div className="wrap">{banniere.texte}</div>
    </div>
  );
}

function Gabarit() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a href="#contenu" className="sr-only">
        Aller au contenu
      </a>
      <Banniere />
      <Entete />
      <main id="contenu">
        <Outlet />
      </main>
      <Pied />
    </>
  );
}

// Espaces connectés : en-tête réduit au rôle, pas de pied de page de présentation.
const Agence = lazy(() => import("./agence"));

function GabaritEspace() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a href="#contenu" className="sr-only">
        Aller au contenu
      </a>
      <Entete espace />
      <main id="contenu" className="espace">
        <Outlet />
      </main>
      <PiedEspace />
    </>
  );
}

function PageAccueil() {
  useTitre("Logements vérifiés sur place au Bénin");
  return <Accueil />;
}

export default function App() {
  // Tant que la session n'est pas vérifiée auprès de l'API, on n'affiche pas de page (sinon une personne connectée serait renvoyée vers /connexion).
  const prete = useSessionPrete();
  if (!prete) return <div className="chargement" aria-busy="true" aria-label="Chargement" />;
  return (
    <Routes>
      <Route element={<Gabarit />}>
        <Route index element={<PageAccueil />} />
        <Route path="louer" element={<Louer />} />
        <Route path="louer/:ville/:quartier" element={<Louer />} />
        <Route path="annonce/:slug" element={<Annonce />} />
        <Route path="comment-ca-marche" element={<CommentCaMarche />} />
        <Route path="proprietaires" element={<Proprietaires />} />
        <Route path="confiance" element={<Confiance />} />
        <Route path="aide" element={<Aide />} />
        <Route path="contact" element={<Contact />} />
        <Route path="a-propos" element={<APropos />} />
        {DOCS_LEGAUX.map((d) => (
          <Route key={d.slug} path={d.slug} element={<Legal slug={d.slug} />} />
        ))}
        <Route path="*" element={<Introuvable />} />
      </Route>
      <Route
        path="agence/*"
        element={
          <Suspense fallback={<div className="chargement" aria-busy="true" />}>
            <Agence />
          </Suspense>
        }
      />
      <Route element={<GabaritEspace />}>
        <Route path="connexion" element={<Connexion />} />
        <Route path="mon-espace" element={<MonEspace />} />
        <Route path="proprietaires/deposer" element={<Deposer />} />
        <Route path="bail/:ref" element={<Bail />} />
        <Route path="recu/:numero" element={<Recu />} />
      </Route>
    </Routes>
  );
}
