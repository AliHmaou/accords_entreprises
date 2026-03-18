import os
import subprocess
import pandas as pd
from pathlib import Path
from multiprocessing import Pool
import functools

def convert_single_doc(doc_path: str, md_path: str) -> bool:
    """Converts a single word document to markdown using Pandoc."""
    if not os.path.exists(doc_path):
        # some documents might be missing or have a different extension
        return False
        
    # skip if already converted
    if os.path.exists(md_path):
        return True
        
    try:
        # call pandoc in shell mode
        cmd = ["pandoc", doc_path, "-o", md_path, "-t", "markdown"]
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False

def process_row(row, base_doc_dir, output_dir):
    doc_rel_path = row.get('DOCUMENT_BUREAUTIQUE')
    if not doc_rel_path:
        return None
        
    # remove leading slash if any
    if doc_rel_path.startswith('/'):
        doc_rel_path = doc_rel_path[1:]
        
    doc_path = Path(base_doc_dir) / doc_rel_path
    
    # Check if file exists, sometimes extensions are different like .doc instead of .docx
    if not doc_path.exists():
        # try without extension and see what is there
        # This is a simplification. Assuming exact match for now.
        pass
        
    md_filename = f"{row['ID']}.md"
    md_path = Path(output_dir) / md_filename
    
    success = convert_single_doc(str(doc_path), str(md_path))
    if success:
        return str(md_path)
    return None

def convert_documents(df: pd.DataFrame, base_doc_dir: str, output_dir: str, num_workers: int = 4) -> pd.DataFrame:
    """
    Takes a dataframe with metadata, converts all referenced word documents to markdown,
    and adds a 'fichier_markdown' column.
    """
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    print(f"Converting {len(df)} documents to markdown...")
    
    rows = [row for _, row in df.iterrows()]
    
    # Use multiprocessing for faster conversion
    with Pool(num_workers) as pool:
        process_func = functools.partial(process_row, base_doc_dir=base_doc_dir, output_dir=output_dir)
        md_paths = pool.map(process_func, rows)
        
    df['fichier_markdown'] = md_paths
    
    success_count = sum(1 for p in md_paths if p is not None)
    print(f"Successfully converted {success_count} / {len(df)} documents.")
    
    return df

if __name__ == "__main__":
    # Test
    df = pd.read_parquet("ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_initial.parquet")
    base_dir = "ACCORDS_PROFESSIONNELS/tmp/ACCO_test.tar/20250708-064156/acco/global/bureautique"
    out_md_dir = "ACCORDS_PROFESSIONNELS/data/outputs/interim/markdown_files"
    
    # Process a small subset for testing if we want, but pool makes it fast
    df = convert_documents(df, base_dir, out_md_dir, num_workers=8)
    
    # Save the updated dataframe
    df.to_parquet("ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_md.parquet")
    print("Saved updated metadata to ACCORDS_PROFESSIONNELS/data/outputs/interim/metadata_with_md.parquet")
