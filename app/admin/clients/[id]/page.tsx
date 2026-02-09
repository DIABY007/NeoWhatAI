'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import type { Client } from '@/types/database';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;
  
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [savingSessionId, setSavingSessionId] = useState(false);
  const [savingWebhookSecret, setSavingWebhookSecret] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadClient();
  }, [clientId]);

  async function loadClient() {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();

      if (error) throw error;
      setClient(data);
      setSystemPrompt(data.system_prompt || 'Tu es un assistant utile.');
      setSessionId(data.whatsapp_session_id || '');
      setWebhookSecret(data.webhook_secret || '');
    } catch (error) {
      console.error('Error loading client:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePrompt() {
    if (!client) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ system_prompt: systemPrompt })
        .eq('id', clientId);

      if (error) throw error;
      alert('System prompt sauvegardé !');
      loadClient();
    } catch (error) {
      console.error('Error saving prompt:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveSessionId() {
    if (!client) return;
    
    setSavingSessionId(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ whatsapp_session_id: sessionId.trim() })
        .eq('id', clientId);

      if (error) throw error;
      alert('✅ Session ID mis à jour ! Le bot devrait maintenant fonctionner.');
      loadClient();
    } catch (error) {
      console.error('Error saving session ID:', error);
      alert('Erreur lors de la sauvegarde du Session ID');
    } finally {
      setSavingSessionId(false);
    }
  }

  async function handleSaveWebhookSecret() {
    if (!client) return;
    
    setSavingWebhookSecret(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ webhook_secret: webhookSecret.trim() || null })
        .eq('id', clientId);

      if (error) throw error;
      alert('✅ Webhook Secret mis à jour !');
      loadClient();
    } catch (error) {
      console.error('Error saving webhook secret:', error);
      alert('Erreur lors de la sauvegarde du Webhook Secret');
    } finally {
      setSavingWebhookSecret(false);
    }
  }

  async function handleToggleActive() {
    if (!client) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir ${client.is_active ? 'mettre en pause' : 'réactiver'} ce client ?`)) {
      return;
    }

    setToggling(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_active: !client.is_active })
        .eq('id', clientId);

      if (error) throw error;
      alert(`✅ Client ${!client.is_active ? 'réactivé' : 'mis en pause'} avec succès !`);
      loadClient();
    } catch (error) {
      console.error('Error toggling client status:', error);
      alert('❌ Erreur lors de la modification du statut');
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    if (!client) return;
    
    if (!confirm(`⚠️ ÊTES-VOUS ABSOLUMENT SÛR de vouloir supprimer le client "${client.name}" ?\n\nCette action est IRRÉVERSIBLE et supprimera également :\n- Tous les documents associés\n- Tous les logs de conversation\n- Toutes les données liées\n\nTapez "SUPPRIMER" pour confirmer.`)) {
      return;
    }

    const confirmation = prompt('Tapez "SUPPRIMER" (en majuscules) pour confirmer la suppression :');
    if (confirmation !== 'SUPPRIMER') {
      alert('Suppression annulée');
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;
      alert('✅ Client supprimé avec succès !');
      router.push('/admin/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      alert('❌ Erreur lors de la suppression du client');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg">Chargement...</p>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-lg text-red-600">Client introuvable</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin/clients')}
            className="text-blue-600 hover:underline mb-4"
          >
            ← Retour à la liste
          </button>
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">{client.name}</h1>
            <div className="flex gap-2">
              <button
                onClick={handleToggleActive}
                disabled={toggling}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                  client.is_active
                    ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                    : 'bg-green-100 text-green-800 hover:bg-green-200'
                }`}
              >
                {toggling
                  ? '...'
                  : client.is_active
                  ? '⏸️ Mettre en pause'
                  : '▶️ Réactiver'}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-100 text-red-800 rounded-lg text-sm font-medium hover:bg-red-200 transition disabled:opacity-50"
              >
                {deleting ? 'Suppression...' : '🗑️ Supprimer'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Informations</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WhatsApp Session ID (depuis WasenderAPI Dashboard)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={sessionId}
                  onChange={(e) => setSessionId(e.target.value)}
                  placeholder="Coller le Session ID exact depuis WasenderAPI"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder:text-gray-900"
                />
                <button
                  onClick={handleSaveSessionId}
                  disabled={savingSessionId || !sessionId.trim()}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                >
                  {savingSessionId ? 'Sauvegarde...' : 'Mettre à jour'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ⚠️ Important : Le Session ID doit correspondre exactement à celui dans WasenderAPI Dashboard → Sessions
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Webhook Secret (Optionnel)
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  placeholder="Laissez vide pour utiliser le secret global"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm placeholder:text-gray-900"
                />
                <button
                  onClick={handleSaveWebhookSecret}
                  disabled={savingWebhookSecret}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                >
                  {savingWebhookSecret ? 'Sauvegarde...' : 'Mettre à jour'}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Webhook Secret WasenderAPI pour ce client (optionnel, utilise WASENDER_WEBHOOK_SECRET global si non défini)
              </p>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Phone ID:</span> {client.whatsapp_phone_id}</p>
              <p>
                <span className="font-medium">Statut:</span>{' '}
                <span className={client.is_active ? 'text-green-600' : 'text-gray-600'}>
                  {client.is_active ? 'Actif' : 'Inactif'}
                </span>
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">System Prompt</h2>
          <p className="text-sm text-gray-600 mb-3">
            Le prompt définit la personnalité et le comportement du bot. 
            <span className="text-blue-600 ml-1">
              💡 Guide complet : <code className="bg-gray-100 px-1 rounded text-xs">memory-bank/system-prompt-restaurant-optimized.md</code>
            </span>
          </p>
          <textarea
            rows={10}
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4 font-mono text-sm text-gray-900 placeholder:text-gray-900"
            placeholder="Instructions pour le bot..."
          />
          <button
            onClick={handleSavePrompt}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Base de Connaissances</h2>
          <p className="text-gray-600 mb-4">
            Uploadez un PDF pour alimenter le bot avec des informations spécifiques.
          </p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              formData.append('client_id', clientId);
              
              const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
              if (!fileInput?.files?.[0]) {
                alert('Veuillez sélectionner un fichier PDF');
                return;
              }
              
              formData.append('pdf', fileInput.files[0]);
              
              try {
                const response = await fetch('/api/ingest', {
                  method: 'POST',
                  body: formData,
                });
                
                const result = await response.json();
                if (response.ok) {
                  alert(`✅ ${result.message || 'PDF vectorisé avec succès !'}`);
                } else {
                  alert(`❌ Erreur: ${result.error || 'Erreur lors de l\'upload'}`);
                }
              } catch (error) {
                console.error('Error uploading PDF:', error);
                alert('Erreur lors de l\'upload du PDF');
              }
            }}
          >
            <input
              type="file"
              name="pdf"
              accept=".pdf"
              required
              className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              type="submit"
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition"
            >
              Uploader et Vectoriser le PDF
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

