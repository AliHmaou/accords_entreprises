import os
import json
import re
import time
import pandas as pd
from openai import OpenAI

def analyze_context_mock(doc_id: str, context: str, categories: list) -> dict:
    return {
        "ID": doc_id,
        "mesures_proposees": ["promouvoir le vélo en entreprise"],
        "mot_cle": categories[0] if categories else "Vélo",
        "mentionne_mobilite_ia": "Oui",
        "est_mobilites_durables": "Oui",
        "moyens_materiels": ["parc à vélos"],
        "moyens_financiers": ["indemnité kilométrique"],
        "mesures_ref_idfm": "Promouvoir le vélo"
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

def analyze_context_llm(client: OpenAI, model: str, doc_id: str, context: str, categories: list, idfm_measures: list = None, max_retries: int = 3, verbose: bool = False, temperature: float = 0.0) -> dict:
    categories_str = ", ".join(categories)
    idfm_measures_str = ", ".join(idfm_measures) if idfm_measures else "Pas de référentiel disponible"
    
    prompt = f"""
Au service d'une autorité organisatrice des mobilités, et en tant que chargé de développement des mobilités durables en entreprises.
Les données fournies sont des extraits d'accords professionnels. 

STRUCTURE DE L'EXTRAIT :
L'extrait commence par une balise "TITRE SECTION :" qui indique la partie du document d'où provient le texte. Utilise cette information pour mieux comprendre le contexte de l'accord.

Voici l'extrait pour l'accord {doc_id} :
{context}

Répond EXCLUSIVEMENT en JSON valide selon cette structure :
{{
  "ID": "{doc_id}",
  "mesures_proposees": ["mesure 1", "mesure 2"],
  "mot_cle": "un seul mot-clé issu de cette liste : {categories_str}",
  "mentionne_mobilite_ia": "Oui ou Non",
  "est_mobilites_durables": "Oui ou Non",
  "moyens_materiels": ["moyen 1", "moyen 2"],
  "moyens_financiers": ["moyen financier 1", "moyen financier 2"],
  "mesures_ref_idfm": "Libellé exact du référentiel IDFM"
}}

Instructions pour les champs :
* "ID": Rappeler l'identifiant du texte.
* "mesures_proposees": Mesures concrètes proposées concernant les mobilités sous forme d'une liste
  (en 10 mots max par mesure, commençant par un verbe à l'infinitif, un complément d'objet et un
  complément de moyen).
* "mot_cle": Mot clé principal parmi les catégories fournies (un seul mot clé, possiblement composé
  de 3 mots maximum).
* "mentionne_mobilite_ia": Répond "Oui" si l'extrait traite réellement de la mobilité des employés
  (déplacements domicile-travail, transports, vélo, covoiturage, etc.). Répond "Non" si le mot-clé
  trouvé est une coïncidence lexicale (ex: "en train de", "voiture" dans un autre contexte).
* "est_mobilites_durables": Indicateur de promotion des mobilités durables et des transports en
  commun (uniquement si mentionne_mobilite_ia est "Oui").
* "moyens_materiels": Moyens matériels concernant les mobilités lorsqu'ils sont mis à disposition
  par l'entreprise, sous la forme d'une liste.
* "moyens_financiers": Moyens financiers concernant les mobilités proposés par l'entreprise sous
  la forme d'une liste.
* "mesures_ref_idfm": Tu DOIS choisir la mesure la plus pertinente UNIQUEMENT parmi la liste suivante (respecte scrupuleusement le libellé exact) :
{idfm_measures_str}
Si aucune mesure ne correspond vraiment, répond exactement "hors mesures IDFM".
"""

    fallback_result = {
        "ID": doc_id,
        "mesures_proposees": [],
        "mot_cle": None,
        "mentionne_mobilite_ia": None,
        "est_mobilites_durables": None,
        "moyens_materiels": [],
        "moyens_financiers": [],
        "mesures_ref_idfm": "hors mesures IDFM"
    }

    for attempt in range(max_retries):
        try:
            if verbose:
                print(f"\n--- PROMPT POUR {doc_id} ---\n{prompt}\n--- FIN PROMPT ---")

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Tu es un expert métier analysant des accords professionnels. Tu réponds uniquement en JSON valide sans aucun texte autour ni markdown."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature
            )
            content = response.choices[0].message.content
            
            if verbose:
                print(f"\n--- RÉPONSE POUR {doc_id} ---\n{content}\n--- FIN RÉPONSE ---")

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

def _normalize_result(res: dict) -> dict:
    """Normalise les champs d'un résultat LLM (listes -> str, etc.)."""
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
    res["mentionne_mobilite_ia"] = str(res.get("mentionne_mobilite_ia", ""))
    res["mesures_ref_idfm"] = str(res.get("mesures_ref_idfm", "hors mesures IDFM"))
    return res


