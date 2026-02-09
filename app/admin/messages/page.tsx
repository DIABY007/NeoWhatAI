'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import type { Log, Client } from '@/types/database';

interface LogWithClient extends Log {
  client?: Client;
}

export default function MessagesPage() {
  const [logs, setLogs] = useState<LogWithClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState<string>('all');
  const [clients, setClients] = useState<Client[]>([]);
  const [searchPhone, setSearchPhone] = useState('');

  useEffect(() => {
    loadClients();
    loadLogs();
  }, [selectedClient, searchPhone]);

  async function loadClients() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  }

  async function loadLogs() {
    try {
      setLoading(true);
      let query = supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Filtrer par client si sélectionné
      if (selectedClient !== 'all') {
        query = query.eq('client_id', selectedClient);
      }

      // Filtrer par numéro de téléphone si recherché
      if (searchPhone) {
        query = query.ilike('user_phone', `%${searchPhone}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Charger les informations des clients pour chaque log
      const logsWithClients = await Promise.all(
        (data || []).map(async (log) => {
          const { data: clientData } = await supabase
            .from('clients')
            .select('*')
            .eq('id', log.client_id)
            .single();

          return {
            ...log,
            client: clientData || undefined,
          };
        })
      );

      setLogs(logsWithClients);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date);
  }

  function formatPhone(phone: string) {
    // Formater le numéro de téléphone de manière lisible
    if (phone.length > 10) {
      return phone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5 $6');
    }
    return phone;
  }

  const totalMessages = logs.length;
  const uniquePhones = new Set(logs.map(log => log.user_phone)).size;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Chargement des messages...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            📨 Messages Reçus
          </h1>
          <p className="text-gray-600">
            Historique de tous les messages reçus et traités par le système
          </p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Total Messages</div>
            <div className="text-3xl font-bold text-blue-600">{totalMessages}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Numéros Uniques</div>
            <div className="text-3xl font-bold text-green-600">{uniquePhones}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-sm text-gray-600 mb-1">Clients Actifs</div>
            <div className="text-3xl font-bold text-purple-600">{clients.length}</div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Filtres</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrer par Client
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rechercher par Numéro
              </label>
              <input
                type="text"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
                placeholder="Ex: 221771234567"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-900"
              />
            </div>
          </div>
        </div>

        {/* Liste des messages */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold">
              Messages ({logs.length})
            </h2>
          </div>

          {logs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 text-lg mb-2">
                Aucun message trouvé
              </p>
              <p className="text-gray-400 text-sm">
                {selectedClient !== 'all' || searchPhone
                  ? 'Essayez de modifier les filtres'
                  : 'Les messages apparaîtront ici une fois reçus'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {logs.map((log) => (
                <div key={log.id} className="p-6 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          📱 {formatPhone(log.user_phone)}
                        </span>
                        {log.client && (
                          <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                            {log.client.name}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {formatDate(log.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Message reçu */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-xs font-semibold text-gray-600 mb-1 uppercase">
                        Message Reçu
                      </div>
                      <div className="text-gray-900 whitespace-pre-wrap">
                        {log.message_in}
                      </div>
                    </div>

                    {/* Réponse envoyée */}
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-xs font-semibold text-blue-600 mb-1 uppercase">
                        Réponse Envoyée
                      </div>
                      <div className="text-gray-900 whitespace-pre-wrap">
                        {log.message_out}
                      </div>
                    </div>
                  </div>

                  {log.tokens_used && (
                    <div className="mt-3 text-xs text-gray-500">
                      Tokens utilisés: {log.tokens_used}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            💡 Comment ça fonctionne ?
          </h3>
          <ul className="text-sm text-yellow-700 space-y-1 list-disc list-inside">
            <li>
              Les messages sont automatiquement enregistrés lorsqu'ils sont reçus via le webhook
            </li>
            <li>
              Chaque message reçu déclenche une recherche dans la base de connaissances
            </li>
            <li>
              La réponse générée est envoyée via WhatsApp et enregistrée ici
            </li>
            <li>
              Les messages sont stockés dans la table <code className="bg-yellow-100 px-1 rounded">logs</code> de Supabase
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

