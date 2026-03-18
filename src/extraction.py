import os
import tarfile
import zipfile
import shutil
from pathlib import Path

def extract_archive(archive_path: str, extract_to: str) -> str:
    """
    Extracts a zip or tar.gz archive to a specified directory.
    Returns the path where the files were extracted.
    """
    archive_path = Path(archive_path)
    extract_to = Path(extract_to)
    
    # Create specific extraction folder based on archive name
    folder_name = archive_path.name.replace('.tar.gz', '').replace('.zip', '')
    extraction_dir = extract_to / folder_name
    if extraction_dir.exists():
        shutil.rmtree(extraction_dir)
    extraction_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"Extracting {archive_path.name} to {extraction_dir}...")
    
    if archive_path.suffix == '.zip':
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(extraction_dir)
    elif archive_path.name.endswith('.tar.gz') or archive_path.suffix == '.tar':
        with tarfile.open(archive_path, 'r:*') as tar_ref:
            tar_ref.extractall(extraction_dir)
    else:
        raise ValueError(f"Unsupported archive format: {archive_path.suffix}")
        
    print("Extraction completed.")
    return str(extraction_dir)

if __name__ == "__main__":
    # Test
    extract_archive("ACCORDS_PROFESSIONNELS/data/inputs/archives_acco/ACCO_test.tar.gz", "ACCORDS_PROFESSIONNELS/tmp")
