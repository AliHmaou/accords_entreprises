import os
import re
import pandas as pd


def load_keywords_mapping(csv_path: str) -> dict:
    """Charge le CSV catégorie/mots-clés et retourne un dict {mot_cle: categorie}."""
    df = pd.read_csv(csv_path)
    cat_col = df.columns[0]   # 'Catgorie'
    kw_col = df.columns[1]    # 'Mots-cls'

    mapping = {}
    for _, row in df.iterrows():
        cat = str(row[cat_col]).strip()
        kw = str(row[kw_col]).strip().lower()
        if kw:
            mapping[kw] = cat

    return mapping


def build_regex(mapping: dict) -> re.Pattern:
    """Construit un regex qui matche tous les mots-clés (plus longs en premier)."""
    keywords = sorted(mapping.keys(), key=len, reverse=True)
    escaped = [re.escape(kw) for kw in keywords if kw]
    pattern = r'(?i)\b(' + '|'.join(escaped) + r')\b'
    return re.compile(pattern)


def extract_chunks_per_keyword(
    text: str,
    regex: re.Pattern,
    mapping: dict,
    context_window: int = 1
) -> list[dict]:
    """
    Pour chaque mot-clé trouvé dans le texte, retourne un dict avec :
    - theme_recherche : le mot-clé trouvé
    - categorie_mot_cle : la catégorie associée
    - extrait_chunk : le contexte autour du paragraphe contenant le mot-clé
    Inclut désormais le TITRE DE LA PARTIE si trouvé.
    """
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]

    # Identification des titres pour chaque paragraphe
    para_to_heading = {}
    last_heading = "Introduction / Titre non détecté"
    for i, p in enumerate(paragraphs):
        # On considère comme titre tout paragraphe commençant par # (Markdown)
        if p.startswith('#'):
            last_heading = p.lstrip('#').strip()
        para_to_heading[i] = last_heading

    # Regrouper les paragraphes par mot-clé trouvé
    kw_to_para_indices: dict[str, set] = {}

    for i, p in enumerate(paragraphs):
        # On ne cherche pas de mots-clés dans les titres eux-mêmes pour éviter les doublons de contexte
        if p.startswith('#'):
            continue

        matches = regex.findall(p)
        for m in matches:
            kw = m.lower()
            if kw not in kw_to_para_indices:
                kw_to_para_indices[kw] = set()
            for j in range(
                max(0, i - context_window),
                min(len(paragraphs), i + context_window + 1)
            ):
                # On n'ajoute pas les titres dans le flux de texte du chunk pour garder la lisibilité,
                # on les gère séparément.
                if not paragraphs[j].startswith('#'):
                    kw_to_para_indices[kw].add(j)

    results = []
    for kw, indices in kw_to_para_indices.items():
        sorted_indices = sorted(indices)
        
        # Trouver le titre associé au premier paragraphe du groupe
        heading = para_to_heading.get(sorted_indices[0], "Titre non trouvé")
        
        chunks = []
        last_idx = -2
        for idx in sorted_indices:
            if idx > last_idx + 1 and last_idx != -2:
                chunks.append("[...]")
            chunks.append(paragraphs[idx])
            last_idx = idx

        full_chunk_text = f"TITRE SECTION : {heading}\n\n" + "\n\n".join(chunks)

        results.append({
            'theme_recherche': kw,
            'categorie_mot_cle': mapping.get(kw, ''),
            'extrait_chunk': full_chunk_text,
        })

    return results


def process_documents(metadata_path: str, keywords_csv: str, output_path: str):
    """
    Produit un parquet avec UNE LIGNE PAR MOT-CLÉ TROUVÉ PAR ACCORD.
    Chaque ligne contient les métadonnées de l'accord + le mot-clé + son extrait.
    """
    df = pd.read_parquet(metadata_path)
    mapping = load_keywords_mapping(keywords_csv)
    regex = build_regex(mapping)

    print(f"Scanning {len(df)} documents pour Jalon 1 (une ligne par mot-clé)...")

    rows = []
    accords_avec_mobilite = 0

    for _, row in df.iterrows():
        md_path = row.get('fichier_markdown')
        if not md_path or not os.path.exists(str(md_path)):
            continue

        with open(str(md_path), 'r', encoding='utf-8') as f:
            text = f.read()

        chunks = extract_chunks_per_keyword(text, regex, mapping, context_window=1)

        if chunks:
            accords_avec_mobilite += 1
            base = row.to_dict()
            base['mentionne_mobilite'] = True
            for chunk_info in chunks:
                new_row = {**base, **chunk_info}
                rows.append(new_row)

    total = len(df)
    print(f"--- STATISTIQUES JALON 1 ---")
    print(f"Total des accords analysés: {total}")
    print(f"Accords évoquant la mobilité: {accords_avec_mobilite} ({accords_avec_mobilite/total*100:.1f}%)")
    print(f"Lignes produites (1 par mot-clé par accord): {len(rows)}")

    df_out = pd.DataFrame(rows)
    df_out.to_parquet(output_path, index=False)
    print(f"Sauvegardé dans: {output_path}")


if __name__ == "__main__":
    metadata_in = "ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_md.parquet"
    kw_csv = "ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260318_categories_mots_cles.csv"
    output_out = "ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_context.parquet"

    process_documents(metadata_in, kw_csv, output_out)
