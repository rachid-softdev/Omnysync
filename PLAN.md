# Plan de Développement : OmniSync (Alternative Augmentée à Docswrite)

Ce document sert de guide de référence pour l'implémentation complète du SaaS **OmniSync**, une plateforme d'automatisation et d'optimisation de contenu multi-plateformes.

## 1. Vision du Produit
OmniSync n'est pas qu'un simple outil de transfert. C'est un orchestrateur qui récupère le contenu depuis des sources (Google Docs, Notion, Markdown), l'enrichit via IA (SEO, Maillage, Images), et le déploie sur diverses destinations (WordPress, Ghost, Webflow, Shopify) avec une synchronisation bidirectionnelle.

## 2. Stack Technique Recommandée
- **Framework :** Next.js (App Router) pour le SSR et les API Routes.
- **Style :** Tailwind CSS + Shadcn UI (Composants professionnels).
- **Authentification :** Clerk (Gestion facile des organisations/équipes).
- **Base de données :** PostgreSQL (via Supabase ou Prisma).
- **Gestion des tâches (Queue) :** BullMQ ou Upstash QStash (Crucial pour les exports longs).
- **Stockage Images :** AWS S3 ou Cloudinary (pour le traitement intermédiaire).
- **IA :** OpenAI SDK (GPT-4o pour le texte, DALL-E 3 pour les images).

## 3. Architecture des Données (Schema)
- **User / Organization :** Gestion des accès et abonnements.
- **Connectors :** Stockage sécurisé des tokens OAuth (Google, Notion) et clés API (WP, Ghost).
- **Documents :** Référence vers l'ID source, statut (Draft, Sync, Published), et métadonnées SEO.
- **SyncLogs :** Historique détaillé des erreurs et succès d'export.

## 4. Modules de Fonctionnalités (Backlog)

### Phase 1 : Le Cœur (MVP)
- **Authentification & Dashboard :** Interface de connexion et vue d'ensemble des documents synchronisés (Google Auth).
- **Connecteur Google Docs :** Intégration Google Picker pour sélectionner un doc.
- **Parser HTML/ProseMirror :** Conversion du Google Doc en HTML propre (nettoyage des styles inline inutiles de Google).
- **Bridge WordPress :** Export via l'API REST de WordPress (Gestion des catégories, tags et Featured Image).
- **Gestionnaire d'images :** Upload automatique des images du Doc vers la bibliothèque média WP.

### Phase 2 : Enrichissement IA & SEO
- **Module SEO :** Remplissage auto des champs Yoast/RankMath (Meta title, description) basé sur le contenu.
- **Générateur d'images IA :** Remplacement des placeholders `[AI-Image: prompt]` par des images générées et optimisées.
- **Smart Interlinking :** Analyse du site de destination et insertion automatique de 2-3 liens vers des articles existants pertinents.

### Phase 3 : Multi-Sources & Multi-Destinations
- **Source Notion :** Intégration de l'API Notion pour importer des pages.
- **Destinations Modernes :** Bridge pour Ghost (API Admin) et Webflow (CMS API).
- **Webhooks :** Déclenchement de l'export via un changement de statut dans Trello ou Airtable.

### Phase 4 : Synchronisation & Workflow Pro
- **2-Way Sync :** Détection des changements sur le document source et mise à jour de l'article déjà publié (sans doublon).
- **Portail d'Approbation :** Génération d'un lien de prévisualisation public pour validation client avant la publication réelle.
- **Analyse Post-Publication :** Récupération des stats de vue via Google Search Console.

## 5. Spécifications API & Sécurité
- **OAuth :** Utiliser les scopes `drive.readonly` pour Google.
- **Sécurité :** Chiffrement des clés API CMS (AES-256) en base de données.
- **Rate Limiting :** Implémenter des limites pour éviter le bannissement par les API des CMS.

## 6. Interface Utilisateur (UI)
- **Workflow Stepper :** Source -> Transformation (IA) -> Destination -> Confirmation.
- **Log Console :** Une console en temps réel montrant les étapes (ex: "Optimisation de l'image 1...", "Envoi vers WP...").

## 7. Instructions pour l'IA de Coding
1. "Commence par configurer un projet Next.js avec Shadcn UI et Prisma."
2. "Implémente l'authentification OAuth2 pour Google Drive."
3. "Crée un service de parsing qui transforme le JSON Google Doc en HTML sémantique propre."
4. "Développe le connecteur WordPress utilisant l'Application Password pour l'authentification REST API."
5. "Ajoute une file d'attente pour gérer les uploads d'images en arrière-plan."