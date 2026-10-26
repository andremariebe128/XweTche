import { Route, Routes } from "react-router-dom";
import "../styles/agence.css";
import { Contenus, Equipe, Journal, Messages, ParametresPage, Signalements } from "./Administration";
import ConnexionAgence from "./Connexion";
import { DossierEtude, FileEtude } from "./Etude";
import GabaritAgence from "./Gabarit";
import { Annonces, Baux, Terrain, Utilisateurs, Visites } from "./Operations";
import Tableau from "./Tableau";
import { Acces } from "./ui";

// Back-office de l'agence, chargé à part pour ne pas alourdir le site public.
export default function RoutesAgence() {
  return (
    <Routes>
      <Route path="connexion" element={<ConnexionAgence />} />
      <Route element={<GabaritAgence />}>
        <Route index element={<Tableau />} />
        <Route path="etude" element={<Acces module="etude"><FileEtude /></Acces>} />
        <Route path="etude/:ref" element={<Acces module="annonces"><DossierEtude /></Acces>} />
        <Route path="annonces" element={<Acces module="annonces"><Annonces /></Acces>} />
        <Route path="terrain" element={<Acces module="terrain"><Terrain /></Acces>} />
        <Route path="visites" element={<Acces module="visites"><Visites /></Acces>} />
        <Route path="baux" element={<Acces module="baux"><Baux /></Acces>} />
        <Route path="utilisateurs" element={<Acces module="utilisateurs"><Utilisateurs /></Acces>} />
        <Route path="signalements" element={<Acces module="signalements"><Signalements /></Acces>} />
        <Route path="messages" element={<Acces module="messages"><Messages /></Acces>} />
        <Route path="contenus" element={<Acces module="contenus"><Contenus /></Acces>} />
        <Route path="parametres" element={<Acces module="parametres"><ParametresPage /></Acces>} />
        <Route path="equipe" element={<Acces module="equipe"><Equipe /></Acces>} />
        <Route path="journal" element={<Acces module="journal"><Journal /></Acces>} />
        <Route path="*" element={<Acces module="tableau"><Tableau /></Acces>} />
      </Route>
    </Routes>
  );
}
