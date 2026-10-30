-- ============================================================================
-- Vues et fonctions métier : règles du cahier des charges calculées côté base
-- ============================================================================

-- Valeur d'un paramètre numérique (4.1, BO-09)
CREATE FUNCTION param_num(p_cle text) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT (valeur #>> '{}')::numeric FROM parametres WHERE cle = p_cle
$$;

-- Commission = taux × un mois de loyer, arrondie au FCFA (4.1 : ½ mois par défaut)
CREATE FUNCTION calcul_commission(p_loyer integer) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT round(p_loyer * COALESCE(param_num('commission'), 0.5))::integer
$$;

-- Heures restantes sur le délai d'étude (48 h par défaut), pause comprise (5.1)
CREATE FUNCTION etude_heures_restantes(a annonces) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN a.soumise_le IS NULL THEN NULL ELSE
    GREATEST(0,
      COALESCE(param_num('delai_etude_h'), 48)
      - extract(epoch FROM (COALESCE(a.pause_le, now()) - a.soumise_le - a.pause_cumulee)) / 3600
    ) END
$$;

-- Soumission / re-soumission : relance le compte à rebours là où il s'était arrêté
CREATE FUNCTION annonce_soumettre(p_annonce uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a annonces;
BEGIN
  SELECT * INTO a FROM annonces WHERE id = p_annonce FOR UPDATE;
  IF a.statut NOT IN ('brouillon', 'a_corriger', 'refusee') THEN
    RAISE EXCEPTION 'Une annonce « % » ne peut pas être soumise', a.statut;
  END IF;
  IF a.statut = 'a_corriger' THEN
    UPDATE annonces
       SET statut = 'soumise', motif = NULL,
           pause_cumulee = pause_cumulee + (now() - pause_le), pause_le = NULL,
           version = version + 1
     WHERE id = p_annonce;
  ELSE  -- brouillon ou nouvelle soumission après refus : nouveau délai de 48 h
    UPDATE annonces
       SET statut = 'soumise', motif = NULL, soumise_le = now(),
           pause_le = NULL, pause_cumulee = '0', version = version + 1
     WHERE id = p_annonce;
  END IF;
END $$;

-- Décision d'étude (valider / refuser / corriger) : trace, change le statut, journalise
CREATE FUNCTION annonce_decider(p_annonce uuid, p_agent uuid, p_decision decision_etude,
                                p_motif text DEFAULT NULL, p_checklist jsonb DEFAULT '{}')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE ref_ text; nom_ text; role_ text;
BEGIN
  IF p_decision <> 'valider' AND COALESCE(trim(p_motif), '') = '' THEN
    RAISE EXCEPTION 'Motif obligatoire pour refuser ou demander une correction';
  END IF;
  INSERT INTO decisions_etude (annonce_id, agent_id, decision, motif, checklist)
  VALUES (p_annonce, p_agent, p_decision, p_motif, p_checklist);

  UPDATE annonces SET
    agent_etude_id = p_agent,
    statut  = CASE p_decision WHEN 'valider' THEN 'controle'::statut_annonce
                              WHEN 'refuser' THEN 'refusee'::statut_annonce
                              ELSE 'a_corriger'::statut_annonce END,
    motif   = CASE WHEN p_decision = 'valider' THEN NULL ELSE p_motif END,
    pause_le = CASE WHEN p_decision = 'corriger' THEN now() ELSE pause_le END
  WHERE id = p_annonce
  RETURNING ref INTO ref_;

  SELECT nom, role::text INTO nom_, role_ FROM membres_agence WHERE id = p_agent;
  INSERT INTO journal_audit (membre_id, auteur, role, action, cible, details)
  VALUES (p_agent, COALESCE(nom_, 'Système'), COALESCE(role_, 'Système'),
          CASE p_decision WHEN 'valider' THEN 'Annonce validée'
                          WHEN 'refuser' THEN 'Annonce refusée'
                          ELSE 'Correction demandée' END,
          ref_ || COALESCE(' · ' || p_motif, ''),
          jsonb_build_object('annonce_id', p_annonce, 'decision', p_decision));
END $$;

-- Compteur « 2 visites gratuites disponibles » (LOC-07)
CREATE FUNCTION visites_gratuites_disponibles(p_locataire uuid) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT count(*)::int FROM credits_visite WHERE locataire_id = p_locataire AND statut = 'disponible'
$$;

-- Anti-abus (5.3) : plafond de crédits en cours, blocage après 3 absences non annulées 12 h avant
CREATE FUNCTION locataire_peut_reserver(p_locataire uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT
    visites_gratuites_disponibles(p_locataire) < COALESCE(param_num('plafond_visites_gratuites'), 5)::int
    AND (SELECT count(*) FROM visites
          WHERE locataire_id = p_locataire AND statut = 'absent') < 3
    AND EXISTS (SELECT 1 FROM utilisateurs WHERE id = p_locataire AND statut = 'actif')
$$;

-- Un avis « Pas satisfait » crédite automatiquement une visite gratuite
CREATE FUNCTION credit_apres_avis() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.avis = 'pas_satisfait' AND OLD.avis IS DISTINCT FROM 'pas_satisfait' THEN
    INSERT INTO credits_visite (locataire_id, visite_origine_id)
    VALUES (NEW.locataire_id, NEW.id)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_credit_apres_avis AFTER UPDATE OF avis ON visites
  FOR EACH ROW EXECUTE FUNCTION credit_apres_avis();

-- Paiement confirmé -> émission du reçu ; commission payée -> bail « payé » + annonce « louée » (5.1)
CREATE FUNCTION apres_paiement_recu() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.statut = 'recu' AND OLD.statut IS DISTINCT FROM 'recu' THEN
    NEW.confirme_le := COALESCE(NEW.confirme_le, now());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_paiement_confirme BEFORE UPDATE OF statut ON paiements
  FOR EACH ROW EXECUTE FUNCTION apres_paiement_recu();

CREATE FUNCTION finaliser_paiement() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_annonce uuid;
BEGIN
  IF NEW.statut = 'recu' AND (TG_OP = 'INSERT' OR OLD.statut IS DISTINCT FROM 'recu') THEN
    INSERT INTO recus (paiement_id) VALUES (NEW.id) ON CONFLICT (paiement_id) DO NOTHING;
    IF NEW.type = 'commission' THEN
      UPDATE baux SET statut = 'paye' WHERE id = NEW.bail_id RETURNING annonce_id INTO v_annonce;
      UPDATE annonces SET statut = 'louee' WHERE id = v_annonce AND statut IN ('en_ligne', 'reservee');
      UPDATE candidatures SET statut = 'payee'
       WHERE id = (SELECT candidature_id FROM baux WHERE id = NEW.bail_id);
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_paiement_final AFTER INSERT OR UPDATE OF statut ON paiements
  FOR EACH ROW EXECUTE FUNCTION finaliser_paiement();

-- ----------------------------------------------------------------------------
-- Vues de lecture
-- ----------------------------------------------------------------------------

-- Fiche d'annonce publique (7.3) : aucune coordonnée du propriétaire, adresse exacte exclue
CREATE VIEW v_annonces_publiques AS
SELECT
  a.id, a.ref, a.slug, a.titre,
  b.type, q.nom AS quartier, v.nom AS ville, v.slug AS ville_slug, q.slug AS quartier_slug,
  a.loyer, a.avance_mois, a.caution_mois, a.charges,
  calcul_commission(a.loyer) AS commission,
  a.loyer * (a.avance_mois + a.caution_mois) + calcul_commission(a.loyer) AS total_entree,
  b.chambres, b.surface_m2, b.reperes, b.description, b.regles,
  b.latitude, b.longitude,                       -- à arrondir côté API pour la « zone approximative »
  CASE a.statut
    WHEN 'en_ligne' THEN 'en-ligne'
    WHEN 'reservee' THEN 'reservee'
    ELSE 'bientot'
  END AS statut_public,
  a.disponible_le, a.verifie_le, a.mise_en_avant, a.publiee_le,
  ag.nom AS agent_verificateur,
  COALESCE((SELECT array_agg(ae.equipement ORDER BY e.ordre)
              FROM annonce_equipements ae JOIN equipements e ON e.code = ae.equipement
             WHERE ae.annonce_id = a.id), '{}') AS equipements
FROM annonces a
JOIN biens b      ON b.id = a.bien_id
JOIN quartiers q  ON q.id = b.quartier_id
JOIN villes v     ON v.id = q.ville_id
LEFT JOIN membres_agence ag ON ag.id = a.agent_terrain_id
-- Une annonce louée reste en ligne avec « Bientôt disponible » (7.4) ; les autres statuts sont invisibles.
WHERE a.statut IN ('en_ligne', 'reservee', 'louee', 'liberee');

-- File d'étude triée par urgence (BO-01)
CREATE VIEW v_file_etude AS
SELECT a.id, a.ref, a.statut, a.soumise_le, a.pause_le,
       etude_heures_restantes(a) AS heures_restantes,
       etude_heures_restantes(a) <= COALESCE(param_num('alerte_etude_h'), 12) AS urgent,
       b.type, q.nom AS quartier, a.loyer,
       u.nom AS proprietaire, u.tel AS tel_proprietaire,
       a.pre_controle,
       (SELECT count(*) FROM medias m WHERE m.annonce_id = a.id AND m.controle_id IS NULL) AS nb_photos
FROM annonces a
JOIN biens b ON b.id = a.bien_id
JOIN quartiers q ON q.id = b.quartier_id
JOIN utilisateurs u ON u.id = b.proprietaire_id
WHERE a.statut IN ('soumise', 'en_etude', 'a_corriger')
ORDER BY (a.statut = 'a_corriger'), etude_heures_restantes(a) NULLS LAST;

-- Indicateurs de pilotage (chapitre 19)
CREATE VIEW v_kpi AS
SELECT
  (SELECT count(*) FROM annonces WHERE statut = 'en_ligne')                      AS annonces_en_ligne,
  (SELECT count(*) FROM annonces WHERE statut IN ('soumise', 'en_etude'))        AS annonces_en_etude,
  (SELECT count(*) FROM annonces WHERE statut = 'a_corriger')                    AS annonces_a_corriger,
  (SELECT count(*) FROM visites WHERE statut = 'faite')                          AS visites_faites,
  (SELECT count(*) FROM visites WHERE avis = 'pas_satisfait')                    AS visites_pas_satisfait,
  (SELECT count(*) FROM baux WHERE statut = 'paye')                              AS baux_payes,
  (SELECT COALESCE(sum(montant), 0) FROM paiements
     WHERE type = 'commission' AND statut = 'recu')                              AS commissions_encaissees,
  (SELECT round(100.0 * count(*) FILTER (WHERE statut = 'echoue')
                / NULLIF(count(*), 0), 1) FROM paiements)                        AS taux_echec_paiement,
  (SELECT round(100.0 * (SELECT count(*) FROM baux WHERE statut IN ('signe', 'paye'))
                / NULLIF((SELECT count(*) FROM visites WHERE statut = 'faite'), 0), 1)) AS conversion_visite_bail;
