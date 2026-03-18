# Utilisation du Pipeline des Accords Professionnels

Ce projet permet de traiter des archives d'accords d'entreprise pour en extraire des informations sur les mobilités des salariés, grâce à un pipeline NLP et LLM.

## Prérequis

1. **Python 3.10+** avec les dépendances installées :
   ```bash
   pip install pandas pyarrow duckdb openai python-dotenv
   ```
2. **Pandoc** doit être installé sur votre système (pour la conversion Word vers Markdown) :
   ```bash
   sudo apt-get install pandoc
   ```
3. Fichier de configuration **.env** :
   Copiez `.env.template` vers `.env` et remplissez vos clés API (ex: `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`).

## Étapes du Pipeline

Le pipeline se lance via le script interactif :
```bash
python scripts/run_pipeline.py
```

Vous serez guidé pas à pas :
1. **Extraction** : Décompresse les archives `.tar.gz` ou `.zip` présentes dans `data/inputs/archives_acco`.
2. **Parsing XML** : Extrait les métadonnées pour créer un index.
3. **Conversion Pandoc** : Transforme les `.docx` / `.doc` en Markdown pour faciliter l'analyse.
4. **Jalon 1 (NLP)** : Filtre les accords pour ne garder que ceux qui contiennent les mots-clés liés à la mobilité. Extrait un "chunk" (contexte étendu).
5. **Jalon 2 (IA)** : Envoie le contexte à un LLM (via OpenAI/Groq/Azure) pour extraire les mesures structurées. Un filtre par année (ex: 2025) vous sera demandé.

## Fichiers Intermédiaires
Tous les résultats de chaque étape (Jalons) sont sauvegardés dans `data/outputs/interim/`, ce qui permet de relancer le pipeline à partir d'une certaine étape sans tout recalculer (ex: sauter la conversion Pandoc si déjà faite).
Le fichier final est généré dans `data/outputs/`.
