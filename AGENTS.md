# 🤖 Guide des Agents & Reprise de Pipeline (`AGENTS.md`)

Guide technique et opérationnel pour initialiser une nouvelle instance d'exécution (Onyxia / VM Linux) et lancer le traitement d'une année d'accords (ex: 2022).

---

## 🚨 0. Règles d'Or Immédiates

1. **NE JAMAIS SCANNER MINIO OU GIT POUR LES RÉFÉRENTIELS MÉTIER IDFM !**
   Les 2 fichiers suivants sont **internes et confidentiels** (absents de Git et de MinIO S3) :
   - `data/inputs/referentiels/20260318_categories_mots_cles.csv` (mapping catégories / mots-clés, Jalons 1 & 2)
   - `data/inputs/referentiels/20260507_ref_mesures_idfm.csv` (16 mesures officielles IDFM, Jalon 2)
   👉 **Si ces 2 fichiers sont absents, les demander IMMÉDIATEMENT à l'humain** sans perdre de temps à fouiller.

2. **Référentiels Open Data (SIRENE & Géo - Jalon 3) en 1 seule commande** :
   ```bash
   python scripts/download_referentiels.py
   ```
   Ce script installe et valide automatiquement les 4 fichiers publics nécessaires :
   - `geoloc-geolocalisationetablissement-sirene-pour-etudes-statistiques-parquet.parquet` (Insee Data.gouv)
   - `StockUniteLegale_utf8.parquet` (Insee Data.gouv)
   - `fr-esr-referentiel-geographique.csv` (MESR)
   - `ept.zip` (Insee Métropole Grand Paris)

3. **Expiration des Jetons STS MinIO (Validité 24h)** :
   Sur Onyxia / SSP Cloud, `AWS_SESSION_TOKEN` expire au bout de 24 heures. Si une erreur `InvalidAccessKeyId` survient lors d'un accès S3 :
   👉 **Demander à l'humain ses credentials MinIO rafraîchis** (*Mon compte ➔ Stockage*).

---

## ⚡ 1. Initialisation sur Instance Vierge (Cold Start)

Exécuter depuis `/home/onyxia/work` :

```bash
cd /home/onyxia/work

# 1. Cloner le projet sous le nom conventionnel ACCORDS_PROFESSIONNELS
git clone https://github.com/AliHmaou/accords_entreprises.git ACCORDS_PROFESSIONNELS
cd ACCORDS_PROFESSIONNELS

# 2. Installer les dépendances Python
pip install pandas pyarrow duckdb openai python-dotenv huggingface_hub python-calamine boto3 s3fs

# 3. Lier le binaire Pandoc (préinstallé avec Quarto sur Onyxia)
sudo ln -sf $(ls -d /usr/local/lib/quarto-*/bin/tools/x86_64/pandoc 2>/dev/null | tail -n 1) /usr/local/bin/pandoc
pandoc --version | head -n 1

# 4. Fichier d'environnement (.env)
cp .env.template .env
```

Contenu minimal requis dans `.env` :
```ini
# Modèle LLM (Azure AI Foundry)
AZURE_AI_API_KEY=votre_cle_azure
AZURE_AI_ENDPOINT=https://dlb-azureai-tst-ais02.services.ai.azure.com/openai/v1
AZURE_AI_MODEL=gpt-5.4-nano
LLM_TEMPERATURE=0.0

# Accès S3 / MinIO Onyxia
AWS_ACCESS_KEY_ID=votre_access_key
AWS_SECRET_ACCESS_KEY=votre_secret_key
AWS_SESSION_TOKEN=votre_token_sts
AWS_S3_ENDPOINT=minio.data-platform-self-service.net
AWS_DEFAULT_REGION=fr-central

# Hugging Face
HF_TOKEN=hf_votre_token_write
HF_REPO_ID=alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES
ANNEE_FILTRE_DEFAUT=all
```

```bash
# 5. Installer les référentiels
# -> S'assurer que les 2 CSV métier IDFM sont déposés dans data/inputs/referentiels/
# -> Télécharger les 4 référentiels Open Data :
python scripts/download_referentiels.py
```

---

## 🚀 2. Traitement d'une Année (Exemple : 2022)

Le script `scripts/batch_and_upload.py` est **100% autonome et résilient** :
* Télécharge automatiquement les archives brutes `.tar.gz` depuis MinIO S3 (`dila_acco/`) si absentes en local.
* Exécute séquentiellement chaque mois : Ingestion ➔ XML ➔ Pandoc ➔ NLP Jalon 1 ➔ LLM Jalon 2 (`gpt-5.4-nano`) ➔ Géo Jalon 3.
* Applique automatiquement la normalisation des 16 mesures IDFM et le dédoublonnage métier (`correct_and_deduplicate.py`).
* Téléverse au fil de l'eau les 3 Parquets (`brut`, `ENRICHIS`, `ENRICHIS_CORRIGES`) et le log sur MinIO (`dila_acco/run_gpt_nano/`).
* **Tolérant aux pannes** : si le jeton STS MinIO expire en cours de run, le script ne plante pas et conserve tous les Parquets localement dans `data/outputs/`.

### Commande pour lancer l'année 2022 complète en arrière-plan :
```bash
cd /home/onyxia/work/ACCORDS_PROFESSIONNELS

nohup python3 -u scripts/batch_and_upload.py \
  --archives acco_2022_01.tar.gz,acco_2022_02.tar.gz,acco_2022_03.tar.gz,acco_2022_04.tar.gz,acco_2022_05.tar.gz,acco_2022_06.tar.gz,acco_2022_07.tar.gz,acco_2022_08.tar.gz,acco_2022_09.tar.gz,acco_2022_10.tar.gz,acco_2022_11.tar.gz,acco_2022_12.tar.gz \
  --year all \
  --log-file batch_run_2022.log > batch_run_2022.log 2>&1 &
```

### Suivi :
```bash
tail -f batch_run_2022.log
ps aux | grep batch_and_upload
```

*(Adapter simplement le millésime dans la liste `--archives` pour traiter 2021, 2023, 2024, etc.).*

---

## 📦 3. Consolidation Globale & Déploiement Final

Une fois les runs mensuels terminés :

### A. Fusion consolidée (Schéma 45 colonnes dédoublonné)
```bash
python scripts/consolidate_final.py
```
Génère le Parquet consolidé global dédoublonné et prêt pour le Dashboard.

### B. Déploiement sur Hugging Face
```bash
python -c "
import os
from dotenv import load_dotenv
from src.upload_hf import upload_to_huggingface

load_dotenv()
repo = os.getenv('HF_REPO_ID')
token = os.getenv('HF_TOKEN')
file_path = 'data/outputs/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet'

upload_to_huggingface(file_path, repo, token, 'IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet')
"
```
Le dashboard en ligne prend automatiquement en compte le nouveau jeu de données à jour.
