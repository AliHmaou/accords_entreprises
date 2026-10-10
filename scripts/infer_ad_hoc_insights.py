#!/usr/bin/env python3
"""
Script d'inférence ad hoc pour extraire deux nouveaux insights :
1. est_prime_carburant : Mentionne la mise à disposition/augmentation d'une prime carburant (Oui / Non)
2. est_infra_velo : Mentionne la mise à disposition d'infrastructures vélo (Oui / Non)
   + enrichissement ouvert de la colonne moyens_materiels

Usage :
  python scripts/infer_ad_hoc_insights.py --scope idf [--limit 20] [--upload]
  python scripts/infer_ad_hoc_insights.py --scope national [--upload]
"""

import os
import sys
import json
import time
import math
import hashlib
import argparse
from pathlib import Path
from typing import Dict, List, Any
import pandas as pd
import duckdb
from tqdm import tqdm
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# URLs Hugging Face de référence
HF_URL_IDF = "https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_IDF.parquet"
HF_URL_FRANCE = "https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"

CHECKPOINT_DEFAULT = BASE_DIR / "data/outputs/interim/ad_hoc_insights_checkpoint.json"

def get_hash(text: str) -> str:
    return hashlib.md5(str(text).strip().encode('utf-8')).hexdigest()

def get_openai_client():
    from openai import OpenAI
    az_key = os.getenv("AZURE_AI_API_KEY")
    az_endpoint = os.getenv("AZURE_AI_ENDPOINT")
    az_model = os.getenv("AZURE_AI_MODEL", "gpt-5.4-nano")

    api_key = az_key or os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY")
    base_url = az_endpoint or os.getenv("LLM_BASE_URL")

    if not api_key:
        raise ValueError("Aucune clé API LLM trouvée dans les variables d'environnement.")

    client_kwargs = {"api_key": api_key}
    if base_url:
        client_kwargs["base_url"] = base_url

    return OpenAI(**client_kwargs), az_model

def build_prompt_batch(batch: List[Dict[str, Any]]) -> str:
    extraits_text = ""
    for item in batch:
        extraits_text += f'<extrait chunk_key="{item["chunk_key"]}" ID="{item["ID"]}">\n{item["context"]}\n</extrait>\n\n'

    return f"""
Tu es un expert métier en analyse des accords d'entreprises et mobilités professionnelles. Tu dois analyser un lot d'extraits d'accords concernant deux dimensions précises :
1. La PRIME CARBURANT (dispositif financier)
2. Les INFRASTRUCTURES VÉLO (aménagements matériels / équipements)

Chaque extrait est encapsulé dans une balise <extrait> avec l'attribut 'chunk_key' et 'ID'.

Voici les extraits à analyser :
{extraits_text}

Tu dois répondre EXCLUSIVEMENT avec un OBJET JSON valide selon cette structure :
{{
  "resultats": [
    {{
      "chunk_key": "valeur exacte de chunk_key",
      "ID": "valeur exacte de ID",
      "est_prime_carburant": "Oui" ou "Non",
      "est_infra_velo": "Oui" ou "Non",
      "equipements_infra_velo": ["équipement 1", "équipement 2"]
    }}
  ]
}}

Règles d'évaluation strictes :
* "est_prime_carburant" : "Oui" si l'accord mentionne explicitement la mise à disposition, l'instauration, l'attribution, l'augmentation, la revalorisation ou le maintien d'une prime carburant, chèque carburant, bon carburant ou prise en charge spécifique du carburant pour les trajets domicile-travail. Répond "Non" si refusé, simple barème kilométrique fiscal sans prime employeur spécifique, ou non abordé.
* "est_infra_velo" : "Oui" si l'accord mentionne explicitement la mise à disposition, la création, l'aménagement ou l'amélioration d'infrastructures ou d'équipements matériels pour les cyclistes / usagers du vélo (stationnement, abri sécurisé, douches, vestiaires, casiers, bornes de recharge VAE, pompe/outillage, etc.). Répond "Non" si simple versement financier FMD/IKV sans équipement matériel.
* "equipements_infra_velo" : LISTE OUVERTE de tous les équipements, aménagements ou infrastructures physiques dédiés au vélo explicitement cités dans le texte (2 à 5 mots par équipement). Exemples indicatifs : "Abri vélo sécurisé", "Arceaux de stationnement", "Local vélo fermé", "Douches et vestiaires", "Casiers individuels", "Bornes de recharge VAE", "Station de gonflage/réparation", "Vélos de service mis à disposition", etc. Si "est_infra_velo" est "Non", renvoie [].

Ne rajoute aucun texte avant ou après le JSON.
"""

def extract_json_safe(text: str) -> dict:
    text = text.strip()
    if "```json" in text:
        parts = text.split("```json")
        if len(parts) > 1:
            text = parts[1].split("```")[0].strip()
    elif "```" in text:
        parts = text.split("```")
        if len(parts) > 1:
            text = parts[1].split("```")[0].strip()
    return json.loads(text)
