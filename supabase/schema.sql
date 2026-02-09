-- Activer l'extension vectorielle pour les embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- Table clients (multi-tenancy)
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  whatsapp_phone_id TEXT UNIQUE NOT NULL,
  whatsapp_session_id TEXT NOT NULL, -- ID de session WasenderAPI
  whatsapp_token TEXT, -- Optionnel si on utilise l'API key globale
  openrouter_key TEXT, -- Optionnel, sinon utilise la clé globale
  system_prompt TEXT DEFAULT 'Tu es un assistant utile.',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour le routing rapide par session_id
CREATE INDEX IF NOT EXISTS idx_clients_session_id ON clients(whatsapp_session_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone_id ON clients(whatsapp_phone_id);

-- Table documents (vector store)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536), -- Compatible text-embedding-3-small
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour la recherche vectorielle
CREATE INDEX IF NOT EXISTS idx_documents_client ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Table logs (historique des conversations)
CREATE TABLE IF NOT EXISTS logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  user_phone TEXT NOT NULL,
  message_in TEXT NOT NULL,
  message_out TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour les requêtes d'historique
CREATE INDEX IF NOT EXISTS idx_logs_client ON logs(client_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_phone ON logs(user_phone);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);

-- Table pour l'idempotency (éviter les doublons de webhooks)
CREATE TABLE IF NOT EXISTS processed_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT UNIQUE NOT NULL,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processed_messages_id ON processed_messages(message_id);

-- Fonction RPC pour la recherche de similarité vectorielle
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_client_id UUID,
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE documents.client_id = match_client_id
    AND documents.embedding IS NOT NULL
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Activer Row Level Security (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE processed_messages ENABLE ROW LEVEL SECURITY;

-- Politique RLS pour les admins authentifiés (tout lire/écrire)
CREATE POLICY "Admins can do everything on clients"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can do everything on documents"
  ON documents FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can do everything on logs"
  ON logs FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can do everything on processed_messages"
  ON processed_messages FOR ALL
  USING (auth.role() = 'authenticated');

-- Politique pour le service role (backend API - webhooks)
-- Le service role bypass RLS automatiquement, donc pas besoin de politique explicite
-- Mais on peut en créer une pour être explicite
CREATE POLICY "Service role can do everything on clients"
  ON clients FOR ALL
  USING (true);

CREATE POLICY "Service role can do everything on documents"
  ON documents FOR ALL
  USING (true);

CREATE POLICY "Service role can do everything on logs"
  ON logs FOR ALL
  USING (true);

CREATE POLICY "Service role can do everything on processed_messages"
  ON processed_messages FOR ALL
  USING (true);

-- Trigger pour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

