import os
import sys
import duckdb
import pandas as pd
from pathlib import Path

# Add src to python path
base_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(base_dir / "src"))
from deduplicate import deduplicate_parquet

def main():
    outputs_dir = base_dir / "data/outputs"
    
    print("==================================================")
    print(" FUSION FINALE CONSOLIDÉE : 2024 + 2025/2026 ")
    print("==================================================")
    
    # 1. Lister les 12 mois de 2024
    months_2024 = [f"{i:02d}" for i in range(1, 13)]
    files_2024 = [outputs_dir / f"ACCO_MESURES_MOBILITES_acco_2024_{m}_ENRICHIS_CORRIGES.parquet" for m in months_2024]
    
    dfs_2024 = []
    print("\n[Étape 1/4] Chargement des 12 mois de l'année 2024...")
    for f in files_2024:
        if not f.exists():
            raise FileNotFoundError(f"Fichier manquant : {f.name}")
        df = pd.read_parquet(f)
        if 'source_file' not in df.columns:
            df['source_file'] = f.name
        dfs_2024.append(df)
        print(f"  - {f.name} : {len(df):,} lignes")
        
    df_all_2024 = pd.concat(dfs_2024, ignore_index=True)
    print(f"✓ Total année 2024 chargée : {len(df_all_2024):,} lignes")
    
    # 2. Charger le jeu de données 2025-2026
    print("\n[Étape 2/4] Chargement du jeu consolidé 2025-2026...")
    qwen_file = outputs_dir / "IDFM_ACCO_2025_2026_QWEN_CORRIGE.parquet"
    if not qwen_file.exists():
        raise FileNotFoundError(f"Fichier 2025-2026 manquant : {qwen_file}")
    df_2025_2026 = pd.read_parquet(qwen_file)
    print(f"✓ Total 2025-2026 chargé : {len(df_2025_2026):,} lignes")
    
    # 3. Alignement des schémas et concaténation
    print("\n[Étape 3/4] Alignement des 45 colonnes et fusion...")
    
    # S'assurer de la présence et du typage des 45 colonnes cibles
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
        if col not in df_all_2024.columns:
            df_all_2024[col] = None
        if col not in df_2025_2026.columns:
            df_2025_2026[col] = None
            
    df_all_2024 = df_all_2024[target_columns]
    df_2025_2026 = df_2025_2026[target_columns]
    
    # Harmonisation des types de dates
    for d_col in ["DATE_DEPOT", "DATE_TEXTE", "DATE_EFFET", "DATE_FIN"]:
        df_all_2024[d_col] = pd.to_datetime(df_all_2024[d_col], errors='coerce')
        df_2025_2026[d_col] = pd.to_datetime(df_2025_2026[d_col], errors='coerce')
        
    df_global = pd.concat([df_all_2024, df_2025_2026], ignore_index=True)
    print(f"✓ Concaténation brute réussie : {len(df_global):,} lignes combinées.")
    
    # 4. Sauvegarde & dédoublonnage métier
    print("\n[Étape 4/4] Dédoublonnage métier et export des fichiers de production...")
    
    final_output_geo = outputs_dir / "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
    final_output_corrige = outputs_dir / "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_CORRIGE_2025.parquet"
    
    df_global.to_parquet(final_output_geo, index=False)
    
    # Dédoublonnage sur (ID, mesures_ref_idfm)
    deduplicate_parquet(str(final_output_geo))
    
    # Copier vers le nom conventionnel CORRIGE_2025
    import shutil
    shutil.copy2(str(final_output_geo), str(final_output_corrige))
    
    print("\n==================================================")
    print(f"✅ FUSION ET DÉDOUBLONNAGE RÉUSSIS !")
    print(f"  - {final_output_geo.name} ({final_output_geo.stat().st_size / (1024*1024):.2f} Mo)")
    print(f"  - {final_output_corrige.name} ({final_output_corrige.stat().st_size / (1024*1024):.2f} Mo)")
    print("==================================================")

if __name__ == "__main__":
    main()
