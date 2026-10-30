-- Données de référence : générées par db/generate-seed.mjs, ne pas éditer à la main.
-- Idempotent : peut être rejoué sans doublon.
BEGIN;

INSERT INTO villes (nom, slug) VALUES
  ('Cotonou', 'cotonou'),
  ('Abomey-Calavi', 'abomey-calavi'),
  ('Porto-Novo', 'porto-novo')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO quartiers (ville_id, nom, slug) VALUES
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Fidjrossè', 'fidjrosse'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Cadjèhoun', 'cadjehoun'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Haie Vive', 'haie-vive'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Akpakpa', 'akpakpa'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Agla', 'agla'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Gbégamey', 'gbegamey'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Zogbo', 'zogbo'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Missèbo', 'missebo'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Vêdoko', 'vedoko'),
  ((SELECT id FROM villes WHERE slug = 'cotonou'), 'Sainte-Rita', 'sainte-rita'),
  ((SELECT id FROM villes WHERE slug = 'abomey-calavi'), 'Godomey', 'godomey'),
  ((SELECT id FROM villes WHERE slug = 'abomey-calavi'), 'Calavi Kpota', 'calavi-kpota')
ON CONFLICT (ville_id, slug) DO NOTHING;

INSERT INTO equipements (code, libelle, ordre) VALUES
  ('eau', 'Eau au compteur', 0),
  ('electricite', 'Électricité au compteur', 1),
  ('cloture', 'Cour clôturée', 2),
  ('parking-voiture', 'Parking voiture', 3),
  ('parking-moto', 'Parking moto', 4),
  ('meuble', 'Meublé', 5),
  ('douche-interne', 'Douche interne', 6),
  ('cuisine', 'Cuisine', 7),
  ('carrelage', 'Carrelage', 8),
  ('plafond', 'Plafond', 9),
  ('climatisation', 'Climatisation', 10),
  ('ventilateur', 'Ventilateur', 11),
  ('groupe', 'Groupe électrogène', 12),
  ('forage', 'Forage', 13),
  ('gardien', 'Gardien', 14)
ON CONFLICT (code) DO NOTHING;

INSERT INTO parametres (cle, valeur, note) VALUES
  ('commission', '0.5'::jsonb, 'Part d''un mois de loyer facturée à la signature (0.5 = ½ mois). À VALIDER juridiquement.'),
  ('plafond_visites_gratuites', '5'::jsonb, 'Crédits de visite gratuite en cours, au maximum (5.3)'),
  ('delai_etude_h', '48'::jsonb, 'Délai d''étude d''une annonce, en heures (5.1)'),
  ('alerte_etude_h', '12'::jsonb, 'Alerte quand il reste moins de N heures d''étude (BO-01)'),
  ('annulation_visite_h', '12'::jsonb, 'Annulation sans pénalité jusqu''à N heures avant la visite (5.3)'),
  ('absences_max', '3'::jsonb, 'Absences sans annulation avant blocage des réservations (5.3)'),
  ('photos_min', '6'::jsonb, 'Nombre minimal de photos par annonce (5.2)'),
  ('photo_largeur_min_px', '1280'::jsonb, 'Largeur minimale d''une photo (5.2)'),
  ('creneaux_heures', '["08:00","09:00","10:00","11:00","14:00","15:00","16:00","17:00","18:00"]'::jsonb, 'Créneaux de visite proposés (heure du Bénin, UTC+1)'),
  ('horizon_visite_jours', '10'::jsonb, 'Nombre de jours proposés à la réservation (dimanche exclu)'),
  ('jours_sans_visite', '[0]'::jsonb, 'Jours sans visite (0 = dimanche)')
ON CONFLICT (cle) DO NOTHING;

