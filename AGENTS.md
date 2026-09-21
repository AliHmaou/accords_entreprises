# 🤖 Guide des Agents & Reprise de Pipeline (`AGENTS.md`)

Ce document est le guide de référence technique destiné aux agents d'IA (Cline, etc.) et aux développeurs reprenant le projet **Accords Entreprises (Mobilités)** sur une nouvelle instance d'exécution (ex. conteneur Onyxia / SSP Cloud / VM Linux).

---

## 1. 🏗️ Architecture Globale du Projet

Le projet valorise les accords collectifs d'entreprises déposés sur Légifrance (DILA) pour identifier, extraire et cartographier les mesures de mobilités durables pour **Île-de-France Mobilités**.

Il est composé de deux briques complémentaires :
1. **Pipeline de Données (Python & DuckDB)** :
   - Ingestion d'archives brutes DILA (`.tar.gz` / `.zip`).
   - Parsing des métadonnées XML (`src/metadata_parser.py`).
   - Conversion des documents bureautiques `.docx` en Markdown (`src/conversion.py` via **Pandoc**).
   - Filtrage sémantique et chunking contextuel (Jalon 1, `src/nlp_processing.py`).
   - Analyse sémantique par IA (Jalon 2, `src/llm_analysis.py` avec `gpt-5.4-nano` sur **Azure AI Foundry** en batch de 5 chunks).
   - Enrichissement géographique SIRENE / EPCI / EPT via DuckDB (Jalon 3, `src/geoloc_epci.py`).
   - Dédoublonnage métier et redressement des modalités (`src/deduplicate.py` et `scripts/correct_and_deduplicate.py`).
   - Export Parquet consolidé vers **Hugging Face** (`src/upload_hf.py`).
2. **Dashboard Web (React / TypeScript / Vite)** :
   - Situé dans `app/src/`, déployé automatiquement sur GitHub Pages.
   - Fonctionne en mode *serverless* grâce à **DuckDB-Wasm** qui interroge directement le Parquet distant hébergé sur Hugging Face.

---

## 2. ⚡ Initialisation sur une Nouvelle Instance (Cold Start)

Lors du démarrage d'une nouvelle instance (par exemple sur un conteneur Onyxia / SSP Cloud vierge) :

### A. Cloner le Dépôt GitHub
Depuis votre espace de travail (`/home/onyxia/work`), cloner le projet sous le nom conventionnel `ACCORDS_PROFESSIONNELS` :
```bash
cd /home/onyxia/work

# Clonage HTTPS standard
git clone https://github.com/AliHmaou/accords_entreprises.git ACCORDS_PROFESSIONNELS
cd ACCORDS_PROFESSIONNELS

# Alternative : Clonage authentifié via Personal Access Token (PAT GitHub)
git clone https://<VOTRE_GITHUB_TOKEN>@github.com/AliHmaou/accords_entreprises.git ACCORDS_PROFESSIONNELS
cd ACCORDS_PROFESSIONNELS
```

### B. Dépendances Python
Installer les paquets nécessaires dans l'environnement Python :
```bash
pip install pandas pyarrow duckdb openai python-dotenv huggingface_hub python-calamine boto3 s3fs
```

### C. Binaire Pandoc (Conversion docx -> Markdown)
Pandoc est indispensable pour le module `src/conversion.py`.
- **Sur Onyxia (si Quarto est préinstallé)** :
  ```bash
  sudo ln -sf /usr/local/lib/quarto-1.9.37/bin/tools/x86_64/pandoc /usr/local/bin/pandoc
  hash -r
  pandoc --version
  ```
- **Sur un conteneur Debian/Ubuntu standard** :
  ```bash
  sudo apt-get update && sudo apt-get install -y pandoc
  ```

### D. Fichier d'environnement (`.env`)
À la racine de `ACCORDS_PROFESSIONNELS/`, créer ou cloner le fichier `.env` avec les accès requis :
```ini
# Modèle LLM (Azure AI Foundry)
AZURE_AI_API_KEY=votre_cle_azure
AZURE_AI_ENDPOINT=https://votre-endpoint.services.ai.azure.com/openai/v1
AZURE_AI_MODEL=gpt-5.4-nano
LLM_TEMPERATURE=0.0

# Accès S3 / MinIO Onyxia (pour téléchargement des archives brutes)
AWS_ACCESS_KEY_ID=votre_access_key
AWS_SECRET_ACCESS_KEY=votre_secret_key
AWS_SESSION_TOKEN=votre_token_de_session_si_sts
AWS_S3_ENDPOINT=minio.data-platform-self-service.net
AWS_DEFAULT_REGION=fr-central

# Publication Hugging Face
HF_TOKEN=hf_votre_token_write
HF_REPO_ID=alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES

# Filtre temporel par défaut
ANNEE_FILTRE_DEFAUT=all
```

