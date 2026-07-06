import os
import sys
import shutil
from pathlib import Path

# Ajouter src au python path
scripts_dir = Path(__file__).parent
sys.path.append(str(scripts_dir.parent / "src"))
from geoloc_epci import process_geoloc

def main():
    print("==================================================")
    print(" RECALCUL COMPLET DES ENRICHISSEMENTS ET DE LA FUSION ")
    print("==================================================")
    
    out_dir = scripts_dir.parent / "data/outputs"
    
    # 1. Identifier tous les fichiers individuels non-enrichis (supporte le dossier de l'utilisateur)
    backup_dir = out_dir / "Backup_run2_2025_2026"
    search_dir = backup_dir if backup_dir.exists() else out_dir
    
    files = sorted([f for f in os.listdir(search_dir) if f.endswith('.parquet') and not f.endswith('_ENRICHIS.parquet') and f.startswith('ACCO_MESURES_MOBILITES_')])
    
    print(f"\n[Étape 1] Ré-enrichissement de {len(files)} fichiers individuels dans {search_dir.name}...")
    for f in files:
        accords_in = search_dir / f
        accords_out = search_dir / f.replace('.parquet', '_ENRICHIS.parquet')
        print(f"  - Enrichissement géo + EPT + SIRENE pour : {f}")
        try:
            process_geoloc(str(accords_in), str(accords_out))
        except Exception as e:
            print(f"  ❌ Erreur lors de l'enrichissement de {f} : {e}")
            sys.exit(1)
            
    print("\n✓ Tous les fichiers individuels ont été ré-enrichis.")

    # 2. Lancer la fusion des fichiers parquets
    print("\n[Étape 2] Fusion globale de tous les fichiers enrichis...")
    sys.path.append(str(scripts_dir))
    import concatenate_parquets
    try:
        concatenate_parquets.concatenate_and_upload()
    except Exception as e:
        print(f"  ❌ Erreur lors de la fusion : {e}")
        sys.exit(1)

    # 3. Lancer la correction et le dédoublonnage
    print("\n[Étape 3] Application des corrections de labels et dédoublonnage final...")
    import correct_and_deduplicate
    try:
        correct_and_deduplicate.main()
    except Exception as e:
        print(f"  ❌ Erreur lors des corrections et du dédoublonnage : {e}")
        sys.exit(1)

    # 4. Copier le fichier final à la racine
    print("\n[Étape 4] Copie du fichier final propre vers la racine...")
    src_final = out_dir / "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_CORRIGE_2025.parquet"
    dest_root = Path("/home/onyxia/work/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_CORRIGE_2025.parquet")
    
    try:
        if src_final.exists():
            shutil.copy2(src_final, dest_root)
            print(f"✓ Copie réussie : {dest_root}")
        else:
            print(f"❌ Erreur : Le fichier source {src_final} n'a pas été trouvé.")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Erreur lors de la copie du fichier final : {e}")
        sys.exit(1)

    print("\n==================================================")
    print("✓ RECALCUL ET ACTUALISATION COMPLÉTÉS AVEC SUCCÈS")
    print("==================================================")

if __name__ == "__main__":
    main()