def process_llm(input_parquet: str, output_parquet: str, categories_csv: str, idfm_referentiel_csv: str = None, verbose: bool = False):
    df = pd.read_parquet(input_parquet)

    # Lecture des catégories
    cat_df = pd.read_csv(categories_csv)
    categories = cat_df.iloc[:, 0].dropna().unique().tolist()

    # Lecture du référentiel IDFM
    idfm_measures = []
    if idfm_referentiel_csv and os.path.exists(idfm_referentiel_csv):
        idfm_df = pd.read_csv(idfm_referentiel_csv)
        idfm_measures = idfm_df.iloc[:, 0].dropna().unique().tolist()
        print(f"Référentiel IDFM chargé : {len(idfm_measures)} mesures trouvées.")

    # Paramétrage de l'API (Priorité Azure AI Foundry, puis générique OpenAI/Groq)
    az_key = os.getenv("AZURE_AI_API_KEY")
    az_endpoint = os.getenv("AZURE_AI_ENDPOINT")
    az_model = os.getenv("AZURE_AI_MODEL")

    api_key = az_key or os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("GROQ_API_KEY")
    base_url = az_endpoint or os.getenv("LLM_BASE_URL")
    model = az_model or os.getenv("LLM_MODEL", "gpt-4o-mini")
    
    # Récupération de la température
    try:
        temperature = float(os.getenv("LLM_TEMPERATURE", "0.0"))
    except ValueError:
        temperature = 0.0

    client = None
    if api_key:
        client_kwargs = {"api_key": api_key}
        if base_url:
            client_kwargs["base_url"] = base_url
        client = OpenAI(**client_kwargs)
        
        provider = "Azure AI Foundry" if az_key else "OpenAI/Groq/Custom"
        print(f"Initialisation client LLM ({provider}).")
        print(f"  Modèle     : {model}")
        print(f"  Endpoint    : {base_url if base_url else 'par défaut'}")
        print(f"  Température : {temperature}")
    else:
        print("Aucune clé API trouvée. Utilisation du MOCK pour générer les résultats.")

    # Filtrer uniquement les accords qui mentionnent la mobilité (Jalon 1)
    mask = df['mentionne_mobilite'].astype(bool)
    to_process = df[mask].copy()

    # -----------------------------------------------------------------------
    # DÉDUPLICATION PAR CHUNK
    # Un même accord peut avoir plusieurs mots-clés pointant vers le même
    # extrait_chunk. On ne veut appeler l'IA qu'une seule fois par chunk
    # unique (ID, extrait_chunk). Les résultats sont ensuite rediffusés à
    # toutes les lignes partageant ce chunk.
    # -----------------------------------------------------------------------
    chunk_col = 'extrait_chunk' if 'extrait_chunk' in to_process.columns else 'contexte_etendu'

    # Clé de déduplication : (ID, contenu du chunk)
    to_process['_chunk_key'] = (
        to_process['ID'].astype(str) + '|||' + to_process[chunk_col].fillna('').astype(str)
    )

    # Garder une seule ligne représentative par chunk unique
    unique_chunks = to_process.drop_duplicates(subset='_chunk_key')

    total_rows = len(to_process)
    total_unique = len(unique_chunks)
    saved = total_rows - total_unique
    print(
        f"Lancement de l'analyse par IA sur {total_unique} chunks uniques "
        f"({total_rows} lignes au total, {saved} appels économisés par déduplication)."
    )

    # Attempt to import tqdm for a nice progress bar
    try:
        from tqdm import tqdm
        iterator = tqdm(unique_chunks.iterrows(), total=total_unique, desc="Traitement LLM")
    except ImportError:
        iterator = unique_chunks.iterrows()

    count = 0
    # Cache : chunk_key -> résultat normalisé
    chunk_cache: dict = {}

    for idx, row in iterator:
        count += 1
        doc_id = row['ID']
        context = row.get(chunk_col)
        chunk_key = row['_chunk_key']

        if not hasattr(iterator, 'set_description') and count % 10 == 0:
            print(f"Progression : {count} / {total_unique} chunks traités...")

        if pd.isna(context) or not str(context).strip():
            chunk_cache[chunk_key] = _normalize_result({
                "ID": doc_id,
                "mesures_proposees": [],
                "mot_cle": None,
                "mentionne_mobilite_ia": None,
                "est_mobilites_durables": None,
                "moyens_materiels": [],
                "moyens_financiers": []
            })
            continue

        if client:
            res = analyze_context_llm(client, model, doc_id, context, categories, idfm_measures=idfm_measures, verbose=verbose, temperature=temperature)
        else:
            res = analyze_context_mock(doc_id, context, categories)

        chunk_cache[chunk_key] = _normalize_result(res)

    # Rediffuser les résultats à toutes les lignes (y compris les doublons de chunk)
    target_columns = [
        "resume_mesure_proposee", "mot_cle_calcule",
        "mentionne_mobilite_ia", "est_mobilites_durables",
        "moyens_materiels", "moyens_financiers", "mesures_ref_idfm"
    ]

    for col in target_columns:
        if col not in df.columns:
            df[col] = None

    for col in target_columns:
        df.loc[mask, col] = to_process['_chunk_key'].map(
            lambda k: chunk_cache.get(k, {}).get(col)
        ).values

    # Ajout du champ LLM_MODEL_USED
    df['llm_model_used'] = model if client else "MOCK"

    # Construire l'URL Légifrance depuis l'ID
    # Le bon chemin est /acco/id/ (et non /conv_coll/id/)
    if 'ID' in df.columns and 'url_legifrance' not in df.columns:
        df['url_legifrance'] = df['ID'].apply(
            lambda x: f"https://www.legifrance.gouv.fr/acco/id/{x}" if pd.notna(x) else None
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
    idfm_csv = "ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260507_ref_mesures_idfm.csv"
    
    process_llm(input_path, output_path, kw_csv, idfm_referentiel_csv=idfm_csv)