---

## 3. 📥 Téléchargement des Archives depuis MinIO S3

Les archives mensuelles et hebdomadaires de Légifrance/DILA sont stockées sur le bucket S3/MinIO :
* **Bucket S3** : `user-alihmaou`
* **Chemin S3** : `dila_acco/acco_YYYY_MM.tar.gz`

Pour télécharger les archives manquantes dans `data/inputs/archives_acco/` :

```bash
# Télécharger un mois précis (ex: avril 2024)
python scripts/download_archives_s3.py --month 04

# Télécharger tous les mois de l'année 2024 (01 à 12)
python scripts/download_archives_s3.py --month all
```

---

## 4. 🚀 Lancement d'un Run de Traitement (Mode Batch / Background)

### A. Commande recommandée (résiliente aux fermetures de session)
Pour traiter un ou plusieurs mois en tâche de fond :
```bash
cd /home/onyxia/work/ACCORDS_PROFESSIONNELS

nohup python3 -u scripts/run_pipeline.py \
  --archives acco_2024_04.tar.gz,acco_2024_05.tar.gz \
  --year all \
  --skip-upload > batch_run_2024_04_05.log 2>&1 &
```

### B. Options CLI du pipeline
* `--archives archive1,archive2` : Liste des archives à traiter séquentiellement.
* `--year all` : Conserve tous les accords mentionnant la mobilité (indispensable pour les archives hors 2025).
* `--skip-upload` : Évite d'écraser prématurément le Parquet consolidé de production sur Hugging Face.
* `-y` ou `--yes` : Active le mode sans invite interactive.

### C. Suivi de l'avancement
```bash
# Suivre les logs en temps réel
tail -f batch_run_2024_04_05.log

# Vérifier les processus actifs
ps aux | grep run_pipeline
```

### D. Mécanisme de Cache et Reprise sur Incident
Chaque étape intermédiaire génère un fichier Parquet dans `data/outputs/interim/` :
1. `metadata_initial_<archive>.parquet` (Parsing XML)
2. `metadata_with_md_<archive>.parquet` (Conversion Pandoc)
3. `metadata_with_context_<archive>.parquet` (Extraction NLP / Jalon 1)
4. `ACCO_MESURES_MOBILITES_<archive>.parquet` (Analyse LLM / Jalon 2)
5. `ACCO_MESURES_MOBILITES_<archive>_ENRICHIS.parquet` (Géolocalisation / Jalon 3)

Si un run est interrompu, relancer la commande : le pipeline détecte automatiquement les fichiers déjà calculés et saute les étapes prêtes.


---

## 5. 🛠️ ÉTAPE CRUCIALE : Redressement des Modalités & Dédoublonnage

### A. Problématique
Le LLM (même avec une température à `0.0`) peut occasionnellement produire :
- Des fautes d'accord ou de syntaxe légères.
- Des troncatures ou variations de libellés.
- Des anomalies d'encodage UTF-8 (ex: `v\x00elo`, `t\u00e9l\u00e9travail`).

### B. Procédure de Correction
Le script `scripts/correct_and_deduplicate.py` applique une table de correspondance déterministe pour mapper strictement chaque extrait vers l'une des **16 mesures officielles du référentiel IDFM** :

| Mesures Officielles IDFM Validées |
| :--- |
| **Améliorer la sécurité routière** |
| **Déployer des dispositifs financiers d’aide à la mobilité** |
| **Inclure les engins de déplacements personnels EDPM** |
| **Mettre en place le forfait mobilité durable et l'indemnité kilométrique vélo IKV** |
| **Mettre en place un plan de mobilité employeur** |
| **Organiser l’usage de la voiture et des deux-roues motorisés** |
| **Organiser le stationnement des véhicules et des vélos** |
| **Organiser le télétravail et les horaires de travail** |
| **Prendre en compte la mobilité des salariés** |
| **Promouvoir l’autopartage** |
| **Promouvoir le vélo** |
| **Soutenir la transition énergétique du parc de véhicules de l’entreprise** |
| **Transition énergétique** |

