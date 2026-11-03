// Génère db/seed/001_reference.sql à partir des données de l'app (src/data, src/lib/parametres).
// Le seed de démonstration (002_demo.sql) est maintenu à la main : les annonces viennent de l'API.
// Usage : node db/generate-seed.mjs
import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const tmp = join(racine, "db", ".tmp");
mkdirSync(tmp, { recursive: true });

async function charger(entree) {
  const sortie = join(tmp, entree.replace(/[\\/]/g, "_") + ".mjs");
  await build({ entryPoints: [join(racine, entree)], outfile: sortie, bundle: true, format: "esm", platform: "node", logLevel: "silent" });
  return import(pathToFileURL(sortie).href);
}

const { THEMES } = await charger("src/data/aide.ts");
const { slugQuartier } = await charger("src/data/annonces.ts");
const { PARAMETRES_DEFAUT: P } = await charger("src/lib/parametres.ts");

const q = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);
const slug = (s) => slugQuartier(s);

// ---------------------------------------------------------------- référence
const VILLES = [["Cotonou", true], ["Abomey-Calavi", true], ["Porto-Novo", true]];
const VILLE_DE = { Godomey: "Abomey-Calavi", "Calavi Kpota": "Abomey-Calavi" };
const EQUIPEMENTS = [
  ["eau", "Eau au compteur"], ["electricite", "Électricité au compteur"], ["cloture", "Cour clôturée"],
  ["parking-voiture", "Parking voiture"], ["parking-moto", "Parking moto"], ["meuble", "Meublé"],
  ["douche-interne", "Douche interne"], ["cuisine", "Cuisine"], ["carrelage", "Carrelage"], ["plafond", "Plafond"],
  ["climatisation", "Climatisation"], ["ventilateur", "Ventilateur"], ["groupe", "Groupe électrogène"],
  ["forage", "Forage"], ["gardien", "Gardien"],
];
const PARAMS = [
  ["commission", P.commission, "Part d'un mois de loyer facturée à la signature (0.5 = ½ mois). À VALIDER juridiquement."],
  ["plafond_visites_gratuites", P.plafondVisites, "Crédits de visite gratuite en cours, au maximum (5.3)"],
  ["delai_etude_h", P.delaiEtude, "Délai d'étude d'une annonce, en heures (5.1)"],
  ["alerte_etude_h", P.alerteEtude, "Alerte quand il reste moins de N heures d'étude (BO-01)"],
  ["annulation_visite_h", P.annulationVisite, "Annulation sans pénalité jusqu'à N heures avant la visite (5.3)"],
  ["absences_max", 3, "Absences sans annulation avant blocage des réservations (5.3)"],
  ["photos_min", 6, "Nombre minimal de photos par annonce (5.2)"],
  ["photo_largeur_min_px", 1280, "Largeur minimale d'une photo (5.2)"],
  ["creneaux_heures", ["08:00", "09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00", "18:00"], "Créneaux de visite proposés (heure du Bénin, UTC+1)"],
  ["horizon_visite_jours", 10, "Nombre de jours proposés à la réservation (dimanche exclu)"],
  ["jours_sans_visite", [0], "Jours sans visite (0 = dimanche)"],
];
const MOTIFS = [
  ["refus", [
    "Documents de propriété insuffisants", "Identité du propriétaire non vérifiée", "Photos ne correspondant pas au bien",
    "Annonce en double", "Bien non conforme à la charte",
  ]],
  ["correction", [
    "Photos floues ou sombres", "Photo manquante (pièce obligatoire)", "Montants incohérents",
    "Description incomplète", "Repères insuffisants",
  ]],
  ["visite", P.motifsVisite],
  ["signalement", [
    "On m'a demandé de l'argent avant la visite", "Déjà loué", "Photos non conformes à la réalité",
    "Faux compte ou faux numéro se réclamant de Xwé Tché", "Annonce fausse ou abusive", "Autre",
  ]],
];
const MODELES = [
  ["invitation-sms", "Invitation membre", "sms", "XweTche : {par} vous invite au back-office avec le rôle « {role} ». Activez votre accès avant le {expire} : {lien}"],
  ["invitation-email", "Invitation membre", "email", "Objet : Votre accès au back-office Xwé Tché\n\nBonjour {prenom},\n\n{par} vous invite à rejoindre le back-office Xwé Tché avec le rôle « {role} ».\n\nOuvrez ce lien pour choisir votre mot de passe, avant le {expire} : {lien}\n\nSi vous n'attendiez pas cette invitation, ignorez ce message.\n\nL'équipe Xwé Tché"],
  ["visite-confirmee", "Visite confirmée", "sms", "XweTche : visite confirmée le {date} à {heure}. Code {code}. Adresse : {adresse}. Ne payez rien avant la visite."],
  ["visite-rappel", "Rappel la veille", "whatsapp", "Bonjour {prenom}, rappel de votre visite demain à {heure} ({quartier}). Votre agent : {agent}. Empêché ? Annulez avant {limite}."],
  ["avis", "Avis après visite", "sms", "XweTche : comment s'est passée la visite de {ref} ? Répondez sur {lien}. « Pas satisfait » = prochaine visite gratuite."],
  ["annonce-validee", "Annonce validée", "sms", "XweTche : votre annonce {ref} est validée. Un agent passera pour le contrôle sur place le {date}."],
  ["correction", "Correction demandée", "whatsapp", "Bonjour {prenom}, votre annonce {ref} demande une correction : {motif}. Le compte à rebours reprend dès votre envoi."],
  ["paiement", "Paiement reçu", "sms", "XweTche : paiement de {montant} reçu ({moyen}). Reçu n° {recu}. Bienvenue chez vous !"],
  ["visite-proprietaire", "Visite chez le propriétaire", "sms", "XweTche : une visite de votre bien {ref} est prévue le {date} à {heure}. Un agent Xwé Tché accompagnera le visiteur."],
  ["visite-agent", "Mission de visite", "sms", "XweTche : visite {ref} ({quartier}) le {date} à {heure}. Code de visite {code}. Adresse : {adresse}."],
  ["visite-rappel-2h", "Rappel 2 h avant", "sms", "Xwé Tché : votre visite est à {heure}. Repère : {repere}. Empêché ? Annulez dans l'appli pour garder vos visites gratuites."],
  ["alerte-annonce", "Nouvelle annonce pour votre alerte", "sms", "XweTche : nouveau logement pour votre alerte : {type} à {quartier}, {loyer} FCFA. Voir : {lien}"],
  ["annonce-refusee", "Annonce refusée", "sms", "XweTche : votre annonce {ref} n'a pas été validée : {motif}. Vous pouvez la renvoyer après correction."],
  ["candidature-retenue", "Candidature retenue", "sms", "XweTche : votre candidature pour {ref} est retenue ! Signez le bail et réglez la commission dans l'appli."],
  ["alerte-etude", "Alerte délai d'étude", "sms", "XweTche : l'annonce {ref} doit être étudiée dans les {heures} h. Ouvrez le back-office."],
  ["liberation", "Logement bientôt libre", "sms", "XweTche : le logement {ref} à {quartier} se libère le {date}. Réservez une visite : {lien}. STOP pour arrêter."],
];