def process_batches(client, model: str, chunks_to_process: List[Dict[str, Any]], checkpoint_data: Dict[str, Any], checkpoint_file: Path, batch_size: int = 5, verbose: bool = False) -> Dict[str, Any]:
    batches = [chunks_to_process[i:i + batch_size] for i in range(0, len(chunks_to_process), batch_size)]
    print(f"Lancement de l'inférence : {len(batches)} batchs à exécuter (taille batch: {batch_size})...")

    pbar = tqdm(batches, desc="Inférence Ad Hoc LLM")
    batch_counter = 0

    for batch in pbar:
        prompt = build_prompt_batch(batch)
        max_retries = 3

        for attempt in range(max_retries):
            try:
                resp = client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": "Tu réponds uniquement en JSON valide (objet avec clé resultats)."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.0,
                    response_format={"type": "json_object"}
                )
                raw = resp.choices[0].message.content
                parsed = extract_json_safe(raw)
                resultats = parsed.get("resultats", [])
                
                res_map = {r.get("chunk_key"): r for r in resultats if "chunk_key" in r}
                
                for item in batch:
                    ck = item["chunk_key"]
                    if ck in res_map:
                        r = res_map[ck]
                        checkpoint_data[ck] = {
                            "est_prime_carburant": "Oui" if str(r.get("est_prime_carburant", "")).strip().lower() == "oui" else "Non",
                            "est_infra_velo": "Oui" if str(r.get("est_infra_velo", "")).strip().lower() == "oui" else "Non",
                            "equipements_infra_velo": r.get("equipements_infra_velo", []) if isinstance(r.get("equipements_infra_velo"), list) else []
                        }
                    else:
                        checkpoint_data[ck] = {
                            "est_prime_carburant": "Non",
                            "est_infra_velo": "Non",
                            "equipements_infra_velo": []
                        }

                break
            except Exception as e:
                time.sleep(2 ** attempt)
                if attempt == max_retries - 1:
                    print(f"\n[Avertissement] Échec batch après {max_retries} tentatives : {e}")
                    for item in batch:
                        checkpoint_data[item["chunk_key"]] = {
                            "est_prime_carburant": "Non",
                            "est_infra_velo": "Non",
                            "equipements_infra_velo": []
                        }

        batch_counter += 1
        if batch_counter % 20 == 0:
            checkpoint_file.parent.mkdir(parents=True, exist_ok=True)
            with open(checkpoint_file, "w", encoding="utf-8") as f:
                json.dump(checkpoint_data, f, ensure_ascii=False)

    checkpoint_file.parent.mkdir(parents=True, exist_ok=True)
    with open(checkpoint_file, "w", encoding="utf-8") as f:
        json.dump(checkpoint_data, f, ensure_ascii=False)

    return checkpoint_data

def merge_and_enrich(df: pd.DataFrame, checkpoint_data: Dict[str, Any]) -> pd.DataFrame:
    print("\nIntégration des nouveaux champs et fusion des moyens matériels...")
    
    prime_map = {}
    velo_map = {}
    infra_map = {}
    
    for ck, res in checkpoint_data.items():
        prime_map[ck] = res.get("est_prime_carburant", "Non")
        velo_map[ck] = res.get("est_infra_velo", "Non")
        infra_map[ck] = res.get("equipements_infra_velo", [])

    df["_chunk_key"] = df["extrait_chunk"].apply(get_hash)
    
    df["est_prime_carburant"] = df["_chunk_key"].map(prime_map).fillna("Non")
    df["est_infra_velo"] = df["_chunk_key"].map(velo_map).fillna("Non")
    
    def update_moyens(row):
        ck = row["_chunk_key"]
        new_equipements = infra_map.get(ck, [])
        if not new_equipements:
            return row["moyens_materiels"]
            
        current = str(row.get("moyens_materiels") or "").strip()
        existing_items = []
        if current and current not in ("None", "AUCUNE_CORRESPONDANCE", "null"):
            existing_items = [x.strip() for x in current.split("|") if x.strip()]
            
        existing_lower = {x.lower() for x in existing_items}
        for eq in new_equipements:
            clean_eq = str(eq).strip()
            if clean_eq and clean_eq.lower() not in existing_lower:
                existing_items.append(clean_eq)
                existing_lower.add(clean_eq.lower())
                
        return " | ".join(existing_items) if existing_items else "AUCUNE_CORRESPONDANCE"

    df["moyens_materiels"] = df.apply(update_moyens, axis=1)
    df.drop(columns=["_chunk_key"], inplace=True)
    return df

