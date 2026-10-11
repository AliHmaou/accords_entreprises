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

---

## 🧠 4. Inférence Ad Hoc de Nouveaux Insights (`scripts/infer_ad_hoc_insights.py`)

Ce script permet d'extraire de nouveaux indicateurs métiers directement depuis les fichiers Parquet Hugging Face complets de référence **sans rouvrir les archives brutes ni réanalyser l'intégralité du corpus** :

### A. Champs Détectés
1. **`est_prime_carburant`** (`"Oui"` / `"Non"`) :
   * Détecte explicitement l'instauration, l'attribution, l'augmentation ou la revalorisation d'une prime carburant, chèque carburant, bon carburant ou prise en charge spécifique des frais de carburant pour les trajets domicile-travail.
2. **`est_infra_velo`** (`"Oui"` / `"Non"`) :
   * Détecte les aménagements physiques et équipements matériels dédiés aux cyclistes (stationnement, abris, douches, vestiaires, casiers, bornes de recharge VAE, stations de gonflage/réparation, vélos de service...).
3. **`moyens_materiels`** :
   * Enrichi dynamiquement avec les équipements vélo extraits selon une **liste ouverte et fidèle au texte**. Ces éléments sont fusionnés sans doublons avec les mentions existantes (séparateur ` | `).

### B. Optimisation & Stratégie d'Exécution
* **Double filtre d'accélération** :
  - `mentionne_mobilite_ia = 'Oui'` (exclusion des ~70% d'accords sans mobilité confirmée par l'IA).
  - Présence des thématiques cibles : `theme_recherche ILIKE '%carburant%' OR theme_recherche ILIKE '%velo%'`.
* **Dédoublonnage des chunks** : Seuls les chunks textuels uniques (`extrait_chunk`) sont envoyés au LLM (`gpt-5.4-nano` en batchs de 5), puis les résultats sont re-jointoyés sur toutes les lignes.
* **Résilience par Checkpoint** : Sauvegarde incrémentale dans `data/outputs/interim/ad_hoc_insights_checkpoint.json` toutes les 20 itérations. Si le script est interrompu, la reprise est immédiate.
* **Double export automatique lors de l'upload (`--upload`)** :
  - Génère et téléverse le dataset National : `IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet` (248 746 lignes).
  - Extrait et téléverse la déclinaison Île-de-France : `IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_IDF.parquet` (68 230 lignes).

### C. Commandes d'Exécution
```bash
# Test pilote rapide (ex: 10 chunks) sur l'Île-de-France
python scripts/infer_ad_hoc_insights.py --scope idf --limit 10

# Exécution complète National + IDF en arrière-plan avec publication Hugging Face automatique :
nohup python3 -u scripts/infer_ad_hoc_insights.py --scope national --upload > infer_adhoc_national.log 2>&1 &
```

---

## 🏷️ 5. Simplification des Secteurs par Section NAF Insee (`app/src/nafConstants.ts`)

Pour remplacer la liste déroulante ingérable de 681 sous-classes APE :
1. **Règle officielle Insee (NAF rév. 2)** :
   * Les 2 premiers chiffres du `CODE_APE` correspondent à la **Division** (01 à 99).
   * La table de passage associe de manière déterministe chaque division à l'une des **21 Sections macroéconomiques (A à U)** :
     - *Exemples* : 10 à 33 ➔ **C - Industrie manufacturière**, 49 à 53 ➔ **H - Transports et entreposage**, 86 à 88 ➔ **Q - Santé humaine et action sociale**.
2. **Enrichissement DuckDB-Wasm dynamique** :
   * Réalisé à la volée en mémoire lors du chargement des données (`CODE_SECTION_NAF`, `SECTION_NAF`) en ~30 ms pour 68 000 lignes.
   * Ne nécessite aucun recalcul lourd des fichiers Parquet.
3. **Filtre en cascade dans l'application** :
   * L'utilisateur choisit d'abord une Section NAF macro (21 options).
   * Un sous-sélecteur dynamique contextualisé apparaît alors pour affiner vers les sous-secteurs spécifiques de la section choisie.

---

## 🖥️ 6. Dashboard Web : Ergonomie & Fonctionnalités Clés (`app/src/`)

L'application web React/Vite serverless (s'appuyant sur DuckDB-Wasm) intègre :

1. **Volet Latéral Rétractable (Hamburger Sidebar)** :
   * Les filtres et le bloc de périmètre actif (IDF / France) sont regroupés dans une barre latérale rétractable (`SidebarFilters.tsx`), ouverte par défaut.
   * Libère plus de 400 pixels de hauteur pour la carte et le tableau. La carte interactive Leaflet s'adapte automatiquement à l'ouverture/fermeture via un `ResizeObserver`.
2. **Recherche Globale Multi-Champs & Multi-Termes** :
   * Prend en charge indifféremment les identifiants d'accords (`ACCOTEXT...`), numéros SIRET (14 chiffres), noms d'entreprises, mots-clés (`theme_recherche`, `mot_cle_calcule`), synthèses de mesures et texte intégral des chunks (`extrait_chunk`).
   * Découpage par mots-clés multiples (ex: `"sncf vélo"` recherche la concordance sur chaque terme).
3. **Export Direct Excel (`.xlsx`) Sécurisé** :
   * Bouton dédié **`📊 Exporter en Excel (.xlsx)`** générant un classeur avec en-têtes français professionnels.
   * **Protection limite Microsoft Excel** : Troncature automatique des cellules textuelles à 32 700 caractères (`truncateForExcel`) pour respecter la spécification stricte d'Excel (32 767 car. max par cellule).
4. **Configuration par Défaut Métier** :
   * Onglet actif par défaut : **Carte interactive (`MapTab`)**.
   * Filtres activés d'emblée : **Mobilité IA = Oui**, **Île-de-France uniquement**, **Ignorer revendications**.
5. **Ventilation Territoriale par Couronnes Franciliennes** :
   * Donut 1 : **Paris (75)**
   * Donut 2 : **Petite Couronne (92, 93, 94)**
   * Donut 3 : **Grande Couronne (77, 78, 91, 95)**

