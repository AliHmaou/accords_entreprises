import sys
import os
import duckdb
import pandas as pd
import argparse

# Add src to python path to import deduplicate
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))
from deduplicate import deduplicate_parquet

DEFAULT_INPUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'outputs', 'IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet')
DEFAULT_OUTPUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'outputs', 'IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_CORRIGE_2025.parquet')

def fix_label(val):
    if not isinstance(val, str):
        return val
    
    val_lower = val.lower()
    
    # Precise but flexible keyword matching to avoid any encoding/character mismatches
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
        
    if 'voiture' in val_lower or 'deux-roues' in val_lower or 'motoris' in val_lower:
        return "Organiser l’usage de la voiture et des deux-roues motorisés"
        
    if 'stationnement' in val_lower:
        return "Organiser le stationnement des véhicules et des vélos"
        
    # Vérifier 'salari' AVANT 'telet' pour éviter que 'mobilité' matche des séquences d'encodage 't\x00e'
    if 'salari' in val_lower:
        return "Prendre en compte la mobilité des salariés"

    if 'telet' in val_lower or 'télét' in val_lower or 'horaire' in val_lower or 'travail' in val_lower:
        return "Organiser le télétravail et les horaires de travail"
        
    if 'autopartage' in val_lower:
        return "Promouvoir l’autopartage"
        
    if 'velo' in val_lower or 'vélo' in val_lower or r'v\x00' in val_lower or r'v\u00' in val_lower:
        return "Promouvoir le vélo"
        
    if 'transition' in val_lower or 'energet' in val_lower or 'énergét' in val_lower or 'energ' in val_lower:
        if 'parc' in val_lower or 'entreprise' in val_lower or 'véhic' in val_lower or 'vehic' in val_lower:
            return "Soutenir la transition énergétique du parc de véhicules de l’entreprise"
        else:
            return "Transition énergétique"
            
    return val

def correct_file(input_path: str, output_path: str):
    """Corrige les libellés LLM et dédoublonne un fichier Parquet donné."""
    if input_path.startswith("http"):
        print(f"1. Téléchargement du fichier distant {input_path}...")
    else:
        if not os.path.exists(input_path):
            print(f"❌ Erreur : Fichier introuvable : {input_path}")
            return
        print(f"1. Lecture du fichier local {input_path}...")
        
    df = pd.read_parquet(input_path)
    count_init = len(df)
    
    print(f"2. Application des corrections sur {count_init} lignes...")
    df['mesures_ref_idfm'] = df['mesures_ref_idfm'].apply(fix_label)
    
    dir_name = os.path.dirname(output_path)
    if dir_name:
        os.makedirs(dir_name, exist_ok=True)
    df.to_parquet(output_path)
    
    print(f"3. Application du dédoublonnage métier...")
    deduplicate_parquet(output_path)
    
    con = duckdb.connect()
    count_final = con.execute(f"SELECT count(*) FROM '{output_path}'").fetchone()[0]
    distinct_vals = con.execute(f"SELECT DISTINCT mesures_ref_idfm FROM '{output_path}' ORDER BY 1").fetchall()
    
    print(f"✅ Terminé : {output_path} ({count_final} lignes, dédoublonné de {count_init - count_final} lignes)")
    print("Modalités distinctes :")
    for val in distinct_vals:
        print(f"  - {val[0]}")
        
    # Vérification d'anomalies
    for val in distinct_vals:
        val_str = str(val[0])
        if '\x00' in val_str or 'v elo' in val_str or 'kilom kilométrique' in val_str or 'v ehicules' in val_str:
            print(f"⚠️ Avertissement : Pattern anormal détecté dans '{val_str}'")

def main():
    parser = argparse.ArgumentParser(description="Corriger les modalités IDFM et dédoublonner")
    parser.add_argument("--input", default=None, help="Chemin du fichier Parquet source")
    parser.add_argument("--output", default=None, help="Chemin du fichier Parquet de sortie")
    args = parser.parse_args()
    
    inp = args.input or DEFAULT_INPUT
    if not os.path.exists(inp) and not inp.startswith("http"):
        inp = "https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
    out = args.output or DEFAULT_OUTPUT
    correct_file(inp, out)

if __name__ == "__main__":
    main()

