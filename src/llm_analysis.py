import os
import json
import re
import time
import pandas as pd
from pathlib import Path
from openai import OpenAI

def analyze_context_mock(doc_id: str, context: str, categories: list) -> dict:
    return {
        "ID": doc_id,
        "mesures_proposees": ["promouvoir le vélo en entreprise"],
        "mot_cle": categories[0] if categories else "Vélo",
        "est_mobilites_durables": "Oui",
        "moyens_materiels": ["parc à vélos"],
        "moyens_financiers": ["indemnité kilométrique"]
    }

def extract_json_from_text(text: str) -> dict:
    """Tente d'extraire et de parser un objet JSON d'une chaîne de caractères brute."""
    text = text.strip()
    
    # Si le texte est déjà propre
    if text.startswith("{") and text.endswith("}"):
        return json.loads(text)
        
    # Nettoyage si le modèle renvoie du markdown
    if "```json" in text:
        parts = text.split("```json")
        if len(parts) > 1:
            json_part = parts[1].split("```")[0].strip()
            return json.loads(json_part)
            
    if "```" in text:
        parts = text.split("```")
        if len(parts) > 1:
            # On prend le bloc qui ressemble le plus à du JSON
            for p in parts[1:]:
                p = p.strip()
                if p.startswith("{") and p.endswith("}"):
                    return json.loads(p)
                    
    # Extraction regex de dernier recours (cherche le premier bloc {...})
    match = re.search(r'\{[\s\S]*\}', text)
    if match:
        return json.loads(match.group(0))
        
    raise json.JSONDecodeError("Impossible de trouver un bloc JSON valide", text, 0)

