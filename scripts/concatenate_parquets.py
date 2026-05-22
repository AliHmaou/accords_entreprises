import os
import sys
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
import upload_hf

def concatenate_and_upload():
    base_dir = Path(__file__).parent.parent
    load_dotenv(base_dir / ".env")
    
    outputs_dir = base_dir / "data/outputs"
    
    # 1. Chercher tous les fichiers finaux générés
    pattern = "ACCO_MESURES_MOBILITES_*_ENRICHIS.parquet"
    parquet_files = list(outputs_dir.glob(pattern))
    
    if not parquet_files:
        print(f"Aucun fichier trouvé avec le motif {pattern} dans {outputs_dir}.")
        return

    print(f"{len(parquet_files)} fichiers parquets trouvés. Concaténation en cours...")
    
    dfs = []
    for f in parquet_files:
        try:
            df = pd.read_parquet(f)
            dfs.append(df)
            print(f" - Chargé {f.name} ({len(df)} lignes)")
        except Exception as e:
            print(f"Erreur lors de la lecture de {f.name}: {e}")

    if not dfs:
        print("Échec de la lecture de tous les fichiers.")
        return

    # 2. Concaténation
    final_df = pd.concat(dfs, ignore_index=True)
    
    # Déduplication au cas où un accord serait présent dans plusieurs archives (très rare, mais par sécurité)
    # ou si le même mot clé apparaît plusieurs fois.
    # On va faire simple: on concatène juste tout ce qui a été validé. 
    # (Si vous vouliez dédupliquer, on pourrait faire final_df.drop_duplicates(subset=['ID', 'theme_recherche']))
    
    final_path = outputs_dir / "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
    final_df.to_parquet(final_path)
    
    print(f"\n✅ Concaténation réussie : {len(final_df)} lignes au total.")
    print(f"Fichier global sauvegardé sous : {final_path}")
    
    # 3. Upload vers Hugging Face
    print("\n--- UPLOAD HUGGING FACE ---")
    hf_repo = os.getenv("HF_REPO_ID", "alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES")
    hf_token = os.getenv("HF_TOKEN")
    
    if not hf_token:
        print("Le token Hugging Face (HF_TOKEN) est introuvable dans le .env.")
        return
        
    geo_name = "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
    success = upload_hf.upload_to_huggingface(str(final_path), hf_repo, hf_token, geo_name)
    
    if success:
        print("Upload du fichier global terminé avec succès !")
    else:
        print("L'upload a échoué.")

if __name__ == "__main__":
    concatenate_and_upload()
