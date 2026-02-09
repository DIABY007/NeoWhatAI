'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';
import type { Client } from '@/types/database';

interface ClientWithStats extends Client {
  messagesCount: number;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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

      // Charger le nombre de messages pour chaque client
      const clientsWithStats = await Promise.all(
        (data || []).map(async (client) => {
          const { count, error: countError } = await supabase
            .from('logs')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', client.id);

          if (countError) {
            console.error('Error counting messages for client:', client.id, countError);
            return { ...client, messagesCount: 0 };
          }

          return { ...client, messagesCount: count || 0 };
        })
      );

      setClients(clientsWithStats);
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleActive(clientId: string, currentStatus: boolean) {
    if (!confirm(`Êtes-vous sûr de vouloir ${currentStatus ? 'mettre en pause' : 'réactiver'} ce client ?`)) {
      return;
    }

    setToggling(clientId);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: !currentStatus })
        .eq('id', clientId);

      if (error) throw error;
      alert(`✅ Client ${!currentStatus ? 'réactivé' : 'mis en pause'} avec succès !`);
      loadClients();
    } catch (error) {
      console.error('Error toggling client status:', error);
      alert('❌ Erreur lors de la modification du statut');
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete(clientId: string, clientName: string) {
    if (!confirm(`⚠️ ÊTES-VOUS ABSOLUMENT SÛR de vouloir supprimer le client "${clientName}" ?\n\nCette action est IRRÉVERSIBLE et supprimera également :\n- Tous les documents associés\n- Tous les logs de conversation\n- Toutes les données liées\n\nTapez "SUPPRIMER" pour confirmer.`)) {
      return;
    }

    const confirmation = prompt('Tapez "SUPPRIMER" (en majuscules) pour confirmer la suppression :');
    if (confirmation !== 'SUPPRIMER') {
      alert('Suppression annulée');
      return;
    }

    setDeleting(clientId);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;
      alert('✅ Client supprimé avec succès !');
      loadClients();
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('❌ Erreur lors de la suppression du client');
    } finally {
      setDeleting(null);
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
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <Link
            href="/admin/clients/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            + Nouveau Client
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-500 mb-4">Aucun client pour le moment.</p>
            <Link
              href="/admin/clients/new"
              className="text-blue-600 hover:underline"
            >
              Créer votre premier client
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {clients.map((client) => (
              <div
                key={client.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <Link
                    href={`/admin/clients/${client.id}`}
                    className="text-xl font-semibold text-gray-900 hover:text-blue-600"
                  >
                    {client.name}
                  </Link>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      client.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {client.is_active ? 'Actif' : 'En pause'}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Session: {client.whatsapp_session_id.slice(0, 20)}...
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">📨 Messages répondus</span>
                    <span className="text-lg font-bold text-blue-600">{client.messagesCount}</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-4">
                  Créé le {new Date(client.created_at).toLocaleDateString('fr-FR')}
                </p>
                <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleActive(client.id, client.is_active);
                    }}
                    disabled={toggling === client.id}
                    className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${
                      client.is_active
                        ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    } disabled:opacity-50`}
                  >
                    {toggling === client.id
                      ? '...'
                      : client.is_active
                      ? '⏸️ Mettre en pause'
                      : '▶️ Réactiver'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(client.id, client.name);
                    }}
                    disabled={deleting === client.id}
                    className="px-3 py-2 bg-red-100 text-red-800 rounded text-sm font-medium hover:bg-red-200 transition disabled:opacity-50"
                  >
                    {deleting === client.id ? '...' : '🗑️'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

