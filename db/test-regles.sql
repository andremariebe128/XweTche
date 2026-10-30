-- Scénario de test des règles métier (à jouer sur une base de développement)
-- les erreurs marquées « attendue » sont voulues
BEGIN;
INSERT INTO biens (proprietaire_id,type,quartier_id,adresse) SELECT u.id,'studio',q.id,'test' FROM utilisateurs u, quartiers q WHERE u.tel='0166554433' AND q.slug='agla' LIMIT 1;
INSERT INTO annonces (slug,bien_id,titre,loyer) SELECT 'test-studio-agla', id, 'Test', 60000 FROM biens WHERE adresse='test';
SELECT ref, statut FROM annonces WHERE slug='test-studio-agla';
SELECT annonce_soumettre(id) FROM annonces WHERE slug='test-studio-agla';
SELECT statut, round(etude_heures_restantes(a)) AS h FROM annonces a WHERE slug='test-studio-agla';
-- refus sans motif => erreur attendue (sous-transaction)
SAVEPOINT s1;
SELECT annonce_decider(a.id,(SELECT id FROM membres_agence WHERE tel='0161000002'),'refuser') FROM annonces a WHERE slug='test-studio-agla';
ROLLBACK TO s1;
-- correction puis re-soumission : pause cumulée
SELECT annonce_decider(a.id,(SELECT id FROM membres_agence WHERE tel='0161000002'),'corriger','Photos floues') FROM annonces a WHERE slug='test-studio-agla';
UPDATE annonces SET pause_le = now() - interval '2 hours', soumise_le = now() - interval '10 hours' WHERE slug='test-studio-agla';
SELECT annonce_soumettre(id) FROM annonces WHERE slug='test-studio-agla';
SELECT statut, round(etude_heures_restantes(a)) AS h_restantes_attendu_40 FROM annonces a WHERE slug='test-studio-agla';
-- validation, mise en ligne
SELECT annonce_decider(a.id,(SELECT id FROM membres_agence WHERE tel='0161000002'),'valider') FROM annonces a WHERE slug='test-studio-agla';
UPDATE annonces SET statut='en_ligne', publiee_le=now(), verifie_le=now() WHERE slug='test-studio-agla';
SELECT ref, commission, total_entree, statut_public FROM v_annonces_publiques WHERE slug='test-studio-agla';
-- visite + « pas satisfait » => crédit
INSERT INTO visites (annonce_id,locataire_id,creneau_le,statut) SELECT a.id,u.id,now(),'faite' FROM annonces a, utilisateurs u WHERE a.slug='test-studio-agla' AND u.tel='0197123456';
UPDATE visites SET avis='pas_satisfait', motif_avis='Prix' WHERE statut='faite' AND avis IS NULL;
SELECT visites_gratuites_disponibles(id) AS credits FROM utilisateurs WHERE tel='0197123456';
-- doublon de visite => erreur attendue
SAVEPOINT s2;
INSERT INTO visites (annonce_id,locataire_id,creneau_le) SELECT a.id,u.id,now() FROM annonces a, utilisateurs u WHERE a.slug='test-studio-agla' AND u.tel='0197123456';
ROLLBACK TO s2;
-- bail + paiement reçu => bail payé, annonce louée, reçu émis
INSERT INTO baux (annonce_id,locataire_id,proprietaire_id,loyer,commission,statut,signe_le)
 SELECT a.id,(SELECT id FROM utilisateurs WHERE tel='0197123456'),(SELECT id FROM utilisateurs WHERE tel='0166554433'),60000,calcul_commission(60000),'signe',now() FROM annonces a WHERE slug='test-studio-agla';
INSERT INTO paiements (bail_id,montant,moyen,cle_idempotence,statut) SELECT id,commission,'mtn_momo','k1','en_attente' FROM baux WHERE loyer=60000;
UPDATE paiements SET statut='recu' WHERE cle_idempotence='k1';
SELECT b.statut AS bail, a.statut AS annonce, r.numero FROM baux b JOIN annonces a ON a.id=b.annonce_id JOIN recus r ON TRUE WHERE b.loyer=60000;
-- journal immuable => erreur attendue
SAVEPOINT s3;
DELETE FROM journal_audit;
ROLLBACK TO s3;
SELECT action,cible FROM journal_audit;
SELECT * FROM v_kpi;
ROLLBACK;