// Quartiers connus au démarrage (les suivants s'ajoutent depuis le back-office).
const QUARTIERS = [
  "Fidjrossè", "Cadjèhoun", "Haie Vive", "Akpakpa", "Agla", "Gbégamey", "Zogbo", "Missèbo", "Vèdoko", "Sainte-Rita",
  "Godomey", "Calavi Kpota",
];

const quartiersTous = [...new Set([...P.quartiers, ...QUARTIERS])];
const villeDe = (n) => VILLE_DE[n] ?? "Cotonou";

let ref = "-- Données de référence : générées par db/generate-seed.mjs, ne pas éditer à la main.\n-- Idempotent : peut être rejoué sans doublon.\nBEGIN;\n\n";
ref += "INSERT INTO villes (nom, slug) VALUES\n" + VILLES.map(([n]) => `  (${q(n)}, ${q(slug(n))})`).join(",\n") + "\nON CONFLICT (slug) DO NOTHING;\n\n";
ref += "INSERT INTO quartiers (ville_id, nom, slug) VALUES\n" +
  quartiersTous.map((n) => `  ((SELECT id FROM villes WHERE slug = ${q(slug(villeDe(n)))}), ${q(n)}, ${q(slug(n))})`).join(",\n") +
  "\nON CONFLICT (ville_id, slug) DO NOTHING;\n\n";
ref += "INSERT INTO equipements (code, libelle, ordre) VALUES\n" + EQUIPEMENTS.map(([c, l], i) => `  (${q(c)}, ${q(l)}, ${i})`).join(",\n") + "\nON CONFLICT (code) DO NOTHING;\n\n";
ref += "INSERT INTO parametres (cle, valeur, note) VALUES\n" + PARAMS.map(([c, v, n]) => `  (${q(c)}, '${JSON.stringify(v)}'::jsonb, ${q(n)})`).join(",\n") + "\nON CONFLICT (cle) DO NOTHING;\n\n";
ref += "INSERT INTO motifs (categorie, libelle, ordre) VALUES\n" +
  MOTIFS.flatMap(([c, l]) => l.map((m, i) => `  ('${c}', ${q(m)}, ${i})`)).join(",\n") + "\nON CONFLICT (categorie, libelle) DO NOTHING;\n\n";
ref += "INSERT INTO modeles_message (id, nom, canal, texte) VALUES\n" + MODELES.map(([i, n, c, t]) => `  (${q(i)}, ${q(n)}, '${c}', ${q(t)})`).join(",\n") + "\nON CONFLICT (id) DO NOTHING;\n\n";
const faq = THEMES.flatMap((t) => t.questions.map((x, i) => `  ('faq', ${q(t.id + "-" + (i + 1))}, ${q(t.id)}, ${q(t.titre)}, ${q(x.q)}, ${q(x.r)}, ${i}, 'publie')`));
ref += "-- FAQ : thèmes de src/data/aide.ts (« theme » = id du thème : " + THEMES.map((t) => `${t.id} = ${t.titre}`).join(" ; ") + ")\n";
ref += "INSERT INTO contenus_editoriaux (type, slug, theme, theme_titre, titre, texte, ordre, statut) VALUES\n" + faq.join(",\n") + "\nON CONFLICT (type, slug, langue) DO NOTHING;\n";
ref += "INSERT INTO contenus_editoriaux (type, slug, titre, texte, statut) VALUES\n  ('banniere', 'principale', 'Bandeau du site', 'Nouveau : les visites sont désormais possibles le samedi après-midi.', 'brouillon')\nON CONFLICT (type, slug, langue) DO NOTHING;\n\nCOMMIT;\n";

mkdirSync(join(racine, "db", "seed"), { recursive: true });
writeFileSync(join(racine, "db", "seed", "001_reference.sql"), ref);
console.log(`Seed de référence généré : ${quartiersTous.length} quartiers, ${faq.length} questions FAQ.`);
console.log("Le seed de démonstration (002_demo.sql) est maintenu à la main.");
