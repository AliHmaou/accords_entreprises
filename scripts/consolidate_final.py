import os
import sys
import duckdb
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

# Add src and scripts to python path
base_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(base_dir / "src"))
sys.path.append(str(base_dir / "scripts"))

from deduplicate import deduplicate_parquet
from correct_and_deduplicate import fix_label
from upload_hf import upload_to_huggingface
import boto3
from botocore.client import Config

OFFICIAL_IDFM_MEASURES = {
    "Utiliser les transports en commun",
    "Organiser le télétravail et les horaires de travail",
    "Promouvoir le vélo",
    "Encourager la marche",
    "Inclure les engins de déplacements personnels EDPM",
    "Promouvoir l’autopartage",
    "Promouvoir le covoiturage",
    "Organiser le stationnement des véhicules et des vélos",
    "Rembourser les transports en commun",
    "Organiser l’usage de la voiture et des deux-roues motorisés",
    "Améliorer la sécurité routière",
    "Mettre en place le forfait mobilité durable et l'indemnité kilométrique vélo IKV",
    "Soutenir la transition énergétique du parc de véhicules de l’entreprise",
    "Déployer des dispositifs financiers d’aide à la mobilité",
    "Prendre en compte la mobilité des salariés",
    "Mettre en place un plan de mobilité employeur",
    "AUCUNE_CORRESPONDANCE",
    "hors mesures IDFM",
}

def clean_measure(val):
    if not isinstance(val, str):
        return "AUCUNE_CORRESPONDANCE"
    cleaned = fix_label(val)
    if cleaned not in OFFICIAL_IDFM_MEASURES:
        return "hors mesures IDFM"
    return cleaned

def get_s3_client():
    load_dotenv(base_dir / ".env", override=True)
    aws_id = os.environ.get("AWS_ACCESS_KEY_ID")
    aws_secret = os.environ.get("AWS_SECRET_ACCESS_KEY")
    aws_token = os.environ.get("AWS_SESSION_TOKEN")
    endpoint = os.environ.get("AWS_S3_ENDPOINT", "minio.data-platform-self-service.net")
    if not endpoint.startswith("http"):
        endpoint = f"https://{endpoint}"
        
    session = boto3.Session(
        aws_access_key_id=aws_id,
        aws_secret_access_key=aws_secret,
        aws_session_token=aws_token
    )
    return session.client(
        "s3",
        endpoint_url=endpoint,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"})
    )

