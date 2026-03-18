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
    df = pd.read_excel(
        extracted_path,
        sheet_name="Composition_communale",
        skiprows=5,
        engine="calamine"
    )

    if mode == "EPT":
        df = df[['CODGEO', 'EPT', 'LIBEPT']]
        df.rename(columns={'CODGEO': 'plg_code_commune'}, inplace=True)
        df.to_parquet(output_parquet)
        print(f"Mapping {mode} sauvegardé dans {output_parquet}")

    if os.path.exists(extracted_path):
        os.remove(extracted_path)

    return output_parquet


def build_geo_referentiel(ref_csv: str, output_parquet: str):
    """
    Construit un référentiel commune -> région/département/EPCI
    à partir du fichier fr-esr-referentiel-geographique.csv.
    """
    if os.path.exists(output_parquet):
        return output_parquet

    print("Construction du référentiel géographique depuis le CSV ESR...")
    df = pd.read_csv(
        ref_csv,
        sep=';',
        usecols=['REG_CODE', 'REG_NOM', 'DEP_CODE', 'DEP_NOM', 'COM_CODE', 'EPCI_ID', 'EPCI_NOM'],
        dtype=str
    )

    # Nettoyage : on garde une ligne par commune (dédoublonnage sur COM_CODE)
    df = df.drop_duplicates(subset=['COM_CODE'])

    # Remplacer les valeurs 'SO' (sans objet) par None
    df = df.replace('SO', None)

    df.rename(columns={
        'COM_CODE': 'plg_code_commune',
        'REG_CODE': 'localisation_region_code',
        'REG_NOM': 'localisation_region_nom',
        'DEP_CODE': 'localisation_departement_code',
        'DEP_NOM': 'localisation_departement_nom',
        'EPCI_ID': 'localisation_epci_id',
        'EPCI_NOM': 'localisation_epci_nom',
    }, inplace=True)

    df.to_parquet(output_parquet, index=False)
    print(f"Référentiel géographique sauvegardé dans {output_parquet}")
    return output_parquet


def enrich_accords_with_geoloc(
    accords_parquet: str,
    geo_ref_parquet: str,
    ept_parquet: str,
    output_parquet: str
):
    sirene_url = (
        "https://object.files.data.gouv.fr/data-pipeline-open/siren/geoloc/"
        "GeolocalisationEtablissement_Sirene_pour_etudes_statistiques_utf8.parquet"
    )

    print("Enrichissement des accords avec les données SIRENE + référentiel géo via DuckDB...")

    con = duckdb.connect(database=':memory:')

    query = f"""
    SELECT
        a.*,
        s.y_latitude AS localisation_lat,
        s.x_longitude AS localisation_lon,
        s.plg_code_commune AS localisation_code_commune,
        g.localisation_region_code,
        g.localisation_region_nom,
        g.localisation_departement_code,
        g.localisation_departement_nom,
        g.localisation_epci_id,
        g.localisation_epci_nom,
        t.EPT AS localisation_ept_id,
        t.LIBEPT AS localisation_ept_nom
    FROM read_parquet('{accords_parquet}') a
    LEFT JOIN read_parquet('{sirene_url}') s
        ON a.SIRET = s.siret
    LEFT JOIN read_parquet('{geo_ref_parquet}') g
        ON s.plg_code_commune = g.plg_code_commune
    LEFT JOIN read_parquet('{ept_parquet}') t
        ON s.plg_code_commune = t.plg_code_commune
    """

    df_enriched = con.execute(query).df()

    df_enriched.to_parquet(output_parquet)
    print(f"Fichier final enrichi sauvegardé dans {output_parquet}")
    return output_parquet


def process_geoloc(accords_in: str, accords_out: str):
    base_dir = Path("ACCORDS_PROFESSIONNELS")
    tmp_dir = base_dir / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    ref_csv = base_dir / "data/inputs/referentiels/fr-esr-referentiel-geographique.csv"
    ept_url = "https://www.insee.fr/fr/statistiques/fichier/2510634/ept_au_01-01-2026.zip"

    ept_zip = tmp_dir / "ept.zip"
    ept_parquet = tmp_dir / "ept_mapping.parquet"
    geo_ref_parquet = tmp_dir / "geo_referentiel.parquet"

    download_file(ept_url, str(ept_zip))
    extract_mapping(str(ept_zip), str(ept_parquet), "EPT")
    build_geo_referentiel(str(ref_csv), str(geo_ref_parquet))

    enrich_accords_with_geoloc(
        accords_in,
        str(geo_ref_parquet),
        str(ept_parquet),
        accords_out
    )


if __name__ == "__main__":
    accords_in = "ACCORDS_PROFESSIONNELS/data/outputs/202511_ACCO_MESURES_MOBILITES_FINAL.parquet"
    accords_out = "ACCORDS_PROFESSIONNELS/data/outputs/202511_ACCO_MESURES_MOBILITES_FINAL_ENRICHIS.parquet"
    process_geoloc(accords_in, accords_out)
