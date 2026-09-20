import os
import sys
import time
import requests
import zipfile
import shutil
import tempfile
import pandas as pd
from tqdm import tqdm
from pathlib import Path
import duckdb

# Configurations des 4 référentiels Open Data requis par le pipeline (Jalon 3 - Géolocalisation)
REFERENTIELS = {
    "geoloc-geolocalisationetablissement-sirene-pour-etudes-statistiques-parquet.parquet": {
        "url": "https://static.data.gouv.fr/resources/geolocalisation-des-etablissements-du-repertoire-sirene-pour-les-etudes-statistiques/20260821-081708/geoloc-geolocalisationetablissement-sirene-pour-etudes-statistiques-parquet.parquet",
        "desc": "Base SIRENE géolocalisée (Insee data.gouv - Août 2026)",
        "type": "parquet"
    },
    "StockUniteLegale_utf8.parquet": {
        "url": "https://static.data.gouv.fr/resources/base-sirene-des-entreprises-et-de-leurs-etablissements-siren-siret/20260901-084858/stock-stockunitelegale-parquet.parquet",
        "desc": "Base SIRENE StockUniteLegale (Insee data.gouv - Septembre 2026)",
        "type": "parquet"
    },
    "fr-esr-referentiel-geographique.csv": {
        "url": "https://data.enseignementsup-recherche.gouv.fr/api/explore/v2.1/catalog/datasets/fr-esr-referentiel-geographique/exports/csv?limit=-1",
        "desc": "Référentiel géographique communes/EPCI/régions (MESR - 2026)",
        "type": "csv_esr"
    },
    "ept.zip": {
        "url": "https://www.insee.fr/fr/statistiques/fichier/2510634/ept_au_01-01-2026.zip",
        "desc": "Composition communale EPT Grand Paris (Insee - 2026)",
        "type": "zip"
    }
}

target_dir = Path(__file__).resolve().parent.parent / "data/inputs/referentiels"

def download_file_stream(url: str, dest_path: Path, desc: str):
    """Télécharge un fichier brut par flux avec barre de progression."""
    response = requests.get(url, stream=True, timeout=120)
    response.raise_for_status()
    
    total_size = int(response.headers.get('content-length', 0))
    chunk_size = 2 * 1024 * 1024  # 2 Mo chunks
    
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

def download_referentiel(name: str, info: dict, target_dir: Path):
    dest_path = target_dir / name
    temp_path = target_dir / f"{name}.tmp"
    
    print(f"\nTraitement : {info['desc']}")
    print(f"URL : {info['url']}")
    print(f"Cible : {dest_path}")
    
    # Si le fichier existe déjà et est valide, on saute
    if dest_path.exists() and dest_path.stat().st_size > 0:
        print(f"✓ Fichier déjà présent ({dest_path.stat().st_size / (1024*1024):.1f} Mo), étape ignorée.")
        return

    try:
        download_file_stream(info["url"], temp_path, info["desc"])
        
        # Post-traitement spécifique si nécessaire
        if info["type"] == "csv_esr":
            print("Normalisation des en-têtes du CSV ESR en MAJUSCULES...")
            with open(temp_path, 'r', encoding='utf-8') as f:
                first_line = f.readline()
                rest = f.read()
            first_line_upper = first_line.upper()
            with open(dest_path, 'w', encoding='utf-8') as f:
                f.write(first_line_upper + rest)
            temp_path.unlink(missing_ok=True)
        elif info["type"] == "parquet":
            print("Validation du format Parquet...")
            con = duckdb.connect()
            cnt = con.execute(f"SELECT count(*) FROM read_parquet('{temp_path}')").fetchone()[0]
            print(f"✓ Parquet valide ({cnt:,} lignes).")
            temp_path.rename(dest_path)
        elif info["type"] == "zip":
            with zipfile.ZipFile(temp_path, 'r') as z:
                files = z.namelist()
                print(f"✓ Archive ZIP valide contenant : {files}")
            temp_path.rename(dest_path)
        else:
            temp_path.rename(dest_path)
            
        print(f"✅ {name} installé avec succès.")
    except Exception as e:
        if temp_path.exists():
            temp_path.unlink()
        print(f"❌ Erreur lors du téléchargement de {name} : {e}")
        raise e

def main():
    target_dir.mkdir(parents=True, exist_ok=True)
    
    print("==================================================")
    print(" TÉLÉCHARGEMENT DES RÉFÉRENTIELS OPEN DATA (GÉO/SIRENE) ")
    print("==================================================")
    
    for filename, info in REFERENTIELS.items():
        try:
            download_referentiel(filename, info, target_dir)
        except Exception as e:
            print(f"Échec critique sur {filename}: {e}")
            sys.exit(1)
            
    print("\n==================================================")
    print("✓ TOUS LES RÉFÉRENTIELS OPEN DATA SONT PRÊTS DANS :")
    print(f"  {target_dir}")
    print("==================================================")

if __name__ == "__main__":
    main()
