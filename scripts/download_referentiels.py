import os
import sys
import time
import requests
import zipfile
import shutil
import tempfile
from tqdm import tqdm
from pathlib import Path
import duckdb

# Configurations des fichiers et des URLs les plus récentes de Juillet 2026
REFERENTIELS = {
    "geoloc-geolocalisationetablissement-sirene-pour-etudes-statistiques-parquet.parquet": {
        "url": "https://static.data.gouv.fr/resources/geolocalisation-des-etablissements-du-repertoire-sirene-pour-les-etudes-statistiques/20260621-112946/geoloc-geolocalisationetablissement-sirene-pour-etudes-statistiques-parquet.parquet",
        "desc": "Géolocalisation établissements SIRENE (parquet)"
    },
    "StockEtablissement_utf8.parquet": {
        "url": "https://static.data.gouv.fr/resources/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/20260701-093629/stock-stocketablissement-parquet.parquet",
        "desc": "StockEtablissement (parquet)"
    },
    "StockUniteLegale_utf8.parquet": {
        "url": "https://static.data.gouv.fr/resources/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/20260701-093003/stock-stockunitelegale-parquet.parquet",
        "desc": "StockUniteLegale (parquet)"
    }
}

target_dir = Path("/home/onyxia/work/ACCORDS_PROFESSIONNELS/data/inputs/referentiels")

def download_file_stream(url: str, dest_path: Path, desc: str):
    """Télécharge un fichier brut par flux avec barre de progression."""
    response = requests.get(url, stream=True, timeout=60)
    response.raise_for_status()
    
    total_size = int(response.headers.get('content-length', 0))
    chunk_size = 1024 * 1024  # 1 Mo chunks
    
    with open(dest_path, "wb") as f, tqdm(
        desc=desc,
        total=total_size,
        unit='B',
        unit_scale=True,
        unit_divisor=1024,
        miniters=1
    ) as bar:
        for chunk in response.iter_content(chunk_size=chunk_size):
            if chunk:
                f.write(chunk)
                bar.update(len(chunk))

def download_and_convert_if_needed(url: str, dest_path: Path, desc: str):
    print(f"\nDébut du traitement : {desc}")
    print(f"Depuis : {url}")
    print(f"Vers : {dest_path}")
    
    # Fichier temporaire final pour éviter de corrompre l'existant si interruption
    temp_dest_path = dest_path.with_suffix(".tmp")
    
    # Détection si c'est un ZIP (et donc un CSV à convertir en Parquet)
    is_zip = ".zip" in url.lower() or "csv" in url.lower()
    
    try:
        if is_zip:
            # Étape A: Télécharger l'archive ZIP temporaire
            with tempfile.TemporaryDirectory() as tmp_dir:
                zip_temp_path = Path(tmp_dir) / "downloaded_archive.zip"
                print(f"Téléchargement de l'archive ZIP intermédiaire...")
                download_file_stream(url, zip_temp_path, f"{desc} (ZIP)")
                
                # Étape B: Extraire le CSV
                print(f"Extraction du fichier CSV de l'archive ZIP...")
                with zipfile.ZipFile(zip_temp_path, 'r') as zip_ref:
                    csv_files = [f for f in zip_ref.namelist() if f.endswith('.csv')]
                    if not csv_files:
                        raise ValueError("Aucun fichier .csv trouvé dans l'archive ZIP.")
                    csv_filename = csv_files[0]
                    zip_ref.extract(csv_filename, path=tmp_dir)
                    extracted_csv_path = Path(tmp_dir) / csv_filename
                
                # Étape C: Convertir le CSV en Parquet avec DuckDB (ultra-rapide et économe en RAM)
                print(f"Conversion du CSV en Parquet avec DuckDB...")
                con = duckdb.connect()
                # Lecture automatique des types de CSV et copie vers Parquet
                con.execute(f"COPY (SELECT * FROM read_csv_auto('{extracted_csv_path}')) TO '{temp_dest_path}' (FORMAT 'PARQUET')")
                print("✓ Conversion terminée avec succès.")
        else:
            # Téléchargement direct s'il s'agit déjà d'un fichier Parquet
            download_file_stream(url, temp_dest_path, desc)
            
        # Étape D: Remplacement atomique de l'ancien référentiel
        if dest_path.exists():
            backup_path = dest_path.with_suffix(".bak")
            print(f"Création d'une sauvegarde préventive : {backup_path.name}")
            if backup_path.exists():
                backup_path.unlink()
            dest_path.rename(backup_path)
            
        temp_dest_path.rename(dest_path)
        print(f"✓ Fichier actualisé avec succès : {dest_path.name}")
        
    except Exception as e:
        if temp_dest_path.exists():
            temp_dest_path.unlink()
        print(f"❌ Erreur lors de l'actualisation de {desc}: {e}")
        raise e

def validate_parquet(path: Path):
    print(f"\nValidation du fichier Parquet : {path.name}")
    con = duckdb.connect()
    try:
        row_count_df = con.execute(f"SELECT count(*) as cnt FROM '{path}'").df()
        row_count = int(row_count_df['cnt'].iloc[0])
        print(f"  - Nombre de lignes : {row_count:,}")
        
        schema_df = con.execute(f"DESCRIBE SELECT * FROM '{path}' LIMIT 1").df()
        columns = schema_df['column_name'].tolist()
        print(f"  - Nombre de colonnes : {len(columns)}")
        print(f"  - Exemples de colonnes : {', '.join(columns[:10])}...")
        
        print("✓ Fichier Parquet valide et lisible par DuckDB")
    except Exception as e:
        print(f"❌ Erreur de validation DuckDB sur {path.name} : {e}")
        raise e

def main():
    target_dir.mkdir(parents=True, exist_ok=True)
    
    print("==================================================")
    print(" ACTUALISATION DES RÉFÉRENTIELS DE L'OPEN DATA ")
    print("==================================================")
    
    for filename, info in REFERENTIELS.items():
        dest_path = target_dir / filename
        try:
            download_and_convert_if_needed(info["url"], dest_path, info["desc"])
            validate_parquet(dest_path)
        except Exception as e:
            print(f"Échec de l'actualisation du fichier {filename}")
            sys.exit(1)
            
    print("\n==================================================")
    print("✓ TOUTES LES ACTUALISATIONS ONT ÉTÉ EFFECTUÉES AVEC SUCCÈS")
    print("==================================================")

if __name__ == "__main__":
    main()
