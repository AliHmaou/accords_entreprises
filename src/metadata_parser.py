import os
import glob
import xml.etree.ElementTree as ET
import pandas as pd
from pathlib import Path

def parse_xml_to_dict(xml_path: str) -> dict:
    """Parses a single XML file and extracts relevant metadata."""
    tree = ET.parse(xml_path)
    root = tree.getroot()
    
    metadata = {}
    
    # helper function to safely find text
    def get_text(xpath, default=None):
        elem = root.find(xpath)
        return elem.text if elem is not None else default

    metadata['ID'] = get_text('.//META_COMMUN/ID')
    metadata['RAISON_SOCIALE'] = get_text('.//META_ACCO/RAISON_SOCIALE')
    metadata['SIRET'] = get_text('.//META_ACCO/SIRET')
    metadata['TITRE_TXT'] = get_text('.//META_ACCO/TITRE_TXT')
    metadata['DATE_DEPOT'] = get_text('.//META_ACCO/DATE_DEPOT')
    metadata['DATE_TEXTE'] = get_text('.//META_ACCO/DATE_TEXTE')
    metadata['DATE_EFFET'] = get_text('.//META_ACCO/DATE_EFFET')
    metadata['DATE_FIN'] = get_text('.//META_ACCO/DATE_FIN')
    metadata['CODE_APE'] = get_text('.//META_ACCO/CODE_APE')
    metadata['SECTEUR'] = get_text('.//META_ACCO/SECTEUR')
    metadata['DOCUMENT_BUREAUTIQUE'] = get_text('.//META_ACCO/DOCUMENT_BUREAUTIQUE')
    metadata['NUMERO'] = get_text('.//META_ACCO/NUMERO')
    
    # Extract Syndicats
    syndicats_elems = root.findall('.//META_ACCO/SYNDICATS/SYNDICAT/LIBELLE')
    if syndicats_elems:
        metadata['SYNDICATS'] = " | ".join([s.text for s in syndicats_elems if s.text])
    else:
        metadata['SYNDICATS'] = None
        
    # Extract themes (if useful, though not explicitly in original schema it could be good, but we stick to schema)
    # We will just keep the ones from schema.
    
    return metadata

def parse_all_metadata(xml_dir: str) -> pd.DataFrame:
    """Parses all XML files in a directory recursively and returns a DataFrame."""
    xml_files = glob.glob(os.path.join(xml_dir, '**', '*.xml'), recursive=True)
    
    data = []
    print(f"Parsing {len(xml_files)} XML files...")
    for file_path in xml_files:
        try:
            data.append(parse_xml_to_dict(file_path))
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            
    df = pd.DataFrame(data)
    # Convert date columns to datetime
    date_cols = ['DATE_DEPOT', 'DATE_TEXTE', 'DATE_EFFET', 'DATE_FIN']
    for col in date_cols:
        if col in df.columns:
            df[col] = pd.to_datetime(df[col], errors='coerce').dt.date
            
    return df

if __name__ == "__main__":
    # Test
    xml_directory = "ACCORDS_PROFESSIONNELS/tmp/ACCO_test.tar/20250708-064156/acco/global/ACCO/TEXT"
    df = parse_all_metadata(xml_directory)
    print(df.head())
    print(f"Total rows: {len(df)}")
    # Save to interim parquet
    out_dir = Path("ACCORDS_PROFESSIONNELS/data/outputs/interim")
    out_dir.mkdir(parents=True, exist_ok=True)
    df.to_parquet(out_dir / "metadata_initial.parquet")
    print(f"Saved metadata to {out_dir / 'metadata_initial.parquet'}")