import sys
import os
import argparse
import duckdb
import pandas as pd
import argparse

# Add src to python path to import deduplicate
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from deduplicate import deduplicate_parquet

def fix_label(val):
    if not isinstance(val, str):
        return val
    
    # Nettoyage des artefacts d'encodage éventuels
    val_clean = (
        val.replace('\x00', 'e')
           .replace('\\u00e9', 'é')
           .replace('\\u00e0', 'à')
           .replace('\\u00e8', 'è')
           .replace('\u2019', "'")
           .strip()
    )
    val_lower = val_clean.lower()
    
    if val_clean.upper() == 'AUCUNE_CORRESPONDANCE':
        return 'AUCUNE_CORRESPONDANCE'
        
    if 'hors mesures' in val_lower:
        return 'hors mesures IDFM'
        
    if 'curit' in val_lower:
        return "Améliorer la sécurité routière"
        
    if 'dispositif' in val_lower or 'financier' in val_lower or 'ployer' in val_lower:
        return "Déployer des dispositifs financiers d’aide à la mobilité"
        
    if 'engin' in val_lower or 'edpm' in val_lower:
        return "Inclure les engins de déplacements personnels EDPM"
        
    if 'forfait' in val_lower or 'ikv' in val_lower:
        return "Mettre en place le forfait mobilité durable et l'indemnité kilométrique vélo IKV"
        
    if ('plan' in val_lower and 'mobilit' in val_lower) or 'plan de' in val_lower:
        return "Mettre en place un plan de mobilité employeur"
        
    if 'covoiturage' in val_lower or 'co-voiturage' in val_lower:
        return "Promouvoir le covoiturage"
        
    if 'voiture' in val_lower or 'deux-roues' in val_lower or 'motoris' in val_lower:
        return "Organiser l’usage de la voiture et des deux-roues motorisés"
        
    if 'stationnement' in val_lower:
        return "Organiser le stationnement des véhicules et des vélos"
        
    if 'telet' in val_lower or 'télét' in val_lower or 'horaires' in val_lower:
        return "Organiser le télétravail et les horaires de travail"
        
    if 'salari' in val_lower:
        return "Prendre en compte la mobilité des salariés"

    if 'telet' in val_lower or 'télét' in val_lower or 'horaire' in val_lower or 'travail' in val_lower:
        return "Organiser le télétravail et les horaires de travail"
        
    if 'autopartage' in val_lower:
        return "Promouvoir l’autopartage"
        
    if 'velo' in val_lower or 'vélo' in val_lower:
        return "Promouvoir le vélo"
        
    if 'marche' in val_lower:
        return "Encourager la marche"
        
    if 'rembourser' in val_lower:
        return "Rembourser les transports en commun"
        
    if 'utiliser' in val_lower and 'transport' in val_lower:
        return "Utiliser les transports en commun"
        
    if 'transition' in val_lower or 'energet' in val_lower or 'énergét' in val_lower or 'energ' in val_lower:
        if 'parc' in val_lower or 'entreprise' in val_lower or 'véhic' in val_lower or 'vehic' in val_lower:
            return "Soutenir la transition énergétique du parc de véhicules de l’entreprise"
        else:
            return "Transition énergétique"
            
    return val

def process_file(input_file: str, output_file: str):
    if input_file.startswith("http"):
        print(f"1. Téléchargement du fichier distant {input_file}...")
    else:
        print(f"1. Lecture du fichier local {input_file}...")
    df = pd.read_parquet(input_file)
    
    print("2. Application des corrections des libellés IDFM...")
    if 'mesures_ref_idfm' in df.columns:
        df['mesures_ref_idfm'] = df['mesures_ref_idfm'].apply(fix_label)
    
    print(f"3. Sauvegarde du fichier corrigé vers {output_file}...")
    dir_name = os.path.dirname(output_file)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    df.to_parquet(output_path)
    
    print("4. Application du dédoublonnage métier...")
    deduplicate_parquet(output_file)
    
    con = duckdb.connect()
    count_final = con.execute(f"SELECT count(*) FROM '{output_path}'").fetchone()[0]
    distinct_vals = con.execute(f"SELECT DISTINCT mesures_ref_idfm FROM '{output_path}' ORDER BY 1").fetchall()
    
    print("\nValeurs distinctes dans mesures_ref_idfm :")
    for val in distinct_vals:
        print(f"  - {val[0]}")
        
    has_ko = False
    for val in distinct_vals:
        val_str = str(val[0])
        if '\x00' in val_str or 'v elo' in val_str or 'kilom kilométrique' in val_str or 'v ehicules' in val_str or '27' in val_str:
            print(f"⚠️ Erreur: Il reste des patterns corrompus dans '{repr(val_str)}'!")
            has_ko = True
            
    if not has_ko:
        print(f"\n✅ Succès: Nettoyage et dédoublonnage réussis pour {output_file}")
    return not has_ko

def main():
    parser = argparse.ArgumentParser(description="Correction des modalités IDFM et dédoublonnage métier")
    parser.add_argument("--input", default=None, help="Chemin du fichier Parquet source")
    parser.add_argument("--output", default=None, help="Chemin du fichier Parquet cible corrigé")
    args = parser.parse_args()
    
    default_input = os.path.join(os.path.dirname(__file__), '..', 'data', 'outputs', 'IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet')
    if not os.path.exists(default_input):
        default_input = "https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
        
    default_output = os.path.join(os.path.dirname(__file__), '..', 'data', 'outputs', 'IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_CORRIGE_2025.parquet')
    
    inp = args.input or default_input
    out = args.output or default_output
    
    process_file(inp, out)

if __name__ == "__main__":
    main()

