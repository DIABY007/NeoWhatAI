'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

export default function NewClientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    whatsapp_phone_id: '',
    whatsapp_session_id: '',
    whatsapp_token: '',
    webhook_secret: '',
    openrouter_key: '',
    system_prompt: `Tu es l'assistant WhatsApp de l'entreprise. Réponds aux questions en t'appuyant sur notre base de connaissances.

**RÈGLES :**
- ❌ JAMAIS "D'après le guide..." → ✅ "Chez nous...", "Nous proposons..."
- Style mobile : 2 phrases max par paragraphe, sauts de ligne doubles
- Gras uniquement pour prix/heures/dates/nombres
- Termine par un CTA (ex: "Souhaitez-vous réserver ?" au lieu de "Besoin d'autres infos ?")
- Ton chaleureux et professionnel
- Un seul emoji par section max

Base-toi UNIQUEMENT sur le contexte fourni. Si l'info n'est pas disponible, dis-le poliment et propose une alternative.`,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('clients')
        .insert([formData])
        .select()
        .single();

      if (error) throw error;

      router.push(`/admin/clients/${data.id}`);
    } catch (error) {
      console.error('Error creating client:', error);
      alert('Erreur lors de la création du client');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Nouveau Client
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du Client *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-900"
              placeholder="Ex: Clinique Dentaire ABC"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WhatsApp Phone ID *
            </label>
            <input
              type="text"
              required
              value={formData.whatsapp_phone_id}
              onChange={(e) => setFormData({ ...formData, whatsapp_phone_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-900"
              placeholder="Ex: 221771234567"
            />
            <p className="text-xs text-gray-500 mt-1">
              Numéro de téléphone WhatsApp (format international)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WasenderAPI Session ID *
            </label>
            <input
              type="text"
              required
              value={formData.whatsapp_session_id}
              onChange={(e) => setFormData({ ...formData, whatsapp_session_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-900"
              placeholder="ID de session WasenderAPI"
            />
            <p className="text-xs text-gray-500 mt-1">
              L'ID de session créé dans WasenderAPI pour ce client
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              WasenderAPI Token (Optionnel)
            </label>
            <input
              type="password"
              value={formData.whatsapp_token}
              onChange={(e) => setFormData({ ...formData, whatsapp_token: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-900"
              placeholder="Laissez vide pour utiliser la clé globale"
            />
            <p className="text-xs text-gray-500 mt-1">
              API Key WasenderAPI pour ce client (optionnel)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Webhook Secret (Optionnel)
            </label>
            <input
              type="password"
              value={formData.webhook_secret}
              onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-900"
              placeholder="Laissez vide pour utiliser le secret global"
            />
            <p className="text-xs text-gray-500 mt-1">
              Webhook Secret WasenderAPI pour ce client (optionnel, utilise WASENDER_WEBHOOK_SECRET global si non défini)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              OpenRouter API Key (Optionnel)
            </label>
            <input
              type="password"
              value={formData.openrouter_key}
              onChange={(e) => setFormData({ ...formData, openrouter_key: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-900"
              placeholder="Laissez vide pour utiliser la clé globale"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              System Prompt
            </label>
            <textarea
              rows={8}
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-gray-900 placeholder:text-gray-900"
              placeholder="Instructions pour le bot..."
            />
            <p className="text-xs text-gray-500 mt-1">
              Définit la personnalité et le comportement du bot. Le prompt par défaut est optimisé pour un restaurant (ton naturel, mobile-first, CTAs).
            </p>
            <p className="text-xs text-blue-600 mt-1">
              💡 Voir le guide complet : <code className="bg-gray-100 px-1 rounded">memory-bank/system-prompt-restaurant-optimized.md</code>
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Création...' : 'Créer le Client'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 border border-gray-400 rounded-lg hover:bg-gray-100 transition text-gray-900 font-medium"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

