'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import type { Client } from '@/types/database';

export default function DebugPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  }

  async function testWebhook() {
    const testPayload = {
      event: 'webhook-message-received',
      session_id: clients[0]?.whatsapp_session_id || 'test_session',
      from: '221771234567',
      message: {
        id: 'test_msg_' + Date.now(),
        body: 'Test message',
      },
    };

    try {
      const response = await fetch('/api/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      const result = await response.json();
      alert(`Réponse: ${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      alert(`Erreur: ${error}`);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Debug & Configuration</h1>
          <Link
            href="/admin/messages"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition"
          >
            📨 Voir les Messages
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Clients Configurés</h2>
          {clients.length === 0 ? (
            <p className="text-gray-500">Aucun client configuré</p>
          ) : (
            <div className="space-y-4">
              {clients.map((client) => (
                <div key={client.id} className="border rounded p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium">Nom:</span> {client.name}
                    </div>
                    <div>
                      <span className="font-medium">Session ID:</span>{' '}
                      <code className="bg-gray-100 px-2 py-1 rounded">
                        {client.whatsapp_session_id}
                      </code>
                    </div>
                    <div>
                      <span className="font-medium">Phone ID:</span> {client.whatsapp_phone_id}
                    </div>
                    <div>
                      <span className="font-medium">Statut:</span>{' '}
                      <span
                        className={
                          client.is_active
                            ? 'text-green-600 font-medium'
                            : 'text-gray-600'
                        }
                      >
                        {client.is_active ? '✅ Actif' : '❌ Inactif'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Webhook</h2>
          <p className="text-gray-600 mb-4">
            Testez le webhook avec un payload de test (nécessite au moins un client configuré)
          </p>
          <button
            onClick={testWebhook}
            disabled={clients.length === 0}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Tester le Webhook
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Vérifications</h2>
          <div className="space-y-2 text-sm">
            <div>
              <span className="font-medium">Webhook URL:</span>{' '}
              <code className="bg-gray-100 px-2 py-1 rounded">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook
              </code>
            </div>
            <div>
              <span className="font-medium">Variables d'environnement:</span>
              <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
                <li>
                  OPENROUTER_API_KEY:{' '}
                  {process.env.NEXT_PUBLIC_OPENROUTER_API_KEY ? '✅' : '❌'}
                </li>
                <li>
                  WASENDER_API_KEY:{' '}
                  {process.env.NEXT_PUBLIC_WASENDER_API_KEY ? '✅' : '❌ (côté serveur uniquement)'}
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-yellow-800">
            📋 Checklist de Configuration
          </h2>
          <ul className="space-y-2 text-sm">
            <li>
              ☐ Webhook WasenderAPI configuré avec l'URL correcte
            </li>
            <li>
              ☐ Verify Token correspond à WHATSAPP_VERIFY_TOKEN
            </li>
            <li>
              ☐ Session ID dans la base correspond à WasenderAPI
            </li>
            <li>
              ☐ Client actif (is_active = true)
            </li>
            <li>
              ☐ PDF uploadé et vectorisé pour le client
            </li>
            <li>
              ☐ Vérifier les logs du serveur lors de l'envoi d'un message
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

