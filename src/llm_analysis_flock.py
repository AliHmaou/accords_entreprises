import os
import duckdb
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

def process_llm_flock(input_parquet: str, output_parquet: str, categories_csv: str, idfm_referentiel_csv: str = None, verbose: bool = False):
    # Load .env
    load_dotenv()
    
    # Paramétrage de l'API (Priorité Azure AI Foundry)
    az_key = os.getenv("AZURE_AI_API_KEY")
    az_endpoint = os.getenv("AZURE_AI_ENDPOINT")
    az_model = os.getenv("AZURE_AI_MODEL")
    
    api_key = az_key or os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("GROQ_API_KEY")
    base_url = az_endpoint or os.getenv("LLM_BASE_URL")
    model = az_model or os.getenv("LLM_MODEL", "gpt-4o-mini")
    
    try:
        temperature = float(os.getenv("LLM_TEMPERATURE", "1.0"))
    except ValueError:
        temperature = 1.0

    # Initialisation DuckDB
    con = duckdb.connect()
    con.execute("INSTALL flock FROM community; LOAD flock;")
    
    # Configuration du secret
    # Note: On utilise le type OPENAI même pour Azure car l'endpoint fourni par l'utilisateur
    # se termine par /openai/v1, ce qui est compatible avec le type OPENAI générique de Flock.
    # On n'utilise pas OR REPLACE car non supporté par l'extension Flock.
    secret_query = f"""
    CREATE SECRET (
        TYPE OPENAI,
        API_KEY '{api_key}',
        BASE_URL '{base_url}'
    );
    """
    con.execute(secret_query)
    
    # Configuration du modèle
    model_name = 'AccordsModel'
    create_model_query = f"""
    CREATE MODEL(
       '{model_name}',
       '{model}',
       'openai',
       {{
           "tuple_format": "json", 
           "batch_size": 32, 
           "model_parameters": {{"temperature": {temperature}}}
       }}
    );
    """
    con.execute(create_model_query)
    
    # Lecture des référentiels
    cat_df = pd.read_csv(categories_csv)
    categories_str = ", ".join(cat_df.iloc[:, 0].dropna().unique().tolist())
    
    idfm_measures_str = "Pas de référentiel disponible"
    if idfm_referentiel_csv and os.path.exists(idfm_referentiel_csv):
        idfm_df = pd.read_csv(idfm_referentiel_csv)
        idfm_measures_str = ", ".join(idfm_df.iloc[:, 0].dropna().unique().tolist())

    # Chargement des données
    con.execute(f"CREATE VIEW input_data AS SELECT * FROM read_parquet('{input_parquet}')")
    
    # On ne traite que les lignes mentionnant la mobilité
    # Et on déduplique par chunk pour économiser les appels
    con.execute("""
    CREATE TABLE unique_chunks AS 
    SELECT DISTINCT ID, extrait_chunk 
    FROM input_data 
    WHERE mentionne_mobilite = true AND extrait_chunk IS NOT NULL
    """)
    
    print(f"Lancement de l'analyse via Flock sur {con.execute('SELECT COUNT(*) FROM unique_chunks').fetchone()[0]} chunks uniques...")

    # Construction du prompt complexe (sans les données)
    # Note: On doit doubler les accolades qui doivent apparaître dans la chaîne finale 
    # (celles du template JSON). Celles utilisées pour les variables Python restent simples.
    prompt_template = f"""
Au service d'une autorité organisatrice des mobilités, et en tant que chargé de développement des mobilités durables en entreprises.
Les données fournies dans "context_columns" sont des extraits d'accords professionnels. L'extrait peut commencer par une balise "TITRE SECTION :".

Répond EXCLUSIVEMENT en JSON valide selon cette structure :
{{{{
  "mesures_proposees": ["mesure 1", "mesure 2"],
  "mot_cle": "un seul mot-clé issu de cette liste : {categories_str}",
  "mentionne_mobilite_ia": "Oui ou Non",
  "est_mobilites_durables": "Oui ou Non",
  "moyens_materiels": ["moyen 1", "moyen 2"],
  "moyens_financiers": ["moyen financier 1", "moyen financier 2"],
  "mesures_ref_idfm": "Libellé exact du référentiel IDFM"
}}}}

Instructions :
* mesures_proposees: Mesures concrètes en 10 mots max par mesure, commençant par un verbe à l'infinitif.
* mentionne_mobilite_ia: Répond "Oui" si l'extrait traite réellement de la mobilité des employés (domicile-travail, transports, vélo, covoiturage, etc.). Répond "Non" si le mot-clé trouvé est une coïncidence lexicale.
* mesures_ref_idfm: Tu DOIS choisir la mesure la plus pertinente UNIQUEMENT parmi la liste suivante : {idfm_measures_str}. Indiquer "hors mesures IDFM" en l'absence de lien.
"""
    
    # Exécution de l'appel LLM massif via Flock
    # On utilise context_columns pour injecter l'extrait dynamiquement
    # Note : On a dû échapper les quotes simples pour le SQL de DuckDB.
    query = f"""
    CREATE TABLE results AS
    SELECT 
        ID,
        extrait_chunk,
        llm_complete(
            {{'model_name': '{model_name}'}},
            struct_pack(
                prompt := '{prompt_template.replace("'", "''")}',
                context_columns := [{{'data': extrait_chunk}}]
            )
        ) as raw_json
    FROM unique_chunks
    """
    con.execute(query)
    
    # Post-traitement DuckDB pour extraire les champs du JSON
    con.execute("""
    CREATE TABLE processed_results AS
    SELECT 
        ID,
        extrait_chunk,
        (raw_json->>'$.mesures_proposees') as mesures_list,
        (raw_json->>'$.mot_cle') as mot_cle_calcule,
        (raw_json->>'$.mentionne_mobilite_ia') as mentionne_mobilite_ia,
        (raw_json->>'$.est_mobilites_durables') as est_mobilites_durables,
        (raw_json->>'$.moyens_materiels') as moyens_materiels_list,
        (raw_json->>'$.moyens_financiers') as moyens_financiers_list,
        (raw_json->>'$.mesures_ref_idfm') as mesures_ref_idfm
    FROM results
    """)
    
    # Jointure avec le dataframe d'origine
    final_df = con.execute(f"""
    SELECT 
        i.*,
        p.mot_cle_calcule,
        p.mentionne_mobilite_ia,
        p.est_mobilites_durables,
        p.mesures_ref_idfm,
        p.mesures_list as resume_mesure_proposee,
        p.moyens_materiels_list as moyens_materiels,
        p.moyens_financiers_list as moyens_financiers,
        '{model}' as llm_model_used
    FROM input_data i
    LEFT JOIN processed_results p ON i.ID = p.ID AND i.extrait_chunk = p.extrait_chunk
    """).df()
    
    # Sauvegarde
    final_df.to_parquet(output_parquet)
    print(f"Analyse terminée avec Flock. Fichier sauvegardé : {output_parquet}")

if __name__ == "__main__":
    input_path = "ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_context.parquet"
    output_path = "ACCORDS_PROFESSIONNELS/data/outputs/ACCO_MESURES_MOBILITES_FLOCK.parquet"
    kw_csv = "ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260318_categories_mots_cles.csv"
    idfm_csv = "ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260507_ref_mesures_idfm.csv"
    
    if os.path.exists(input_path):
        process_llm_flock(input_path, output_path, kw_csv, idfm_csv)
    else:
        print(f"Fichier d'entrée introuvable : {input_path}")
