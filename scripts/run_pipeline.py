import os
import sys
import subprocess
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

# Add src to python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

import extraction
import metadata_parser
import conversion
import nlp_processing
import llm_analysis
import geoloc_epci
import upload_hf


def prompt_step(step_name: str) -> bool:
    """Demande à l'utilisateur s'il veut exécuter l'étape."""
    while True:
        resp = input(
            f"\nVoulez-vous exécuter l'étape [{step_name}] ? (O/n) : "
        ).strip().lower()
        if not resp or resp in ('o', 'oui', 'y', 'yes'):
            return True
        elif resp in ('n', 'non', 'no'):
            return False
        else:
            print("Réponse invalide, veuillez taper O ou N.")


def get_year_filter() -> str:
    default_year = os.getenv("ANNEE_FILTRE_DEFAUT", "2025")
    year = input(
        f"\nVeuillez saisir l'année pour le filtre LLM "
        f"(entrée pour défaut = {default_year}, 'all' pour tout traiter) : "
    ).strip()
    return year if year else default_year


def choose_source_parquet(base_dir: Path, label: str) -> Path | None:
    """
    Permet à l'utilisateur de choisir un fichier parquet existant
    comme source pour une étape (enrichissement, upload...).
    Retourne le Path choisi ou None si annulé.
    """
    outputs_dir = base_dir / "data/outputs"
    parquets = sorted(outputs_dir.glob("*.parquet"))

    if not parquets:
        print("Aucun fichier parquet trouvé dans data/outputs/.")
        return None

    print(f"\nFichiers parquet disponibles pour [{label}] :")
    for i, p in enumerate(parquets):
        print(f"  [{i}] {p.name}")

    while True:
        choice = input(
            "Saisissez le numéro du fichier à utiliser "
            "(ou 'q' pour annuler) : "
        ).strip()
        if choice.lower() == 'q':
            return None
        if choice.isdigit() and 0 <= int(choice) < len(parquets):
            return parquets[int(choice)]
        print("Choix invalide.")


