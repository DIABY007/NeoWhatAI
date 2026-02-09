/**
 * Utilitaires pour le traitement de PDFs (inspiré d'ARAP)
 */

/**
 * Nettoie le texte extrait d'un PDF
 * - Supprime les espaces multiples
 * - Réduit les sauts de ligne multiples
 * - Supprime les caractères de contrôle
 */
export function cleanText(text: string): string {
  if (!text) return '';
  
  // Suppression des espaces multiples
  let cleaned = text.replace(/\s+/g, ' ');
  
  // Suppression des sauts de ligne multiples (garder max 2)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Suppression des caractères de contrôle (sauf \n, \r, \t)
  cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  
  return cleaned.trim();
}

/**
 * Détecte si un PDF est probablement basé sur des images (scanné)
 * 
 * Heuristique basique:
 * - Si très peu de texte par page estimée
 * - Si beaucoup d'espaces vides
 * 
 * @param extractedText - Le texte extrait du PDF
 * @param textLength - La longueur du texte (optionnel, calculé si non fourni)
 * @returns true si le PDF semble être scanné
 */
export function detectImageBasedPDF(
  extractedText: string,
  textLength?: number
): boolean {
  const length = textLength || extractedText.length;
  
  // Si le texte est très court, probablement scanné
  if (length < 100) {
    return true;
  }
  
  // Estimation du nombre de pages (environ 2000 caractères par page)
  const estimatedPages = Math.max(1, Math.ceil(length / 2000));
  const charsPerPage = length / estimatedPages;
  
  // Si moins de 50 caractères par page, probablement scanné
  if (charsPerPage < 50) {
    return true;
  }

  // Vérifier le ratio de caractères imprimables
  const printableChars = extractedText.replace(/[\s\n\r\t]/g, '').length;
  const printableRatio = printableChars / Math.max(1, length);
  
  // Si moins de 30% de caractères imprimables, probablement scanné
  if (printableRatio < 0.3) {
    return true;
  }

  return false;
}

/**
 * Extrait le nombre de pages depuis les données PDF
 * (Compatibilité avec différentes versions de pdf-parse)
 */
export function extractPageCount(pdfData: any): number {
  // Essayer différentes propriétés
  let pageCount = pdfData.numpages;
  
  if (!pageCount && pdfData.info) {
    pageCount = pdfData.info.numpages || pdfData.info.Pages;
  }
  
  if (!pageCount && Array.isArray(pdfData.pages)) {
    pageCount = pdfData.pages.length;
  }
  
  // Validation et conversion
  pageCount = Number(pageCount);
  
  if (!pageCount || isNaN(pageCount) || pageCount < 1) {
    console.warn('[PDF Utils] Nombre de pages invalide, utilisation de 1 par défaut');
    return 1;
  }
  
  return Math.floor(pageCount);
}

