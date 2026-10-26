import { useEffect } from "react";
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
      <Entete />
      <main id="contenu">
        <Outlet />
      </main>
      <Pied />
    </>
  );
}

// Espaces connectés : en-tête réduit au rôle, pas de pied de page de présentation.
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
