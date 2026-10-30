// Questions d'aide d'exemple, à remplacer par les contenus gérés depuis le back-office (WEB-07).
// Les montants et règles marqués [ ] restent à valider.

export interface Question {
  q: string;
  r: string;
}

export interface Theme {
  id: string;
  titre: string;
  questions: Question[];
}

export const THEMES: Theme[] = [
  {
    id: "chercher",
    titre: "Chercher un logement",
    questions: [
      {
        q: "Faut-il un compte pour chercher ?",
        r: "Non. La recherche et les annonces sont accessibles à tous. Un compte vous est demandé seulement pour réserver une visite, enregistrer un favori sur plusieurs appareils ou candidater.",
      },
      {
        q: "Que veut dire « Vérifié sur place » ?",
        r: "Un agent Xwé Tché s'est rendu dans le logement à la date indiquée sur le badge. Il a contrôlé les photos, les compteurs d'eau et d'électricité, l'état général et les repères.",
      },
      {
        q: "Pourquoi l'adresse exacte n'est-elle pas affichée ?",
        r: "Pour protéger le propriétaire et éviter les visites sans rendez-vous. L'annonce montre la zone et les repères. L'adresse exacte vous est envoyée par SMS après la réservation de la visite.",
      },
      {
        q: "Une annonce est marquée « Bientôt disponible ». Que faire ?",
        r: "Le logement est loué mais le locataire part à la date indiquée. Touchez « Être alerté » pour vous inscrire sur la liste d'attente : vous serez prévenu dès qu'il se libère.",
      },
    ],
  },
  {
    id: "visites",
    titre: "Visites",
    questions: [
      {
        q: "Combien coûte une visite ?",
        r: "[Première visite gratuite ou payante : à confirmer.] Si une visite ne correspond pas à l'annonce et que vous répondez « Pas satisfait », la visite suivante vous est offerte.",
      },
      {
        q: "Comment se passe la visite ?",
        r: "Vous recevez un code de visite par SMS. Sur place, un agent Xwé Tché vous accueille et valide votre présence par QR code. Après la visite, vous dites si vous êtes satisfait ou non.",
      },
      {
        q: "Je ne peux plus venir, comment annuler ?",
        r: "Annulez depuis votre espace au moins 12 h avant le rendez-vous. Après 3 absences sans annulation, la réservation de visites est temporairement bloquée.",
      },
      {
        q: "Combien de visites gratuites puis-je avoir ?",
        r: "Jusqu'à [5] visites gratuites en cours. Votre compteur est toujours visible dans votre espace locataire.",
      },
    ],
  },
  {
    id: "paiements",
    titre: "Bail et paiements",
    questions: [
      {
        q: "Quand dois-je payer Xwé Tché ?",
        r: "Uniquement après la signature du bail. La commission est d'un demi-mois de loyer [montant à valider]. Rien n'est demandé avant.",
      },
      {
        q: "Comment payer ?",
        r: "Par Mobile Money : MTN MoMo, Moov Money ou Celtiis Cash. Vous validez le paiement sur votre téléphone. Vous recevez aussitôt un reçu par SMS et en PDF.",
      },
      {
        q: "À qui vont l'avance et la caution ?",
        r: "Au propriétaire, aux montants affichés dans le bloc « Coût total » de l'annonce. La caution vous est restituée en fin de bail selon l'état des lieux.",
      },
      {
        q: "Puis-je être remboursé ?",
        r: "Oui, si le bail est annulé avant votre entrée dans les lieux ou en cas d'erreur de montant. Consultez nos règles de remboursement.",
      },
    ],
  },
  {
    id: "proprietaires",
    titre: "Propriétaires",
    questions: [
      {
        q: "Combien coûte la mise en ligne d'un bien ?",
        r: "Le dépôt et l'étude de votre annonce sont gratuits. [Conditions pour les propriétaires à préciser.]",
      },
      {
        q: "Quels documents dois-je fournir ?",
        r: "Une pièce d'identité et un document de propriété (titre foncier, attestation de détention coutumière, convention de vente ou permis d'habiter). Un gestionnaire fournit le mandat écrit du propriétaire. [Liste à valider avec le juriste.]",
      },
      {
        q: "En combien de temps mon annonce est-elle étudiée ?",
        r: "Sous 48 h. Un compte à rebours vous montre où en est votre dossier. Il se met en pause si nous vous demandons une correction et reprend dès votre nouvel envoi.",
      },
      {
        q: "Mon annonce a été refusée. Pourquoi ?",
        r: "Le motif vous est toujours indiqué : photos floues, document manquant, montants incomplets… Corrigez le point demandé et renvoyez votre annonce en étude.",
      },
    ],
  },
  {
    id: "securite",
    titre: "Sécurité",
    questions: [
      {
        q: "Quelqu'un me demande de payer avant la visite. Est-ce normal ?",
        r: "Non, c'est une arnaque. Xwé Tché ne demande jamais de paiement avant la visite, ni votre code Mobile Money. Ne versez rien et signalez-le.",
      },
      {
        q: "Comment reconnaître un message officiel de Xwé Tché ?",
        r: "Nos SMS viennent uniquement de l'expéditeur « XweTche ». Notre compte WhatsApp est vérifié. Chaque annonce porte une référence du type XT-0412.",
      },
    ],
  },
  {
    id: "compte",
    titre: "Mon compte",
    questions: [
      {
        q: "Comment me connecter ?",
        r: "Avec votre numéro de téléphone : vous recevez un code par SMS, sans mot de passe à retenir.",
      },
      {
        q: "J'ai changé de numéro. Que faire ?",
        r: "Contactez le support : nous vérifions votre identité avant de transférer votre compte vers le nouveau numéro.",
      },
    ],
  },
];