def run_enrichment_for_scope(scope: str, limit: int = None, upload: bool = False, checkpoint_file: Path = CHECKPOINT_DEFAULT):
    url = HF_URL_IDF if scope == "idf" else HF_URL_FRANCE
    out_filename = "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_IDF.parquet" if scope == "idf" else "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
    out_path = BASE_DIR / "data/outputs" / out_filename

    print(f"\n==================================================")
    print(f"🚀 TRAITEMENT AD HOC : SCOPE {scope.upper()}")
    print(f"  Source : {url}")
    print(f"  Sortie : {out_path}")
    print(f"==================================================")

    print("Chargement du dataset de référence...")
    df = pd.read_parquet(url)
    print(f"✓ Chargé : {len(df):,} lignes.")

    cond_mob = df["mentionne_mobilite_ia"].astype(str).str.lower().isin(["oui", "true", "1"])
    theme_str = df["theme_recherche"].astype(str).str.lower()
    cond_kw = theme_str.str.contains("carburant", regex=False) | theme_str.str.contains("velo", regex=False) | theme_str.str.contains("vélo", regex=False)
    
    target_df = df[cond_mob & cond_kw].copy()
    print(f"✓ Chunks ciblés : {len(target_df):,} lignes.")

    target_df["_chunk_key"] = target_df["extrait_chunk"].apply(get_hash)
    unique_chunks = target_df.drop_duplicates(subset=["_chunk_key"])
    print(f"✓ Chunks uniques à évaluer : {len(unique_chunks):,}")

    checkpoint_data = {}
    if checkpoint_file.exists():
        try:
            with open(checkpoint_file, "r", encoding="utf-8") as f:
                checkpoint_data = json.load(f)
            print(f"🔄 Checkpoint chargé : {len(checkpoint_data):,} chunks déjà inférés en cache.")
        except Exception as e:
            print(f"⚠️ Erreur chargement checkpoint : {e}")

    chunks_to_run = []
    for _, row in unique_chunks.iterrows():
        ck = row["_chunk_key"]
        if ck not in checkpoint_data:
            chunks_to_run.append({
                "chunk_key": ck,
                "ID": row["ID"],
                "context": row["extrait_chunk"]
            })

    if limit and limit > 0:
        print(f"🔬 Mode test activé : limitation à {limit} chunks.")
        chunks_to_run = chunks_to_run[:limit]

    print(f"⚡ Solde de chunks à inférer par LLM : {len(chunks_to_run):,} ({math.ceil(len(chunks_to_run)/5):,} batchs)")

    if chunks_to_run:
        client, model = get_openai_client()
        print(f"Client LLM initialisé (Modèle: {model})")
        checkpoint_data = process_batches(client, model, chunks_to_run, checkpoint_data, checkpoint_file)

    df_enriched = merge_and_enrich(df, checkpoint_data)

    nb_prime = (df_enriched["est_prime_carburant"] == "Oui").sum()
    nb_infra = (df_enriched["est_infra_velo"] == "Oui").sum()
    print("\n--- STATISTIQUES DES INSIGHTS DÉTECTÉS ---")
    print(f"  • Prime carburant (Oui) : {nb_prime:,} lignes ({df_enriched[df_enriched['est_prime_carburant'] == 'Oui']['ID'].nunique():,} accords)")
    print(f"  • Infra vélo (Oui)      : {nb_infra:,} lignes ({df_enriched[df_enriched['est_infra_velo'] == 'Oui']['ID'].nunique():,} accords)")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    df_enriched.to_parquet(out_path, index=False)
    print(f"\n✅ Parquet enrichi sauvegardé : {out_path} ({out_path.stat().st_size / (1024*1024):.2f} Mo)")

    if upload:
        repo_id = os.getenv("HF_REPO_ID", "alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES")
        hf_token = os.getenv("HF_TOKEN")
        if hf_token:
            sys.path.append(str(BASE_DIR / "src"))
            from upload_hf import upload_to_huggingface
            print(f"🤗 Upload Hugging Face vers {repo_id}/{out_filename}...")
            upload_to_huggingface(str(out_path), repo_id, hf_token, out_filename)
        else:
            print("⚠️ HF_TOKEN manquant dans .env, upload ignoré.")

    return df_enriched

def main():
    parser = argparse.ArgumentParser(description="Inférence Ad Hoc : Prime carburant & Infrastructures vélo")
    parser.add_argument("--scope", choices=["idf", "national", "both"], default="idf", help="Périmètre à traiter (défaut: idf)")
    parser.add_argument("--limit", type=int, default=None, help="Nombre max de chunks à inférer (pour tests rapides)")
    parser.add_argument("--upload", action="store_true", help="Publier automatiquement sur Hugging Face après traitement")
    parser.add_argument("--checkpoint", type=str, default=str(CHECKPOINT_DEFAULT), help="Chemin du fichier checkpoint JSON")
    args = parser.parse_args()

    ckpt_path = Path(args.checkpoint)

    if args.scope in ("idf", "both"):
        run_enrichment_for_scope("idf", limit=args.limit, upload=args.upload, checkpoint_file=ckpt_path)

    if args.scope in ("national", "both"):
        run_enrichment_for_scope("national", limit=args.limit, upload=args.upload, checkpoint_file=ckpt_path)

if __name__ == "__main__":
    main()