def analyze_context_llm(client: OpenAI, model: str, doc_id: str, context: str, categories: list, max_retries: int = 3) -> dict:
    categories_str = ", ".join(categories)
    
    prompt = f"""
Au service d'une autorité organisatrice des mobilités, et en tant que chargé de développement des mobilités durables en entreprises.
Les données sont des extraits des accords issus des négociations annuelles obligatoires portant sur la thématique des mobilités, extraction faite sur la base des mots clés soumis.

Voici l'extrait pour l'accord {doc_id} :
{context}

Répond EXCLUSIVEMENT en JSON valide selon cette structure :
{{
  "ID": "{doc_id}",
  "mesures_proposees": ["mesure 1", "mesure 2"],
  "mot_cle": "un seul mot-clé issu de cette liste : {categories_str}",
  "est_mobilites_durables": "Oui ou Non",
  "moyens_materiels": ["moyen 1", "moyen 2"],
  "moyens_financiers": ["moyen financier 1", "moyen financier 2"]
}}

Instructions pour les champs :
* "ID": Rappeler l'identifiant du texte.
* "mesures_proposees": Mesures concrètes proposées concernant les mobilités sous forme d'une liste (en 10 mots max par mesure, commençant par un verbe à l'infinitif, un complément d'objet et un complément de moyen).
* "mot_cle": Mot clé principal parmi les catégories fournies (un seul mot clé, possiblement composé de 3 mots maximum).
* "est_mobilites_durables": Indicateur de promotion des mobilités durables et des transports en commun.
* "moyens_materiels": Moyens matériels concernant les mobilités lorsqu'ils sont mis à disposition par l'entreprise, sous la forme d'une liste.
* "moyens_financiers": Moyens financiers concernant les mobilités proposés par l'entreprise sous la forme d'une liste.
"""

    fallback_result = {
        "ID": doc_id,
        "mesures_proposees": [],
        "mot_cle": None,
        "est_mobilites_durables": None,
        "moyens_materiels": [],
        "moyens_financiers": []
    }

    for attempt in range(max_retries):
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Tu es un expert métier analysant des accords professionnels. Tu réponds uniquement en JSON valide sans aucun texte autour ni markdown."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.0
            )
            content = response.choices[0].message.content
            
            if not content:
                raise ValueError("Contenu vide retourné par l'API.")
                
            return extract_json_from_text(content)

        except Exception as e:
            print(f"[Attention] Erreur API LLM pour {doc_id} (Tentative {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt) # Backoff exponentiel (1s, 2s, 4s...)
            else:
                print(f"[Erreur fatale] Échec après {max_retries} tentatives pour {doc_id}. Utilisation des valeurs par défaut.")
                # Si erreur de parsing sur la dernière tentative, on affiche le contenu brut
                if 'content' in locals() and content:
                    print(f"Contenu brut renvoyé:\n{content}")
                    
    return fallback_result

def process_llm(input_parquet: str, output_parquet: str, categories_csv: str):
    df = pd.read_parquet(input_parquet)
    
    # Lecture des catégories
    cat_df = pd.read_csv(categories_csv)
    categories = cat_df.iloc[:, 0].dropna().unique().tolist()
    
    # Paramétrage de l'API (Azure, Groq, OpenAI...)
    api_key = os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("GROQ_API_KEY")
    base_url = os.getenv("LLM_BASE_URL")
    model = os.getenv("LLM_MODEL", "gpt-4o-mini")
    
    client = None
    if api_key:
        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        client = OpenAI(**client_kwargs)
        print(f"Clé API détectée. Modèle: {model} | Base URL: {base_url if base_url else 'par défaut'}")
    else:
        print("Aucune clé API trouvée. Utilisation du MOCK pour générer les résultats (à des fins de test).")
    
    results = []
    
    # Filtrer uniquement les accords qui mentionnent la mobilité (Jalon 1)
    mask = df['mentionne_mobilite'] == True
    to_process = df[mask]
    
    print(f"Lancement de l'analyse par IA sur {len(to_process)} accords...")
    
    # Attempt to import tqdm for a nice progress bar
    try:
        from tqdm import tqdm
        iterator = tqdm(to_process.iterrows(), total=len(to_process), desc="Traitement LLM")
    except ImportError:
        iterator = to_process.iterrows()
        
    count = 0
    total = len(to_process)
    
    for idx, row in iterator:
        count += 1
        doc_id = row['ID']
        # Compatibilité : le nouveau pipeline utilise 'extrait_chunk', l'ancien 'contexte_etendu'
        context = row.get('extrait_chunk') or row.get('contexte_etendu')
        
        if type(iterator) is not type and not hasattr(iterator, 'set_description'):
            # Si pas de tqdm, on affiche des logs textuels tous les 10 accords
            if count % 10 == 0:
                print(f"Progression : {count} / {total} accords traités...")
            
        if pd.isna(context) or not str(context).strip():
            results.append({
                "ID": doc_id,
                "mesures_proposees": [],
                "mot_cle": None,
                "est_mobilites_durables": None,
                "moyens_materiels": [],
                "moyens_financiers": []
            })
            continue
            
        if client:
            res = analyze_context_llm(client, model, doc_id, context, categories)
        else:
            res = analyze_context_mock(doc_id, context, categories)
            
        # Normalisation des données pour insertion dans le dataframe (Conversion des listes en str)
        if isinstance(res.get("mesures_proposees"), list):
            res["resume_mesure_proposee"] = " | ".join([str(m) for m in res["mesures_proposees"]])
        else:
            res["resume_mesure_proposee"] = str(res.get("mesures_proposees", ""))
            
        if isinstance(res.get("moyens_materiels"), list):
            res["moyens_materiels"] = " | ".join([str(m) for m in res["moyens_materiels"]])
        else:
            res["moyens_materiels"] = str(res.get("moyens_materiels", ""))
            
        if isinstance(res.get("moyens_financiers"), list):
            res["moyens_financiers"] = " | ".join([str(m) for m in res["moyens_financiers"]])
        else:
            res["moyens_financiers"] = str(res.get("moyens_financiers", ""))
            
        res["mot_cle_calcule"] = str(res.get("mot_cle", ""))
        res["est_mobilites_durables"] = str(res.get("est_mobilites_durables", ""))
            
        results.append(res)
        
    # Créer le dataframe de résultats et fusionner avec le df principal
    res_df = pd.DataFrame(results, index=to_process.index)

    target_columns = [
        "resume_mesure_proposee", "mot_cle_calcule",
        "est_mobilites_durables", "moyens_materiels", "moyens_financiers"
    ]

    for col in target_columns:
        if col not in df.columns:
            df[col] = None
        if col in res_df.columns:
            df.loc[mask, col] = res_df[col]

    # Construire l'URL Légifrance depuis l'ID
    if 'ID' in df.columns and 'url_legifrance' not in df.columns:
        df['url_legifrance'] = df['ID'].apply(
            lambda x: f"https://www.legifrance.gouv.fr/conv_coll/id/{x}" if pd.notna(x) else None
        )

    # Renommer contexte_etendu -> extrait_chunk si nécessaire (compatibilité app)
    if 'contexte_etendu' in df.columns and 'extrait_chunk' not in df.columns:
        df['extrait_chunk'] = df['contexte_etendu']

    # Renommer resume_mesure_proposee -> mesure_extraite si nécessaire (compatibilité app)
    if 'resume_mesure_proposee' in df.columns and 'mesure_extraite' not in df.columns:
        df['mesure_extraite'] = df['resume_mesure_proposee'].apply(
            lambda x: _parse_list_to_str(x) if pd.notna(x) else None
        )

    # Sauvegarde
    df.to_parquet(output_parquet)
    print(f"Analyse terminée. Fichier final sauvegardé dans : {output_parquet}")


def _parse_list_to_str(val: str) -> str:
    """Convertit une liste JSON en string ou retourne la valeur telle quelle."""
    import json
    try:
        parsed = json.loads(val)
        if isinstance(parsed, list):
            return " | ".join(str(m) for m in parsed)
    except Exception:
        pass
    return str(val)

if __name__ == "__main__":
    input_path = "ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_context.parquet"
    output_path = "ACCORDS_PROFESSIONNELS/data/outputs/202511_ACCO_MESURES_MOBILITES_FINAL.parquet"
    kw_csv = "ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260318_categories_mots_cles.csv"
    
    process_llm(input_path, output_path, kw_csv)
