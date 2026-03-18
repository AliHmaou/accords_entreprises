
export interface Agreement {
  url_legifrance: string;
  mesure_extraite: string;
  ID: string;
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
  theme_recherche: string;
  fichier_markdown: string;
  extrait_chunk: string;
  contexte_etendu: string;
  resume_mesure_proposee: string;
  mot_cle_calcule: string;
  est_mobilites_durables: string;
  moyens_materiels: string;
  moyens_financiers: string;

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
