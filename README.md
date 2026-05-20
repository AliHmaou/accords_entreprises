# Pipeline d'Analyse des Accords d'Entreprises (Mobilités)

Bienvenue sur le dépôt du projet **Accords Entreprises**. Ce projet propose un pipeline complet de bout-en-bout permettant de traiter, d'analyser sémantiquement, de géolocaliser, et de visualiser des accords professionnels d'entreprises.

Il a été conçu initialement autour de la thématique des **mobilités durables**, mais son architecture modulaire (fichiers de mots-clés externes, prompts IA personnalisables) permet de l'adapter à n'importe quel autre sujet issu des Négociations Annuelles Obligatoires (NAO).

---

## 🎯 Architecture du Projet

Ce dépôt est scindé en deux grandes parties :

1. **Le Pipeline de Traitement (Python)** : Situé à la racine et dans le dossier `src/`, il télécharge, décompresse, parse, convertit (en Markdown via Pandoc), chunk, interroge un Modèle d'Intelligence Artificielle (LLM), enrichit les données géographiquement (SIRENE / EPCI / EPT via DuckDB) et pousse le jeu de données Parquet vers [Hugging Face](https://huggingface.co/).
2. **L'Application de Visualisation (React/Vite)** : Située dans le dossier `app/src/`, cette WebApp Dashboard *serverless* utilise **DuckDB-Wasm** pour importer et requêter nativement le fichier Parquet hébergé en ligne. Elle est déployée automatiquement de façon "flat" (statique) sur GitHub Pages via des Actions GitHub.

---

## 🚀 Démarrer avec le Pipeline (Python)

Toute la documentation technique sur l'utilisation du pipeline de données est disponible dans les sous-dossiers dédiés :

- 📖 **[Guide d'utilisation détaillé (Installation & Lancement)](./docs/usage/usage.md)**
- 📖 **[Architecture Générale du Pipeline](./docs/plan/general_plan.md)**
- 📖 **[Documentation sur le Chunking (NLP)](./docs/plan/chunking.md)**
- 📖 **[Réflexions sur les Prompts (IA)](./docs/plan/prompt.md)**
- 📖 **[Documentation de l'Enrichissement Géographique](./docs/plan/enrichissement.md)**

### Installation rapide

1. Installer **Pandoc** sur votre machine : `sudo apt-get install pandoc`
2. Installer les paquets Python requis :
   ```bash
   pip install pandas pyarrow duckdb openai python-dotenv huggingface_hub python-calamine
   ```
3. Cloner le `.env.template` vers `.env` et renseigner vos API keys (ex: Groq, OpenAI, Hugging Face).
4. Lancer le pipeline interactif : `python scripts/run_pipeline.py`

---

## 📊 L'Application Web (React)

L'application de data-visualisation est conçue pour être **100% statique** et s'exécute entièrement dans le navigateur du visiteur (zéro backend).

### Technologies clés
- **React / Vite** pour l'interface.
- **DuckDB-Wasm** pour la base de données in-browser (requêtage SQL ultra-rapide sur le fichier Parquet public).
- **GitHub Pages** pour le déploiement.

### Développement local de l'App

Si vous souhaitez modifier le dashboard (situé dans `app/src/`) :
```bash
cd app/src/
npm install
npm run dev
```

L'application charge par défaut le dernier Parquet exporté sur Hugging Face (URL configurable dans votre `.env` local).

### Déploiement continu
Chaque push (modification) apporté sur la branche `main` qui impacte le dossier `app/src/` déclenche automatiquement notre **GitHub Action** (`.github/workflows/deploy.yml`). Cette action compile (build) le code React et déploie les fichiers statiques HTML/JS directement sur les serveurs GitHub Pages !
