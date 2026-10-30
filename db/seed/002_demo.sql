-- Données de démonstration (DEV UNIQUEMENT) : générées par db/generate-seed.mjs.
-- Ne jamais charger en production : numéros et noms fictifs.
BEGIN;

INSERT INTO membres_agence (nom, tel, email, role, statut) VALUES
  ('Clarisse Ahouandjinou', '0161000001', 'clarisse@xwetche.bj', 'admin', 'actif'),
  ('Fabrice Dossa', '0161000002', 'fabrice@xwetche.bj', 'etude', 'actif'),
  ('Nadège Kpadonou', '0161000003', 'nadege@xwetche.bj', 'etude', 'actif'),
  ('Serge Houngbo', '0161000004', 'serge@xwetche.bj', 'terrain', 'actif'),
  ('Rachidatou Bello', '0161000005', 'rachidatou@xwetche.bj', 'terrain', 'actif'),
  ('Brice Tossou', '0161000006', 'brice@xwetche.bj', 'finance', 'actif'),
  ('Mireille Zinsou', '0161000007', 'mireille@xwetche.bj', 'support', 'actif')
ON CONFLICT (tel) DO NOTHING;

INSERT INTO utilisateurs (tel, nom, roles, role_actif, identite) VALUES
  ('0166554433', 'Koffi Agbo', '{proprietaire}', 'proprietaire', 'verifiee'),
  ('0197123456', 'Awa Dossou', '{locataire}', 'locataire', 'verifiee')
ON CONFLICT (tel) DO NOTHING;

-- XT-0412 · Chambre-salon carrelée, cour fermée
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'chambre-salon',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'fidjrosse' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Fidjrossè', '{"Face pharmacie Fidjrossè Plage","200 m de la route des Pêches"}', 32, 1, 'Chambre-salon au rez-de-chaussée d''une maison de 4 logements. Carrelage récent, plafond posé, douche et toilettes internes. Eau et électricité au compteur individuel. Cour fermée avec portail, place pour une moto.', '{"Pas d''animaux","Visites du lundi au samedi","Locataire seul ou couple"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0412', 'xt-0412-chambre-salon-fidjrosse', nb.id, 'Chambre-salon carrelée, cour fermée', 45000, 3, 1, 0, 'en_ligne', now() - interval '5 days', now() - interval '1 days', '2026-11-12', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['eau', 'electricite', 'cloture', 'parking-moto', 'douche-interne', 'carrelage', 'plafond']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade et entrée', 'Pièce principale', 'Chambre', 'Cuisine', 'Douche et toilettes', 'Cour', 'Repère proche']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0412'
ON CONFLICT DO NOTHING;

-- XT-0398 · Appartement 2 chambres climatisé
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'appartement',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'haie-vive' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Haie Vive', '{"Derrière l''église Saint-Michel","Rue des ambassades"}', 85, 2, 'Appartement au 1er étage, deux chambres climatisées avec placards, salon lumineux, cuisine équipée. Groupe électrogène pour les parties communes, gardien de jour et de nuit.', '{"Pas de fête après 22 h","Charges : gardiennage et entretien"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0398', 'xt-0398-appartement-haie-vive', nb.id, 'Appartement 2 chambres climatisé', 180000, 3, 2, 15000, 'en_ligne', now() - interval '5 days', now() - interval '2 days', '2026-11-10', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['eau', 'electricite', 'cloture', 'parking-voiture', 'climatisation', 'cuisine', 'douche-interne', 'groupe', 'gardien']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade et entrée', 'Pièce principale', 'Chambre', 'Cuisine', 'Douche et toilettes', 'Cour', 'Repère proche', 'Salon', 'Balcon']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0398'
ON CONFLICT DO NOTHING;

-- XT-0405 · Entrée-couchée propre, proche marché
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'entree-couchee',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'akpakpa' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Akpakpa', '{"Carrefour Sègbèya","À côté de la boulangerie Le Bon Pain"}', 16, 0, 'Entrée-couchée dans une cour commune de 6 logements. Douche et toilettes communes, entretenues. Compteur d''eau partagé, électricité au compteur individuel.', '{"Locataire seul","Pas de commerce dans la cour"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0405', 'xt-0405-entree-couchee-akpakpa', nb.id, 'Entrée-couchée propre, proche marché', 20000, 3, 1, 0, 'en_ligne', now() - interval '5 days', now() - interval '1 days', '2026-11-11', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['eau', 'electricite', 'cloture', 'carrelage', 'ventilateur']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade et entrée', 'Pièce principale', 'Chambre', 'Cuisine', 'Douche et toilettes', 'Cour']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0405'
ON CONFLICT DO NOTHING;

-- XT-0377 · Studio meublé avec climatisation
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'studio',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'cadjehoun' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Cadjèhoun', '{"Près de l''aéroport","Rue du supermarché Erevan"}', 30, 1, 'Studio entièrement meublé : lit double, armoire, coin cuisine équipé, climatisation. Idéal pour un jeune actif. Internet non inclus.', '{"Pas d''animaux","Locataire seul"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0377', 'xt-0377-studio-meuble-cadjehoun', nb.id, 'Studio meublé avec climatisation', 95000, 2, 1, 5000, 'reservee', now() - interval '5 days', now() - interval '6 days', '2026-11-04', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['eau', 'electricite', 'meuble', 'climatisation', 'cuisine', 'douche-interne', 'cloture', 'parking-moto']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade et entrée', 'Pièce principale', 'Chambre', 'Cuisine', 'Douche et toilettes', 'Cour', 'Repère proche']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0377'
ON CONFLICT DO NOTHING;

