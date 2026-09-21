import os
import sys
import argparse
import subprocess
import boto3
from pathlib import Path
from botocore.client import Config
from dotenv import load_dotenv

base_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(base_dir / "scripts"))
import correct_and_deduplicate

def upload_results_to_minio(months: list[str], log_filename: str = None):
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
    s3 = session.client(
        "s3",
        endpoint_url=endpoint,
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"})
    )
    
    bucket = "user-alihmaou"
    prefix = "dila_acco/run_gpt_nano"
    
    print("\n==================================================")
    print(" DÉPÔT DES FICHIERS SUR MINIO S3 ")
    print("==================================================")
    
    outputs_dir = base_dir / "data/outputs"
    uploaded = 0
    
    for m in months:
        archive_stem = f"acco_2024_{m}" if not m.startswith("acco_") else m
        patterns = [
            f"ACCO_MESURES_MOBILITES_{archive_stem}.parquet",
            f"ACCO_MESURES_MOBILITES_{archive_stem}_ENRICHIS.parquet",
            f"ACCO_MESURES_MOBILITES_{archive_stem}_ENRICHIS_CORRIGES.parquet",
        ]
        for fn in patterns:
            local_p = outputs_dir / fn
            if local_p.exists():
                target_key = f"{prefix}/{fn}"
                size_mb = local_p.stat().st_size / (1024 * 1024)
                print(f"Téléversement de {fn} ({size_mb:.2f} Mo) vers s3://{bucket}/{target_key}...")
                s3.upload_file(str(local_p), bucket, target_key)
                uploaded += 1
            else:
                print(f"⚠️ Fichier introuvable localement : {fn}")
                
    if log_filename:
        log_p = base_dir / log_filename
        if log_p.exists():
            log_key = f"{prefix}/{log_filename}"
            print(f"Téléversement du fichier de log vers s3://{bucket}/{log_key}...")
            s3.upload_file(str(log_p), bucket, log_key)
            uploaded += 1

    print(f"\n✅ {uploaded} fichier(s) téléversé(s) avec succès dans s3://{bucket}/{prefix}/")

def main():
    parser = argparse.ArgumentParser(description="Automatisation Batch Pipeline + Correction + Upload MinIO")
    parser.add_argument("--archives", type=str, default="acco_2024_06.tar.gz,acco_2024_07.tar.gz", help="Liste d'archives séparées par des virgules")
    parser.add_argument("--year", type=str, default="all", help="Filtre année pour le LLM")
    parser.add_argument("--log-file", type=str, default="batch_run_2024_06_07.log", help="Nom du fichier de log")
    args = parser.parse_args()

    archive_list = [a.strip() for a in args.archives.split(",") if a.strip()]
    months = []
    for a in archive_list:
        clean = a.replace(".tar.gz", "").replace(".zip", "")
        # Extraire le mois ou le stem
        parts = clean.split("_")
        if len(parts) >= 3 and parts[-1].isdigit():
            months.append(parts[-1])
        else:
            months.append(clean)

    print("==================================================")
    print(f" DÉBUT DU TRAITEMENT BATCH AUTOMATISÉ : {archive_list}")
    print("==================================================")

    # 1. Exécution du pipeline complet
    cmd = [
        sys.executable,
        "-u",
        str(base_dir / "scripts/run_pipeline.py"),
        "--archives",
        args.archives,
        "--year",
        args.year,
        "--skip-upload"
    ]
    print(f"\n[Étape 1/3] Lancement de run_pipeline.py...")
    subprocess.run(cmd, check=True)

    # 2. Exécution du redressement et dédoublonnage pour chaque mois
    print("\n[Étape 2/3] Application du redressement des modalités et du dédoublonnage...")
    outputs_dir = base_dir / "data/outputs"
    for m in months:
        archive_stem = f"acco_2024_{m}" if not m.startswith("acco_") else m
        enriched_p = outputs_dir / f"ACCO_MESURES_MOBILITES_{archive_stem}_ENRICHIS.parquet"
        corrected_p = outputs_dir / f"ACCO_MESURES_MOBILITES_{archive_stem}_ENRICHIS_CORRIGES.parquet"

        if enriched_p.exists():
            print(f"\nTraitement de correction pour {archive_stem}...")
            correct_and_deduplicate.process_file(str(enriched_p), str(corrected_p))
        else:
            print(f"⚠️ Fichier enrichi non trouvé pour {archive_stem}: {enriched_p}")

    # 3. Téléversement automatique sur MinIO
    print("\n[Étape 3/3] Synchronisation vers MinIO...")
    upload_results_to_minio(months, log_filename=args.log_file)

    print("\n==================================================")
    print("🎉 TOUTES LES ÉTAPES DU BATCH SONT COMPLÉTÉES AVEC SUCCÈS !")
    print("==================================================")

if __name__ == "__main__":
    main()
