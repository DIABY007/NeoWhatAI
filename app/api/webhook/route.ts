import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/wasender';
import { generateEmbedding, chatCompletion } from '@/lib/openrouter';
import type { OpenRouterMessage } from '@/lib/openrouter';

const DEFAULT_ERROR_MESSAGE = process.env.DEFAULT_ERROR_MESSAGE || 
  'Désolé, je rencontre une petite difficulté technique pour récupérer cette information. 🛠️ Un conseiller humain va prendre le relais si nécessaire. N\'hésitez pas à reformuler votre question dans quelques instants !';

/**
 * Récupère les 3 derniers messages de l'utilisateur pour le contexte
 */
async function getRecentMessages(clientId: string, userPhone: string, limit: number = 3) {
  const { data } = await supabaseAdmin
    .from('logs')
    .select('message_in, message_out')
    .eq('client_id', clientId)
    .eq('user_phone', userPhone)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * Vérifie si un message a déjà été traité (idempotency)
 */
async function isMessageProcessed(messageId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('processed_messages')
    .select('id')
    .eq('message_id', messageId)
    .single();

  return !!data;
}

/**
 * Marque un message comme traité
 */
async function markMessageAsProcessed(messageId: string, clientId: string) {
  await supabaseAdmin
    .from('processed_messages')
    .insert({
      message_id: messageId,
      client_id: clientId,
    });
}

/**
 * GET: Vérification du webhook (pour WasenderAPI)
 * WasenderAPI envoie généralement un challenge pour vérifier l'endpoint
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const verifyToken = searchParams.get('verify_token') || searchParams.get('token');
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge');

  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // Si un challenge est fourni, le retourner (vérification standard)
  if (challenge) {
    if (verifyToken && verifyToken === expectedToken) {
      return new NextResponse(challenge, { status: 200 });
    }
    // Certains services retournent juste le challenge sans vérification
    return new NextResponse(challenge, { status: 200 });
  }

  // Si pas de challenge, vérifier le token
  if (verifyToken === expectedToken) {
    return NextResponse.json({ verified: true });
  }

  return NextResponse.json(
    { error: 'Token de vérification invalide' },
    { status: 403 }
  );
}

/**
 * Vérifie la signature du webhook WasenderAPI
 * Documentation: https://wasenderapi.com/api-docs/webhooks/webhook-setup
 * WasenderAPI envoie la signature dans le header X-Webhook-Signature
 * 
 * @param request - La requête Next.js
 * @param body - Le corps de la requête (pour vérification future si nécessaire)
 * @param clientWebhookSecret - Le webhook secret du client (optionnel, prioritaire sur le secret global)
 */
function verifyWebhookSignature(
  request: NextRequest, 
  body: string, 
  clientWebhookSecret?: string | null
): boolean {
  const signature = request.headers.get('x-webhook-signature');
  
  // Priorité: secret du client > secret global > aucun (mode dev)
  const webhookSecret = clientWebhookSecret || process.env.WASENDER_WEBHOOK_SECRET;
  
  // Si pas de secret configuré, on accepte toutes les requêtes (pour le développement)
  if (!webhookSecret) {
    console.log('⚠️ [Webhook] Aucun webhook secret configuré (ni client ni global), signature non vérifiée');
    return true;
  }
  
  // Si pas de signature dans les headers, rejeter
  if (!signature) {
    console.log('❌ [Webhook] Signature manquante dans les headers');
    return false;
  }
  
  // Vérifier que la signature correspond au secret
  if (signature !== webhookSecret) {
    console.log('❌ [Webhook] Signature invalide');
    console.log('❌ [Webhook] Secret utilisé:', clientWebhookSecret ? 'client' : 'global');
    return false;
  }
  
  console.log('✅ [Webhook] Signature vérifiée (secret:', clientWebhookSecret ? 'client' : 'global', ')');
  return true;
}

/**
 * POST: Réception des messages WhatsApp via WasenderAPI
 */
export async function POST(request: NextRequest) {
  try {
    // Logger toutes les requêtes POST pour diagnostic
    console.log('🔔 [Webhook] REQUÊTE POST REÇUE');
    console.log('🔔 [Webhook] Headers:', Object.fromEntries(request.headers.entries()));
    
    // Lire le body comme texte pour la vérification de signature
    const bodyText = await request.text();
    
    // Parser le payload JSON pour extraire le sessionId et trouver le client
    // (on vérifiera la signature après avoir trouvé le client pour utiliser son secret si disponible)
    const payload = JSON.parse(bodyText);
    console.log('🔔 [Webhook] Payload reçu:', JSON.stringify(payload, null, 2));

    // Structure du webhook WasenderAPI selon la documentation officielle
    // Format: { event: "messages.received", data: { messages: { key: {...}, messageBody: "...", message: {...} } } }
    const event = payload.event || payload.type || payload.event_type;
    const data = payload.data || payload;

    console.log('🔔 [Webhook] Event détecté:', event);
    console.log('🔔 [Webhook] Data:', JSON.stringify(data, null, 2));

    // Ne traiter que les messages reçus
    // Support de tous les formats WasenderAPI selon la documentation
    const validEvents = [
      'messages.received', // Format officiel selon la documentation
      'message.received',
      'webhook-message-received',
      'webhook-personal-message-received',
      'message',
      'webhook.message.received',
      'personal.message.received',
    ];
    
    if (!validEvents.includes(event)) {
      console.log('⚠️ [Webhook] Event ignoré:', event, '| Payload keys:', Object.keys(payload));
      console.log('⚠️ [Webhook] Payload complet pour debug:', JSON.stringify(payload, null, 2));
      return NextResponse.json({ received: true, event, reason: 'event_not_handled' });
    }

    // Extraction des données selon la structure WasenderAPI officielle
    // Format principal: { event: "messages.received", data: { messages: { key: {...}, messageBody: "...", message: {...} } } }
    // 
    // Structure data.messages:
    // - key.cleanedSenderPn : numéro de téléphone (chats privés) - RECOMMANDÉ
    // - key.cleanedParticipantPn : numéro de téléphone (groupes) - RECOMMANDÉ
    // - key.remoteJid : ID unique du chat (peut être LID, pas un numéro)
    // - key.id : ID du message
    // - messageBody : texte unifié du message (RECOMMANDÉ pour le texte)
    // - message : objet brut du message (pour media, etc.)
    
    const messageData = data.messages || data.message || data;
    
    // Extraire le numéro de téléphone (priorité: cleanedParticipantPn pour groupes, cleanedSenderPn pour privé)
    const from = 
      messageData.key?.cleanedParticipantPn ||  // Pour les groupes
      messageData.key?.cleanedSenderPn ||        // Pour les chats privés
      messageData.key?.remoteJid?.replace('@lid', '').replace('@s.whatsapp.net', '') || // Fallback
      data.from || 
      data.phone_number || 
      data.phone || 
      data.from_number ||
      payload.from;
    
    // Extraire le texte du message (messageBody est le champ unifié recommandé)
    const messageText = 
      messageData.messageBody ||  // Champ unifié recommandé par WasenderAPI
      messageData.message?.conversation ||
      messageData.message?.extendedTextMessage?.text ||
      messageData.body || 
      messageData.text ||
      data.message?.body || 
      data.message?.text?.body || 
      data.message?.text ||
      data.body || 
      data.text?.body ||
      data.text ||
      data.content ||
      payload.message?.body ||
      payload.message?.text?.body ||
      payload.body;
    
    // Extraire l'ID du message
    const messageId = 
      messageData.key?.id ||
      messageData.id || 
      data.message?.id || 
      data.id || 
      data.message_id ||
      payload.message_id;
    
    // Extraire le session_id (peut être dans les headers ou ailleurs)
    // Note: WasenderAPI peut envoyer le session_id dans les headers ou dans le payload
    const sessionId = 
      payload.session_id || 
      payload.sessionId || 
      data.session_id || 
      data.sessionId ||
      data.session?.id ||
      // Si pas trouvé, on essaiera de le récupérer depuis le client via le numéro
      null;

    console.log('🔔 [Webhook] Données extraites:', {
      sessionId: sessionId || 'NON TROUVÉ',
      from,
      messageId,
      messageText: messageText?.substring(0, 50) + '...',
      hasMessageText: !!messageText,
      messageDataKeys: messageData ? Object.keys(messageData) : 'no messageData',
    });
    
    // Log détaillé pour debug du session_id
    console.log('🔍 [Webhook] Recherche session_id dans:', {
      'payload.session_id': payload.session_id,
      'payload.sessionId': payload.sessionId,
      'data.session_id': data.session_id,
      'data.sessionId': data.sessionId,
      'data.session?.id': data.session?.id,
      'messageData.key': messageData?.key,
      'allPayloadKeys': Object.keys(payload),
      'allDataKeys': data ? Object.keys(data) : 'no data',
    });

    // Vérifier les données minimales requises
    if (!from || !messageText) {
      console.log('❌ [Webhook] Données manquantes:', {
        sessionId: !!sessionId,
        from: !!from,
        messageText: !!messageText,
        allKeys: Object.keys(payload),
        dataKeys: data ? Object.keys(data) : 'no data',
        messageDataStructure: messageData ? JSON.stringify(messageData, null, 2) : 'no messageData',
      });
      return NextResponse.json({ received: true, reason: 'missing_data' });
    }

    // Si session_id n'est pas dans le payload, essayer de le récupérer depuis les headers
    // ou chercher le client par numéro de téléphone (si unique)
    let finalSessionId = sessionId;
    if (!finalSessionId) {
      // Essayer de récupérer depuis les headers (certaines APIs l'envoient là)
      const headers = request.headers;
      finalSessionId = headers.get('x-session-id') || 
                       headers.get('session-id') || 
                       headers.get('x-whatsapp-session-id');
      
      if (finalSessionId) {
        console.log('✅ [Webhook] Session ID trouvé dans les headers:', finalSessionId);
      } else {
        console.log('⚠️ [Webhook] Session ID non trouvé, recherche par numéro de téléphone...');
      }
    }

    // Vérifier l'idempotency (avant de chercher le client)
    if (messageId && await isMessageProcessed(messageId)) {
      console.log('⚠️ [Webhook] Message déjà traité:', messageId);
      return NextResponse.json({ received: true });
    }

    // Trouver le client correspondant à la session
    // Si on a un session_id, chercher par session_id (méthode principale)
    // Sinon, chercher par numéro de téléphone (fallback, si unique)
    console.log('🔍 [Webhook] Recherche client pour session_id:', finalSessionId || 'NON DISPONIBLE');
    
    let client = null;
    let clientError = null;
    
    if (finalSessionId) {
      // Méthode principale: chercher par session_id
      const result = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('whatsapp_session_id', finalSessionId)
        .eq('is_active', true)
        .single();
      client = result.data;
      clientError = result.error;
    } else {
      // Fallback: chercher par numéro de téléphone (si unique)
      // Note: Cette méthode fonctionne seulement si un seul client utilise ce numéro
      console.log('⚠️ [Webhook] Pas de session_id, recherche par numéro de téléphone:', from);
      const result = await supabaseAdmin
        .from('clients')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();
      client = result.data;
      clientError = result.error;
      
      if (client) {
        console.log('✅ [Webhook] Client trouvé par fallback (premier client actif)');
        // Utiliser le session_id du client trouvé
        finalSessionId = client.whatsapp_session_id;
      }
    }

    if (clientError || !client) {
      console.error('❌ [Webhook] Client introuvable');
      console.error('❌ [Webhook] Session ID recherché:', finalSessionId || 'NON DISPONIBLE');
      console.error('❌ [Webhook] Numéro de téléphone:', from);
      console.error('❌ [Webhook] Erreur:', clientError);
      
      // Lister tous les clients pour debug
      const { data: allClients } = await supabaseAdmin
        .from('clients')
        .select('id, name, whatsapp_session_id, is_active');
      console.log('📋 [Webhook] Clients disponibles:', allClients);
      
      return NextResponse.json({ 
        received: true, 
        reason: 'client_not_found', 
        sessionId: finalSessionId || 'NON DISPONIBLE',
        from 
      });
    }

    console.log('✅ [Webhook] Client trouvé:', client.name, '| ID:', client.id);

    // Vérifier la signature du webhook avec le secret du client (si disponible)
    // ou le secret global en fallback
    if (!verifyWebhookSignature(request, bodyText, client.webhook_secret)) {
      console.error('❌ [Webhook] Signature invalide, requête rejetée');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Marquer le message comme traité
    if (messageId) {
      await markMessageAsProcessed(messageId, client.id);
    }

    // Vérifier d'abord si des documents existent pour ce client
    const { count: docCount, error: countError } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', client.id)
      .not('embedding', 'is', null);

    if (countError) {
      console.error('❌ [Webhook] Erreur lors de la vérification des documents:', countError);
    }

    console.log(`📚 [Webhook] Documents disponibles pour ce client: ${docCount || 0}`);

    let context = '';
    let matches: any[] = [];

    if (docCount && docCount > 0) {
      // Générer l'embedding de la question
      console.log('🧠 [Webhook] Génération embedding pour la question...');
      const questionEmbedding = await generateEmbedding(messageText, 'text-embedding-3-small');
      console.log('✅ [Webhook] Embedding généré, longueur:', questionEmbedding.length);

      // Recherche vectorielle avec seuil progressif (essayer plusieurs seuils si nécessaire)
      // Seuils plus bas pour mieux capturer les informations factuelles (prix, tarifs, etc.)
      const thresholds = [0.7, 0.6, 0.5, 0.4, 0.3, 0.25]; // Seuils décroissants jusqu'à 0.25
      let searchError = null;

      for (const threshold of thresholds) {
        console.log(`🔍 [Webhook] Recherche vectorielle (seuil: ${threshold})...`);
        const result = await supabaseAdmin.rpc('match_documents', {
          query_embedding: questionEmbedding,
          match_client_id: client.id,
          match_threshold: threshold,
          match_count: 8, // Augmenter à 8 pour avoir plus de contexte
        });

        if (result.error) {
          console.error('❌ [Webhook] Erreur recherche vectorielle:', result.error);
          searchError = result.error;
          break;
        }

        if (result.data && result.data.length > 0) {
          matches = result.data;
          console.log(`✅ [Webhook] Contexte trouvé avec seuil ${threshold}:`, matches.length, 'chunks');
          // Logger les similarités pour diagnostic
          matches.forEach((m, i) => {
            console.log(`   Chunk ${i + 1}: similarité = ${(m.similarity * 100).toFixed(1)}%`);
            // Logger un aperçu du contenu pour diagnostic
            if (i < 3) {
              const preview = m.content.substring(0, 100).replace(/\n/g, ' ');
              console.log(`      Aperçu: "${preview}..."`);
            }
          });
          break;
        } else {
          console.log(`⚠️ [Webhook] Aucun résultat avec seuil ${threshold}`);
        }
      }

      if (!searchError && matches.length > 0) {
        // Trier par similarité décroissante et prendre les meilleurs
        matches.sort((a, b) => b.similarity - a.similarity);
        // Prendre jusqu'à 5 chunks pour avoir plus de contexte (au lieu de 3)
        const topMatches = matches.slice(0, 5);
        context = topMatches.map((m: any) => m.content).join('\n\n');
        console.log('✅ [Webhook] Contexte trouvé:', topMatches.length, 'chunks, longueur:', context.length);
        
        // TOUJOURS faire une recherche textuelle complémentaire pour les questions factuelles
        // Même si la recherche vectorielle a trouvé des résultats
        const factualKeywords = ['prix', 'coûte', 'tarif', '€', 'euro', 'formule', 'express', 'complet', 'burger', 'curry', 'combien'];
        const questionLower = messageText.toLowerCase();
        const isFactualQuestion = factualKeywords.some(keyword => questionLower.includes(keyword));
        
        if (isFactualQuestion) {
          // Extraire les mots-clés importants de la question (mots de 3+ caractères pour capturer "express")
          // Nettoyer les mots-clés : enlever les caractères spéciaux (?, !, etc.)
          const questionWords = messageText.toLowerCase()
            .replace(/[?!.,;:]/g, ' ') // Remplacer les caractères spéciaux par des espaces
            .split(/\s+/)
            .filter((w: string) => w.length >= 3)
            .filter((w: string) => !['combien', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'quand', 'où', 'est', 'sont', 'cest', 'pour'].includes(w))
            .map((w: string) => w.trim()); // Nettoyer les espaces
          
          // Vérifier si le contexte contient au moins un des mots-clés importants
          const contextLower = context.toLowerCase();
          const hasRelevantKeywords = questionWords.some((word: string) => contextLower.includes(word));
          
          // Faire une recherche textuelle complémentaire SI :
          // 1. Les mots-clés ne sont pas dans le contexte vectoriel, OU
          // 2. La question contient "formule" ou "express" (pour être sûr de trouver les formules)
          const needsTextSearch = !hasRelevantKeywords || 
                                  questionLower.includes('formule') || 
                                  questionLower.includes('express');
          
          if (needsTextSearch && questionWords.length > 0) {
            console.log('🔍 [Webhook] Recherche textuelle complémentaire pour question factuelle...');
            console.log('🔍 [Webhook] Mots-clés extraits:', questionWords);
            // Recherche textuelle complémentaire avec les mots-clés de la question
            const searchTerms = questionWords.slice(0, 3); // Prendre les 3 premiers mots-clés
            console.log('🔍 [Webhook] Termes de recherche:', searchTerms);
            let allTextMatches: any[] = [];
            
            // Faire une recherche pour chaque terme et combiner les résultats
            for (const term of searchTerms) {
              console.log(`🔍 [Webhook] Recherche textuelle avec terme: "${term}"`);
              const { data: textMatches, error: textError } = await supabaseAdmin
                .from('documents')
                .select('content')
                .eq('client_id', client.id)
                .ilike('content', `%${term}%`)
                .limit(5);
              
              if (textError) {
                console.error('❌ [Webhook] Erreur recherche textuelle:', textError);
              } else if (textMatches && textMatches.length > 0) {
                console.log(`✅ [Webhook] Trouvé ${textMatches.length} chunks avec "${term}"`);
                // Logger les aperçus des chunks trouvés
                textMatches.forEach((match: any, i: number) => {
                  const preview = match.content.substring(0, 150).replace(/\n/g, ' ');
                  console.log(`   Chunk ${i + 1}: "${preview}..."`);
                });
                allTextMatches = [...allTextMatches, ...textMatches];
              } else {
                console.log(`⚠️ [Webhook] Aucun chunk trouvé avec "${term}"`);
              }
            }
            
            // Dédupliquer par contenu (comparer les 100 premiers caractères pour être sûr)
            const uniqueMatches = allTextMatches.filter((match: any, index: number, self: any[]) => 
              index === self.findIndex((m: any) => m.content.substring(0, 100) === match.content.substring(0, 100))
            );
            
            console.log(`📊 [Webhook] Total chunks uniques trouvés: ${uniqueMatches.length}`);
            
            if (uniqueMatches.length > 0) {
              // Pour les questions factuelles, on inclut TOUS les chunks trouvés par la recherche textuelle
              // même s'ils semblent déjà dans le contexte vectoriel, car parfois le contexte vectoriel
              // ne contient pas assez d'informations ou les chunks sont différents
              const vectorContextLower = context.toLowerCase();
              
              // Filtrer les chunks qui contiennent vraiment les mots-clés recherchés
              const relevantChunks = uniqueMatches.filter((match: any) => {
                const matchLower = match.content.toLowerCase();
                return searchTerms.some((term: string) => matchLower.includes(term));
              });
              
              console.log(`📊 [Webhook] Chunks pertinents (avec mots-clés): ${relevantChunks.length}`);
              
              // Logger le contenu de chaque chunk pertinent pour diagnostic
              relevantChunks.forEach((chunk: any, i: number) => {
                const preview = chunk.content.substring(0, 200).replace(/\n/g, ' ');
                console.log(`   Chunk pertinent ${i + 1}: "${preview}..."`);
              });
              
              if (relevantChunks.length > 0) {
                // TOUJOURS ajouter les chunks de la recherche textuelle pour les questions factuelles
                // même s'ils semblent déjà dans le contexte, car ils peuvent contenir des infos manquantes
                const textContext = relevantChunks.slice(0, 5).map((m: any) => m.content).join('\n\n');
                context = context + '\n\n' + textContext;
                console.log('✅ [Webhook] Contexte enrichi avec recherche textuelle:', relevantChunks.length, 'chunks supplémentaires');
                // Logger un aperçu du contexte final pour vérifier que "express" est dedans
                const contextLower = context.toLowerCase();
                const hasExpress = contextLower.includes('express');
                const hasFormule = contextLower.includes('formule');
                console.log(`📄 [Webhook] Vérification contexte final: contient "express"=${hasExpress}, contient "formule"=${hasFormule}`);
                if (hasExpress || hasFormule) {
                  // Trouver où se trouve "express" dans le contexte
                  const expressIndex = contextLower.indexOf('express');
                  if (expressIndex >= 0) {
                    const snippet = context.substring(Math.max(0, expressIndex - 100), expressIndex + 200);
                    console.log(`📄 [Webhook] Aperçu autour de "express": "...${snippet}..."`);
                  }
                }
              } else {
                console.warn('⚠️ [Webhook] Aucun chunk pertinent trouvé avec les mots-clés recherchés');
              }
            } else {
              console.warn('⚠️ [Webhook] Aucun chunk unique trouvé avec la recherche textuelle');
            }
          }
        }
      } else {
        console.warn('⚠️ [Webhook] Aucun contexte trouvé pour cette question (même avec seuils réduits)');
        
        // Fallback : Recherche textuelle pour les questions factuelles (prix, tarifs, etc.)
        // Cela aide quand la recherche vectorielle échoue complètement mais que l'info existe
        const factualKeywords = ['prix', 'coûte', 'tarif', '€', 'euro', 'formule', 'express', 'complet', 'burger', 'curry'];
        const questionLower = messageText.toLowerCase();
        const isFactualQuestion = factualKeywords.some((keyword: string) => questionLower.includes(keyword));
        
        if (isFactualQuestion) {
          console.log('🔍 [Webhook] Recherche textuelle de fallback pour question factuelle...');
          
          // Extraire les mots-clés importants de la question
          const questionWords = messageText.toLowerCase()
            .split(/\s+/)
            .filter((w: string) => w.length >= 4)
            .filter((w: string) => !['combien', 'quel', 'quelle', 'quels', 'quelles', 'comment', 'pourquoi', 'quand', 'où'].includes(w));
          
          // Recherche avec les mots-clés (essayer plusieurs termes)
          const searchTerms = questionWords.length > 0 ? questionWords.slice(0, 2) : ['formule'];
          let allTextMatches: any[] = [];
          
          // Faire une recherche pour chaque terme et combiner les résultats
          for (const term of searchTerms) {
            const { data: textMatches, error: textError } = await supabaseAdmin
              .from('documents')
              .select('content')
              .eq('client_id', client.id)
              .ilike('content', `%${term}%`)
              .limit(5);
            
            if (!textError && textMatches) {
              allTextMatches = [...allTextMatches, ...textMatches];
            }
          }
          
          // Dédupliquer par contenu (en comparant les premiers caractères)
          const uniqueMatches = allTextMatches.filter((match: any, index: number, self: any[]) => 
            index === self.findIndex((m: any) => m.content.substring(0, 50) === match.content.substring(0, 50))
          );
          
          if (uniqueMatches.length > 0) {
            context = uniqueMatches.slice(0, 5).map((m: any) => m.content).join('\n\n');
            console.log('✅ [Webhook] Contexte trouvé via recherche textuelle:', uniqueMatches.length, 'chunks');
          } else {
            console.warn('⚠️ [Webhook] Aucun résultat même avec recherche textuelle');
          }
        }
      }
    } else {
      console.warn('⚠️ [Webhook] Aucun document vectorisé trouvé pour ce client');
    }

    // Récupérer l'historique récent
    const recentMessages = await getRecentMessages(client.id, from);
    const historyMessages: OpenRouterMessage[] = [];

    // Construire l'historique (les 3 derniers échanges)
    for (const msg of recentMessages.reverse()) {
      historyMessages.push({ role: 'user', content: msg.message_in });
      historyMessages.push({ role: 'assistant', content: msg.message_out });
    }

    // Construire le prompt final
    const systemPrompt = client.system_prompt || 'Tu es un assistant utile.';
    
    let systemContent = '';
    if (context) {
      // Détecter si c'est une question factuelle (prix, tarifs, formules, etc.)
      const factualKeywords = ['prix', 'coûte', 'tarif', '€', 'euro', 'formule', 'express', 'complet', 'burger', 'curry', 'combien'];
      const isFactualQuestion = factualKeywords.some((keyword: string) => messageText.toLowerCase().includes(keyword));
      
      // Contexte disponible - utiliser le PDF vectorisé
      // Détecter si la question concerne spécifiquement une formule
      const questionLower = messageText.toLowerCase().replace(/[?!.,;:]/g, '');
      const isFormulaQuestion = questionLower.includes('formule') || 
                                questionLower.includes('express') ||
                                questionLower.includes('complète') ||
                                questionLower.includes('complet');
      
      // Vérifier si le contexte contient "express" ou "formule express"
      const contextLower = context.toLowerCase();
      const hasExpressInContext = contextLower.includes('express');
      const hasFormuleExpress = contextLower.includes('formule') && contextLower.includes('express');
      
      systemContent = `${systemPrompt}

**INSTRUCTIONS CRITIQUES :**
- Tu as accès au contenu d'un document PDF vectorisé ci-dessous
- Utilise UNIQUEMENT les informations du contexte pour répondre
${isFactualQuestion ? `- **QUESTION FACTUELLE DÉTECTÉE** : Tu dois chercher MÉTICULEUSEMENT dans TOUT le contexte ci-dessous
  * L'information peut être écrite de différentes façons (majuscules/minuscules, avec/sans guillemets, etc.)
  * Exemple : "Formule Express", "formule Express", "Express", "formule express" = même chose
  * Les prix peuvent être écrits : "14,50 €", "14.50€", "14,50 euros", "14.50 EUR"
  * LIS TOUT LE CONTEXTE ligne par ligne avant de répondre
  * Si tu vois l'information quelque part dans le contexte, tu DOIS la donner
${isFormulaQuestion ? `  * **ATTENTION SPÉCIALE FORMULES** : 
  * Le contexte contient ${hasExpressInContext ? 'BIEN' : 'PAS'} le mot "express"
  * Le contexte contient ${hasFormuleExpress ? 'BIEN' : 'PAS'} "formule express"
  * Cherche les mots "Formule", "formule", "Express", "express", "Complète", "complète"
  * Les formules peuvent être dans une section "Formules du Midi" ou "Formules"
  * Si tu vois "Formule Express" ou "formule Express" dans le contexte, c'est la même chose
  * ${hasExpressInContext ? '⚠️ IMPORTANT : Le mot "express" EST dans le contexte. Tu DOIS trouver et donner le prix de la formule Express si elle est mentionnée.' : ''}` : ''}` : `- Combine intelligemment les différents segments de contexte pour donner une réponse complète`}
- Si l'information demandée n'est PAS dans le contexte, dis poliment : "Je ne trouve pas cette information dans nos documents. Pourriez-vous reformuler votre question ?"
- Ne jamais inventer d'informations qui ne sont pas dans le contexte

**CONTEXTE DU DOCUMENT :**
${context}

**Rappel :** Base-toi exclusivement sur le contexte ci-dessus. ${isFactualQuestion ? `Pour cette question factuelle${isFormulaQuestion ? ' sur les formules' : ''}, examine CHAQUE ligne du contexte avec attention avant de répondre. ${hasExpressInContext ? 'Le mot "express" est présent dans le contexte - tu DOIS trouver et donner cette information.' : ''}` : 'Combine intelligemment les segments pour une réponse complète.'}`;
    } else if (docCount && docCount > 0) {
      // Documents existent mais aucun résultat de recherche
      systemContent = `${systemPrompt}

**ATTENTION :** Des documents sont disponibles dans la base de connaissances, mais aucune information pertinente n'a été trouvée pour cette question spécifique.

Réponds poliment que tu n'as pas trouvé d'information pertinente dans les documents disponibles pour cette question. Propose à l'utilisateur de reformuler sa question ou d'être plus spécifique.`;
    } else {
      // Aucun document disponible
      systemContent = `${systemPrompt}

**ATTENTION :** Aucun document PDF n'a été uploadé et vectorisé pour ce client.

Réponds poliment que tu n'as pas accès à une base de connaissances pour le moment. Indique que des documents doivent être uploadés pour pouvoir répondre aux questions.`;
    }

    const systemMessage: OpenRouterMessage = {
      role: 'system',
      content: systemContent,
    };

    const messages: OpenRouterMessage[] = [
      systemMessage,
      ...historyMessages,
      { role: 'user', content: messageText },
    ];

    // Générer la réponse via OpenRouter
    const openrouterKey = client.openrouter_key || process.env.OPENROUTER_API_KEY;
    let responseText = '';

    try {
      responseText = await chatCompletion(messages, 'deepseek/deepseek-chat', 0, openrouterKey);
    } catch (error) {
      console.error('Erreur lors de la génération de la réponse:', error);
      responseText = DEFAULT_ERROR_MESSAGE;
    }

    // Envoyer la réponse via WasenderAPI
    // Utiliser le session_id du client (peut être différent de celui du payload)
    const clientSessionId = client.whatsapp_session_id || finalSessionId;
    
    console.log('📤 [Webhook] Envoi réponse via WasenderAPI...');
    console.log('📤 [Webhook] Session ID:', clientSessionId, '| To:', from, '| Message length:', responseText.length);
    
    if (!clientSessionId) {
      console.error('❌ [Webhook] Impossible d\'envoyer la réponse: pas de session_id disponible');
    } else {
      try {
        const wasenderToken = client.whatsapp_token || process.env.WASENDER_API_KEY;
        await sendWhatsAppMessage(clientSessionId, from, responseText, wasenderToken);
        console.log('✅ [Webhook] Réponse envoyée avec succès');
      } catch (error) {
        console.error('❌ [Webhook] Erreur lors de l\'envoi du message:', error);
        console.error('❌ [Webhook] Détails erreur:', error instanceof Error ? error.message : error);
        // Ne pas échouer complètement, on a quand même loggé
      }
    }

    // Sauvegarder dans les logs
    await supabaseAdmin.from('logs').insert({
      client_id: client.id,
      user_phone: from,
      message_in: messageText,
      message_out: responseText,
    });

    return NextResponse.json({ received: true, processed: true });

  } catch (error) {
    console.error('Erreur dans le webhook:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement du webhook' },
      { status: 500 }
    );
  }
}

