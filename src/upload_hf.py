import os
from huggingface_hub import HfApi

def upload_to_huggingface(file_path: str, repo_id: str, hf_token: str):
    """
    Upload a file to a Hugging Face dataset repository.
    """
    if not os.path.exists(file_path):
        print(f"Erreur : le fichier {file_path} n'existe pas.")
        return False

    if not repo_id or not hf_token:
        print("Erreur : HF_REPO_ID ou HF_TOKEN non définis.")
        return False

    api = HfApi(token=hf_token)
    
    # We use a constant name for simplicity
    file_name_in_repo = "data_accords_mobilites.parquet"
    
    print(f"Téléversement de {file_path} vers {repo_id}/{file_name_in_repo}...")
    
    try:
        api.upload_file(
            path_or_fileobj=file_path,
            path_in_repo=file_name_in_repo,
            repo_id=repo_id,
            repo_type="dataset",
        )
        print(f"✅ Téléversement réussi ! URL : https://huggingface.co/datasets/{repo_id}/resolve/main/{file_name_in_repo}")
        return True
    except Exception as e:
        print(f"❌ Erreur lors de l'upload vers Hugging Face : {e}")
        return False

if __name__ == "__main__":
    # Pour tester unitairement
    import dotenv
    dotenv.load_dotenv("ACCORDS_PROFESSIONNELS/.env")
    
    test_file = "ACCORDS_PROFESSIONNELS/data/outputs/202511_ACCO_MESURES_MOBILITES_FINAL_ENRICHIS.parquet"
    repo = os.getenv("HF_REPO_ID")
    token = os.getenv("HF_TOKEN")
    
    upload_to_huggingface(test_file, repo, token)
