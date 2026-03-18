import os
import re
import pandas as pd
from collections import defaultdict

def load_keywords_mapping(csv_path: str) -> dict:
    df = pd.read_csv(csv_path)
    # The columns are likely 'Catgorie' and 'Mots-cls'
    cat_col = df.columns[0]
    kw_col = 'Mots-cls' if 'Mots-cls' in df.columns else df.columns[1]
    
    mapping = {}
    for _, row in df.iterrows():
        cat = str(row[cat_col]).strip()
        kw = str(row[kw_col]).strip().lower()
        mapping[kw] = cat
        
    return mapping

def build_regex_and_mapping(mapping: dict):
    keywords = sorted(list(mapping.keys()), key=len, reverse=True)
    escaped = [re.escape(kw) for kw in keywords if kw]
    pattern = r'(?i)\b(' + '|'.join(escaped) + r')\b'
    regex = re.compile(pattern)
    return regex, mapping

def extract_context_and_keywords(text: str, regex: re.Pattern, mapping: dict, context_window: int = 1):
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    match_indices = set()
    found_kws = set()
    found_cats = set()
    
    for i, p in enumerate(paragraphs):
        matches = regex.findall(p)
        if matches:
            for m in matches:
                # m could be a tuple if regex has multiple groups, but here it has one group
                kw_found = m.lower()
                found_kws.add(kw_found)
                if kw_found in mapping:
                    found_cats.add(mapping[kw_found])
                    
            for j in range(max(0, i - context_window), min(len(paragraphs), i + context_window + 1)):
                match_indices.add(j)
                
    if not match_indices:
        return None, None, None
        
    sorted_indices = sorted(list(match_indices))
    
    chunks = []
    last_idx = -2
    for idx in sorted_indices:
        if idx > last_idx + 1 and last_idx != -2:
            chunks.append("[...]")
        chunks.append(paragraphs[idx])
        last_idx = idx
        
    context = "\n\n".join(chunks)
    kws_str = " | ".join(sorted(list(found_kws)))
    cats_str = " | ".join(sorted(list(found_cats)))
    
    return context, kws_str, cats_str

def process_documents(metadata_path: str, keywords_csv: str, output_path: str):
    df = pd.read_parquet(metadata_path)
    mapping = load_keywords_mapping(keywords_csv)
    regex, mapping_dict = build_regex_and_mapping(mapping)
    
    contexts = []
    mots_cles_trouves = []
    categories_trouvees = []
    
    print(f"Scanning {len(df)} documents for Jalon 1 (avec extraction mots-clés)...")
    
    for idx, row in df.iterrows():
        md_path = row.get('fichier_markdown')
        if not md_path or not os.path.exists(md_path):
            contexts.append(None)
            mots_cles_trouves.append(None)
            categories_trouvees.append(None)
            continue
            
        with open(md_path, 'r', encoding='utf-8') as f:
            text = f.read()
            
        context, kws, cats = extract_context_and_keywords(text, regex, mapping_dict, context_window=1)
        contexts.append(context)
        mots_cles_trouves.append(kws)
        categories_trouvees.append(cats)
        
    df['contexte_etendu'] = contexts
    df['mots_cles_bruts'] = mots_cles_trouves
    df['categories_mots_cles'] = categories_trouvees
    df['mentionne_mobilite'] = df['contexte_etendu'].notna()
    
    total = len(df)
    mentions = df['mentionne_mobilite'].sum()
    print(f"--- STATISTIQUES JALON 1 ---")
    print(f"Total des accords analysés: {total}")
    print(f"Accords évoquant la mobilité: {mentions} ({mentions/total*100:.1f}%)")
    
    df.to_parquet(output_path)
    print(f"Sauvegardé dans: {output_path}")
    
if __name__ == "__main__":
    metadata_in = "ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_md.parquet"
    kw_csv = "ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260318_categories_mots_cles.csv"
    output_out = "ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_context.parquet"
    
    process_documents(metadata_in, kw_csv, output_out)
