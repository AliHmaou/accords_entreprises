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

def download_archive_if_needed(bucket: str, archive_name: str, archives_dir: Path):
    local_p = archives_dir / archive_name
    if local_p.exists() and local_p.stat().st_size > 0:
        print(f"✓ Archive {archive_name} déjà présente en local ({local_p.stat().st_size / (1024*1024):.1f} Mo).")
        return True
    
    key = f"dila_acco/{archive_name}"
    print(f"📥 Téléchargement de s3://{bucket}/{key} vers {local_p}...")
    try:
        s3 = get_s3_client()
        s3.download_file(bucket, key, str(local_p))
        print(f"  ✓ {archive_name} téléchargée ({local_p.stat().st_size / (1024*1024):.1f} Mo).")
        return True
    except Exception as e:
        print(f"  ❌ Erreur de téléchargement pour {archive_name} : {e}")
        return False

def upload_single_stem_to_minio(bucket: str, prefix: str, stem: str):
    outputs_dir = base_dir / "data/outputs"
    patterns = [
        f"ACCO_MESURES_MOBILITES_{stem}.parquet",
        f"ACCO_MESURES_MOBILITES_{stem}_ENRICHIS.parquet",
        f"ACCO_MESURES_MOBILITES_{stem}_ENRICHIS_CORRIGES.parquet",
    ]
    uploaded = 0
    try:
        s3 = get_s3_client()
        for fn in patterns:
            local_p = outputs_dir / fn
            if local_p.exists():
                target_key = f"{prefix}/{fn}"
                size_mb = local_p.stat().st_size / (1024 * 1024)
                print(f"☁️ Téléversement de {fn} ({size_mb:.2f} Mo) -> s3://{bucket}/{target_key}...")
                s3.upload_file(str(local_p), bucket, target_key)
                uploaded += 1
            else:
                print(f"ℹ️ Fichier non présent localement : {fn}")
        print(f"  ✓ {uploaded} fichier(s) sauvegardé(s) sur MinIO pour {stem}")
    except Exception as e:
        print(f"⚠️ AVERTISSEMENT : Échec du téléversement MinIO pour {stem} ({e}).")
        print(f"   Raison probable : Expiration du jeton STS de session.")
        print(f"   Les fichiers restent 100% conservés en local dans {outputs_dir} et pourront être synchronisés après le run.")
    return uploaded

def main():
    parser = argparse.ArgumentParser(description="Automatisation Batch Pipeline + Correction + Upload MinIO Résilient")
    parser.add_argument("--archives", type=str, required=True, help="Liste d'archives séparées par des virgules")
    parser.add_argument("--year", type=str, default="all", help="Filtre année pour le LLM")
    parser.add_argument("--log-file", type=str, default=None, help="Nom du fichier de log")
    args = parser.parse_args()

    bucket = "user-alihmaou"
    prefix = "dila_acco/run_gpt_nano"
    archives_dir = base_dir / "data/inputs/archives_acco"
    archives_dir.mkdir(parents=True, exist_ok=True)
    outputs_dir = base_dir / "data/outputs"

    archive_list = [a.strip() for a in args.archives.split(",") if a.strip()]

    print("==================================================")
    print(f" DÉBUT DU TRAITEMENT BATCH AUTOMATISÉ ({len(archive_list)} archives)")
    print(f" Mode : Résilient aux erreurs de credentials MinIO")
    print("==================================================")

    for idx, archive_name in enumerate(archive_list, 1):
        stem = archive_name.replace(".tar.gz", "").replace(".zip", "")
        print(f"\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
        print(f" ARCHIVE [{idx}/{len(archive_list)}] : {archive_name} ({stem})")
        print(f">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")

        # 1. Vérifier si l'archive existe localement ou la télécharger
        local_archive = archives_dir / archive_name
        if not local_archive.exists() or local_archive.stat().st_size == 0:
            ok = download_archive_if_needed(bucket, archive_name, archives_dir)
            if not ok:
                print(f"⚠️ Échec du téléchargement pour {archive_name}, passage à la suivante.")
                continue

        # 2. Exécuter le pipeline unitaire
        cmd = [
            sys.executable,
            "-u",
            str(base_dir / "scripts/run_pipeline.py"),
            "--archives",
            archive_name,
            "--year",
            args.year,
            "--skip-upload"
        ]
        print(f"\n[1/3] Exécution de run_pipeline.py pour {archive_name}...")
        try:
            subprocess.run(cmd, check=True)
        except Exception as e:
            print(f"❌ Erreur lors du pipeline sur {archive_name} : {e}")
            continue

        # 3. Exécuter le redressement et dédoublonnage métier
        enriched_p = outputs_dir / f"ACCO_MESURES_MOBILITES_{stem}_ENRICHIS.parquet"
        corrected_p = outputs_dir / f"ACCO_MESURES_MOBILITES_{stem}_ENRICHIS_CORRIGES.parquet"
        if enriched_p.exists():
            print(f"\n[2/3] Correction & Dédoublonnage métier pour {stem}...")
            try:
                correct_and_deduplicate.process_file(str(enriched_p), str(corrected_p))
            except Exception as e:
                print(f"❌ Erreur lors de la correction pour {stem} : {e}")
        else:
            print(f"⚠️ Fichier enrichi non trouvé pour {stem} : {enriched_p}")

        # 4. Téléverser immédiatement les résultats du mois vers MinIO S3 (try/catch résilient)
        print(f"\n[3/3] Synchronisation vers MinIO pour {stem}...")
        upload_single_stem_to_minio(bucket, prefix, stem)

        # Synchroniser aussi le fichier de log à jour si possible
        if args.log_file:
            log_p = base_dir / args.log_file
            if log_p.exists():
                try:
                    s3 = get_s3_client()
                    s3.upload_file(str(log_p), bucket, f"{prefix}/{args.log_file}")
                except Exception:
                    pass

    print("\n==================================================")
    print(f"🎉 TRAITEMENT BATCH DE TOUTES LES ARCHIVES TERMINÉ !")
    print("==================================================")

if __name__ == "__main__":
    main()
