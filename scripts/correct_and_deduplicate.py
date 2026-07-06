import sys
import os
import duckdb
import pandas as pd

# Add src to python path to import deduplicate
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from deduplicate import deduplicate_parquet

url = os.path.join(os.path.dirname(__file__), '..', 'data', 'outputs', 'IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet')
if not os.path.exists(url):
    url = "https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
output_file = os.path.join(os.path.dirname(__file__), '..', 'data', 'outputs', 'IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_CORRIGE_2025.parquet')

def fix_label(val):
    if not isinstance(val, str):
        return val
    
    val_lower = val.lower()
    
    # Precise but flexible keyword matching to avoid any encoding/character mismatches
    if 'curit' in val_lower:
        return "Améliorer la sécurité routière"
        
    if 'dispositifs' in val_lower or 'financiers' in val_lower or 'ployer' in val_lower:
        return "Déployer des dispositifs financiers d’aide à la mobilité"
        
    if 'engins' in val_lower or 'edpm' in val_lower:
        return "Inclure les engins de déplacements personnels EDPM"
        
    if 'forfait' in val_lower:
        return "Mettre en place le forfait mobilité durable et l'indemnité kilométrique vélo IKV"
        
    if 'plan' in val_lower and 'mobilit' in val_lower or 'plan de' in val_lower:
        return "Mettre en place un plan de mobilité employeur"
        
    if 'voiture' in val_lower or 'deux-roues' in val_lower or 'motoris' in val_lower or 'motorisés' in val_lower:
        return "Organiser l’usage de la voiture et des deux-roues motorisés"
        
    if 'stationnement' in val_lower:
        return "Organiser le stationnement des véhicules et des vélos"
        
    if 'telet' in val_lower or 'télét' in val_lower or 'horaires' in val_lower or 't\x00e' in val_lower or 't\\u00e' in val_lower:
        return "Organiser le télétravail et les horaires de travail"
        
    if 'salari' in val_lower or 'salarie' in val_lower:
        return "Prendre en compte la mobilité des salariés"
        
    if 'autopartage' in val_lower:
        return "Promouvoir l’autopartage"
        
    if 'velo' in val_lower or 'vélo' in val_lower or 'v\x00' in val_lower or 'v\\u00' in val_lower:
        return "Promouvoir le vélo"
        
    if 'transition' in val_lower or 'energet' in val_lower or 'énergét' in val_lower or 'energ' in val_lower:
        if 'parc' in val_lower or 'entreprise' in val_lower or 'véhic' in val_lower or 'vehic' in val_lower:
            return "Soutenir la transition énergétique du parc de véhicules de l’entreprise"
        else:
            return "Transition énergétique"
            
    return val

def main():
    if url.startswith("http"):
        print("1. Téléchargement du fichier distant...")
    else:
        print(f"1. Lecture du fichier local {url}...")
    df = pd.read_parquet(url)
    
    print("2. Application des corrections...")
    # Clean string column using the custom element-wise function
    df['mesures_ref_idfm'] = df['mesures_ref_idfm'].apply(fix_label)
    
    print("3. Sauvegarde du fichier corrigé temporaire...")
    dir_name = os.path.dirname(output_file)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    df.to_parquet(output_file)
    
    print("4. Application du dédoublonnage...")
    deduplicate_parquet(output_file)
    
    print("5. Vérification des valeurs distinctes...")
    con = duckdb.connect()
    distinct_vals = con.execute(f"SELECT DISTINCT mesures_ref_idfm FROM '{output_file}' ORDER BY 1").fetchall()
    
    print("\nNouvelles valeurs distinctes dans mesures_ref_idfm :")
    for val in distinct_vals:
        print(f"- {val[0]}")
        
    # Double check if any KO patterns still exist
    has_ko = False
    for val in distinct_vals:
        val_str = val[0]
        if '\x00' in val_str or 'v elo' in val_str or 'kilom kilométrique' in val_str or 'v ehicules' in val_str or '27' in val_str:
            print(f"⚠️ Erreur: Il reste des patterns corrompus dans '{repr(val_str)}'!")
            has_ko = True
            
    if not has_ko:
        print("\n✅ Succès: Toutes les scories ont été nettoyées et dédoublonnées avec succès !")
        print(f"Fichier disponible à la racine du workspace : {output_file}")

if __name__ == "__main__":
    main()
