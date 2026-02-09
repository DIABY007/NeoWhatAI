export interface Client {
  id: string;
  name: string;
  whatsapp_phone_id: string;
  whatsapp_session_id: string; // ID de session WasenderAPI
  whatsapp_token?: string; // Optionnel si on utilise l'API key globale
  webhook_secret?: string; // Optionnel, webhook secret WasenderAPI pour ce client
  openrouter_key?: string; // Optionnel, sinon utilise la clé globale
  system_prompt: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  client_id: string;
  content: string;
  embedding: number[]; // vector(1536)
  metadata?: {
    source?: string;
    page?: number;
    chunk_index?: number;
  };
  created_at: string;
}

export interface Log {
  id: string;
  client_id: string;
  user_phone: string;
  message_in: string;
  message_out: string;
  tokens_used?: number;
  created_at: string;
}

