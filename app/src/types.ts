
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
  est_mobilites_durables_v2: "true" | "false";
  moyens_materiels_v2: string; // This is a string representation of an array
  
  // Localization fields
  localisation_commune?: string;
  localisation_lat?: number;
  localisation_lon?: number;
  localisation_region?: string;
  localisation_departement_nom?: string;
  localisation_departement_code?: string;
  localisation_nom_commune?: string;
  localisation_epci_id?: string;
  localisation_epci_nom?: string;
}