Exécuter le redressement :

#### Redresser un fichier unitaire (recommandé après chaque mois traité) :
```bash
python scripts/correct_and_deduplicate.py \
  --input data/outputs/ACCO_MESURES_MOBILITES_acco_2024_02_ENRICHIS.parquet \
  --output data/outputs/ACCO_MESURES_MOBILITES_acco_2024_02_ENRICHIS_CORRIGES.parquet
```

#### Redresser le fichier global consolidé :
```bash
python scripts/correct_and_deduplicate.py
```

Ce script :
1. Corrige la colonne `mesures_ref_idfm` selon le mapping officiel IDFM (évite les fautes de frappe et artefacts d'encodage).
2. Applique la règle de dédoublonnage métier (`deduplicate_parquet`) : groupe par `ID` + `mesures_ref_idfm`, sélectionne l'extrait de chunk le plus complet et fusionne les thèmes de recherche.
3. Vérifie par DuckDB qu'aucune scorie ou pattern corrompu ne subsiste.

---

## 6. ☁️ Sauvegarde & Synchronisation MinIO (`run_gpt_nano`)

Afin de sauvegarder vos résultats et de pouvoir les partager entre différentes instances (ou reprendre le travail d'une instance à l'autre), déposez les fichiers Parquet (bruts, enrichis et corrigés) ainsi que les logs dans le bucket MinIO sous le préfixe dédié :
`s3://user-alihmaou/dila_acco/run_gpt_nano/`

Exemple de synchronisation en Python :
```python
import s3fs, os

fs = s3fs.S3FileSystem(client_kwargs={'endpoint_url': 'https://minio.data-platform-self-service.net/'})
prefix = 'user-alihmaou/dila_acco/run_gpt_nano'

# Uploader les résultats d'un mois
for fn in [
    'ACCO_MESURES_MOBILITES_acco_2024_02.parquet',
    'ACCO_MESURES_MOBILITES_acco_2024_02_ENRICHIS.parquet',
    'ACCO_MESURES_MOBILITES_acco_2024_02_ENRICHIS_CORRIGES.parquet'
]:
    local_p = f'data/outputs/{fn}'
    if os.path.exists(local_p):
        fs.put(local_p, f'{prefix}/{fn}')
        print(f'Uploadé : {fn}')
```

---

## 7. 📦 Concaténation Finale & Déploiement Hugging Face

Une fois toutes les archives unitaires traitées, enrichies et redressées :

### 1. Concaténer l'ensemble des fichiers unitaires
```bash
python scripts/concatenate_parquets.py
```
Génère le fichier consolidé global :
`data/outputs/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet`

### 2. Dédoublonner et Redresser le fichier global
```bash
python scripts/correct_and_deduplicate.py
```

### 3. Publier sur Hugging Face
Téléverser le fichier consolidé vers le dataset public :
```bash
python -c "
import os
from dotenv import load_dotenv
from src.upload_hf import upload_to_huggingface

load_dotenv()
repo = os.getenv('HF_REPO_ID')
token = os.getenv('HF_TOKEN')
file_path = 'data/outputs/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_CORRIGE_2025.parquet'

upload_to_huggingface(file_path, repo, token, 'IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet')
"
```
Le Dashboard React en ligne prend alors automatiquement en compte le nouveau jeu de données à jour.

---

## 8. 🧹 Bonnes Pratiques & Entretien de l'Espace Disque

- **Core Dumps** : Si un processus crash, vérifier la présence d'un fichier `core.XXXX` (qui peut peser ~4.7 Go) à la racine de `/home/onyxia/work` et le supprimer immédiatement (`rm -f /home/onyxia/work/core.*`).
- **Dossiers temporaires** : Le pipeline nettoie automatiquement `tmp/acco_<archive>` après chaque archive traitée.
- **Sécurité Git** : Ne jamais commiter de clés API, de fichiers `.env`, de scripts shell contenant des tokens d'authentification (`shellenv.sh`), ni de gros volumes `.parquet` ou `.tar.gz`. Vérifier systématiquement `git status` avant tout push.
