import os
import zipfile
import subprocess
import pandas as pd
import duckdb
from pathlib import Path

def download_file(url: str, output_zip: str):
    if not os.path.exists(output_zip):
        print(f"Téléchargement du fichier {os.path.basename(output_zip)}...")
        subprocess.run(["wget", "-q", url, "-O", output_zip], check=True)
    return output_zip


def extract_mapping(zip_path: str, output_parquet: str, mode: str):
    if os.path.exists(output_parquet):
        return output_parquet
        
    print(f"Extraction du mapping {mode}...")
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        xlsx_file = [f for f in zip_ref.namelist() if f.endswith('.xlsx')][0]
        zip_ref.extract(xlsx_file, path=os.path.dirname(zip_path))
        extracted_path = os.path.join(os.path.dirname(zip_path), xlsx_file)
        
    print(f"Lecture du fichier Excel {mode}...")
    df = pd.read_excel(extracted_path, sheet_name="Composition_communale", skiprows=5, engine="calamine")
    
    if mode == "EPCI":
        df = df[['CODGEO', 'EPCI', 'LIBEPCI', 'DEP', 'REG']]
    else:
        df = df[['CODGEO', 'EPT', 'LIBEPT']]
        
    df.rename(columns={'CODGEO': 'plg_code_commune'}, inplace=True)
    df.to_parquet(output_parquet)
    print(f"Mapping {mode} sauvegardé dans {output_parquet}")
    
    if os.path.exists(extracted_path):
        os.remove(extracted_path)
        
    return output_parquet


def enrich_accords_with_geoloc(accords_parquet: str, epci_parquet: str, ept_parquet: str, output_parquet: str):
    sirene_url = "https://object.files.data.gouv.fr/data-pipeline-open/siren/geoloc/GeolocalisationEtablissement_Sirene_pour_etudes_statistiques_utf8.parquet"
    
    print("Enrichissement des accords avec les données SIRENE, EPCI et EPT via DuckDB...")
    
    con = duckdb.connect(database=':memory:')
    
    query = f"""
    SELECT 
        a.*,
        s.x, s.y, s.epsg, s.plg_qp24, s.plg_iris, s.plg_zus, s.plg_qp15, s.plg_qva, s.plg_code_commune,
        s.y_latitude, s.x_longitude,
        e.EPCI, e.LIBEPCI, e.DEP, e.REG,
        t.EPT, t.LIBEPT
    FROM read_parquet('{accords_parquet}') a
    LEFT JOIN read_parquet('{sirene_url}') s
        ON a.SIRET = s.siret
    LEFT JOIN read_parquet('{epci_parquet}') e
        ON s.plg_code_commune = e.plg_code_commune
    LEFT JOIN read_parquet('{ept_parquet}') t
        ON s.plg_code_commune = t.plg_code_commune
    """
    
    df_enriched = con.execute(query).df()
    
    df_enriched.to_parquet(output_parquet)
    print(f"Fichier final enrichi sauvegardé dans {output_parquet}")
    return output_parquet


def process_geoloc(accords_in: str, accords_out: str):
    tmp_dir = Path("ACCORDS_PROFESSIONNELS/tmp")
    tmp_dir.mkdir(parents=True, exist_ok=True)
    
    epci_url = "https://www.insee.fr/fr/statistiques/fichier/2510634/epci_au_01-01-2026.zip"
    ept_url = "https://www.insee.fr/fr/statistiques/fichier/2510634/ept_au_01-01-2026.zip"
    
    epci_zip = tmp_dir / "epci.zip"
    ept_zip = tmp_dir / "ept.zip"
    epci_parquet = tmp_dir / "epci_mapping.parquet"
    ept_parquet = tmp_dir / "ept_mapping.parquet"
    
    download_file(epci_url, str(epci_zip))
    download_file(ept_url, str(ept_zip))
    
    extract_mapping(str(epci_zip), str(epci_parquet), "EPCI")
    extract_mapping(str(ept_zip), str(ept_parquet), "EPT")
    
    enrich_accords_with_geoloc(accords_in, str(epci_parquet), str(ept_parquet), accords_out)

if __name__ == "__main__":
    accords_in = "ACCORDS_PROFESSIONNELS/data/outputs/202511_ACCO_MESURES_MOBILITES_FINAL.parquet"
    accords_out = "ACCORDS_PROFESSIONNELS/data/outputs/202511_ACCO_MESURES_MOBILITES_FINAL_ENRICHIS.parquet"
    process_geoloc(accords_in, accords_out)
