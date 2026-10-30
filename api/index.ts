import { gerer } from "../server/app.js";

// Un seul point d'entrée pour toute l'API : vercel.json y renvoie /api/*, le routage est dans server/.
export default {
  fetch: (req: Request) => gerer(req),
};
