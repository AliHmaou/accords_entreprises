import os
import subprocess
import re

def download_archives():
    url_base = "https://echanges.dila.gouv.fr/OPENDATA/ACCO/"
    out_dir = "ACCORDS_PROFESSIONNELS/data/inputs/archives_acco"
    os.makedirs(out_dir, exist_ok=True)
    
    with open("ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260318_archives_urls.txt", "r") as f:
        lines = f.readlines()
        
    for line in lines:
        match = re.search(r'\] (ACCO_[^\s]+|Freemium_acco_global_[^\s]+)', line)
        if match:
            filename = match.group(1)
            # Skip the 45GB one for now
            if "Freemium_acco_global" in filename:
                continue
            
            out_path = os.path.join(out_dir, filename)
            if not os.path.exists(out_path):
                print(f"Downloading {filename}...")
                subprocess.run(["wget", "-q", f"{url_base}{filename}", "-O", out_path])
            else:
                print(f"{filename} already exists, skipping.")

if __name__ == "__main__":
    download_archives()
