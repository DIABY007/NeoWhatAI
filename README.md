# WhatsApp AI Automation SaaS

Plateforme SaaS pour déployer et gérer des chatbots WhatsApp intelligents basés sur des bases de connaissances PDF via RAG (Retrieval-Augmented Generation).

## 🚀 Stack Technique

- **Framework**: Next.js 15 (App Router) + TypeScript
- **Base de données**: Supabase (PostgreSQL + pgvector)
- **IA**: OpenRouter (pour LLM) + OpenAI (pour embeddings)
- **WhatsApp**: WasenderAPI
- **Déploiement**: Vercel

## 📋 Prérequis

1. Node.js 18+ et npm
2. Compte Supabase
3. Clé API OpenRouter
4. Clé API WasenderAPI
5. (Optionnel) Clé API OpenAI pour les embeddings

## 🔧 Installation

1. Installer les dépendances :
```bash
npm install
```

2. Créer le fichier `.env.local` à la racine du projet :
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# OpenRouter
OPENROUTER_API_KEY=your_openrouter_api_key

# WasenderAPI
WASENDER_API_KEY=your_wasender_api_key
WASENDER_BASE_URL=https://wasenderapi.com/api/v1

# WhatsApp Webhook
WHATSAPP_VERIFY_TOKEN=your_random_secure_token_here

# Message par défaut en cas d'erreur
DEFAULT_ERROR_MESSAGE=Désolé, je rencontre une petite difficulté technique pour récupérer cette information. 🛠️ Un conseiller humain va prendre le relais si nécessaire. N'hésitez pas à reformuler votre question dans quelques instants !
```

3. Configurer Supabase :
   - Créer un nouveau projet Supabase
   - Dans l'éditeur SQL, exécuter le script `supabase/schema.sql`
   - Activer l'extension `vector` si nécessaire

4. Lancer le serveur de développement :
```bash
npm run dev
```

## 📁 Structure du Projet

```
/
├── app/                    # Next.js App Router
│   ├── admin/             # Dashboard Admin
│   ├── api/               # API Routes (webhooks, etc.)
│   └── page.tsx           # Page d'accueil
├── lib/                   # Utilitaires
│   ├── supabase/          # Clients Supabase
│   ├── openrouter.ts      # API OpenRouter
│   └── wasender.ts        # API WasenderAPI
├── types/                 # Types TypeScript
├── supabase/              # Scripts SQL
└── memory-bank/           # Documentation du projet
```

## 🎯 Fonctionnalités

### Phase 1 : MVP
- ✅ Dashboard Admin pour créer et gérer des clients
- ✅ Upload et vectorisation de PDF
- ✅ Webhook WhatsApp pour recevoir et répondre aux messages
- ✅ RAG complet (recherche vectorielle + génération de réponse)

### Phase 2 : À venir
- Support des images entrantes (Vision)
- Dashboard de suivi des coûts (Tokens)
- Reset de la base de connaissances

## 📚 Documentation

Voir le dossier `memory-bank/` pour :
- `prd.md` : Spécifications produit
- `implementation-plan.md` : Plan d'implémentation détaillé
- `tech-stack.md` : Détails de la stack technique

## 🚢 Déploiement

Le projet est prêt pour le déploiement sur Vercel ! 

### Fichiers de configuration créés :
- ✅ `vercel.json` - Configuration Vercel avec timeouts optimisés
- ✅ `.vercelignore` - Exclusion des fichiers inutiles
- ✅ `env.example` - Template des variables d'environnement
- ✅ `next.config.ts` - Configuration Next.js optimisée pour la production

### Guide de déploiement complet

📖 **Consultez [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md) pour un guide détaillé étape par étape.**

### Déploiement rapide :

1. **Push sur GitHub** ✅ (déjà fait)
2. **Connecter le repo à Vercel** :
   - Allez sur [vercel.com](https://vercel.com)
   - Importez le dépôt `DIABY007/NeoWhatAI`
3. **Configurer les variables d'environnement** :
   - Utilisez le fichier `env.example` comme référence
   - Ajoutez toutes les variables dans Vercel (Production, Preview, Development)
4. **Déployer** :
   - Cliquez sur "Deploy"
   - Attendez la fin du build
5. **Configurer WasenderAPI** :
   - Mettez à jour l'URL du webhook avec l'URL Vercel
   - Utilisez le même `WHATSAPP_VERIFY_TOKEN`

## 📝 License

Private - Tous droits réservés
# NeoWhatAI
