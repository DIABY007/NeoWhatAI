import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/openrouter';
import { chunkTextByTokens } from '@/lib/chunking';
import { cleanText, extractPageCount, detectImageBasedPDF } from '@/lib/pdf-utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File;
    const clientId = formData.get('client_id') as string;

    if (!file || !clientId) {
      return NextResponse.json(
        { error: 'Fichier PDF et client_id requis' },
        { status: 400 }
      );
    }

    // Vérifier que le client existe
    const { data: client, error: clientError } = await supabaseAdmin
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json(
        { error: 'Client introuvable' },
        { status: 404 }
      );
    }

    // Lire le fichier PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Calculer un hash pour éviter les doublons
    const crypto = await import('crypto');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    
    // Vérifier si le bucket existe, sinon le créer
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'raw_documents');
    
    if (!bucketExists) {
      // Créer le bucket s'il n'existe pas
      const { error: createError } = await supabaseAdmin.storage.createBucket('raw_documents', {
        public: false,
        fileSizeLimit: 10485760, // 10 MB
        allowedMimeTypes: ['application/pdf'],
      });
      
      if (createError && !createError.message?.includes('already exists')) {
        console.error('Erreur création bucket:', createError);
      }
    }
    
    // Supprimer les anciens PDFs du client dans le storage (remplacement)
    // Cela permet de remplacer l'ancien PDF par le nouveau
    try {
      const { data: oldFiles, error: listError } = await supabaseAdmin.storage
        .from('raw_documents')
        .list(clientId);
      
      if (!listError && oldFiles && oldFiles.length > 0) {
        const filesToDelete = oldFiles
          .filter(file => file.name.endsWith('.pdf'))
          .map(file => `${clientId}/${file.name}`);
        
        if (filesToDelete.length > 0) {
          const { error: deleteError } = await supabaseAdmin.storage
            .from('raw_documents')
            .remove(filesToDelete);
          
          if (deleteError) {
            console.warn('[PDF Ingest] Erreur lors de la suppression des anciens PDFs:', deleteError);
            // Ne pas bloquer l'upload si la suppression échoue
          } else {
            console.log(`[PDF Ingest] ${filesToDelete.length} ancien(s) PDF(s) supprimé(s) pour le client ${clientId}`);
          }
        }
      }
    } catch (error) {
      console.warn('[PDF Ingest] Erreur lors de la vérification des anciens PDFs:', error);
      // Continuer l'upload même si la suppression échoue
    }
    
    // Uploader le PDF dans Supabase Storage (comme ARAP)
    // Cela évite les problèmes de fichiers de test manquants
    const fileName = `${clientId}/${hash}.pdf`;
    
    // Uploader le PDF dans le bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from('raw_documents')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true, // Permettre de ré-uploader le même fichier
      });
    
    if (uploadError) {
      console.error('Erreur upload PDF:', uploadError);
      // Continuer quand même si le bucket n'existe pas encore (fallback)
      if (!uploadError.message?.includes('Bucket not found')) {
        return NextResponse.json(
          { error: 'Erreur lors de l\'upload du PDF dans le storage' },
          { status: 500 }
        );
      }
    }
    
    // Récupérer le PDF depuis le storage pour l'analyser (comme ARAP)
    // Cela évite les problèmes de fichiers de test
    let pdfBuffer = buffer;
    if (!uploadError) {
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from('raw_documents')
        .download(fileName);
      
      if (!downloadError && fileData) {
        const downloadedBuffer = Buffer.from(await fileData.arrayBuffer());
        pdfBuffer = downloadedBuffer;
        console.log('[PDF Ingest] PDF récupéré depuis le storage');
      }
    }
    
    // Extraire le texte depuis le buffer
    const { extractTextFromPDF } = await import('@/lib/pdf-parse-wrapper');
    const pdfData = await extractTextFromPDF(pdfBuffer);
    
    // Extraire le texte et le nombre de pages
    let text = pdfData.text || '';
    const pageCount = extractPageCount(pdfData);
    
    console.log('[PDF Ingest] Extraction réussie:', {
      textLength: text.length,
      pageCount: pageCount,
    });

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le PDF ne contient pas de texte extractible' },
        { status: 400 }
      );
    }

    // Nettoyer le texte (suppression espaces multiples, etc.)
    text = cleanText(text);
    
    // Détecter si le PDF est scanné (pour information future)
    const isImageBased = detectImageBasedPDF(text);
    if (isImageBased) {
      console.warn('[PDF Ingest] PDF détecté comme scanné - qualité d\'extraction peut être limitée');
    }

    // Découper en chunks intelligents (basés sur tokens avec overlap)
    const textChunks = chunkTextByTokens(text);
    
    // Logging détaillé pour diagnostic
    const totalWords = text.split(/\s+/).filter(w => w.length > 0).length;
    const totalChars = text.length;
    console.log('[PDF Ingest] Statistiques du texte:', {
      totalChars,
      totalWords,
      estimatedTokens: Math.ceil(totalWords * 0.75),
      chunksCreated: textChunks.length,
    });
    
    if (textChunks.length === 1) {
      console.warn('[PDF Ingest] ⚠️ ATTENTION: Un seul chunk créé! Le PDF est peut-être trop court.');
      console.warn('[PDF Ingest] Texte extrait (premiers 500 caractères):', text.substring(0, 500));
      console.warn('[PDF Ingest] Cela peut limiter la capacité de recherche vectorielle.');
      console.warn('[PDF Ingest] Recommandation: Vérifier que le PDF contient suffisamment de texte.');
    } else {
      console.log(`[PDF Ingest] ✅ PDF découpé en ${textChunks.length} chunks (chunking intelligent basé sur tokens)`);
      // Afficher les tailles des premiers chunks
      textChunks.slice(0, 3).forEach((chunk, i) => {
        console.log(`  Chunk ${i + 1}: ${chunk.text.length} caractères, ~${chunk.estimatedTokens} tokens`);
      });
      if (textChunks.length > 3) {
        console.log(`  ... et ${textChunks.length - 3} autres chunks`);
      }
    }
    
    // Extraire juste les textes pour compatibilité
    const chunks = textChunks.map(chunk => chunk.text);

    // Supprimer les anciens documents du client (remplacement complet)
    // Le nouveau PDF remplace l'ancien, donc on supprime tous les anciens documents vectorisés
    await supabaseAdmin
      .from('documents')
      .delete()
      .eq('client_id', clientId);

    // Traiter chaque chunk
    const documents = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        // Générer l'embedding
        const embedding = await generateEmbedding(chunk, 'text-embedding-3-small');
        
        documents.push({
          client_id: clientId,
          content: chunk,
          embedding,
          metadata: {
            source: file.name,
            chunk_index: i,
            total_chunks: chunks.length,
          },
        });

        // Limiter le nombre de requêtes simultanées pour éviter les rate limits
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`Erreur lors du traitement du chunk ${i}:`, error);
        // Continuer avec les autres chunks même en cas d'erreur
      }
    }

    // Insérer tous les documents en batch
    if (documents.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('documents')
        .insert(documents);

      if (insertError) {
        console.error('Erreur lors de l\'insertion:', insertError);
        return NextResponse.json(
          { error: 'Erreur lors du stockage des documents' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `${documents.length} chunks vectorisés et stockés avec succès`,
      chunks_count: documents.length,
      warning: textChunks.length === 1 
        ? 'Un seul chunk créé - le PDF est peut-être trop court pour une recherche optimale'
        : undefined,
      stats: {
        total_words: totalWords,
        total_chars: totalChars,
        chunks_created: textChunks.length,
      },
    });

  } catch (error) {
    console.error('Erreur lors de l\'ingestion:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement du PDF' },
      { status: 500 }
    );
  }
}

