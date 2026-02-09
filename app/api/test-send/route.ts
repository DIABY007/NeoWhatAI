import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/wasender';

/**
 * API Route pour tester l'envoi d'un message
 * GET /api/test-send?to=2250705223228
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const toPhone = searchParams.get('to');

    if (!toPhone) {
      return NextResponse.json(
        { error: 'Paramètre "to" requis (numéro de téléphone)' },
        { status: 400 }
      );
    }

    // Récupérer le premier client actif
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (clientsError || !clients || clients.length === 0) {
      return NextResponse.json(
        { error: 'Aucun client actif trouvé' },
        { status: 404 }
      );
    }

    const client = clients[0];
    console.log('🧪 [Test Send] Client trouvé:', client.name, '| Session ID:', client.whatsapp_session_id);

    // Message de test
    const testMessage = `🧪 Message de test depuis NeoWhatAI
Date: ${new Date().toLocaleString('fr-FR')}
Session ID: ${client.whatsapp_session_id.substring(0, 20)}...
Client: ${client.name}

Si vous recevez ce message, le système fonctionne correctement ! ✅`;

    console.log('📤 [Test Send] Envoi du message...');
    console.log('   À:', toPhone);
    console.log('   Session ID:', client.whatsapp_session_id);

    // Envoyer le message
    const wasenderToken = client.whatsapp_token || process.env.WASENDER_API_KEY;
    
    if (!wasenderToken) {
      return NextResponse.json(
        { error: 'Token WasenderAPI manquant' },
        { status: 500 }
      );
    }

    await sendWhatsAppMessage(
      client.whatsapp_session_id,
      toPhone,
      testMessage,
      wasenderToken
    );

    console.log('✅ [Test Send] Message envoyé avec succès');

    return NextResponse.json({
      success: true,
      message: 'Message envoyé avec succès',
      client: {
        id: client.id,
        name: client.name,
        session_id: client.whatsapp_session_id,
      },
      to: toPhone,
    });

  } catch (error) {
    console.error('❌ [Test Send] Erreur:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de l\'envoi du message',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

