import pandas as pd
import os
from pathlib import Path

def deduplicate_parquet(file_path: str):
    """
    Deduplicates a parquet file by grouping on ID and mesures_ref_idfm,
    taking the longest extrait_chunk, and combining theme_recherche values with '/'.
    Modifies the file in-place.
    """
    if not os.path.exists(file_path):
        return

    try:
        df = pd.read_parquet(file_path)
    except Exception as e:
        print(f"Erreur lors de la lecture de {file_path}: {e}")
        return

    group_cols = ['ID', 'mesures_ref_idfm']
    actual_group_cols = [c for c in group_cols if c in df.columns]

    if len(actual_group_cols) == 0:
        return

    # Check if there are any duplicates to process
    if df.duplicated(subset=actual_group_cols).any():
        print(f"Dédoublonnage de {Path(file_path).name} en cours...")

        agg_dict = {}
        for col in df.columns:
            if col in actual_group_cols:
                continue
            elif col == 'theme_recherche':
                def join_unique(x):
                    # Drop empty/nan and join unique values with '/'
                    items = [str(i).strip() for i in x.dropna() if str(i).strip() != ""]
                    return " / ".join(sorted(set(items)))
                agg_dict[col] = join_unique
            elif col == 'extrait_chunk':
                def longest_string(x):
                    # Return the string with the max length
                    valid_strings = [str(i) for i in x.dropna() if str(i).strip() != ""]
                    if not valid_strings:
                        return None
                    return max(valid_strings, key=len)
                agg_dict[col] = longest_string
            else:
                agg_dict[col] = 'first'

        df_dedup = df.groupby(actual_group_cols, dropna=False, as_index=False).agg(agg_dict)

        # Ensure columns are in original order
        df_dedup = df_dedup[df.columns]
        df_dedup.to_parquet(file_path)
        print(f"✅ Dédoublonnage réussi pour {Path(file_path).name}")
