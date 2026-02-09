-- Migration: Ajouter le champ webhook_secret à la table clients
-- Permet de configurer un webhook secret par client

ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS webhook_secret TEXT;

COMMENT ON COLUMN clients.webhook_secret IS 'Webhook secret WasenderAPI pour ce client (optionnel, utilise WASENDER_WEBHOOK_SECRET global si non défini)';