-- XT-0390 · Maison 3 chambres avec cour
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'maison',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'agla' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Agla', '{"Agla Hlazounto, après le collège","Église des Assemblées de Dieu"}', 140, 3, 'Maison individuelle de 3 chambres dont une avec douche interne, salon, cuisine, grande cour fermée avec forage. Place pour deux voitures.', '{"Bail d''un an minimum","Famille de préférence"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0390', 'xt-0390-maison-agla', nb.id, 'Maison 3 chambres avec cour', 150000, 3, 2, 0, 'en_ligne', now() - interval '5 days', now() - interval '3 days', '2026-11-09', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['eau', 'electricite', 'cloture', 'parking-voiture', 'cuisine', 'douche-interne', 'forage', 'carrelage', 'plafond']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade et entrée', 'Pièce principale', 'Chambre', 'Cuisine', 'Douche et toilettes', 'Cour', 'Repère proche', 'Chambre 2', 'Chambre 3']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0390'
ON CONFLICT DO NOTHING;

-- XT-0366 · Chambre-salon à l'étage
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'chambre-salon',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'gbegamey' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Gbégamey', '{"Derrière le stade de l''Amitié","Pharmacie Gbégamey"}', 28, 1, 'Chambre-salon au premier étage, bien ventilée, douche interne. Le locataire actuel part fin novembre.', '{"Pas d''animaux"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0366', 'xt-0366-chambre-salon-gbegamey', nb.id, 'Chambre-salon à l''étage', 40000, 3, 1, 0, 'louee', now() - interval '5 days', now() - interval '9 days', '2026-11-02', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['eau', 'electricite', 'cloture', 'douche-interne', 'carrelage']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade et entrée', 'Pièce principale', 'Chambre', 'Cuisine', 'Douche et toilettes', 'Cour']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0366'
ON CONFLICT DO NOTHING;

-- XT-0401 · Appartement 3 chambres, résidence calme
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'appartement',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'zogbo' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Zogbo', '{"Zogbo, von après le carrefour Vêdoko","Station Total"}', 110, 3, 'Appartement au rez-de-chaussée d''une résidence de 4 logements. Trois chambres, deux douches, salon et salle à manger. Gardien la nuit.', '{"Bail d''un an minimum"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0401', 'xt-0401-appartement-zogbo', nb.id, 'Appartement 3 chambres, résidence calme', 120000, 3, 1, 10000, 'en_ligne', now() - interval '5 days', now() - interval '2 days', '2026-11-11', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['eau', 'electricite', 'cloture', 'parking-voiture', 'cuisine', 'douche-interne', 'carrelage', 'plafond', 'gardien']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade et entrée', 'Pièce principale', 'Chambre', 'Cuisine', 'Douche et toilettes', 'Cour', 'Repère proche', 'Chambre 2', 'Salon']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0401'
ON CONFLICT DO NOTHING;

-- XT-0388 · Boutique en bord de voie pavée
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'boutique',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'missebo' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Missèbo', '{"À 300 m du marché Dantokpa","Face au pressing Le Blanc"}', 20, 0, 'Boutique de 20 m² avec rideau métallique, en bord de voie pavée très passante.', '{"Pas de restauration","Activité à déclarer au propriétaire"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0388', 'xt-0388-boutique-dantokpa', nb.id, 'Boutique en bord de voie pavée', 60000, 6, 1, 0, 'en_ligne', now() - interval '5 days', now() - interval '4 days', '2026-11-07', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['electricite', 'carrelage']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade', 'Intérieur', 'Rideau métallique', 'Voie', 'Repère proche', 'Compteur']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0388'
ON CONFLICT DO NOTHING;

-- XT-0409 · Studio neuf à 5 minutes de la plage
WITH nb AS (
  INSERT INTO biens (proprietaire_id, type, quartier_id, adresse, reperes, surface_m2, chambres, description, regles)
  VALUES ((SELECT id FROM utilisateurs WHERE tel = '0166554433'), 'studio',
    (SELECT qu.id FROM quartiers qu JOIN villes v ON v.id = qu.ville_id WHERE qu.slug = 'fidjrosse' AND v.nom = 'Cotonou'),
    'Adresse exacte (démo) — Fidjrossè', '{"Fidjrossè Kpota","Église catholique Sainte-Rita"}', 26, 1, 'Studio neuf avec coin cuisine, douche interne, plafond et ventilateur. Maison récente de 3 logements.', '{"Pas d''animaux","Locataire seul ou couple"}')
  RETURNING id
), na AS (
  INSERT INTO annonces (ref, slug, bien_id, titre, loyer, avance_mois, caution_mois, charges, statut, soumise_le, publiee_le, verifie_le, agent_terrain_id)
  SELECT 'XT-0409', 'xt-0409-studio-fidjrosse', nb.id, 'Studio neuf à 5 minutes de la plage', 60000, 3, 1, 0, 'en_ligne', now() - interval '5 days', now() - interval '1 days', '2026-11-12', (SELECT id FROM membres_agence WHERE tel = '0161000004') FROM nb
  ON CONFLICT (ref) DO NOTHING RETURNING id
)
INSERT INTO annonce_equipements (annonce_id, equipement) SELECT na.id, e FROM na, unnest(ARRAY['eau', 'electricite', 'cloture', 'parking-moto', 'douche-interne', 'cuisine', 'carrelage', 'plafond', 'ventilateur']) AS e;

INSERT INTO medias (annonce_id, cle_webp, ordre, legende, largeur_px, hauteur_px)
SELECT id, 'demo/' || ref || '/' || n || '.webp', n, l, 1280, 960 FROM annonces, unnest(ARRAY['Façade et entrée', 'Pièce principale', 'Chambre', 'Cuisine', 'Douche et toilettes', 'Cour', 'Repère proche']) WITH ORDINALITY AS t(l, n) WHERE ref = 'XT-0409'
ON CONFLICT DO NOTHING;

COMMIT;
