
export interface Agreement {
  // Identifiants
  ID: string;
  url_legifrance?: string;

  // Métadonnées accord
  RAISON_SOCIALE: string;
  SIRET: string;
  TITRE_TXT: string;
  DATE_DEPOT: string;
  DATE_TEXTE: string;
  DATE_EFFET: string;
  DATE_FIN: string;
  CODE_APE: string;
  SECTEUR: string;
  SYNDICATS: string;
  DOCUMENT_BUREAUTIQUE: string;
  NUMERO: string;

  // Champs NLP (une ligne par mot-clé)
  theme_recherche: string;       // mot-clé trouvé
  categorie_mot_cle?: string;    // catégorie du mot-clé
  extrait_chunk: string;         // contexte autour du mot-clé (= contexte_etendu)
  contexte_etendu?: string;      // alias legacy

  // Champs LLM
  mesure_extraite?: string;      // mesure extraite par IA (= resume_mesure_proposee parsé)
  resume_mesure_proposee?: string;
  mot_cle_calcule?: string;
  mentionne_mobilite_ia?: string; // confirmation IA que l'extrait traite bien de mobilité
  est_mobilites_durables?: string;
  moyens_materiels?: string;
  moyens_financiers?: string;
  fichier_markdown?: string;

  // Localization fields (produced by geoloc_epci.py)
  localisation_lat?: number;
  localisation_lon?: number;
  localisation_code_commune?: string;
  localisation_epci_id?: string;
  localisation_epci_nom?: string;
  localisation_departement_code?: string;
  localisation_departement_nom?: string;
  localisation_region_code?: string;
  localisation_region_nom?: string;
  localisation_ept_id?: string;
  localisation_ept_nom?: string;

  // Legacy / compatibility fields
  est_mobilites_durables_v2?: string;
  moyens_materiels_v2?: string;
  localisation_region?: string;
  localisation_nom_commune?: string;
}
