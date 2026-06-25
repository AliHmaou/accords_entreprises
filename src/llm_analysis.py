import os
import json
import re
import time
import pandas as pd
import hashlib
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

def extract_json_from_text(text: str):
    """Tente d'extraire et de parser un objet ou un tableau JSON d'une chaîne de caractères brute."""
    text = text.strip()
    
    # Si le texte est déjà propre (objet ou tableau)
    if (text.startswith("{") and text.endswith("}")) or (text.startswith("[") and text.endswith("]")):
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
            for p in parts[1:]:
                p = p.strip()
                if (p.startswith("{") and p.endswith("}")) or (p.startswith("[") and p.endswith("]")):
                    return json.loads(p)
                    
    # Extraction regex de dernier recours
    # Cherche tableau [...] ou objet {...}
    match_array = re.search(r'\[[\s\S]*\]', text)
    match_object = re.search(r'\{[\s\S]*\}', text)
    
    if match_array:
        return json.loads(match_array.group(0))
    elif match_object:
        return json.loads(match_object.group(0))
        
    raise json.JSONDecodeError("Impossible de trouver un bloc JSON valide", text, 0)

def analyze_context_llm(client: OpenAI, model: str, doc_id: str, context: str, keyword: str, categories: list, idfm_measures: list = None, max_retries: int = 3, verbose: bool = False, temperature: float = 0.0) -> dict:
    categories_str = ", ".join(categories)
    idfm_measures_str = ", ".join(idfm_measures) if idfm_measures else "Pas de référentiel disponible"
    
    prompt = f"""
Au service d'une autorité organisatrice des mobilités, et en tant que chargé de développement des mobilités durables en entreprises.
Les données fournies sont des extraits d'accords professionnels. 

STRUCTURE DE L'EXTRAIT :
L'extrait commence par une balise "TITRE SECTION :" qui indique la partie du document d'où provient le texte. Utilise cette information pour mieux comprendre le contexte de l'accord.

Un mot-clé lié à la mobilité a été détecté par notre système pour cet extrait : "{keyword}".

Voici l'extrait pour l'accord {doc_id} :
{context}

Répond EXCLUSIVEMENT en JSON valide selon cette structure :
{{
  "ID": "{doc_id}",
  "mesures_proposees": ["mesure 1", "mesure 2"],
  "mot_cle": "un seul mot-clé issu de cette liste : {categories_str}",
  "mentionne_mobilite_ia": "Oui ou Non",
  "est_mobilites_durables": "Oui ou Non",
  "est_revendication": "Oui ou Non",
  "moyens_materiels": ["moyen 1", "moyen 2"],
  "moyens_financiers": ["moyen financier 1", "moyen financier 2"],
  "mesures_ref_idfm": "Libellé exact du référentiel IDFM"
}}

Instructions pour les champs :
* "est_revendication": Répond "Oui" si l'extrait est formulé comme une demande, une revendication syndicale préalable ou un point à aborder lors des négociations. Répond "Non" s'il s'agit d'une mesure définitivement actée par un accord.
* "ID": Rappeler l'identifiant du texte.
* "mesures_proposees": Mesures concrètes proposées concernant les mobilités sous forme d'une liste
  (en 10 mots max par mesure, commençant par un verbe à l'infinitif, un complément d'objet et un
  complément de moyen).
* "mot_cle": Mot clé principal parmi les catégories fournies (un seul mot clé, possiblement composé
  de 3 mots maximum).
* "mentionne_mobilite_ia": Répond "Oui" si l'extrait traite réellement de la mobilité des employés
  (déplacements domicile-travail, transports, vélo, covoiturage, etc.). Répond "Non" si le mot-clé
  trouvé est une coïncidence lexicale (ex: "en train de", "voiture" dans un autre contexte) ou si l'extrait ne traite pas directement des questions de mobilités.
* "est_mobilites_durables": Indicateur de promotion des mobilités durables et des transports en
  commun (uniquement si mentionne_mobilite_ia est "Oui").
* "moyens_materiels": Moyens matériels concernant les mobilités lorsqu'ils sont mis à disposition
  par l'entreprise, sous la forme d'une liste.
* "moyens_financiers": Moyens financiers concernant les mobilités proposés par l'entreprise sous
  la forme d'une liste.
* "mesures_ref_idfm": Tu DOIS choisir la mesure la plus pertinente en tenant aussi compte du mot clé détecté ("{keyword}") et UNIQUEMENT parmi la liste suivante (respecte scrupuleusement le libellé exact) :
{idfm_measures_str}
Si aucune mesure ne correspond vraiment, répond exactement "hors mesures IDFM".
"""

    fallback_result = {
        "ID": doc_id,
        "mesures_proposees": [],
        "mot_cle": None,
        "mentionne_mobilite_ia": None,
        "est_mobilites_durables": None,
        "est_revendication": None,
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
                time.sleep(2 ** attempt)
            else:
                print(f"[Erreur fatale] Échec après {max_retries} tentatives pour {doc_id}. Utilisation des valeurs par défaut.")
                if 'content' in locals() and content:
                    print(f"Contenu brut renvoyé:\n{content}")
                    
    return fallback_result

def analyze_context_llm_batch(client: OpenAI, model: str, batch: list, categories: list, idfm_measures: list = None, max_retries: int = 3, verbose: bool = False, temperature: float = 0.0) -> list:
    categories_str = ", ".join(categories)
    idfm_measures_str = ", ".join(idfm_measures) if idfm_measures else "Pas de référentiel disponible"
    
    extraits_text = ""
    for item in batch:
        kw = item.get("keyword", "")
        extraits_text += f'<extrait chunk_key="{item["chunk_key"]}" ID="{item["ID"]}" mot_cle_detecte="{kw}">\n{item["context"]}\n</extrait>\n\n'

    prompt = f"""
Au service d'une autorité organisatrice des mobilités, et en tant que chargé de développement des mobilités durables en entreprises.
Tu vas recevoir un lot de plusieurs extraits d'accords professionnels. Chaque extrait est encapsulé dans une balise <extrait> avec des attributs 'chunk_key', 'ID' et 'mot_cle_detecte'.

Voici les extraits à analyser :
{extraits_text}

Tu dois analyser chaque extrait individuellement et répondre EXCLUSIVEMENT avec un OBJET JSON valide contenant une clé "resultats" qui pointe vers un tableau contenant un objet pour chaque extrait analysé.

STRUCTURE DE REPONSE ATTENDUE (Objet JSON strict) :
{{
  "resultats": [
    {{
      "chunk_key": "la valeur exacte de l'attribut chunk_key de l'extrait",
      "ID": "la valeur exacte de l'attribut ID de l'extrait",
      "mesures_proposees": ["mesure 1", "mesure 2"],
      "mot_cle": "un seul mot-clé issu de cette liste : {categories_str}",
      "mentionne_mobilite_ia": "Oui ou Non",
      "est_mobilites_durables": "Oui ou Non",
      "est_revendication": "Oui ou Non",
      "moyens_materiels": ["moyen 1", "moyen 2"],
      "moyens_financiers": ["moyen financier 1", "moyen financier 2"],
      "mesures_ref_idfm": "Libellé exact du référentiel IDFM"
    }}
  ]
}}

Instructions pour les champs :
* "est_revendication": Répond "Oui" si l'extrait est formulé comme une demande, une revendication syndicale préalable ou un point à aborder lors des négociations. Répond "Non" s'il s'agit d'une mesure définitivement actée par un accord.
* Respecte strictement le format JSON. Echappe correctement les guillemets dans le texte.
* "chunk_key" et "ID" : Il est impératif de recopier exactement les identifiants fournis dans la balise <extrait>.
* "mesures_proposees": Mesures concrètes proposées concernant les mobilités sous forme d'une liste
  (en 10 mots max par mesure, commençant par un verbe à l'infinitif, un complément d'objet et un
  complément de moyen).
* "mot_cle": Mot clé principal parmi les catégories fournies (un seul mot clé, possiblement composé
  de 3 mots maximum).
* "mentionne_mobilite_ia": Répond "Oui" si l'extrait traite réellement de la mobilité des employés
  (déplacements domicile-travail, transports, vélo, covoiturage, etc.). Répond "Non" si le mot-clé
  trouvé est une coïncidence lexicale (ex: "en train de", "voiture" dans un autre contexte) 
  ou si l'extrait ne traite pas directement des questions de mobilités.
* "est_mobilites_durables": Indicateur de promotion des mobilités durables et des transports en
  commun (uniquement si mentionne_mobilite_ia est "Oui").
* "moyens_materiels": Moyens matériels concernant les mobilités lorsqu'ils sont mis à disposition
  par l'entreprise, sous la forme d'une liste.
* "moyens_financiers": Moyens financiers concernant les mobilités proposés par l'entreprise sous
  la forme d'une liste.
* "mesures_ref_idfm": Tu DOIS choisir la mesure la plus pertinente en tenant aussi compte du mot clé détecté (fourni dans l'attribut 'mot_cle_detecte' de la balise) et UNIQUEMENT parmi la liste suivante (respecte scrupuleusement le libellé exact) :
{idfm_measures_str}
Si aucune mesure ne correspond vraiment, répond exactement "hors mesures IDFM".

L'ordre des éléments dans le tableau JSON n'a pas d'importance, mais TOUS les extraits fournis doivent avoir leur analyse dans le tableau. NE RAJOUTE AUCUN TEXTE AVANT OU APRES LE JSON.
"""

    for attempt in range(max_retries):
        try:
            if verbose:
                # Truncate prompt for printing if too long
                print_prompt = prompt if len(prompt) < 2000 else prompt[:2000] + "\n...[tronqué]...\n"
                print(f"\n--- PROMPT BATCH ({len(batch)} chunks) ---\n{print_prompt}\n--- FIN PROMPT ---")

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "Tu es un expert métier analysant des accords professionnels. Tu dois obligatoirement répondre avec un objet JSON (contenant la clé 'resultats')."},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                response_format={"type": "json_object"}
            )
            content = response.choices[0].message.content
            
            if verbose:
                print_content = content if len(content) < 2000 else content[:2000] + "\n...[tronqué]...\n"
                print(f"\n--- RÉPONSE BATCH ---\n{print_content}\n--- FIN RÉPONSE ---")

            if not content:
                raise ValueError("Contenu vide retourné par l'API.")
                
            parsed = extract_json_from_text(content)
            if not isinstance(parsed, dict) or "resultats" not in parsed:
                raise ValueError("L'API n'a pas retourné un objet JSON contenant la clé 'resultats'.")
                
            return parsed["resultats"]

        except Exception as e:
            print(f"[Attention] Erreur API LLM (batch) (Tentative {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(2 ** attempt)
            else:
                print(f"[Erreur fatale] Échec après {max_retries} tentatives pour le batch.")
                if 'content' in locals() and content:
                    print(f"Contenu brut renvoyé:\n{content}")
                raise Exception(f"Echec total de l'analyse batch : {e}")

    return []

def _normalize_result(res: dict) -> dict:
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
    res["est_revendication"] = str(res.get("est_revendication", ""))
    res["mesures_ref_idfm"] = str(res.get("mesures_ref_idfm", "hors mesures IDFM"))
    return res

def _process_chunk_fallback(client: OpenAI, model: str, doc_id: str, context: str, chunk_key: str, keyword: str, categories: list, idfm_measures: list, verbose: bool, temperature: float) -> dict:
    """Fallback function to process a single chunk using individual LLM call."""
    if client:
        res = analyze_context_llm(client, model, doc_id, context, keyword, categories, idfm_measures=idfm_measures, verbose=verbose, temperature=temperature)
    else:
        res = analyze_context_mock(doc_id, context, categories)
    return res

def process_llm(input_parquet: str, output_parquet: str, categories_csv: str, idfm_referentiel_csv: str = None, verbose: bool = False, batch_size: int = 5, max_chars_per_batch: int = 40000):
    df = pd.read_parquet(input_parquet)

    cat_df = pd.read_csv(categories_csv)
    categories = cat_df.iloc[:, 0].dropna().unique().tolist()

    idfm_measures = []
    if idfm_referentiel_csv and os.path.exists(idfm_referentiel_csv):
        idfm_df = pd.read_csv(idfm_referentiel_csv)
        idfm_measures = idfm_df.iloc[:, 0].dropna().unique().tolist()
        print(f"Référentiel IDFM chargé : {len(idfm_measures)} mesures trouvées.")

    az_key = os.getenv("AZURE_AI_API_KEY")
    az_endpoint = os.getenv("AZURE_AI_ENDPOINT")
    az_model = os.getenv("AZURE_AI_MODEL")

    api_key = az_key or os.getenv("LLM_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("GROQ_API_KEY")
    base_url = az_endpoint or os.getenv("LLM_BASE_URL")
    model = az_model or os.getenv("LLM_MODEL", "gpt-4o-mini")
    
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

    mask = df['mentionne_mobilite'].astype(bool)
    to_process = df[mask].copy()

    chunk_col = 'extrait_chunk' if 'extrait_chunk' in to_process.columns else 'contexte_etendu'

    def make_hash(x):
        return hashlib.md5(str(x).encode()).hexdigest()[:8]

    # Combinaison ID + mot-clé + hash du chunk pour permettre à l'IA d'analyser le même texte sous des angles différents (Option B)
    to_process['_chunk_key'] = (
        to_process['ID'].astype(str) + '_' + 
        to_process['theme_recherche'].fillna('').apply(make_hash) + '_' + 
        to_process[chunk_col].fillna('').apply(make_hash)
    )

    unique_chunks = to_process.drop_duplicates(subset='_chunk_key')

    total_rows = len(to_process)
    total_unique = len(unique_chunks)
    saved = total_rows - total_unique
    print(
        f"Lancement de l'analyse par IA sur {total_unique} chunks uniques "
        f"({total_rows} lignes au total, {saved} appels économisés par déduplication)."
    )

    chunk_cache = {}
    
    # Prépare les chunks valides (exclut les contextes vides)
    valid_chunks_list = []
    for idx, row in unique_chunks.iterrows():
        doc_id = row['ID']
        context = row.get(chunk_col)
        chunk_key = row['_chunk_key']

        if pd.isna(context) or not str(context).strip():
            chunk_cache[chunk_key] = _normalize_result({
                "ID": doc_id,
                "mesures_proposees": [],
                "mot_cle": None,
                "mentionne_mobilite_ia": None,
                "est_mobilites_durables": None,
                "est_revendication": None,
                "moyens_materiels": [],
                "moyens_financiers": []
            })
        else:
            valid_chunks_list.append({
                "chunk_key": chunk_key,
                "ID": doc_id,
                "keyword": row.get('theme_recherche', ''),
                "context": context
            })

    # Regroupement dynamique en batch
    batches = []
    current_batch = []
    current_chars = 0
    
    for item in valid_chunks_list:
        item_len = len(str(item["context"]))
        # Si l'ajout de cet item dépasse la limite (et qu'on a déjà au moins un élément) ou qu'on atteint batch_size
        if current_batch and (current_chars + item_len > max_chars_per_batch or len(current_batch) >= batch_size):
            batches.append(current_batch)
            current_batch = [item]
            current_chars = item_len
        else:
            current_batch.append(item)
            current_chars += item_len
            
    if current_batch:
        batches.append(current_batch)

    # Tentative d'import de tqdm
    try:
        from tqdm import tqdm
        iterator = tqdm(batches, total=len(batches), desc="Traitement LLM (Batch)")
    except ImportError:
        iterator = batches
        
    count = 0
    for batch in iterator:
        count += len(batch)
        if not hasattr(iterator, 'set_description') and count % (batch_size * 2) == 0:
            print(f"Progression : {count} / {len(valid_chunks_list)} chunks traités...")
            
        if client:
            try:
                # Appelle le LLM pour le lot entier
                batch_results = analyze_context_llm_batch(client, model, batch, categories, idfm_measures=idfm_measures, verbose=verbose, temperature=temperature)
                
                # S'assurer qu'on retrouve les clés attendues
                # Créer un dictionnaire indexé par chunk_key pour accès facile
                results_by_key = {res.get("chunk_key"): res for res in batch_results if isinstance(res, dict) and res.get("chunk_key")}
                
                # Vérifier si tous les éléments du batch sont présents dans les résultats
                missing_keys = [item["chunk_key"] for item in batch if item["chunk_key"] not in results_by_key]
                
                if missing_keys:
                    print(f"[Attention] Le modèle a omis {len(missing_keys)} résultats dans ce batch. Ils seront retraités individuellement.")
                    # On retraite les manquants en fallback
                    for item in batch:
                        if item["chunk_key"] in missing_keys:
                            print(f"Fallback individuel pour {item['ID']}")
                            fallback_res = _process_chunk_fallback(client, model, item["ID"], item["context"], item["chunk_key"], item.get("keyword", ""), categories, idfm_measures, verbose, temperature)
                            chunk_cache[item["chunk_key"]] = _normalize_result(fallback_res)
                            
                # Enregistrer les résultats réussis du batch
                for item in batch:
                    k = item["chunk_key"]
                    if k in results_by_key:
                        chunk_cache[k] = _normalize_result(results_by_key[k])

            except Exception as batch_error:
                print(f"[Attention] Echec du batch complet ({batch_error}). Bascule en mode dégradé (individuel) pour ce lot.")
                for item in batch:
                    fallback_res = _process_chunk_fallback(client, model, item["ID"], item["context"], item["chunk_key"], item.get("keyword", ""), categories, idfm_measures, verbose, temperature)
                    chunk_cache[item["chunk_key"]] = _normalize_result(fallback_res)
        else:
            # Mode MOCK
            for item in batch:
                res = analyze_context_mock(item["ID"], item["context"], categories)
                chunk_cache[item["chunk_key"]] = _normalize_result(res)

    target_columns = [
        "resume_mesure_proposee", "mot_cle_calcule",
        "mentionne_mobilite_ia", "est_mobilites_durables", "est_revendication",
        "moyens_materiels", "moyens_financiers", "mesures_ref_idfm"
    ]

    for col in target_columns:
        if col not in df.columns:
            df[col] = None

    for col in target_columns:
        df.loc[mask, col] = to_process['_chunk_key'].map(
            lambda k: chunk_cache.get(k, {}).get(col)
        ).values
        # Pour les accords sans aucune correspondance de mot-clé
        df.loc[~mask, col] = "AUCUNE_CORRESPONDANCE"

    df['llm_model_used'] = model if client else "MOCK"
    df.loc[~mask, 'llm_model_used'] = "AUCUNE_CORRESPONDANCE"

    if 'ID' in df.columns and 'url_legifrance' not in df.columns:
        df['url_legifrance'] = df['ID'].apply(
            lambda x: f"https://www.legifrance.gouv.fr/acco/id/{x}" if pd.notna(x) else None
        )

    if 'contexte_etendu' in df.columns and 'extrait_chunk' not in df.columns:
        df['extrait_chunk'] = df['contexte_etendu']

    if 'resume_mesure_proposee' in df.columns and 'mesure_extraite' not in df.columns:
        df['mesure_extraite'] = df['resume_mesure_proposee'].apply(
            lambda x: _parse_list_to_str(x) if pd.notna(x) else None
        )
    df.loc[~mask, 'mesure_extraite'] = "AUCUNE_CORRESPONDANCE"

    df.to_parquet(output_parquet)
    print(f"Analyse terminée. Fichier final sauvegardé dans : {output_parquet}")

def _parse_list_to_str(val: str) -> str:
    import json
    try:
        parsed = json.loads(val)
        if isinstance(parsed, list):
            return " | ".join(str(m) for m in parsed)
    except Exception:
        pass
    return str(val)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="LLM Analysis with Batching")
    parser.add_argument("--input", default="ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_context.parquet")
    parser.add_argument("--output", default="ACCORDS_PROFESSIONNELS/data/outputs/202511_ACCO_MESURES_MOBILITES_FINAL.parquet")
    parser.add_argument("--kw", default="ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260318_categories_mots_cles.csv")
    parser.add_argument("--idfm", default="ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260507_ref_mesures_idfm.csv")
    parser.add_argument("--batch-size", type=int, default=5, help="Taille max d'un lot d'extraits")
    parser.add_argument("--max-chars", type=int, default=40000, help="Nombre max de caractères par lot (prévention context limit)")
    parser.add_argument("--verbose", action="store_true")
    
    args = parser.parse_args()
    
    process_llm(
        args.input, 
        args.output, 
        args.kw, 
        idfm_referentiel_csv=args.idfm, 
        verbose=args.verbose,
        batch_size=args.batch_size,
        max_chars_per_batch=args.max_chars
    )
