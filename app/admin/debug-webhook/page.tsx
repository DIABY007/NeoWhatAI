'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

export default function DebugWebhookPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      // Charger les clients
      const { data: clientsData } = await supabase
        .from('clients')
        .select('*')
        .eq('is_active', true);

      setClients(clientsData || []);

      // Charger les logs récents
      const { data: logsData } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      setLogs(logsData || []);
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  }

  async function testWebhook() {
    try {
      const response = await fetch('/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: 'messages.received',
          data: {
            messages: {
              key: {
                cleanedSenderPn: '2250705223228',
                id: 'test-' + Date.now(),
              },
              messageBody: 'Test de webhook',
            },
          },
        }),
      });

      const result = await response.json();
      alert('Résultat: ' + JSON.stringify(result, null, 2));
      loadData();
    } catch (error) {
      alert('Erreur: ' + (error instanceof Error ? error.message : String(error)));
    }
  }

  if (loading) {
    return <div className="p-8">Chargement...</div>;
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">🔍 Debug Webhook</h1>

      <div className="space-y-6">
        {/* Clients */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Clients Actifs</h2>
          {clients.length === 0 ? (
            <p className="text-gray-500">Aucun client actif</p>
          ) : (
            <div className="space-y-4">
              {clients.map((client) => (
                <div key={client.id} className="border p-4 rounded">
                  <p><strong>Nom:</strong> {client.name}</p>
                  <p><strong>Session ID:</strong> {client.whatsapp_session_id || 'NON DÉFINI'}</p>
                  <p><strong>Phone ID:</strong> {client.whatsapp_phone_id || 'NON DÉFINI'}</p>
                  <p><strong>API Key:</strong> {client.whatsapp_token ? '✅ Définie' : '❌ Manquante'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Test Webhook */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Test Webhook</h2>
          <button
            onClick={testWebhook}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Tester le Webhook
          </button>
        </div>

        {/* Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Logs Récents</h2>
          {logs.length === 0 ? (
            <p className="text-gray-500">Aucun log</p>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="border p-3 rounded text-sm">
                  <p><strong>Date:</strong> {new Date(log.created_at).toLocaleString('fr-FR')}</p>
                  <p><strong>De:</strong> {log.user_phone}</p>
                  <p><strong>Message reçu:</strong> {log.message_in}</p>
                  <p><strong>Message envoyé:</strong> {log.message_out}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">📋 Checklist de Diagnostic</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Vérifier que le webhook est configuré dans WasenderAPI: <code>http://157.173.119.156:3000/api/webhook</code></li>
            <li>Vérifier que le Session ID dans la base correspond à celui dans WasenderAPI</li>
            <li>Envoyer un message WhatsApp et regarder les logs du serveur</li>
            <li>Vérifier que vous voyez <code>🔔 [Webhook] REQUÊTE POST REÇUE</code> dans les logs</li>
            <li>Vérifier que vous voyez <code>✅ [Webhook] Client trouvé</code> dans les logs</li>
            <li>Vérifier que vous voyez <code>✅ [Webhook] Réponse envoyée avec succès</code> dans les logs</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