def main():
    load_dotenv(base_dir / ".env", override=True)
    outputs_dir = base_dir / "data/outputs"
    outputs_dir.mkdir(parents=True, exist_ok=True)
    
    print("==================================================")
    print(" FUSION CONSOLIDÉE MASTER : 2022 + BASE HF (2023-2026)")
    print("==================================================")
    
    # 1. Lister les 12 mois de 2022
    months_2022 = [f"{i:02d}" for i in range(1, 13)]
    files_2022 = [outputs_dir / f"ACCO_MESURES_MOBILITES_acco_2022_{m}_ENRICHIS_CORRIGES.parquet" for m in months_2022]
    
    dfs_2022 = []
    print("\n[Étape 1/6] Chargement et vérification des 12 mois de 2022...")
    for f in files_2022:
        if not f.exists():
            raise FileNotFoundError(f"Fichier manquant : {f.name}")
        df = pd.read_parquet(f)
        df["source_file"] = f.name
        if "mesures_ref_idfm" in df.columns:
            df["mesures_ref_idfm"] = df["mesures_ref_idfm"].apply(clean_measure)
        dfs_2022.append(df)
        print(f"  ✓ {f.name} : {len(df):,} lignes")
        
    df_all_2022 = pd.concat(dfs_2022, ignore_index=True)
    print(f"✓ Total année 2022 chargée : {len(df_all_2022):,} lignes")
    
    # 2. Charger le jeu existant depuis Hugging Face (ou local s'il existe)
    print("\n[Étape 2/6] Chargement du jeu master de référence depuis Hugging Face...")
    url_hf = "https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
    
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    df_base = con.execute(f'SELECT * FROM "{url_hf}"').df()
    print(f"✓ Total base HF chargée : {len(df_base):,} lignes")
    
    if "mesures_ref_idfm" in df_base.columns:
        df_base["mesures_ref_idfm"] = df_base["mesures_ref_idfm"].apply(clean_measure)
    
    # 3. Alignement des 45 colonnes
    print("\n[Étape 3/6] Alignement des 45 colonnes cibles...")
    target_columns = [
        "ID", "RAISON_SOCIALE", "SIRET", "TITRE_TXT", "DATE_DEPOT", "DATE_TEXTE", 
        "DATE_EFFET", "DATE_FIN", "CODE_APE", "SECTEUR", "DOCUMENT_BUREAUTIQUE", 
        "NUMERO", "SYNDICATS", "source_archive", "fichier_markdown", 
        "mentionne_mobilite", "theme_recherche", "categorie_mot_cle", "extrait_chunk", 
        "resume_mesure_proposee", "mot_cle_calcule", "mentionne_mobilite_ia", 
        "est_mobilites_durables", "est_revendication", "est_superieur_taux_legal", 
        "est_fmd_ikv_mis_en_place", "moyens_materiels", "moyens_financiers", 
        "mesures_ref_idfm", "llm_model_used", "url_legifrance", "mesure_extraite", 
        "localisation_lat", "localisation_lon", "localisation_code_commune", 
        "localisation_region_code", "localisation_region_nom", 
        "localisation_departement_code", "localisation_departement_nom", 
        "localisation_epci_id", "localisation_epci_nom", "localisation_ept_id", 
        "localisation_ept_nom", "categorie_entreprise", "source_file"
    ]
    
    for col in target_columns:
        if col not in df_all_2022.columns:
            df_all_2022[col] = None
        if col not in df_base.columns:
            df_base[col] = None
            
    df_all_2022 = df_all_2022[target_columns]
    df_base = df_base[target_columns]
    
    for d_col in ["DATE_DEPOT", "DATE_TEXTE", "DATE_EFFET", "DATE_FIN"]:
        df_all_2022[d_col] = pd.to_datetime(df_all_2022[d_col], errors="coerce")
        df_base[d_col] = pd.to_datetime(df_base[d_col], errors="coerce")
        
    df_global = pd.concat([df_base, df_all_2022], ignore_index=True)
    print(f"✓ Concaténation brute réussie : {len(df_global):,} lignes combinées.")
    
    # 4. Sauvegarde & dédoublonnage métier France
    print("\n[Étape 4/6] Dédoublonnage métier France (national)...")
    final_france = outputs_dir / "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
    df_global.to_parquet(final_france, index=False)
    deduplicate_parquet(str(final_france))
    
    df_france_dedup = pd.read_parquet(final_france)
    print(f"✓ Dataset France final dédoublonné : {len(df_france_dedup):,} lignes ({df_france_dedup["ID"].nunique():,} accords uniques).")
    
    # 5. Extraction IDF
    print("\n[Étape 5/6] Extraction du dataset Île-de-France (IDF)...")
    mask_idf = (
        (df_france_dedup["localisation_region_code"] == "11") | 
        (df_france_dedup["localisation_region_nom"].astype(str).str.contains("Ile-de-France|Île-de-France", case=False, na=False))
    )
    df_idf = df_france_dedup[mask_idf].copy()
    final_idf = outputs_dir / "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_IDF.parquet"
    df_idf.to_parquet(final_idf, index=False)
    print(f"✓ Dataset IDF final : {len(df_idf):,} lignes ({df_idf["ID"].nunique():,} accords uniques).")
    
    # 6. Téléversement MinIO & Hugging Face
    print("\n[Étape 6/6] Déploiement : MinIO S3 & Hugging Face...")
    
    # MinIO S3
    try:
        s3 = get_s3_client()
        bucket = "user-alihmaou"
        prefix = "dila_acco"
        print(f"☁️ Upload MinIO : {final_france.name} -> s3://{bucket}/{prefix}/{final_france.name}")
        s3.upload_file(str(final_france), bucket, f"{prefix}/{final_france.name}")
        print(f"☁️ Upload MinIO : {final_idf.name} -> s3://{bucket}/{prefix}/{final_idf.name}")
        s3.upload_file(str(final_idf), bucket, f"{prefix}/{final_idf.name}")
        print("  ✓ Sauvegarde MinIO réussie pour les deux datasets.")
    except Exception as e:
        print(f"⚠️ Avertissement MinIO : {e}")
        
    # Hugging Face
    repo_id = os.environ.get("HF_REPO_ID", "alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES")
    hf_token = os.environ.get("HF_TOKEN")
    if hf_token:
        print(f"\n🤗 Téléversement Hugging Face vers {repo_id}...")
        ok_fr = upload_to_huggingface(str(final_france), repo_id, hf_token, "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet")
        ok_idf = upload_to_huggingface(str(final_idf), repo_id, hf_token, "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_IDF.parquet")
        if ok_fr and ok_idf:
            print("  ✓ Déploiement Hugging Face réussi pour France et IDF !")
        else:
            print("  ⚠️ Un des uploads Hugging Face a échoué.")
    else:
        print("⚠️ HF_TOKEN manquant dans .env, upload Hugging Face ignoré.")
        
    print("\n==================================================")
    print(f"🎉 CONSOLIDATION ET DÉPLOIEMENT TERMINÉS AVEC SUCCÈS !")
    print(f"  - France : {final_france.name} ({final_france.stat().st_size / (1024*1024):.2f} Mo)")
    print(f"  - IDF    : {final_idf.name} ({final_idf.stat().st_size / (1024*1024):.2f} Mo)")
    print("==================================================")

if __name__ == "__main__":
    main()
