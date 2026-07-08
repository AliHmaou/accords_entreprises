import React from 'react';

const AboutData: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 prose dark:prose-invert max-w-none">
      <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-6">Documentation du jeu de données des Accords d'Entreprise sur la Mobilité Durable (Vision 2025)</h2>
      
      <h3>1. Description fonctionnelle du fichier</h3>
      <p>
        Ce jeu de données est issu du traitement et de l'enrichissement de la base <strong>ACCO</strong> (accords d'entreprises) publiée par la DILA en open data (accessible à l'adresse suivante : <a href="https://echanges.dila.gouv.fr/OPENDATA/ACCO/" target="_blank" rel="noreferrer">Index Open Data de la DILA ACCO</a>). 
      </p>
      <p>
        Pour répondre aux besoins d'analyse d'<strong>Île-de-France Mobilités (IDFM)</strong>, un pipeline a été mis en place pour identifier dans ces accords lesquels abordent la thématique des mobilités et quelles mesures y sont abordées.
      </p>
      <p>
        Le traitement combine un filtrage sur la base de mots-clés combiné à une analyse par Intelligence Artificielle (LLM) pour extraire, catégoriser et géolocaliser les mesures en lien avec les mobilités.
      </p>

      <p className="bg-amber-50 dark:bg-amber-950/20 p-4 border-l-4 border-amber-500 rounded-r-lg my-4">
        ⚠️ <strong>Note sur la version actuelle :</strong> Ce dataset représente la <strong>Vision 2025 en <u>date de texte</u></strong>, filtrée sur les accords signés au cours de l'année 2025 dont la publication s'est étalée sur 2025 et 2026.
      </p>

      <hr className="my-6 border-gray-200 dark:border-gray-700"/>

      <h3>2. Enrichissements opérés sur les données</h3>

      <h4>🎯 A. Classification selon le Référentiel IDFM (<code>mesures_ref_idfm</code>)</h4>
      <p>
        Chaque accord identifié comme traitant de la mobilité est associé à une ou plusieurs mesures d'une nomenclature établie par IDFM. Cette catégorisation permet d'évaluer si des mesures ont été abordées et tracées dans les accords. 
        Le référentiel des mesures utilisé est le suivant :
      </p>
      <ul>
        <li><strong>Mobilités actives :</strong> <em>Promouvoir le vélo</em>, <em>Organiser le stationnement des véhicules et des vélos</em>, <em>Encourager la marche</em>.</li>
        <li><strong>Accompagnement financier :</strong> <em>Mettre en place le forfait mobilité durable et l'indemnité kilométrique vélo IKV</em>, <em>Rembourser les transports en commun</em>, <em>Déployer des dispositifs financiers d’aide à la mobilité</em>.</li>
        <li><strong>Nouvelles organisations du travail :</strong> <em>Organiser le télétravail et les horaires de travail</em>, <em>Mettre en place un plan de mobilité employeur</em>.</li>
        <li><strong>Transition énergétique :</strong> <em>Soutenir la transition énergétique du parc de véhicules de l’entreprise</em>, <em>Promouvoir le covoiturage / l'autopartage</em>.</li>
      </ul>

      <h4>🏢 B. Données SIRENE et rattachement au Territoire (INSEE / EPCI / EPT)</h4>
      <p>
        Le pipeline interroge d'abord la base de données nationale <strong>SIRENE</strong> de l'INSEE pour en extraire les informations de structure de l'entreprise :
      </p>
      <ul>
        <li><strong>La taille / catégorie de l'entreprise</strong> (<code>entreprise_categorie_taille</code>) : qualification des structures en PME, ETI ou GE.</li>
        <li><strong>L'activité principale exercée</strong> (<code>entreprise_code_ape</code>) : Code APE officiel.</li>
        <li><strong>Le secteur d'activité</strong> (<code>entreprise_secteur</code>) : Secteur macro-économique d'activité de l'entreprise.</li>
      </ul>
      <p>
        Le dataset est enrichi géographiquement grâce à un croisement avec la base nationale <strong>SIRENE</strong> (INSEE) et le référentiel ESR :
      </p>
      <ul>
        <li><strong>Coordonnées géographiques :</strong> Latitude et Longitude de l'établissement pour la cartographie.</li>
        <li><strong>Rattachement Intercommunal (EPCI) :</strong> Identification de la communauté de communes, d'agglomération ou de la métropole de l'établissement.</li>
        <li><strong>Gouvernance Île-de-France (EPT) :</strong> Pour la Métropole du Grand Paris, croisement avec le référentiel de composition communale 2026 pour associer l'accord à l'un des 12 <strong>Établissements Publics Territoriaux (T1 à T12)</strong> (ex : <em>Vallée Sud-Grand Paris</em>, <em>Grand-Orly Seine Bièvre</em>, <em>Plaine Commune</em>, etc.).</li>
      </ul>

      <h4>🕵️ C. Traçabilité d'Audit (<code>source_file</code>)</h4>
      <p>
        Pour garantir l'intégrité et la transparence des données, chaque ligne intègre la colonne <code>source_file</code> qui documente l'archive d'origine d'où provient l'accord.
      </p>
      <p>
        Pour ce qui concerne les accords provenant du fichier historique, des zips intermédiaires mensuels ont été créés pour le traitement. Ils suivent la convention de nommage standardisée suivante :
      </p>
      <ul>
        <li><strong><code>acco_2025_MM.tar.gz</code></strong> (ex : <code>acco_2025_01.tar.gz</code> à <code>acco_2025_07.tar.gz</code>).</li>
      </ul>
      <p>
        Pour les publications hebdomadaires, c'est le nom de l'export d'origine qui est documenté :
      </p>
      <ul>
        <li><strong><code>ACCO_YYYYMMDD-HHMMSS.tar.gz</code></strong> (ex : <code>ACCO_20250708-064156.tar.gz</code>).</li>
      </ul>
      <p>
        Le fichier comporte également un lien direct hypertexte vers la page Légifrance officielle de publication de l'accord.
      </p>

      <div className="my-6 p-4 bg-indigo-50 dark:bg-gray-700 rounded-lg border border-indigo-100 dark:border-gray-600">
        <h3 className="mt-0 text-indigo-700 dark:text-indigo-300">📥 Téléchargement des données brutes (Hugging Face)</h3>
        <p className="text-sm mb-4">
            Vous pouvez télécharger le fichier Parquet consolidé, corrigé et dédoublonné utilisé directement par ce dashboard :
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
            <a 
                href="https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 no-underline"
            >
                <svg className="mr-2 -ml-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Dataset Complet (Corrigé, Dédoublonné, avec EPT & Audit)
            </a>
        </div>
      </div>

      <h3>3. Période et Volume des données (Vérifié)</h3>
      <p>
        Le jeu de données se focalise sur les accords dont la <strong>date de signature (date de texte)</strong> se situe en <strong>2025</strong>. Le volume total s'élève à <strong>40 398 accords de mobilité uniques</strong>.
      </p>
      <p>
        Le tableau ci-dessous détaille de manière précise la répartition mensuelle des dépôts réels de ces accords s'étalant sur les années 2025 et 2026 :
      </p>
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse text-sm border border-gray-200 dark:border-gray-700">
            <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                    <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">Année de signature (Date texte)</th>
                    <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">Mois de dépôt (Date dépôt)</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200">Nombre d'accords uniques</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-01</td><td className="px-4 py-2 text-right font-mono">1 763</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-02</td><td className="px-4 py-2 text-right font-mono">3 405</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-03</td><td className="px-4 py-2 text-right font-mono">3 889</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-04</td><td className="px-4 py-2 text-right font-mono">3 822</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-05</td><td className="px-4 py-2 text-right font-mono">3 088</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-06</td><td className="px-4 py-2 text-right font-mono">3 583</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-07</td><td className="px-4 py-2 text-right font-mono">3 751</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-08</td><td className="px-4 py-2 text-right font-mono">1 220</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-09</td><td className="px-4 py-2 text-right font-mono">1 974</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-10</td><td className="px-4 py-2 text-right font-mono">2 554</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-11</td><td className="px-4 py-2 text-right font-mono">2 540</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2025-12</td><td className="px-4 py-2 text-right font-mono">5 793</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2026-01</td><td className="px-4 py-2 text-right font-mono">2 094</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2026-02</td><td className="px-4 py-2 text-right font-mono">564</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2026-03</td><td className="px-4 py-2 text-right font-mono">281</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2026-04</td><td className="px-4 py-2 text-right font-mono">74</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2026-05</td><td className="px-4 py-2 text-right font-mono">1</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2 font-mono">2026-06</td><td className="px-4 py-2 text-right font-mono">2</td></tr>
                <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-bold">
                    <td className="px-4 py-2">Total 2025</td>
                    <td className="px-4 py-2">Complet (Dépôts 2025 - 2026)</td>
                    <td className="px-4 py-2 text-right font-mono">40 398</td>
                </tr>
            </tbody>
        </table>
      </div>

      <hr className="my-6 border-gray-200 dark:border-gray-700"/>

      <h3>4. Dictionnaire de données complet</h3>
      <p>
        Les champs fondamentaux pour s'assurer qu'un accord porte bien sur des mesures de mobilité d'intérêt pour IDFM sont <strong><code>mentionne_mobilite_ia</code></strong> et <strong><code>mesures_ref_idfm</code></strong> (qui valident respectivement la pertinence sémantique et la classification).
      </p>
      
      <div className="overflow-x-auto mt-4">
        <table className="min-w-full text-left text-sm border border-gray-200 dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="p-3 border-b dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-200">Champ</th>
              <th className="p-3 border-b dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-200">Description</th>
              <th className="p-3 border-b dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-200">Signification fonctionnelle / Exemples</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
            <tr>
                <td className="p-3 font-mono text-indigo-600 font-bold">mentionne_mobilite_ia</td>
                <td className="p-3 font-semibold text-green-600 dark:text-green-400">Indicateur de pertinence sémantique (Pivot IDFM)</td>
                <td className="p-3 italic">Garantit par IA que l'accord porte bien sur des mesures d'intérêt pour IDFM (ex : True, False).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600 font-bold">mesures_ref_idfm</td>
                <td className="p-3 font-semibold text-green-600 dark:text-green-400">Classification Référentiel IDFM (Pivot IDFM)</td>
                <td className="p-3 italic">Association normalisée à l'une des mesures officielles d'IDFM (ex : Promouvoir le vélo, FMD, etc.).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">ID</td>
                <td className="p-3">Identifiant unique</td>
                <td className="p-3 italic">ACCOTEXT000049122745</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">RAISON_SOCIALE</td>
                <td className="p-3">Raison sociale</td>
                <td className="p-3 italic">Dénomination ou raison sociale de l'entreprise d'accueil (INSEE/SIRENE).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">SIRET</td>
                <td className="p-3">SIRET</td>
                <td className="p-3 italic">Identifiant unique de l'établissement d'accueil physique (14 chiffres).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">TITRE_TXT</td>
                <td className="p-3">Titre officiel</td>
                <td className="p-3 italic">Objet d'entreprise relatif à l'organisation de l'accord.</td>
            </tr>
             <tr>
                <td className="p-3 font-mono text-indigo-600">DATE_DEPOT</td>
                <td className="p-3">Date de dépôt</td>
                <td className="p-3 italic">Date officielle de dépôt de l'accord à la DILA.</td>
            </tr>
             <tr>
                <td className="p-3 font-mono text-indigo-600 font-semibold">DATE_TEXTE</td>
                <td className="p-3">Date de signature (date texte)</td>
                <td className="p-3 italic">Date de signature de l'accord (critère de filtre Vision 2025).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">CODE_APE</td>
                <td className="p-3">Code APE</td>
                <td className="p-3 italic">Code caractérisant l'activité de l'entreprise d'accueil.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">SECTEUR</td>
                <td className="p-3">Secteur d'activité</td>
                <td className="p-3 italic">Libellé clair décrivant le secteur de l'entreprise.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">source_archive</td>
                <td className="p-3">Archive source</td>
                <td className="p-3 italic">Nom de l'archive ZIP/Tar.gz de la DILA d'origine.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">source_file</td>
                <td className="p-3">Fichier d'audit</td>
                <td className="p-3 italic">Nom du fichier parquet unitaire d'origine d'ingestion (traçabilité complète).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">extrait_chunk</td>
                <td className="p-3">Extrait pertinent</td>
                <td className="p-3 italic">Texte d'extrait conservé en taille maximale justifiant l'analyse.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">mesure_extraite</td>
                <td className="p-3">Synthèse sémantique</td>
                <td className="p-3 italic">Synthèse des mesures concrètes d'application rédigée par l'IA.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">moyens_materiels</td>
                <td className="p-3">Moyens matériels</td>
                <td className="p-3 italic">Aides matérielles identifiées par l'IA (ex : Vélos de fonction, Bornes).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">moyens_financiers</td>
                <td className="p-3">Moyens financiers</td>
                <td className="p-3 italic">Aides financières identifiées par l'IA (ex : FMD, Pass Navigo, IKV).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">localisation_ept_nom</td>
                <td className="p-3">Établissement Public Territorial</td>
                <td className="p-3 italic">Nom officiel clair de l'EPT d'Île-de-France (T1 à T12) (ex : Grand-Orly Seine Bièvre).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">localisation_epci_nom</td>
                <td className="p-3">EPCI de rattachement</td>
                <td className="p-3 italic">Nom de l'EPCI (ex : Métropole du Grand Paris, CA Troyes Champagne Métropole).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">categorie_entreprise</td>
                <td className="p-3">Taille d'entreprise</td>
                <td className="p-3 italic">Taille de l'entreprise d'accueil (ex : PME, ETI, GE).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">url_legifrance</td>
                <td className="p-3">Lien Légifrance</td>
                <td className="p-3 italic text-indigo-500 break-all">Lien vers Légifrance.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AboutData;
