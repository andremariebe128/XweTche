import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "./styles/composants.css";
import "./styles/pages.css";
import "./styles/pages-info.css";
import "./styles/espaces.css";
import { amorcerSession } from "./lib/compte";
import { chargerContenus } from "./lib/contenus";
import { chargerParametres } from "./lib/parametres";

// Au démarrage : session, réglages et contenus viennent de l'API.
void amorcerSession();
void chargerParametres();
void chargerContenus();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