INSERT INTO motifs (categorie, libelle, ordre) VALUES
  ('refus', 'Documents de propriété insuffisants', 0),
  ('refus', 'Identité du propriétaire non vérifiée', 1),
  ('refus', 'Photos ne correspondant pas au bien', 2),
  ('refus', 'Annonce en double', 3),
  ('refus', 'Bien non conforme à la charte', 4),
  ('correction', 'Photos floues ou sombres', 0),
  ('correction', 'Photo manquante (pièce obligatoire)', 1),
  ('correction', 'Montants incohérents', 2),
  ('correction', 'Description incomplète', 3),
  ('correction', 'Repères insuffisants', 4),
  ('visite', 'Prix', 0),
  ('visite', 'État du logement', 1),
  ('visite', 'Quartier', 2),
  ('visite', 'Taille', 3),
  ('visite', 'Photos non conformes', 4),
  ('visite', 'Autre', 5),
  ('signalement', 'On m''a demandé de l''argent avant la visite', 0),
  ('signalement', 'Déjà loué', 1),
  ('signalement', 'Photos non conformes à la réalité', 2),
  ('signalement', 'Faux compte ou faux numéro se réclamant de Xwé Tché', 3),
  ('signalement', 'Annonce fausse ou abusive', 4),
  ('signalement', 'Autre', 5)
ON CONFLICT (categorie, libelle) DO NOTHING;

