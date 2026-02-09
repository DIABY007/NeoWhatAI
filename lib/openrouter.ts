const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

function getOpenRouterApiKey(): string {
  return process.env.OPENROUTER_API_KEY || '';
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterChatCompletionRequest {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
}

export interface OpenRouterEmbeddingRequest {
  model: string;
  input: string | string[];
}

/**
 * Appelle l'API OpenRouter pour générer une réponse de chat
 */
export async function chatCompletion(
  messages: OpenRouterMessage[],
  model: string = 'deepseek/deepseek-chat',
  temperature: number = 0,
  apiKey?: string
): Promise<string> {
  const key = apiKey || getOpenRouterApiKey();
  
  if (!key) {
    throw new Error('OpenRouter API key is required');
  }

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://localhost:3000',
      'X-Title': 'WhatsApp AI Automation SaaS',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

/**
 * Génère des embeddings via OpenRouter
 * Note: OpenRouter supporte les embeddings via certains modèles
 * Pour text-embedding-3-small, on peut utiliser OpenAI directement ou un modèle compatible
 */
export async function generateEmbedding(
  text: string,
  model: string = 'text-embedding-3-small'
): Promise<number[]> {
  // OpenRouter peut router vers OpenAI pour les embeddings
  // Si le modèle est OpenAI, on peut l'utiliser directement
  if (model.startsWith('text-embedding')) {
    // Utiliser OpenAI directement pour les embeddings (plus fiable)
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI Embedding API error: ${error}`);
      }

      const data = await response.json();
      return data.data[0]?.embedding || [];
    }
  }

  // Fallback: essayer via OpenRouter si disponible
  const openRouterKey = getOpenRouterApiKey();
  if (!openRouterKey) {
    throw new Error('OpenRouter API key is required for embeddings');
  }
  
  const response = await fetch(`${OPENROUTER_BASE_URL}/embeddings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter Embedding API error: ${error}`);
  }

  const data = await response.json();
  return data.data[0]?.embedding || [];
}

