-- ============================================================================
-- 003 : compléments nécessaires à l'API
-- ============================================================================

-- Rôle actuellement utilisé (AUT-03 : un utilisateur peut être locataire ET propriétaire)
ALTER TABLE utilisateurs ADD COLUMN role_actif role_utilisateur;
UPDATE utilisateurs SET role_actif = roles[1] WHERE role_actif IS NULL;
ALTER TABLE utilisateurs ALTER COLUMN role_actif SET NOT NULL;
ALTER TABLE utilisateurs ALTER COLUMN role_actif SET DEFAULT 'locataire';
ALTER TABLE utilisateurs ADD CONSTRAINT utilisateurs_role_actif_ok CHECK (role_actif = ANY (roles));

-- Cases cochées par l'agent d'étude pendant la validation (BO-02)
ALTER TABLE annonces ADD COLUMN checklist jsonb NOT NULL DEFAULT '{}';

-- Annonce déposée par un gestionnaire mandaté (acteur « Gestionnaire », chapitre 3)
ALTER TABLE biens ADD COLUMN gestionnaire boolean NOT NULL DEFAULT false;

-- Titre du thème de FAQ (le thème lui-même est identifié par « theme »)
ALTER TABLE contenus_editoriaux ADD COLUMN theme_titre text;

-- Évite d'envoyer deux fois le même rappel (J-30, J-7, 2 h avant visite…)
ALTER TABLE notifications ADD COLUMN cle_dedup text UNIQUE;

-- Numéro à alerter pour une alerte de recherche (peut différer du compte)
ALTER TABLE alertes_recherche ADD COLUMN tel text;

-- Fichiers : le propriétaire d'un document / média est connu par préfixe de clé (u/<id>/…)
ALTER TABLE documents ADD COLUMN nom_origine text;
ALTER TABLE documents ADD COLUMN type_mime text;

-- Réservation de commission : un seul paiement de commission « vivant » par bail
CREATE UNIQUE INDEX uq_paiement_commission_vivant ON paiements (bail_id)
  WHERE type = 'commission' AND statut IN ('en_attente', 'recu');

-- Nettoyage : sessions expirées et OTP anciens
CREATE FUNCTION nettoyer_expires() RETURNS void LANGUAGE sql AS $$
  DELETE FROM sessions  WHERE expire_le < now() - interval '1 day' OR revoquee_le < now() - interval '1 day';
  DELETE FROM codes_otp WHERE cree_le < now() - interval '1 day';
$$;