def run():
    # Load .env file
    load_dotenv(Path(__file__).parent.parent / ".env")

    print("=== DÉMARRAGE DU PIPELINE DES ACCORDS PROFESSIONNELS ===")

    base_dir = Path(__file__).parent.parent
    archives_dir = base_dir / "data/inputs/archives_acco"
    extract_dir = base_dir / "tmp"
    kw_csv = base_dir / "data/inputs/referentiels/20260318_categories_mots_cles.csv"

    # --- Mode de démarrage ---
    print("\nMODE DE DÉMARRAGE :")
    print("  [1] Traiter une archive depuis le début (extraction → upload)")
    print("  [2] Reprendre depuis un fichier parquet existant (enrichissement → upload)")
    mode = input("Votre choix (1 ou 2) : ").strip()

    if mode == '2':
        # Mode reprise : on choisit directement un parquet existant
        source_parquet = choose_source_parquet(base_dir, "source pour enrichissement")
        if not source_parquet:
            print("Aucun fichier sélectionné. Abandon.")
            return

        # Nom de sortie basé sur le fichier source
        stem = source_parquet.stem
        final_output = source_parquet
        final_output_enrichi = base_dir / f"data/outputs/{stem}_ENRICHIS.parquet"

        do_enrich = prompt_step("6. Enrichissement géographique (SIRENE, référentiel ESR)")
        do_upload = prompt_step("7. Uploader le fichier final sur Hugging Face")

        if do_enrich:
            print("\n--- JALON 3: ENRICHISSEMENT GEOGRAPHIQUE ---")
            geoloc_epci.process_geoloc(str(final_output), str(final_output_enrichi))
            print(f"Fichier enrichi : {final_output_enrichi}")

        if do_upload:
            print("\n--- JALON 4: UPLOAD HUGGING FACE ---")
            hf_repo = os.getenv(
                "HF_REPO_ID", "alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES"
            )
            hf_token = os.getenv("HF_TOKEN")
            if not hf_token:
                print("Le token Hugging Face (HF_TOKEN) est introuvable dans le .env.")
            else:
                if final_output.exists():
                    simple_name = "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES.parquet"
                    upload_hf.upload_to_huggingface(
                        str(final_output), hf_repo, hf_token, simple_name
                    )
                if final_output_enrichi.exists():
                    geo_name = (
                        "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
                    )
                    upload_hf.upload_to_huggingface(
                        str(final_output_enrichi), hf_repo, hf_token, geo_name
                    )

        print("\n=== PIPELINE TERMINÉ AVEC SUCCÈS ===")
        return

    # --- Mode 1 : traitement complet depuis une archive ---
    dispo = list(archives_dir.glob("*.tar.gz")) + list(archives_dir.glob("*.zip"))
    print("\nArchives disponibles dans data/inputs/archives_acco :")
    for f in dispo:
        print(f" - {f.name}")

    choix = input(
        "\nSaisissez le nom exact de l'archive "
        "(ex: ACCO_test.tar.gz) ou 'all' pour toutes les traiter : "
    ).strip()

    archives_to_process = []
    if choix.lower() == 'all':
        archives_to_process = dispo
    else:
        choix_path = archives_dir / choix
        if choix_path.exists():
            archives_to_process = [choix_path]
        else:
            print(f"Erreur : L'archive {choix} n'existe pas.")
            return

    if not archives_to_process:
        print("Aucune archive à traiter.")
        return

    print(f"\n{len(archives_to_process)} archive(s) sélectionnée(s) pour le traitement.")

    # Choix des étapes pour toutes les archives
    do_extract = prompt_step("1. Extraction des archives")
    do_parse = prompt_step("2. Parsing des métadonnées XML")
    do_convert = prompt_step("3. Conversion Word vers Markdown (Pandoc)")
    do_nlp = prompt_step("4. Recherche par mots-clés et extraction du contexte (Jalon 1)")
    do_llm = prompt_step("5. Analyse Sémantique par IA (LLM)")

    target_year = None
    if do_llm:
        target_year = get_year_filter()

    do_enrich = prompt_step("6. Enrichissement géographique (SIRENE, référentiel ESR)")
    do_upload = prompt_step("7. Uploader le fichier final sur Hugging Face (Jalon 4)")

    # Boucle sur les archives
    for archive_path in archives_to_process:
        print(
            f"\n{'='*50}\n"
            f"TRAITEMENT DE L'ARCHIVE : {archive_path.name}\n"
            f"{'='*50}"
        )

        archive_stem = archive_path.name.replace('.tar.gz', '').replace('.zip', '')

        # Paths spécifiques à l'archive
        extracted_base = extract_dir / archive_stem
        xml_dir = None
        bureautique_dir = None

        interim_dir = base_dir / "data/outputs/interim"
        metadata_initial = interim_dir / f"metadata_initial_{archive_stem}.parquet"
        md_dir = interim_dir / f"markdown_files_{archive_stem}"
        metadata_with_md = interim_dir / f"metadata_with_md_{archive_stem}.parquet"
        metadata_with_context = interim_dir / f"metadata_with_context_{archive_stem}.parquet"
        final_output = base_dir / f"data/outputs/ACCO_MESURES_MOBILITES_{archive_stem}.parquet"
        final_output_enrichi = (
            base_dir / f"data/outputs/ACCO_MESURES_MOBILITES_{archive_stem}_ENRICHIS.parquet"
        )

        # Affichage de l'état des fichiers intermédiaires
        print("\nÉtat des fichiers intermédiaires :")
        for label, path in [
            ("metadata_initial", metadata_initial),
            ("metadata_with_md", metadata_with_md),
            ("metadata_with_context", metadata_with_context),
            ("final_output (LLM)", final_output),
            ("final_output_enrichi", final_output_enrichi),
        ]:
            status = "✅ existe" if path.exists() else "❌ absent"
            print(f"  {label}: {status} ({path.name})")

        # 1. Extraction
        if do_extract:
            extraction.extract_archive(str(archive_path), str(extract_dir))

        # Recherche dynamique des dossiers XML et bureautique
        if extracted_base.exists():
            for root, dirs, files in os.walk(extracted_base):
                if 'TEXT' in dirs and 'ACCO' in root:
                    xml_dir = Path(root) / 'TEXT'
                if 'bureautique' in dirs:
                    bureautique_dir = Path(root) / 'bureautique'

        # 2. Metadata Parsing
        if do_parse:
            print("\n--- PARSING METADONNEES ---")
            if not xml_dir or not xml_dir.exists():
                print(
                    f"Dossier XML introuvable pour {archive_stem}. "
                    "L'extraction a-t-elle été faite ?"
                )
                continue
            df_meta = metadata_parser.parse_all_metadata(str(xml_dir))
            interim_dir.mkdir(parents=True, exist_ok=True)
            df_meta.to_parquet(str(metadata_initial))
            print(f"Métadonnées sauvegardées dans {metadata_initial}")

        # 3. Conversion to Markdown
        if do_convert:
            print("\n--- CONVERSION PANDOC ---")
            if not metadata_initial.exists():
                print(f"Fichier manquant: {metadata_initial}")
                continue
            if not bureautique_dir or not bureautique_dir.exists():
                print(f"Dossier bureautique introuvable pour {archive_stem}.")
                continue
            df_meta = pd.read_parquet(str(metadata_initial))
            df_md = conversion.convert_documents(
                df_meta, str(bureautique_dir), str(md_dir), num_workers=4
            )
            df_md.to_parquet(str(metadata_with_md))
            print(f"Markdown paths sauvegardés dans {metadata_with_md}")

        # 4. NLP Processing (Jalon 1)
        if do_nlp:
            print("\n--- JALON 1: RECHERCHE Mots-Clés ---")
            if not metadata_with_md.exists():
                print(f"Fichier manquant: {metadata_with_md}")
                continue
            nlp_processing.process_documents(
                str(metadata_with_md), str(kw_csv), str(metadata_with_context)
            )

        # 5. LLM Analysis (Jalon 2 & 3)
        if do_llm:
            print("\n--- JALON 2: ANALYSE IA ---")
            if not metadata_with_context.exists():
                print(f"Fichier manquant: {metadata_with_context}")
                continue

            print(f"Filtrage des accords pour l'année {target_year}...")
            df_temp = pd.read_parquet(str(metadata_with_context))

            if 'DATE_TEXTE' in df_temp.columns:
                if target_year.lower() == 'all':
                    n = df_temp['mentionne_mobilite'].sum()
                    print(f"Traitement sur toutes les années. Accords mobilité: {n}")
                else:
                    df_temp['DATE_TEXTE_DT'] = pd.to_datetime(
                        df_temp['DATE_TEXTE'], errors='coerce'
                    )
                    year_mask = df_temp['DATE_TEXTE_DT'].dt.year == int(target_year)
                    df_temp.loc[~year_mask, 'mentionne_mobilite'] = False
                    n = df_temp['mentionne_mobilite'].sum()
                    print(
                        f"Accords évoquant la mobilité dans l'année {target_year}: {n}"
                    )
                    df_temp = df_temp.drop(columns=['DATE_TEXTE_DT'])

                temp_context = metadata_with_context.with_suffix('.temp.parquet')
                df_temp.to_parquet(temp_context)
                llm_analysis.process_llm(str(temp_context), str(final_output), str(kw_csv))
                if temp_context.exists():
                    temp_context.unlink()
            else:
                print("Colonne DATE_TEXTE introuvable, traitement sans filtre temporel.")
                llm_analysis.process_llm(
                    str(metadata_with_context), str(final_output), str(kw_csv)
                )

        # 6. Enrichissement SIRENE et référentiel géographique
        if do_enrich:
            print("\n--- JALON 3: ENRICHISSEMENT GEOGRAPHIQUE ---")
            # Priorité : final_output (LLM), sinon metadata_with_context
            if final_output.exists():
                source_for_enrich = final_output
            elif metadata_with_context.exists():
                print(
                    "Fichier LLM absent, utilisation de metadata_with_context "
                    "comme source pour l'enrichissement."
                )
                source_for_enrich = metadata_with_context
            else:
                print(f"Aucun fichier source valide pour enrichir {archive_stem}.")
                continue
            geoloc_epci.process_geoloc(str(source_for_enrich), str(final_output_enrichi))

        # 7. Upload to Hugging Face
        if do_upload:
            print("\n--- JALON 4: UPLOAD HUGGING FACE ---")
            hf_repo = os.getenv(
                "HF_REPO_ID", "alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES"
            )
            hf_token = os.getenv("HF_TOKEN")
            if not hf_token:
                print("Le token Hugging Face (HF_TOKEN) est introuvable dans le .env.")
            else:
                if final_output.exists():
                    simple_name = "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES.parquet"
                    upload_hf.upload_to_huggingface(
                        str(final_output), hf_repo, hf_token, simple_name
                    )
                if final_output_enrichi.exists():
                    geo_name = (
                        "IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet"
                    )
                    upload_hf.upload_to_huggingface(
                        str(final_output_enrichi), hf_repo, hf_token, geo_name
                    )

    print("\n=== PIPELINE TERMINÉ AVEC SUCCÈS ===")


if __name__ == "__main__":
    run()
