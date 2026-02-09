// Base URL WasenderAPI - selon la documentation, l'endpoint est /api/send-message
// Mais il semble que l'URL complète soit https://www.wasenderapi.com/api/send-message
const WASENDER_BASE_URL = process.env.WASENDER_BASE_URL || 'https://www.wasenderapi.com';

function getWasenderApiKey(): string {
  return process.env.WASENDER_API_KEY || '';
}

export interface WasenderSendMessageRequest {
  session_id: string;
  to: string; // Numéro de téléphone (format international: 221771234567)
  message: string;
}

export interface WasenderWebhookPayload {
  event?: string;
  type?: string;
  event_type?: string;
  session_id?: string;
  sessionId?: string;
  data?: {
    session_id?: string;
    from?: string;
    phone_number?: string;
    phone?: string;
    message?: {
      id?: string;
      body?: string;
      text?: {
        body?: string;
      };
    };
    body?: string;
    text?: {
      body?: string;
    };
  };
  from?: string;
  message?: {
    id?: string;
    body?: string;
    text?: {
      body?: string;
    };
  };
}

/**
 * Envoie un message texte via WasenderAPI
 * Documentation: https://wasenderapi.com/api-docs/messages/send-text-message
 * Endpoint: POST /api/send-message
 * Body: { to: "+1234567890", text: "Hello" }
 */
export async function sendWhatsAppMessage(
  sessionId: string,
  to: string,
  message: string,
  apiKey?: string
): Promise<void> {
  const key = apiKey || getWasenderApiKey();
  
  if (!key) {
    throw new Error('WasenderAPI key is required');
  }

  // Format du numéro: garder le + si présent (format E.164)
  // La documentation indique le format E.164: +1234567890
  const cleanPhone = to.startsWith('+') ? to : `+${to.replace(/[^\d]/g, '')}`;

    // Structure selon la documentation WasenderAPI officielle
    // Endpoint: POST /api/send-message
    // URL complète: https://www.wasenderapi.com/api/send-message
    // Body: { to: "+1234567890", text: "Hello" }
    // Note: La base URL ne doit PAS contenir /api/v1, juste le domaine
    const baseUrl = WASENDER_BASE_URL.replace(/\/api\/v1?$/, ''); // Enlever /api ou /api/v1 si présent
    const endpoint = `${baseUrl}/api/send-message`;
    
    console.log('📤 [WasenderAPI] Envoi message...');
    console.log('📤 [WasenderAPI] Base URL (nettoyée):', baseUrl);
    console.log('📤 [WasenderAPI] Endpoint:', endpoint);
    console.log('📤 [WasenderAPI] Session ID (pour info):', sessionId);
    console.log('📤 [WasenderAPI] To:', cleanPhone);
    console.log('📤 [WasenderAPI] Message length:', message.length);
    console.log('📤 [WasenderAPI] API Key présent:', !!key, '| Longueur:', key ? key.length : 0);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: cleanPhone,
        text: message,
      }),
    });
    
    console.log('📤 [WasenderAPI] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `WasenderAPI error (${response.status})`;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  // Vérifier la réponse
  const result = await response.json();
  return result;
}

/**
 * Récupère les détails d'une session WhatsApp
 * Documentation: https://wasenderapi.com/api-docs/sessions/get-whatsapp-session-details
 */
export async function getSessionDetails(sessionId: string, apiKey?: string) {
  const key = apiKey || getWasenderApiKey();
  
  if (!key) {
    throw new Error('WasenderAPI key is required');
  }

  const response = await fetch(`${WASENDER_BASE_URL}/api/v1/sessions/${sessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `WasenderAPI error (${response.status})`;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Crée une nouvelle session WhatsApp
 * Documentation: https://wasenderapi.com/api-docs/sessions/create-whatsapp-session
 */
export async function createSession(name: string, apiKey?: string) {
  const key = apiKey || getWasenderApiKey();
  
  if (!key) {
    throw new Error('WasenderAPI key is required');
  }

  const response = await fetch(`${WASENDER_BASE_URL}/api/v1/sessions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      name: name,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `WasenderAPI error (${response.status})`;
    
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorJson.error || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}
