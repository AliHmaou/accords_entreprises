# Plan d'action : Pipeline de traitement des accords professionnels

## 1. Objectifs généraux
Automatiser le traitement d'archives contenant des accords professionnels (Word + XML) pour en extraire des métadonnées, convertir chaque fichier word en Markdown, garder le lien avec les métadonnées, identifier les textes évoquant les mobilités et extraire des mesures spécifiques via l'Intelligence Artificielle. Le but final est de générer une table structurée au format Parquet (`data/outputs/*.parquet`).

## 2. Jalon principal : Comptabilisation des accords sur les mobilités
Avant d'arriver au traitement par IA, un **premier objectif prioritaire** est d'obtenir le résultat d'une **recherche brute** permettant de répondre à la question : *"Combien d'accords ont évoqué la question des mobilités des salariés ?"*. Cela permettra d'avoir un état des lieux initial rapide. Pour cela des listes de mots clés structurées ont été préparées et sont dans `data/inputs/referentiels/20260318_categories_mots_cles.csv`

## 3. Architecture du pipeline
Le projet sera découpé en plusieurs modules (fichiers Python dans `src/`) coordonnés par un script d'orchestration (`scripts/run_pipeline.py`).

1. **Extraction (`src/extraction.py`)** : Décompresser les archives (.zip ou .tar) depuis `data/inputs/archives_acco/` vers un dossier de travail temporaire (`tmp/`).
2. **Parsing des métadonnées (`src/metadata_parser.py`)** : Lire les fichiers `.xml` associés aux documents Word pour extraire les informations clés (ID, siret, raison sociale, etc.) vers un DataFrame.
3. **Conversion Document (`src/conversion.py`)** : Appeler `pandoc` (en mode shell pour des raisons de performance) sur les documents Word pour les convertir en format Markdown.
4. **Filtrage textuel (Jalon 1 - `src/nlp_processing.py`)** : Scanner les fichiers Markdown pour rechercher des mots-clés bruts concernant les mobilités et générer des statistiques immédiates ("Combien d'accords en parlent ?"). Isoler ensuite le *contexte étendu* autour de ces mentions.
5. **Analyse par IA (Jalon 2 - `src/llm_analysis.py`)** : Soumettre le `contexte_etendu` obtenu à une API LLM pour structurer les informations : générer un `resume_mesure_proposee`, définir les `moyens_materiels` et `moyens_financiers`, et établir le flag `est_mobilites_durables`.
Pour cela un référentiel de mesures sera communiqué, il permettra aussi au LLM de pointer la mesure la plus pertinente parmi un référentiel de mesures pré-identifiées.
6. **Exportation (`scripts/run_pipeline.py`)** : Assembler toutes ces données et écrire un fichier récapitulatif Parquet dans `data/outputs/`.

## 4. Étapes de développement

1. **Mise en place de l'environnement** :
   - Vérification/installation de Pandoc.
   - Initialisation des bibliothèques (`pandas`, `pyarrow`, `duckdb`, etc.).

2. **Étape 1 : Ingestion et Conversion**
   - Téléchargement d'une archive de test : https://echanges.dila.gouv.fr/OPENDATA/ACCO/ACCO_20250708-064156.tar.gz
   - Script de dézippage des archives.
   - Commande shell `pandoc` optimisée.
   - Parsing XML.

3. **Étape 2 : Recherche brute (Jalon 1)**
   - Utilisation du référentiel des mots-clés liés à la "mobilité".
   - Script cherchant ces mots-clés dans les `.md` et extrayant des blocs de texte.
   - Génération d'un premier tableau (CSV ou Parquet) pour obtenir la volumétrie.

4. **Étape 3 : Traitement LLM (Jalon 2)**
   - Intégration de l'IA sur le corpus identifié en étape 2.
   - Tests de prompt pour extraire correctement les données.

5. **Étape 4 : Tests et consolidation**
   - S'assurer du respect du schéma cible (comparaison avec `202511_ACCO_MESURES_MOBILITES_HACKATHON_IDFM_2022_2025_VF.parquet`).

Chaque étape génère les résultats associés dans le répertoire adapté du projet, notamment en ce qui concerne les outputs intermédiaires qui sont clairement organisés car possiblement réutilisables.