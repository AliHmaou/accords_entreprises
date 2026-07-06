import os
import subprocess
import re
import urllib.request
import sys

def get_available_archives(url_base):
    """Récupère dynamiquement la liste des fichiers disponibles sur la DILA."""
    try:
        print(f"Connexion à {url_base} pour lister les archives...")
        with urllib.request.urlopen(url_base, timeout=15) as response:
            html = response.read().decode('utf-8')
        
        # Recherche tous les fichiers tar.gz ou zip
        filenames = re.findall(r'href="([^"]+\.(?:tar\.gz|zip))"', html)
        if not filenames:
            # Essai d'un autre motif de recherche pour les liens de l'index apache/nginx
            filenames = re.findall(r'a href="([^"]+)"', html)
            filenames = [f for f in filenames if f.endswith('.tar.gz') or f.endswith('.zip')]
            
        return sorted(list(set(filenames)))
    except Exception as e:
        print(f"Impossible de récupérer l'index en direct ({e}). Utilisation du fichier de secours.")
        return []

def download_archives():
    url_base = "https://echanges.dila.gouv.fr/OPENDATA/ACCO/"
    out_dir = "ACCORDS_PROFESSIONNELS/data/inputs/archives_acco"
    done_dir = os.path.join(out_dir, "done")
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(done_dir, exist_ok=True)
    
    # 1. Tentative de récupération dynamique
    filenames = get_available_archives(url_base)
    
    # 2. Secours si la récupération en direct a échoué
    if not filenames:
        ref_file = "ACCORDS_PROFESSIONNELS/data/inputs/referentiels/20260318_archives_urls.txt"
        if os.path.exists(ref_file):
            print(f"Lecture du fichier de secours {ref_file}...")
            with open(ref_file, "r") as f:
                lines = f.readlines()
            for line in lines:
                match = re.search(r'\] (ACCO_[^\s]+|Freemium_acco_global_[^\s]+)', line)
                if match:
                    filenames.append(match.group(1))
        else:
            print("Erreur: Aucun fichier de référence trouvé et impossible de contacter le serveur.")
            sys.exit(1)
            
    # Filtrage des archives pour 2025 et 2026, exclusion de la méga archive globale
    targets = []
    for filename in filenames:
        # Exclure la grosse archive de 45 Go
        if "Freemium_acco_global" in filename:
            continue
        
        # Vérifier si c'est bien une archive ACCO pour 2025 ou 2026
        if re.search(r'ACCO_(2025|2026)', filename):
            targets.append(filename)
            
    print(f"\n{len(targets)} archives identifiées pour 2025/2026 (hors archive globale).")
    
    downloaded_count = 0
    skipped_count = 0
    
    for filename in targets:
        out_path = os.path.join(out_dir, filename)
        done_path = os.path.join(done_dir, filename)
        
        # Vérifier si l'archive est déjà présente dans le dossier de travail ou déjà traitée ("done")
        if os.path.exists(out_path):
            print(f"[-] {filename} existe déjà dans {out_dir}, ignoré.")
            skipped_count += 1
        elif os.path.exists(done_path):
            print(f"[-] {filename} a déjà été traité et se trouve dans {done_dir}, ignoré.")
            skipped_count += 1
        else:
            print(f"[+] Téléchargement de {filename}...")
            # wget avec -q pour être discret et -c pour reprendre le téléchargement si interrompu
            res = subprocess.run(["wget", "-q", "-c", f"{url_base}{filename}", "-O", out_path])
            if res.returncode == 0:
                print(f"    Succès : {filename}")
                downloaded_count += 1
            else:
                print(f"    Erreur lors du téléchargement de {filename}")
                
    print(f"\nTerminé ! {downloaded_count} fichiers téléchargés, {skipped_count} fichiers déjà présents/traités.")

if __name__ == "__main__":
    download_archives()
