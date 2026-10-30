-- ============================================================================
-- Xwé Tché · schéma PostgreSQL (Neon)
-- Source : cahier des charges v2.0 (chapitres 3, 5, 8, 14) + état actuel de l'app
-- (src/lib/compte.ts, src/lib/agence.ts, src/lib/parametres.ts, src/data/*).
-- Conventions : tables et colonnes en français sans accents, clés uuid,
-- montants en FCFA (entiers, pas de décimales), dates en timestamptz (UTC).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- e-mails insensibles à la casse

-- ----------------------------------------------------------------------------
-- Types énumérés
-- ----------------------------------------------------------------------------
CREATE TYPE role_utilisateur  AS ENUM ('locataire', 'proprietaire');
CREATE TYPE role_agence       AS ENUM ('etude', 'terrain', 'finance', 'support', 'admin');
CREATE TYPE statut_membre     AS ENUM ('invite', 'actif', 'revoque');
CREATE TYPE statut_identite   AS ENUM ('non_demandee', 'en_attente', 'verifiee', 'refusee');
CREATE TYPE statut_compte     AS ENUM ('actif', 'suspendu');
CREATE TYPE canal_message     AS ENUM ('sms', 'whatsapp', 'email', 'push');

CREATE TYPE type_bien AS ENUM
  ('entree-couchee', 'chambre-salon', 'studio', 'appartement', 'maison', 'boutique');

-- Cycle de vie d'une annonce (5.1). « controle » = validée, contrôle terrain en cours.
CREATE TYPE statut_annonce AS ENUM
  ('brouillon', 'soumise', 'en_etude', 'a_corriger', 'refusee', 'controle',
   'en_ligne', 'reservee', 'louee', 'liberee');

CREATE TYPE type_document AS ENUM
  ('cip', 'passeport', 'npi', 'selfie',
   'titre_foncier', 'attestation_detention', 'convention_vente', 'permis_habiter', 'mandat');
CREATE TYPE statut_validation AS ENUM ('en_attente', 'valide', 'refuse', 'piece_manquante');

CREATE TYPE type_media       AS ENUM ('photo', 'video');
CREATE TYPE decision_etude   AS ENUM ('valider', 'refuser', 'corriger');

CREATE TYPE statut_visite    AS ENUM ('prevue', 'faite', 'absent', 'annulee');
CREATE TYPE preuve_visite    AS ENUM ('qr', 'gps');
CREATE TYPE avis_visite      AS ENUM ('satisfait', 'pas_satisfait');
CREATE TYPE statut_credit    AS ENUM ('disponible', 'utilise', 'expire');

CREATE TYPE statut_candidature AS ENUM ('envoyee', 'retenue', 'non_retenue', 'bail_signe', 'payee');
CREATE TYPE statut_bail        AS ENUM ('a_signer', 'signe', 'paye', 'annule');

CREATE TYPE type_paiement   AS ENUM ('commission', 'loyer', 'remboursement');
CREATE TYPE moyen_paiement  AS ENUM ('mtn_momo', 'moov_money', 'celtiis_cash', 'carte', 'especes');
CREATE TYPE statut_paiement AS ENUM ('en_attente', 'recu', 'echoue', 'rembourse');

CREATE TYPE statut_signalement AS ENUM ('nouveau', 'en_cours', 'resolu', 'rejete');
CREATE TYPE statut_envoi       AS ENUM ('en_attente', 'envoye', 'echec');
CREATE TYPE type_contenu       AS ENUM ('page', 'faq', 'conseil', 'banniere');
CREATE TYPE statut_publication AS ENUM ('brouillon', 'publie', 'archive');
CREATE TYPE categorie_motif    AS ENUM ('refus', 'correction', 'visite', 'signalement');

-- ----------------------------------------------------------------------------
-- Utilitaires
-- ----------------------------------------------------------------------------
CREATE FUNCTION touch_maj_le() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.maj_le := now();
  RETURN NEW;
END $$;

-- Séquences des références lisibles (XT-0415, SG-4127, XT-R-2026-104233)
CREATE SEQUENCE seq_annonce_ref     START 1000;
CREATE SEQUENCE seq_signalement_num START 5000;
CREATE SEQUENCE seq_recu_num        START 100000;

-- ----------------------------------------------------------------------------
-- Géographie (zones de lancement : Cotonou, puis Abomey-Calavi et Porto-Novo)
-- ----------------------------------------------------------------------------
CREATE TABLE villes (
  id    smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nom   text NOT NULL UNIQUE,
  slug  text NOT NULL UNIQUE,
  actif boolean NOT NULL DEFAULT true
);

CREATE TABLE quartiers (
  id       integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ville_id smallint NOT NULL REFERENCES villes(id),
  nom      text NOT NULL,
  slug     text NOT NULL,
  actif    boolean NOT NULL DEFAULT true,
  UNIQUE (ville_id, slug)
);

-- ----------------------------------------------------------------------------
-- Comptes : utilisateurs (locataires / propriétaires) et équipe de l'agence
-- ----------------------------------------------------------------------------
CREATE TABLE utilisateurs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tel                text NOT NULL UNIQUE CHECK (tel ~ '^[0-9]{8,15}$'),  -- chiffres seuls, format international sans « + »
  nom                text NOT NULL,
  email              citext,
  roles              role_utilisateur[] NOT NULL DEFAULT '{locataire}' CHECK (cardinality(roles) >= 1),
  profession         text,
  revenus_tranche    text,                                  -- déclaratif (LOC-08)
  photo_cle          text,
  langue             text NOT NULL DEFAULT 'fr' CHECK (langue IN ('fr', 'fon', 'yo')),
  pin_hash           text,                                  -- AUT-02 (argon2/bcrypt, jamais en clair)
  identite           statut_identite NOT NULL DEFAULT 'non_demandee',
  statut             statut_compte NOT NULL DEFAULT 'actif',
  motif_suspension   text,
  consentement_identite_le timestamptz,                     -- 15 : consentement explicite pièces d'identité
  cree_le            timestamptz NOT NULL DEFAULT now(),
  maj_le             timestamptz NOT NULL DEFAULT now(),
  supprime_le        timestamptz                            -- droit de suppression (15)
);
CREATE TRIGGER trg_utilisateurs_maj BEFORE UPDATE ON utilisateurs
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

CREATE TABLE codes_otp (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tel         text NOT NULL,
  code_hash   text NOT NULL,
  expire_le   timestamptz NOT NULL,
  tentatives  smallint NOT NULL DEFAULT 0,
  consomme_le timestamptz,
  cree_le     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_tel ON codes_otp (tel, cree_le DESC);

CREATE TABLE membres_agence (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom            text NOT NULL,
  tel            text NOT NULL UNIQUE CHECK (tel ~ '^[0-9]{8,15}$'),
  email          citext UNIQUE,
  role           role_agence NOT NULL,
  statut         statut_membre NOT NULL DEFAULT 'invite',
  cree_le        timestamptz NOT NULL DEFAULT now(),
  maj_le         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_membres_maj BEFORE UPDATE ON membres_agence
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- Un nouvel envoi rend l'ancien lien inutilisable : on ne garde que le hash du jeton.
CREATE TABLE invitations_membre (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id   uuid NOT NULL REFERENCES membres_agence(id) ON DELETE CASCADE,
  jeton_hash  text NOT NULL UNIQUE,
  canaux      canal_message[] NOT NULL DEFAULT '{sms}',
  invite_par  uuid REFERENCES membres_agence(id),
  envoye_le   timestamptz NOT NULL DEFAULT now(),
  expire_le   timestamptz NOT NULL,
  utilise_le  timestamptz,
  annule_le   timestamptz
);
CREATE INDEX idx_invitations_membre ON invitations_membre (membre_id);

-- Sessions des deux mondes (site/app et back-office). Exactement un des deux porteurs.
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jeton_hash   text NOT NULL UNIQUE,
  utilisateur_id uuid REFERENCES utilisateurs(id) ON DELETE CASCADE,
  membre_id    uuid REFERENCES membres_agence(id) ON DELETE CASCADE,
  appareil     text,
  cree_le      timestamptz NOT NULL DEFAULT now(),
  expire_le    timestamptz NOT NULL,
  revoquee_le  timestamptz,
  CHECK ((utilisateur_id IS NULL) <> (membre_id IS NULL))
);
CREATE INDEX idx_sessions_utilisateur ON sessions (utilisateur_id) WHERE utilisateur_id IS NOT NULL;
CREATE INDEX idx_sessions_membre      ON sessions (membre_id)      WHERE membre_id IS NOT NULL;

-- Mandat d'un gestionnaire pour le compte d'un propriétaire (acteur « Gestionnaire mandaté »)
CREATE TABLE mandats (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietaire_id uuid NOT NULL REFERENCES utilisateurs(id),
  gestionnaire_id uuid NOT NULL REFERENCES utilisateurs(id),
  document_id    uuid,                                      -- FK ajoutée après la table documents
  debut_le       date NOT NULL DEFAULT current_date,
  fin_le         date,
  CHECK (proprietaire_id <> gestionnaire_id)
);

-- ----------------------------------------------------------------------------
-- Biens et annonces
-- ----------------------------------------------------------------------------
CREATE TABLE equipements (
  code    text PRIMARY KEY,           -- 'eau', 'electricite', 'cloture', ... (6.7)
  libelle text NOT NULL,
  ordre   smallint NOT NULL DEFAULT 0
);

CREATE TABLE biens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proprietaire_id uuid NOT NULL REFERENCES utilisateurs(id),
  depose_par_id   uuid REFERENCES utilisateurs(id),         -- gestionnaire si différent du propriétaire
  type            type_bien NOT NULL,
  quartier_id     integer NOT NULL REFERENCES quartiers(id),
  adresse         text NOT NULL,                            -- exacte, communiquée seulement après réservation
  latitude        double precision CHECK (latitude  BETWEEN -90  AND 90),
  longitude       double precision CHECK (longitude BETWEEN -180 AND 180),
  reperes         text[] NOT NULL DEFAULT '{}',
  surface_m2      smallint CHECK (surface_m2 > 0),
  chambres        smallint NOT NULL DEFAULT 0 CHECK (chambres >= 0),
  description     text,
  regles          text[] NOT NULL DEFAULT '{}',
  cree_le         timestamptz NOT NULL DEFAULT now(),
  maj_le          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_biens_proprietaire ON biens (proprietaire_id);
CREATE INDEX idx_biens_quartier     ON biens (quartier_id);
CREATE TRIGGER trg_biens_maj BEFORE UPDATE ON biens
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

CREATE TABLE annonces (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref              text NOT NULL UNIQUE DEFAULT ('XT-' || lpad(nextval('seq_annonce_ref')::text, 4, '0')),
  slug             text NOT NULL UNIQUE,                    -- /annonce/[ref]-[titre]
  bien_id          uuid NOT NULL REFERENCES biens(id),
  titre            text NOT NULL,
  loyer            integer NOT NULL CHECK (loyer > 0),
  avance_mois      smallint NOT NULL DEFAULT 3 CHECK (avance_mois BETWEEN 0 AND 12),
  caution_mois     smallint NOT NULL DEFAULT 2 CHECK (caution_mois BETWEEN 0 AND 12),
  charges          integer NOT NULL DEFAULT 0 CHECK (charges >= 0),
  statut           statut_annonce NOT NULL DEFAULT 'brouillon',
  -- Étude de 48 h (5.1) : le compte à rebours est suspendu pendant les corrections.
  soumise_le       timestamptz,
  pause_le         timestamptz,
  pause_cumulee    interval NOT NULL DEFAULT '0',
  motif            text,                                    -- motif du refus ou de la correction demandée
  pre_controle     jsonb NOT NULL DEFAULT '{}',             -- BO-04 : photos nettes, champs complets, doublons
  agent_etude_id   uuid REFERENCES membres_agence(id),
  agent_terrain_id uuid REFERENCES membres_agence(id),
  controle_planifie_le timestamptz,
  verifie_le       timestamptz,                             -- badge « Vérifié sur place » + date du contrôle
  publiee_le       timestamptz,
  disponible_le    date,                                    -- « Bientôt disponible le JJ/MM »
  mise_en_avant    boolean NOT NULL DEFAULT false,          -- V2 : « Annonce mise en avant »
  certification_photos_le timestamptz,                      -- certification sur l'honneur (5.2)
  version          integer NOT NULL DEFAULT 1,
  vues             integer NOT NULL DEFAULT 0,
  cree_le          timestamptz NOT NULL DEFAULT now(),
  maj_le           timestamptz NOT NULL DEFAULT now(),
  -- Une annonce visible a forcément été publiée ; « Vérifié » suppose un contrôle daté.
  CHECK (statut NOT IN ('en_ligne', 'reservee') OR publiee_le IS NOT NULL),
  CHECK (statut NOT IN ('refusee', 'a_corriger') OR motif IS NOT NULL)   -- motif obligatoire (5.1)
);
CREATE INDEX idx_annonces_statut   ON annonces (statut, soumise_le);
CREATE INDEX idx_annonces_bien     ON annonces (bien_id);
CREATE INDEX idx_annonces_publiees ON annonces (publiee_le DESC) WHERE statut IN ('en_ligne', 'reservee', 'louee', 'liberee');
CREATE INDEX idx_annonces_terrain  ON annonces (agent_terrain_id) WHERE statut = 'controle';
CREATE TRIGGER trg_annonces_maj BEFORE UPDATE ON annonces
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

CREATE TABLE annonce_equipements (
  annonce_id uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  equipement text NOT NULL REFERENCES equipements(code),
  PRIMARY KEY (annonce_id, equipement)
);

-- Documents : identité (utilisateur) et propriété/mandat (rattachés à une annonce)
CREATE TABLE documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  annonce_id     uuid REFERENCES annonces(id) ON DELETE SET NULL,
  type           type_document NOT NULL,
  fichier_cle    text NOT NULL,                             -- clé du stockage objet chiffré, jamais de binaire en base
  statut         statut_validation NOT NULL DEFAULT 'en_attente',
  valide_par     uuid REFERENCES membres_agence(id),
  motif          text,
  cree_le        timestamptz NOT NULL DEFAULT now(),
  expire_conservation_le date                               -- durée de conservation définie (15)
);
CREATE INDEX idx_documents_utilisateur ON documents (utilisateur_id);
CREATE INDEX idx_documents_annonce     ON documents (annonce_id);
ALTER TABLE mandats ADD CONSTRAINT mandats_document_fk FOREIGN KEY (document_id) REFERENCES documents(id);

-- Médias : photos/vidéo d'annonce, ou photos de contrôle terrain (controle_id renseigné)
CREATE TABLE controles_terrain (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id    uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  agent_id      uuid NOT NULL REFERENCES membres_agence(id),
  planifie_le   timestamptz,
  realise_le    timestamptz,
  conforme      boolean,
  checklist     jsonb NOT NULL DEFAULT '{}',                -- photos conformes, GPS, état général
  compteur_eau  text,
  compteur_elec text,
  latitude      double precision,
  longitude     double precision,
  note          text,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  CHECK (realise_le IS NULL OR conforme IS NOT NULL)
);
CREATE INDEX idx_controles_annonce ON controles_terrain (annonce_id);
CREATE INDEX idx_controles_agent   ON controles_terrain (agent_id, planifie_le);

CREATE TABLE medias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id    uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  controle_id   uuid REFERENCES controles_terrain(id) ON DELETE SET NULL,
  type          type_media NOT NULL DEFAULT 'photo',
  cle_webp      text NOT NULL,                              -- version compressée servie par le CDN
  cle_originale text,                                       -- original conservé pour le contrôle (6.9)
  ordre         smallint NOT NULL DEFAULT 0,
  legende       text,                                       -- « Façade et entrée », sert aussi de texte alternatif
  largeur_px    integer,
  hauteur_px    integer,
  empreinte     text,                                       -- hash perceptuel : détection de doublons (BO-04)
  prise_le      timestamptz,
  latitude      double precision,
  longitude     double precision,
  statut_controle statut_validation NOT NULL DEFAULT 'en_attente',
  cree_le       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_medias_annonce    ON medias (annonce_id, ordre);
CREATE INDEX idx_medias_empreinte  ON medias (empreinte) WHERE empreinte IS NOT NULL;
CREATE UNIQUE INDEX uq_medias_ordre ON medias (annonce_id, ordre) WHERE controle_id IS NULL;

CREATE TABLE decisions_etude (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id  uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  agent_id    uuid NOT NULL REFERENCES membres_agence(id),
  decision    decision_etude NOT NULL,
  motif       text,
  checklist   jsonb NOT NULL DEFAULT '{}',
  cree_le     timestamptz NOT NULL DEFAULT now(),
  CHECK (decision = 'valider' OR motif IS NOT NULL)         -- motif obligatoire pour refuser/corriger
);
CREATE INDEX idx_decisions_annonce ON decisions_etude (annonce_id, cree_le DESC);

-- ----------------------------------------------------------------------------
-- Visites
-- ----------------------------------------------------------------------------
CREATE TABLE creneaux_visite (                               -- PRO-05 : disponibilités du propriétaire
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  debut_le   timestamptz NOT NULL,
  fin_le     timestamptz NOT NULL,
  CHECK (fin_le > debut_le),
  UNIQUE (annonce_id, debut_le)
);

CREATE TABLE visites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id    uuid NOT NULL REFERENCES annonces(id),
  locataire_id  uuid NOT NULL REFERENCES utilisateurs(id),
  agent_id      uuid REFERENCES membres_agence(id),
  creneau_le    timestamptz NOT NULL,
  statut        statut_visite NOT NULL DEFAULT 'prevue',
  code_visite   char(4) NOT NULL DEFAULT lpad((floor(random() * 10000))::int::text, 4, '0'),
  preuve        preuve_visite,
  preuve_lat    double precision,
  preuve_lng    double precision,
  preuve_le     timestamptz,
  avis          avis_visite,
  motif_avis    text,
  annulee_le    timestamptz,
  cree_le       timestamptz NOT NULL DEFAULT now(),
  maj_le        timestamptz NOT NULL DEFAULT now(),
  CHECK (avis IS NULL OR statut = 'faite'),
  CHECK (avis IS DISTINCT FROM 'pas_satisfait' OR motif_avis IS NOT NULL)  -- 5.3 : motif obligatoire
);
-- 5.3 : une seule visite par bien et par locataire (les visites annulées ne comptent pas)
CREATE UNIQUE INDEX uq_visite_locataire_annonce ON visites (annonce_id, locataire_id) WHERE statut <> 'annulee';
CREATE INDEX idx_visites_locataire ON visites (locataire_id, creneau_le DESC);
CREATE INDEX idx_visites_agent     ON visites (agent_id, creneau_le);
CREATE INDEX idx_visites_annonce   ON visites (annonce_id, creneau_le);
CREATE TRIGGER trg_visites_maj BEFORE UPDATE ON visites
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- « Pas satisfait » crédite une visite gratuite (4.1, 5.3)
CREATE TABLE credits_visite (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  locataire_id     uuid NOT NULL REFERENCES utilisateurs(id),
  visite_origine_id uuid REFERENCES visites(id),
  visite_utilisee_id uuid REFERENCES visites(id),
  statut           statut_credit NOT NULL DEFAULT 'disponible',
  cree_le          timestamptz NOT NULL DEFAULT now(),
  CHECK ((statut = 'utilise') = (visite_utilisee_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_credit_par_visite ON credits_visite (visite_origine_id) WHERE visite_origine_id IS NOT NULL;
CREATE INDEX idx_credits_locataire ON credits_visite (locataire_id, statut);

-- ----------------------------------------------------------------------------
-- Candidatures, baux, paiements, reçus
-- ----------------------------------------------------------------------------
CREATE TABLE candidatures (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id   uuid NOT NULL REFERENCES annonces(id),
  locataire_id uuid NOT NULL REFERENCES utilisateurs(id),
  statut       statut_candidature NOT NULL DEFAULT 'envoyee',
  profession   text,
  revenus_tranche text,
  cree_le      timestamptz NOT NULL DEFAULT now(),
  maj_le       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (annonce_id, locataire_id)
);
CREATE INDEX idx_candidatures_locataire ON candidatures (locataire_id);
CREATE TRIGGER trg_candidatures_maj BEFORE UPDATE ON candidatures
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

CREATE TABLE baux (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id       uuid NOT NULL REFERENCES annonces(id),
  candidature_id   uuid REFERENCES candidatures(id),
  locataire_id     uuid NOT NULL REFERENCES utilisateurs(id),
  proprietaire_id  uuid NOT NULL REFERENCES utilisateurs(id),
  loyer            integer NOT NULL CHECK (loyer > 0),
  avance_mois      smallint NOT NULL DEFAULT 0,
  caution_mois     smallint NOT NULL DEFAULT 0,
  commission       integer NOT NULL CHECK (commission >= 0), -- figée à la signature (taux alors en vigueur)
  statut           statut_bail NOT NULL DEFAULT 'a_signer',
  debut_le         date,
  fin_le           date,
  signe_le         timestamptz,
  signature_locataire jsonb,                                 -- {nom_saisi, ip, appareil, signe_le}
  signature_proprietaire jsonb,
  cree_le          timestamptz NOT NULL DEFAULT now(),
  maj_le           timestamptz NOT NULL DEFAULT now(),
  CHECK (statut = 'a_signer' OR signe_le IS NOT NULL OR statut = 'annule')
);
-- Un seul bail actif par annonce
CREATE UNIQUE INDEX uq_bail_actif ON baux (annonce_id) WHERE statut IN ('a_signer', 'signe', 'paye');
CREATE INDEX idx_baux_locataire    ON baux (locataire_id);
CREATE INDEX idx_baux_proprietaire ON baux (proprietaire_id);
CREATE TRIGGER trg_baux_maj BEFORE UPDATE ON baux
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

CREATE TABLE paiements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bail_id          uuid NOT NULL REFERENCES baux(id),
  type             type_paiement NOT NULL DEFAULT 'commission',
  montant          integer NOT NULL CHECK (montant > 0),
  moyen            moyen_paiement NOT NULL,
  prestataire      text,                                     -- FedaPay, KkiaPay, MTN MoMo API...
  reference_externe text,                                    -- référence de transaction du prestataire
  cle_idempotence  text NOT NULL UNIQUE,                     -- 11 : paiement idempotent
  tel_payeur       text,
  statut           statut_paiement NOT NULL DEFAULT 'en_attente',
  paiement_origine_id uuid REFERENCES paiements(id),         -- pour un remboursement
  motif            text,
  saisi_par        uuid REFERENCES membres_agence(id),       -- PAY-03 : espèces saisies par la finance
  decide_par       uuid REFERENCES membres_agence(id),       -- remboursement décidé par un responsable
  cree_le          timestamptz NOT NULL DEFAULT now(),
  confirme_le      timestamptz,
  maj_le           timestamptz NOT NULL DEFAULT now(),
  CHECK (type <> 'remboursement' OR (paiement_origine_id IS NOT NULL AND motif IS NOT NULL AND decide_par IS NOT NULL)),
  CHECK (moyen <> 'especes' OR saisi_par IS NOT NULL)
);
CREATE UNIQUE INDEX uq_paiement_reference ON paiements (prestataire, reference_externe) WHERE reference_externe IS NOT NULL;
CREATE INDEX idx_paiements_bail   ON paiements (bail_id);
CREATE INDEX idx_paiements_statut ON paiements (statut, cree_le DESC);
CREATE TRIGGER trg_paiements_maj BEFORE UPDATE ON paiements
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

CREATE TABLE recus (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id uuid NOT NULL UNIQUE REFERENCES paiements(id),
  numero      text NOT NULL UNIQUE DEFAULT ('XT-R-' || extract(year FROM now())::int || '-' || nextval('seq_recu_num')),
  fichier_cle text,                                          -- PDF A4 / ticket dans le stockage objet
  emis_le     timestamptz NOT NULL DEFAULT now()
);

-- Notifications du prestataire de paiement, conservées brutes pour la réconciliation (PAY-07)
CREATE TABLE webhooks_paiement (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prestataire text NOT NULL,
  evenement   text,
  reference_externe text,
  charge      jsonb NOT NULL,
  signature_valide boolean,
  recu_le     timestamptz NOT NULL DEFAULT now(),
  traite_le   timestamptz,
  erreur      text
);
CREATE INDEX idx_webhooks_reference ON webhooks_paiement (prestataire, reference_externe);
CREATE INDEX idx_webhooks_a_traiter ON webhooks_paiement (recu_le) WHERE traite_le IS NULL;

-- ----------------------------------------------------------------------------
-- Engagement locataire : favoris, alertes, liste d'attente
-- ----------------------------------------------------------------------------
CREATE TABLE favoris (
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  annonce_id     uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  cree_le        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (utilisateur_id, annonce_id)
);

CREATE TABLE alertes_recherche (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  quartier_id    integer REFERENCES quartiers(id),
  type           type_bien,
  budget_max     integer CHECK (budget_max > 0),
  canal          canal_message NOT NULL DEFAULT 'sms' CHECK (canal IN ('sms', 'whatsapp')),
  actif          boolean NOT NULL DEFAULT true,
  cree_le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_alertes_actives ON alertes_recherche (quartier_id, type) WHERE actif;

CREATE TABLE liste_attente (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  annonce_id     uuid NOT NULL REFERENCES annonces(id) ON DELETE CASCADE,
  utilisateur_id uuid NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
  canal          canal_message NOT NULL DEFAULT 'sms',
  notifie_j30_le timestamptz,
  notifie_j7_le  timestamptz,
  cree_le        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (annonce_id, utilisateur_id)
);

-- ----------------------------------------------------------------------------
-- Support : signalements
-- ----------------------------------------------------------------------------
CREATE TABLE signalements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero      text NOT NULL UNIQUE DEFAULT ('SG-' || nextval('seq_signalement_num')),
  annonce_id  uuid REFERENCES annonces(id) ON DELETE SET NULL,
  auteur_id   uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  tel         text,                                          -- signalement possible sans compte
  motif       text NOT NULL,
  detail      text NOT NULL DEFAULT '',
  statut      statut_signalement NOT NULL DEFAULT 'nouveau',
  assigne_a   uuid REFERENCES membres_agence(id),
  decision    text,
  cree_le     timestamptz NOT NULL DEFAULT now(),
  maj_le      timestamptz NOT NULL DEFAULT now(),
  CHECK (statut NOT IN ('resolu', 'rejete') OR decision IS NOT NULL)
);
CREATE INDEX idx_signalements_statut  ON signalements (statut, cree_le DESC);
CREATE INDEX idx_signalements_annonce ON signalements (annonce_id);
CREATE TRIGGER trg_signalements_maj BEFORE UPDATE ON signalements
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- ----------------------------------------------------------------------------
-- Messages et contenus gérés depuis le back-office (BO-14, BO-15, WEB-07)
-- ----------------------------------------------------------------------------
CREATE TABLE modeles_message (
  id      text PRIMARY KEY,                                  -- 'visite-confirmee', 'invitation-sms', ...
  nom     text NOT NULL,
  canal   canal_message NOT NULL,
  texte   text NOT NULL,                                     -- variables {prenom}, {ref}, {montant}...
  maj_le  timestamptz NOT NULL DEFAULT now(),
  maj_par uuid REFERENCES membres_agence(id)
);

CREATE TABLE notifications (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id uuid REFERENCES utilisateurs(id) ON DELETE SET NULL,
  membre_id      uuid REFERENCES membres_agence(id) ON DELETE SET NULL,
  tel            text,
  canal          canal_message NOT NULL,
  modele_id      text REFERENCES modeles_message(id),
  contenu        text NOT NULL,                              -- texte réellement envoyé
  statut         statut_envoi NOT NULL DEFAULT 'en_attente',
  erreur         text,
  planifie_le    timestamptz NOT NULL DEFAULT now(),         -- rappels J-30, J-7, 2 h avant visite
  envoye_le      timestamptz,
  cree_le        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_a_envoyer ON notifications (planifie_le) WHERE statut = 'en_attente';
CREATE INDEX idx_notifications_utilisateur ON notifications (utilisateur_id, cree_le DESC);

CREATE TABLE contenus_editoriaux (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type        type_contenu NOT NULL,
  slug        text NOT NULL,
  theme       text,                                          -- thème de FAQ (« chercher », « payer »...)
  titre       text NOT NULL,                                 -- titre de page, ou question pour une FAQ
  texte       text NOT NULL,                                 -- corps, ou réponse
  langue      text NOT NULL DEFAULT 'fr' CHECK (langue IN ('fr', 'fon', 'yo')),
  ordre       smallint NOT NULL DEFAULT 0,
  statut      statut_publication NOT NULL DEFAULT 'brouillon',
  maj_le      timestamptz NOT NULL DEFAULT now(),
  maj_par     uuid REFERENCES membres_agence(id),
  UNIQUE (type, slug, langue)
);
CREATE INDEX idx_contenus_publies ON contenus_editoriaux (type, theme, ordre) WHERE statut = 'publie';
CREATE TRIGGER trg_contenus_maj BEFORE UPDATE ON contenus_editoriaux
  FOR EACH ROW EXECUTE FUNCTION touch_maj_le();

-- ----------------------------------------------------------------------------
-- Paramétrage (4.1, BO-09) : modifiable sans nouveau développement
-- ----------------------------------------------------------------------------
CREATE TABLE parametres (
  cle     text PRIMARY KEY,
  valeur  jsonb NOT NULL,
  note    text,
  maj_le  timestamptz NOT NULL DEFAULT now(),
  maj_par uuid REFERENCES membres_agence(id)
);

CREATE TABLE motifs (
  id        integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  categorie categorie_motif NOT NULL,
  libelle   text NOT NULL,
  ordre     smallint NOT NULL DEFAULT 0,
  actif     boolean NOT NULL DEFAULT true,
  UNIQUE (categorie, libelle)
);

-- ----------------------------------------------------------------------------
-- Journal d'audit (BO-12) : en ajout seul, aucune modification ni suppression
-- ----------------------------------------------------------------------------
CREATE TABLE journal_audit (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cree_le     timestamptz NOT NULL DEFAULT now(),
  membre_id   uuid REFERENCES membres_agence(id),
  auteur      text NOT NULL DEFAULT 'Système',               -- nom figé au moment de l'action
  role        text NOT NULL DEFAULT 'Système',
  action      text NOT NULL,
  cible       text NOT NULL,
  details     jsonb
);
CREATE INDEX idx_journal_date   ON journal_audit (cree_le DESC);
CREATE INDEX idx_journal_membre ON journal_audit (membre_id, cree_le DESC);

CREATE FUNCTION journal_en_ajout_seul() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'journal_audit est en ajout seul (% interdit)', TG_OP;
END $$;
CREATE TRIGGER trg_journal_immuable BEFORE UPDATE OR DELETE ON journal_audit
  FOR EACH ROW EXECUTE FUNCTION journal_en_ajout_seul();
CREATE TRIGGER trg_journal_truncate BEFORE TRUNCATE ON journal_audit
  FOR EACH STATEMENT EXECUTE FUNCTION journal_en_ajout_seul();
