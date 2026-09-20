import os
import sys
import boto3
from pathlib import Path
from botocore.client import Config
from dotenv import load_dotenv

# Charger les variables d'environnement
base_dir = Path(__file__).parent.parent
load_dotenv(base_dir / '.env')

aws_id = os.environ.get('AWS_ACCESS_KEY_ID')
aws_secret = os.environ.get('AWS_SECRET_ACCESS_KEY')
aws_token = os.environ.get('AWS_SESSION_TOKEN')
endpoint = os.environ.get('AWS_S3_ENDPOINT', 'minio.data-platform-self-service.net')
if not endpoint.startswith('http'):
    endpoint = f'https://{endpoint}'
if not endpoint.endswith('/'):
    endpoint = f'{endpoint}/'

def download_file_s3(bucket: str, key: str, local_path: Path):
    if not aws_id or not aws_secret:
        print('❌ Erreur : Identifiants AWS/MinIO non trouvés dans l'environnement.')
        return False

    session = boto3.Session(
        aws_access_key_id=aws_id,
        aws_secret_access_key=aws_secret,
        aws_session_token=aws_token
    )
    s3 = session.client(
        's3',
        endpoint_url=endpoint,
        config=Config(signature_version='s3v4', s3={'addressing_style': 'path'})
    )

    # Progress callback
    def progress_callback(bytes_transferred):
        print(f'Téléchargement en cours de {key}... {bytes_transferred} octets transférés.', end='', flush=True)

    print(f'Connexion à S3 pour récupérer s3://{bucket}/{key}...')
    local_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        s3.download_file(
            Bucket=bucket,
            Key=key,
            Filename=str(local_path),
            Callback=progress_callback
        )
        print(f'
✅ Succès ! Fichier enregistré sous : {local_path}')
        return True
    except Exception as e:
        print(f'
❌ Erreur lors du téléchargement S3 de {key} : {e}')
        return False

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description='Télécharger des archives mensuelles depuis S3')
    parser.add_argument('--month', type=str, default='01', help="Mois de 2024 à télécharger (ex: 01, 02, ..., 12, ou 'all')")
    args = parser.parse_args()

    bucket = 'user-alihmaou'
    out_dir = Path('/home/onyxia/work/ACCORDS_PROFESSIONNELS/data/inputs/archives_acco')

    if args.month == 'all':
        months = [f'{i:02d}' for i in range(1, 13)]
    else:
        months = [args.month]

    for m in months:
        key = f'dila_acco/acco_2024_{m}.tar.gz'
        local_path = out_dir / f'acco_2024_{m}.tar.gz'
        download_file_s3(bucket, key, local_path)