INSERT INTO modeles_message (id, nom, canal, texte) VALUES
  ('invitation-sms', 'Invitation membre', 'sms', 'XweTche : {par} vous invite au back-office avec le rôle « {role} ». Activez votre accès avant le {expire} : {lien}'),
  ('invitation-email', 'Invitation membre', 'email', 'Objet : Votre accès au back-office Xwé Tché

Bonjour {prenom},

{par} vous invite à rejoindre le back-office Xwé Tché avec le rôle « {role} ».

Activez votre accès avec ce lien, valable jusqu''au {expire} : {lien}

Vous recevrez un code par SMS au {tel} pour confirmer. Si vous n''attendiez pas cette invitation, ignorez ce message.

L''équipe Xwé Tché'),
  ('visite-confirmee', 'Visite confirmée', 'sms', 'XweTche : visite confirmée le {date} à {heure}. Code {code}. Adresse : {adresse}. Ne payez rien avant la visite.'),
  ('visite-rappel', 'Rappel la veille', 'whatsapp', 'Bonjour {prenom}, rappel de votre visite demain à {heure} ({quartier}). Votre agent : {agent}. Empêché ? Annulez avant {limite}.'),
  ('avis', 'Avis après visite', 'sms', 'XweTche : comment s''est passée la visite de {ref} ? Répondez sur {lien}. « Pas satisfait » = prochaine visite gratuite.'),
  ('annonce-validee', 'Annonce validée', 'sms', 'XweTche : votre annonce {ref} est validée. Un agent passera pour le contrôle sur place le {date}.'),
  ('correction', 'Correction demandée', 'whatsapp', 'Bonjour {prenom}, votre annonce {ref} demande une correction : {motif}. Le compte à rebours reprend dès votre envoi.'),
  ('paiement', 'Paiement reçu', 'sms', 'XweTche : paiement de {montant} reçu ({moyen}). Reçu n° {recu}. Bienvenue chez vous !'),
  ('visite-proprietaire', 'Visite chez le propriétaire', 'sms', 'XweTche : une visite de votre bien {ref} est prévue le {date} à {heure}. Un agent Xwé Tché accompagnera le visiteur.'),
  ('visite-agent', 'Mission de visite', 'sms', 'XweTche : visite {ref} ({quartier}) le {date} à {heure}. Code de visite {code}. Adresse : {adresse}.'),
  ('visite-rappel-2h', 'Rappel 2 h avant', 'sms', 'Xwé Tché : votre visite est à {heure}. Repère : {repere}. Empêché ? Annulez dans l''appli pour garder vos visites gratuites.'),
  ('alerte-annonce', 'Nouvelle annonce pour votre alerte', 'sms', 'XweTche : nouveau logement pour votre alerte : {type} à {quartier}, {loyer} FCFA. Voir : {lien}'),
  ('annonce-refusee', 'Annonce refusée', 'sms', 'XweTche : votre annonce {ref} n''a pas été validée : {motif}. Vous pouvez la renvoyer après correction.'),
  ('candidature-retenue', 'Candidature retenue', 'sms', 'XweTche : votre candidature pour {ref} est retenue ! Signez le bail et réglez la commission dans l''appli.'),
  ('alerte-etude', 'Alerte délai d''étude', 'sms', 'XweTche : l''annonce {ref} doit être étudiée dans les {heures} h. Ouvrez le back-office.'),
  ('liberation', 'Logement bientôt libre', 'sms', 'XweTche : le logement {ref} à {quartier} se libère le {date}. Réservez une visite : {lien}. STOP pour arrêter.')
ON CONFLICT (id) DO NOTHING;

-- FAQ : thèmes de src/data/aide.ts (« theme » = id du thème : chercher = Chercher un logement ; visites = Visites ; paiements = Bail et paiements ; proprietaires = Propriétaires ; securite = Sécurité ; compte = Mon compte)
INSERT INTO contenus_editoriaux (type, slug, theme, theme_titre, titre, texte, ordre, statut) VALUES
  ('faq', 'chercher-1', 'chercher', 'Chercher un logement', 'Faut-il un compte pour chercher ?', 'Non. La recherche et les annonces sont accessibles à tous. Un compte vous est demandé seulement pour réserver une visite, enregistrer un favori sur plusieurs appareils ou candidater.', 0, 'publie'),
  ('faq', 'chercher-2', 'chercher', 'Chercher un logement', 'Que veut dire « Vérifié sur place » ?', 'Un agent Xwé Tché s''est rendu dans le logement à la date indiquée sur le badge. Il a contrôlé les photos, les compteurs d''eau et d''électricité, l''état général et les repères.', 1, 'publie'),
  ('faq', 'chercher-3', 'chercher', 'Chercher un logement', 'Pourquoi l''adresse exacte n''est-elle pas affichée ?', 'Pour protéger le propriétaire et éviter les visites sans rendez-vous. L''annonce montre la zone et les repères. L''adresse exacte vous est envoyée par SMS après la réservation de la visite.', 2, 'publie'),
  ('faq', 'chercher-4', 'chercher', 'Chercher un logement', 'Une annonce est marquée « Bientôt disponible ». Que faire ?', 'Le logement est loué mais le locataire part à la date indiquée. Touchez « Être alerté » pour vous inscrire sur la liste d''attente : vous serez prévenu dès qu''il se libère.', 3, 'publie'),
  ('faq', 'visites-1', 'visites', 'Visites', 'Combien coûte une visite ?', '[Première visite gratuite ou payante : à confirmer.] Si une visite ne correspond pas à l''annonce et que vous répondez « Pas satisfait », la visite suivante vous est offerte.', 0, 'publie'),
  ('faq', 'visites-2', 'visites', 'Visites', 'Comment se passe la visite ?', 'Vous recevez un code de visite par SMS. Sur place, un agent Xwé Tché vous accueille et valide votre présence par QR code. Après la visite, vous dites si vous êtes satisfait ou non.', 1, 'publie'),
  ('faq', 'visites-3', 'visites', 'Visites', 'Je ne peux plus venir, comment annuler ?', 'Annulez depuis votre espace au moins 12 h avant le rendez-vous. Après 3 absences sans annulation, la réservation de visites est temporairement bloquée.', 2, 'publie'),
  ('faq', 'visites-4', 'visites', 'Visites', 'Combien de visites gratuites puis-je avoir ?', 'Jusqu''à [5] visites gratuites en cours. Votre compteur est toujours visible dans votre espace locataire.', 3, 'publie'),
  ('faq', 'paiements-1', 'paiements', 'Bail et paiements', 'Quand dois-je payer Xwé Tché ?', 'Uniquement après la signature du bail. La commission est d''un demi-mois de loyer [montant à valider]. Rien n''est demandé avant.', 0, 'publie'),
  ('faq', 'paiements-2', 'paiements', 'Bail et paiements', 'Comment payer ?', 'Par Mobile Money : MTN MoMo, Moov Money ou Celtiis Cash. Vous validez le paiement sur votre téléphone. Vous recevez aussitôt un reçu par SMS et en PDF.', 1, 'publie'),
  ('faq', 'paiements-3', 'paiements', 'Bail et paiements', 'À qui vont l''avance et la caution ?', 'Au propriétaire, aux montants affichés dans le bloc « Coût total » de l''annonce. La caution vous est restituée en fin de bail selon l''état des lieux.', 2, 'publie'),
  ('faq', 'paiements-4', 'paiements', 'Bail et paiements', 'Puis-je être remboursé ?', 'Oui, si le bail est annulé avant votre entrée dans les lieux ou en cas d''erreur de montant. Consultez nos règles de remboursement.', 3, 'publie'),
  ('faq', 'proprietaires-1', 'proprietaires', 'Propriétaires', 'Combien coûte la mise en ligne d''un bien ?', 'Le dépôt et l''étude de votre annonce sont gratuits. [Conditions pour les propriétaires à préciser.]', 0, 'publie'),
  ('faq', 'proprietaires-2', 'proprietaires', 'Propriétaires', 'Quels documents dois-je fournir ?', 'Une pièce d''identité et un document de propriété (titre foncier, attestation de détention coutumière, convention de vente ou permis d''habiter). Un gestionnaire fournit le mandat écrit du propriétaire. [Liste à valider avec le juriste.]', 1, 'publie'),
  ('faq', 'proprietaires-3', 'proprietaires', 'Propriétaires', 'En combien de temps mon annonce est-elle étudiée ?', 'Sous 48 h. Un compte à rebours vous montre où en est votre dossier. Il se met en pause si nous vous demandons une correction et reprend dès votre nouvel envoi.', 2, 'publie'),
  ('faq', 'proprietaires-4', 'proprietaires', 'Propriétaires', 'Mon annonce a été refusée. Pourquoi ?', 'Le motif vous est toujours indiqué : photos floues, document manquant, montants incomplets… Corrigez le point demandé et renvoyez votre annonce en étude.', 3, 'publie'),
  ('faq', 'securite-1', 'securite', 'Sécurité', 'Quelqu''un me demande de payer avant la visite. Est-ce normal ?', 'Non, c''est une arnaque. Xwé Tché ne demande jamais de paiement avant la visite, ni votre code Mobile Money. Ne versez rien et signalez-le.', 0, 'publie'),
  ('faq', 'securite-2', 'securite', 'Sécurité', 'Comment reconnaître un message officiel de Xwé Tché ?', 'Nos SMS viennent uniquement de l''expéditeur « XweTche ». Notre compte WhatsApp est vérifié. Chaque annonce porte une référence du type XT-0412.', 1, 'publie'),
  ('faq', 'compte-1', 'compte', 'Mon compte', 'Comment me connecter ?', 'Avec votre numéro de téléphone : vous recevez un code par SMS, sans mot de passe à retenir.', 0, 'publie'),
  ('faq', 'compte-2', 'compte', 'Mon compte', 'J''ai changé de numéro. Que faire ?', 'Contactez le support : nous vérifions votre identité avant de transférer votre compte vers le nouveau numéro.', 1, 'publie')
ON CONFLICT (type, slug, langue) DO NOTHING;
INSERT INTO contenus_editoriaux (type, slug, titre, texte, statut) VALUES
  ('banniere', 'principale', 'Bandeau du site', 'Nouveau : les visites sont désormais possibles le samedi après-midi.', 'brouillon')
ON CONFLICT (type, slug, langue) DO NOTHING;

COMMIT;
