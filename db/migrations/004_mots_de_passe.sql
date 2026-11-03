-- ============================================================================
-- 004 : connexion par numéro + mot de passe (remplace le code OTP)
-- ============================================================================

-- Le site utilise déjà utilisateurs.pin_hash. Le back-office a besoin de la même information.
ALTER TABLE membres_agence ADD COLUMN IF NOT EXISTS mot_de_passe_hash text;

-- Tentatives de connexion : 5 échecs en 15 minutes bloquent temporairement un numéro.
CREATE TABLE IF NOT EXISTS tentatives_connexion (
  id        bigserial PRIMARY KEY,
  cle       text NOT NULL,
  ip        text,
  reussi    boolean NOT NULL DEFAULT false,
  cree_le   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tentatives_cle ON tentatives_connexion (cle, cree_le DESC);

-- Nettoyage des tentatives anciennes avec les sessions et les codes OTP expirés.
CREATE OR REPLACE FUNCTION nettoyer_expires() RETURNS void LANGUAGE sql AS $$
  DELETE FROM sessions  WHERE expire_le < now() - interval '1 day' OR revoquee_le < now() - interval '1 day';
  DELETE FROM codes_otp WHERE cree_le < now() - interval '1 day';
  DELETE FROM tentatives_connexion WHERE cree_le < now() - interval '1 day';
$$;
