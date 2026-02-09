# 🚀 Guide de Déploiement Vercel - NeoWhatAI

Ce guide vous accompagne étape par étape pour déployer NeoWhatAI sur Vercel.

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :

1. ✅ Un compte [Vercel](https://vercel.com) (gratuit)
2. ✅ Un compte [Supabase](https://supabase.com) avec un projet créé
3. ✅ Un compte [OpenRouter](https://openrouter.ai) avec une clé API
4. ✅ Un compte [WasenderAPI](https://wasenderapi.com) avec une session WhatsApp
5. ✅ Le code poussé sur GitHub (déjà fait ✅)

---

## 🔧 Étape 1 : Préparer Supabase

### 1.1 Créer le projet Supabase

1. Allez sur [supabase.com](https://supabase.com) et créez un nouveau projet
2. Notez l'URL du projet et les clés API

### 1.2 Exécuter le schéma SQL

1. Dans le dashboard Supabase, allez dans **SQL Editor**
2. Ouvrez le fichier `supabase/schema.sql` de ce projet
3. Copiez tout le contenu et exécutez-le dans l'éditeur SQL
4. Vérifiez que l'extension `vector` est activée : **Database > Extensions > vector**

### 1.3 Créer le bucket Storage

1. Allez dans **Storage** dans le dashboard Supabase
2. Cliquez sur **New bucket**
3. Nom : `raw_documents`
4. Public : ❌ **Non** (privé)
5. Cliquez sur **Create bucket**

### 1.4 Configurer les politiques Storage (optionnel)

1. Dans **SQL Editor**, exécutez le contenu de `supabase/storage-setup.sql`
2. Cela configure les permissions pour le bucket

### 1.5 Récupérer les clés Supabase

Dans **Settings > API**, notez :
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ SECRET)

---

## 🔧 Étape 2 : Configurer OpenRouter

1. Allez sur [openrouter.ai](https://openrouter.ai)
2. Créez un compte et allez dans **Keys**
3. Créez une nouvelle clé API
4. Notez la clé → `OPENROUTER_API_KEY`

---

## 🔧 Étape 3 : Configurer WasenderAPI

1. Allez sur [wasenderapi.com](https://wasenderapi.com)
2. Créez un compte et créez une session WhatsApp
3. Scannez le QR code avec votre téléphone
4. Récupérez :
   - **API Key** → `WASENDER_API_KEY`
   - **Session ID** (sera utilisé dans la base de données)

---

## 🚀 Étape 4 : Déployer sur Vercel

### 4.1 Importer le projet

1. Allez sur [vercel.com](https://vercel.com) et connectez-vous
2. Cliquez sur **Add New... > Project**
3. Importez le dépôt GitHub `DIABY007/NeoWhatAI`
4. Vercel détectera automatiquement Next.js

### 4.2 Configurer les variables d'environnement

Dans la section **Environment Variables**, ajoutez toutes ces variables :

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_anon_key
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-votre_cle_openrouter

# WasenderAPI
WASENDER_API_KEY=votre_wasender_api_key
WASENDER_BASE_URL=https://wasenderapi.com/api/v1

# WhatsApp Webhook
WHATSAPP_VERIFY_TOKEN=votre_token_securise_aleatoire
WASENDER_WEBHOOK_SECRET=votre_webhook_secret

# Message par défaut
DEFAULT_ERROR_MESSAGE=Désolé, je rencontre une petite difficulté technique pour récupérer cette information. 🛠️ Un conseiller humain va prendre le relais si nécessaire. N'hésitez pas à reformuler votre question dans quelques instants !
```

**⚠️ Important :**
- Cochez **Production**, **Preview**, et **Development** pour toutes les variables
- Pour `WHATSAPP_VERIFY_TOKEN` et `WASENDER_WEBHOOK_SECRET`, générez des tokens sécurisés :
  ```bash
  openssl rand -hex 32
  ```

### 4.3 Configurer le build

Vercel détectera automatiquement :
- **Framework Preset** : Next.js
- **Build Command** : `npm run build`
- **Output Directory** : `.next`

Le fichier `vercel.json` configure déjà :
- Timeout de 300s pour l'API d'ingestion (traitement PDF)
- Timeout de 60s pour l'API webhook
- Région : `cdg1` (Paris)

### 4.4 Déployer

1. Cliquez sur **Deploy**
2. Attendez que le build se termine (2-3 minutes)
3. Une fois terminé, vous obtiendrez une URL : `https://neowhatai-xxx.vercel.app`

---

## 🔗 Étape 5 : Configurer WasenderAPI Webhook

Maintenant que votre application est déployée, configurez le webhook WasenderAPI :

1. Allez dans votre dashboard WasenderAPI
2. Trouvez la section **Webhooks** ou **Settings**
3. Configurez :
   - **URL** : `https://votre-domaine.vercel.app/api/webhook`
   - **Events** : Sélectionnez `message.received` ou `webhook-message-received`
   - **Verify Token** : Utilisez la même valeur que `WHATSAPP_VERIFY_TOKEN`
   - **Secret** : Utilisez la même valeur que `WASENDER_WEBHOOK_SECRET` (si supporté)

---

## ✅ Étape 6 : Vérifier le déploiement

### 6.1 Tester l'application

1. Ouvrez l'URL de votre déploiement Vercel
2. Vous devriez voir la page d'accueil
3. Cliquez sur **"Accéder au Dashboard Admin"**

### 6.2 Créer un client de test

1. Dans le dashboard admin, créez un nouveau client
2. Remplissez les informations :
   - **Nom** : Test Client
   - **WhatsApp Phone ID** : Votre numéro WhatsApp
   - **WhatsApp Session ID** : L'ID de session WasenderAPI
   - **OpenRouter Key** : (optionnel, utilise la clé globale si vide)

### 6.3 Tester l'upload PDF

1. Allez sur la page du client créé
2. Uploadez un PDF dans la section **Base de Connaissances**
3. Attendez que le traitement se termine (peut prendre 1-2 minutes)
4. Vérifiez que vous voyez un message de succès

### 6.4 Tester le webhook WhatsApp

1. Envoyez un message WhatsApp à votre numéro de test
2. Le bot devrait répondre automatiquement
3. Vérifiez les logs dans Vercel : **Deployments > [votre déploiement] > Functions**

---

## 🔍 Dépannage

### Problème : Build échoue

- Vérifiez que toutes les variables d'environnement sont configurées
- Vérifiez les logs de build dans Vercel
- Assurez-vous que `package.json` contient tous les scripts nécessaires

### Problème : Erreur 500 sur l'API

- Vérifiez les logs des fonctions serverless dans Vercel
- Vérifiez que Supabase est accessible depuis Vercel
- Vérifiez que les clés API sont correctes

### Problème : Webhook ne reçoit pas de messages

- Vérifiez que l'URL du webhook dans WasenderAPI est correcte
- Vérifiez que `WHATSAPP_VERIFY_TOKEN` correspond
- Vérifiez les logs de l'API webhook dans Vercel

### Problème : Timeout sur l'upload PDF

- Le timeout est configuré à 300s (5 minutes) dans `vercel.json`
- Si c'est insuffisant, vous pouvez l'augmenter dans `vercel.json`
- Note : Vercel Pro permet jusqu'à 300s, Vercel Hobby limite à 10s (mais les fonctions peuvent avoir 60s)

---

## 📊 Monitoring

### Logs Vercel

1. Allez dans votre projet Vercel
2. Cliquez sur **Deployments**
3. Sélectionnez un déploiement
4. Cliquez sur **Functions** pour voir les logs des API routes

### Logs Supabase

1. Dashboard Supabase > **Logs**
2. Vérifiez les requêtes SQL et les erreurs

---

## 🔄 Mises à jour futures

À chaque push sur la branche `main` :
1. Vercel déploiera automatiquement une nouvelle version
2. Les variables d'environnement sont conservées
3. Vous pouvez prévisualiser les changements avant de les promouvoir en production

---

## 📝 Notes importantes

- ⚠️ Ne commitez **jamais** les fichiers `.env.local` ou `.env`
- ✅ Utilisez toujours les variables d'environnement Vercel pour les secrets
- ✅ Le fichier `vercel.json` configure les timeouts nécessaires
- ✅ Le fichier `.vercelignore` exclut les fichiers inutiles du déploiement

---

## 🎉 Félicitations !

Votre application NeoWhatAI est maintenant déployée sur Vercel et prête à recevoir des messages WhatsApp !

Pour toute question, consultez :
- [Documentation Vercel](https://vercel.com/docs)
- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Supabase](https://supabase.com/docs)

