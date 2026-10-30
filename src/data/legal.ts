// Plans des documents légaux. Seule la structure est proposée : chaque texte doit être rédigé
// et validé par un juriste béninois (cahier des charges, 4.3 et 15).

export interface DocLegal {
  slug: string;
  titre: string;
  intro: string;
  sections: { titre: string; points: string[] }[];
}

export const DOCS_LEGAUX: DocLegal[] = [
  {
    slug: "cgu",
    titre: "Conditions générales d'utilisation",
    intro: "Les règles qui s'appliquent à toute personne qui utilise le site et les applications Xwé Tché.",
    sections: [
      { titre: "Objet et acceptation", points: ["Présentation du service", "Acceptation des conditions lors de l'inscription"] },
      { titre: "Inscription et compte", points: ["Inscription par numéro de téléphone", "Vérification d'identité", "Suspension d'un compte"] },
      { titre: "Annonces", points: ["Étude sous 48 h et contrôle sur place", "Engagements du propriétaire sur l'exactitude des informations", "Droits sur les photos"] },
      { titre: "Visites", points: ["Réservation et annulation", "Visites gratuites et leurs limites", "Absences répétées"] },
      { titre: "Commission et paiements", points: ["Montant et moment du paiement", "Prestataire de paiement agréé", "Reçus"] },
      { titre: "Non-contournement", points: ["Interdiction de conclure le bail hors de la plateforme après une visite organisée par Xwé Tché"] },
      { titre: "Responsabilités", points: ["Rôle de Xwé Tché", "Limites de responsabilité"] },
      { titre: "Litiges et droit applicable", points: ["Réclamations", "Droit béninois et juridiction compétente"] },
    ],
  },
  {
    slug: "confidentialite",
    titre: "Politique de confidentialité",
    intro: "Quelles données personnelles nous collectons, pourquoi, combien de temps nous les gardons et quels sont vos droits.",
    sections: [
      { titre: "Responsable du traitement", points: ["Identité et coordonnées de la société", "Déclaration auprès de l'APDP [à valider]"] },
      { titre: "Données collectées", points: ["Téléphone, nom, profession", "Pièce d'identité et selfie", "Documents de propriété", "Données de visite et de paiement"] },
      { titre: "Finalités", points: ["Vérification des annonces et des utilisateurs", "Organisation des visites", "Paiements et reçus", "Lutte contre la fraude"] },
      { titre: "Durées de conservation", points: ["Par type de donnée [à définir]"] },
      { titre: "Partage", points: ["Propriétaire et locataire, au moment de la visite", "Prestataires : paiement, SMS, hébergement"] },
      { titre: "Sécurité", points: ["Chiffrement des documents sensibles", "Accès limité selon les rôles"] },
      { titre: "Vos droits", points: ["Accès, rectification, suppression", "Retrait du consentement", "Comment exercer vos droits"] },
      { titre: "Traceurs et mesure d'audience", points: ["Consentement pour les traceurs non essentiels"] },
    ],
  },
  {
    slug: "charte-proprietaire",
    titre: "Charte propriétaire",
    intro: "Les engagements d'un propriétaire ou d'un gestionnaire qui publie un bien sur Xwé Tché.",
    sections: [
      { titre: "Exactitude de l'annonce", points: ["Photos réelles et récentes, sans retouche trompeuse", "Montants complets : loyer, avance, caution, charges"] },
      { titre: "Droits sur le bien", points: ["Documents de propriété ou mandat écrit", "Certification sur l'honneur"] },
      { titre: "Visites", points: ["Disponibilités tenues", "Accueil de l'agent et des candidats"] },
      { titre: "Choix du locataire", points: ["Délai de réponse aux candidatures", "Non-discrimination"] },
      { titre: "Départ d'un locataire", points: ["Déclaration de la date de libération", "Contrôle avant republication"] },
      { titre: "Manquements", points: ["Retrait d'annonce", "Suspension du compte"] },
    ],
  },
  {
    slug: "remboursements",
    titre: "Règles de remboursement",
    intro: "Dans quels cas la commission payée à Xwé Tché vous est remboursée, et comment.",
    sections: [
      { titre: "Cas de remboursement", points: ["Bail annulé avant l'entrée dans les lieux", "Erreur de montant", "Paiement en double"] },
      { titre: "Cas exclus", points: ["[À définir]"] },
      { titre: "Demande de remboursement", points: ["Depuis votre espace ou auprès du support", "Pièces à fournir"] },
      { titre: "Décision et délais", points: ["Décision d'un responsable, tracée", "Délai de remboursement sur Mobile Money [à définir]"] },
    ],
  },
  {
    slug: "mentions-legales",
    titre: "Mentions légales",
    intro: "Les informations sur l'éditeur et l'hébergeur du site.",
    sections: [
      { titre: "Éditeur", points: ["[Nom de la société porteuse], forme juridique, capital", "RCCM et IFU", "Adresse du siège, Cotonou", "Directeur de la publication"] },
      { titre: "Agrément", points: ["Agrément d'agence immobilière [à valider]"] },
      { titre: "Hébergement", points: ["Nom et adresse de l'hébergeur"] },
      { titre: "Propriété intellectuelle", points: ["Marque, logo et charte graphique Xwé Tché conçus par AWORIX", "Dépôt de la marque [en cours]"] },
    ],
  },
];
