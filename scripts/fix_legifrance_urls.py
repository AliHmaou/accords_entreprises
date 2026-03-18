"""
Script de correction des URLs Légifrance dans les parquets HuggingFace.

Problème : les URLs étaient construites avec /conv_coll/id/ au lieu de /acco/id/
Ce script :
  1. Télécharge les parquets depuis HuggingFace
  2. Corrige les URLs (ou les crée depuis l'ID si absentes)
  3. Repousse les parquets corrigés sur HuggingFace

Usage :
    cd /home/onyxia/work
    python3 ACCORDS_PROFESSIONNELS/scripts/fix_legifrance_urls.py
"""

import os
import sys
import duckdb
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv
from huggingface_hub import HfApi, hf_hub_download

# Charger le .env
load_dotenv(Path(__file__).parent.parent / ".env")

HF_TOKEN = os.getenv("HF_TOKEN")
HF_REPO_ID = os.getenv("HF_REPO_ID", "alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES")
LEGIFRANCE_BASE = "https://www.legifrance.gouv.fr/acco/id/"

# Fichiers à corriger sur HuggingFace
HF_FILES = [
    "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES.parquet",
    "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet",
]

TMP_DIR = Path(__file__).parent.parent / "tmp" / "hf_fix"
TMP_DIR.mkdir(parents=True, exist_ok=True)


def fix_urls_in_parquet(local_path: str) -> str:
    """
    Corrige les URLs Légifrance dans un fichier parquet via DuckDB.
    Retourne le chemin du fichier corrigé.
    """
    output_path = str(local_path).replace(".parquet", "_fixed.parquet")

    con = duckdb.connect(database=":memory:")

    # Vérifier si la colonne url_legifrance existe
    schema = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{local_path}')").fetchdf()
    columns = schema["column_name"].tolist()

    if "url_legifrance" in columns:
        print(f"  Colonne url_legifrance trouvée — correction des URLs...")
        query = f"""
        COPY (
            SELECT
                * EXCLUDE (url_legifrance),
                CASE
                    WHEN url_legifrance IS NULL OR url_legifrance = ''
                        THEN '{LEGIFRANCE_BASE}' || ID
                    ELSE regexp_replace(
                        url_legifrance,
                        'legifrance\\.gouv\\.fr/(conv_coll|acco)/id/',
                        'legifrance.gouv.fr/acco/id/'
                    )
                END AS url_legifrance
            FROM read_parquet('{local_path}')
        ) TO '{output_path}' (FORMAT PARQUET)
        """
    elif "ID" in columns:
        print(f"  Colonne url_legifrance absente — création depuis l'ID...")
        query = f"""
        COPY (
            SELECT
                *,
                '{LEGIFRANCE_BASE}' || ID AS url_legifrance
            FROM read_parquet('{local_path}')
        ) TO '{output_path}' (FORMAT PARQUET)
        """
    else:
        print(f"  ⚠️  Ni url_legifrance ni ID trouvés — fichier ignoré.")
        return local_path

    con.execute(query)
    con.close()

    # Vérification rapide
    df_check = pd.read_parquet(output_path, columns=["url_legifrance"])
    sample = df_check["url_legifrance"].dropna().iloc[0] if len(df_check) > 0 else "N/A"
    print(f"  ✅ Exemple URL corrigée : {sample}")

    return output_path


def main():
    if not HF_TOKEN:
        print("❌ HF_TOKEN non trouvé dans le .env. Abandon.")
        sys.exit(1)

    api = HfApi(token=HF_TOKEN)

    for hf_filename in HF_FILES:
        print(f"\n{'='*60}")
        print(f"Traitement de : {hf_filename}")
        print(f"{'='*60}")

        # 1. Téléchargement depuis HuggingFace
        local_path = TMP_DIR / hf_filename
        print(f"  Téléchargement depuis HF...")
        try:
            downloaded = hf_hub_download(
                repo_id=HF_REPO_ID,
                filename=hf_filename,
                repo_type="dataset",
                token=HF_TOKEN,
                local_dir=str(TMP_DIR),
            )
            print(f"  ✅ Téléchargé : {downloaded}")
            local_path = Path(downloaded)
        except Exception as e:
            print(f"  ❌ Erreur téléchargement : {e}")
            continue

        # 2. Correction des URLs
        fixed_path = fix_urls_in_parquet(str(local_path))

        # 3. Re-upload sur HuggingFace
        print(f"  Upload du fichier corrigé vers HF ({hf_filename})...")
        try:
            api.upload_file(
                path_or_fileobj=fixed_path,
                path_in_repo=hf_filename,
                repo_id=HF_REPO_ID,
                repo_type="dataset",
            )
            print(f"  ✅ Upload réussi !")
        except Exception as e:
            print(f"  ❌ Erreur upload : {e}")

    print(f"\n{'='*60}")
    print("Script terminé.")


if __name__ == "__main__":
    main()
