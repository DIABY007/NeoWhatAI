/**
 * Chunking intelligent basé sur les tokens (inspiré d'ARAP)
 * 
 * Avantages par rapport au chunking par caractères:
 * - Plus précis pour les embeddings (basé sur tokens réels)
 * - Overlap en pourcentage (meilleur contexte)
 * - Taille optimale pour embeddings (650 tokens)
 */

// Estimation: 1 token ≈ 0.75 mots (approximatif pour français/anglais)
const TOKENS_PER_WORD = 0.75;

// Taille cible optimale pour embeddings (text-embedding-3-small)
// Réduit à 500 tokens pour créer plus de chunks et améliorer la granularité de recherche
const TARGET_CHUNK_TOKENS = 500;

// Overlap de 20% pour préserver le contexte entre chunks
const OVERLAP_PERCENT = 0.2;

// Calcul des tailles en mots
const TARGET_WORDS = Math.floor(TARGET_CHUNK_TOKENS / TOKENS_PER_WORD); // ~867 mots
const OVERLAP_WORDS = Math.floor(TARGET_WORDS * OVERLAP_PERCENT); // ~173 mots

export interface TextChunk {
  text: string;
  index: number;
  startWord: number;
  endWord: number;
  estimatedTokens: number;
}

/**
 * Découpe le texte en chunks basés sur les tokens avec overlap
 * 
 * @param text - Le texte à découper
 * @returns Tableau de chunks avec métadonnées
 */
export function chunkTextByTokens(text: string): TextChunk[] {
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const chunks: TextChunk[] = [];
  
  // Si le texte est très court, créer quand même plusieurs chunks pour améliorer la recherche
  // Minimum 2 chunks si possible, même pour des textes courts
  const MIN_CHUNKS = 2;
  const MIN_WORDS_PER_CHUNK = 50; // Minimum de mots par chunk pour les petits textes
  
  // Calculer la taille de chunk adaptative
  let actualTargetWords = TARGET_WORDS;
  if (words.length < TARGET_WORDS * MIN_CHUNKS) {
    // Pour les textes courts, réduire la taille des chunks pour en créer plusieurs
    actualTargetWords = Math.max(
      MIN_WORDS_PER_CHUNK,
      Math.floor(words.length / MIN_CHUNKS)
    );
  }
  
  let startIndex = 0;
  let chunkIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + actualTargetWords, words.length);
    const chunkWords = words.slice(startIndex, endIndex);
    const chunkText = chunkWords.join(' ');
    
    // Estimation des tokens pour ce chunk
    const estimatedTokens = Math.ceil(chunkWords.length * TOKENS_PER_WORD);

    chunks.push({
      text: chunkText,
      index: chunkIndex,
      startWord: startIndex,
      endWord: endIndex,
      estimatedTokens,
    });

    // Avancer avec overlap (sauf pour le dernier chunk)
    if (endIndex < words.length) {
      // Calculer l'overlap adaptatif
      const adaptiveOverlap = Math.floor(actualTargetWords * OVERLAP_PERCENT);
      startIndex = endIndex - adaptiveOverlap;
    } else {
      startIndex = endIndex;
    }

    chunkIndex++;
  }

  return chunks;
}

/**
 * Version simplifiée qui retourne juste les textes (compatibilité)
 */
export function chunkText(text: string): string[] {
  return chunkTextByTokens(text).map(chunk => chunk.text);
}

/**
 * Estime le nombre de tokens dans un texte
 */
export function estimateTokens(text: string): number {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  return Math.ceil(words.length * TOKENS_PER_WORD);
}

