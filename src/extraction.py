import os
import tarfile
import zipfile
import shutil
from pathlib import Path

def extract_archive(archive_path: str, extract_to: str) -> str:
    """
    Extracts a zip or tar.gz archive to a specified directory.
    Consolidates any nested update directories (e.g. YYYYMMDD-HHMMSS/acco/...)
    into a single unified 'acco/global/' folder at the root of the extraction.
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
        
    print("Extraction completed. Consolidating nested directories...")
    
    # Consolidate nested 'acco/global' directories into the root 'acco/global'
    target_base = extraction_dir / "acco" / "global"
    target_base.mkdir(parents=True, exist_ok=True)
    
    all_paths = list(extraction_dir.rglob("*"))
    moved_count = 0
    
    for path in all_paths:
        if path.is_file():
            path_str = str(path.resolve())
            if "acco/global/" in path_str and not path_str.startswith(str(target_base.resolve())):
                # This file is in a nested directory!
                relative_subpath = path_str.split("acco/global/")[1]
                dest_path = target_base / relative_subpath
                dest_path.parent.mkdir(parents=True, exist_ok=True)
                
                # Move/Overwrite if already exists
                if dest_path.exists():
                    dest_path.unlink()
                shutil.move(str(path), str(dest_path))
                moved_count += 1
                
    if moved_count > 0:
        print(f"Consolidated {moved_count} nested files into {target_base}")
        
    # Clean up empty nested directories
    for path in sorted(list(extraction_dir.rglob("*")), key=lambda p: len(str(p)), reverse=True):
        if path.is_dir() and not os.listdir(path):
            path.rmdir()
            
    return str(extraction_dir)

if __name__ == "__main__":
    # Test
    extract_archive("ACCORDS_PROFESSIONNELS/data/inputs/archives_acco/ACCO_test.tar.gz", "ACCORDS_PROFESSIONNELS/tmp")
