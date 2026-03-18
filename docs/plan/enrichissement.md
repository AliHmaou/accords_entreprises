# Documentation de l'enrichissement géographique et de la géolocalisation

L'étape d'enrichissement s'exécute lors du **Jalon 3** (script `src/geoloc_epci.py`) et permet d'ajouter des informations spatiales très fines aux accords, à partir du **SIRET** des établissements concernés.

## Sources de Données Utilisées

1. **Base SIRENE Géolocalisée (Etalab / Insee)**  
   - **URL** : `https://object.files.data.gouv.fr/data-pipeline-open/siren/geoloc/GeolocalisationEtablissement_Sirene_pour_etudes_statistiques_utf8.parquet`
   - **Nature** : Il s'agit d'un gros fichier Parquet exposant la latitude, longitude, le code commune de l'établissement, ainsi que son rattachement éventuel à des zones de la politique de la ville (QPV, ZUS, etc.).
   - **Jointure** : S'effectue sur le champ `SIRET` (clé primaire).

2. **Base EPCI (Insee - 2026)**  
   - **URL** : `https://www.insee.fr/fr/statistiques/fichier/2510634/epci_au_01-01-2026.zip`
   - **Nature** : Ce fichier permet de faire le lien entre la commune d'implantation (le `code_commune` extrait depuis la base Sirene) et la structure intercommunale (l'EPCI, son code et son libellé). L'objectif est d'aider les Autorités Organisatrices de la Mobilité (AOM) à situer l'accord.
   - **Jointure** : S'effectue sur le champ `plg_code_commune` (issu de la jointure SIRENE) et le `CODGEO` du fichier Insee.

3. **Base EPT (Insee - 2026)**  
   - **URL** : `https://www.insee.fr/fr/statistiques/fichier/2510634/ept_au_01-01-2026.zip`
   - **Nature** : Fichier recensant les Établissements Publics Territoriaux, particulièrement utile en Île-de-France.
   - **Jointure** : S'effectue également sur `plg_code_commune` et le `CODGEO`.

## Fonctionnement Technique (DuckDB)

Plutôt que de charger les dizaines de millions de lignes de la base SIRENE en mémoire avec Pandas (ce qui causerait une erreur OOM - Out Of Memory), nous utilisons **DuckDB** :
```sql
SELECT 
    a.*,
    s.x, s.y, s.epsg, s.plg_qp24, s.plg_iris, s.plg_zus, s.plg_qp15, s.plg_qva, s.plg_code_commune,
    s.y_latitude, s.x_longitude,
    e.EPCI, e.LIBEPCI, e.DEP, e.REG,
    t.EPT, t.LIBEPT
FROM read_parquet('accords.parquet') a
LEFT JOIN read_parquet('sirene_url.parquet') s
    ON a.SIRET = s.siret
LEFT JOIN read_parquet('epci.parquet') e
    ON s.plg_code_commune = e.plg_code_commune
LEFT JOIN read_parquet('ept.parquet') t
    ON s.plg_code_commune = t.plg_code_commune
```

DuckDB télécharge à la volée (`HTTP Range Requests`) **seulement les parties du fichier distant nécessaires** pour trouver les SIRET de nos accords. C'est donc ultra-performant.

## Exploitation (Exemples de Requêtes)

Une fois le fichier `202511_ACCO_MESURES_MOBILITES_FINAL_ENRICHIS.parquet` généré, on peut faire des croisements géographiques forts :

- *Combien d'accords sur le vélo ont été signés dans tel EPCI (ex: Métropole de Lyon) ?*
- *Y a-t-il plus d'accords sur les mobilités durables en zone rurale ou en quartiers de la politique de la ville (plg_qp24) ?*
- *Carte interactive des établissements ayant instauré le FMD.*
