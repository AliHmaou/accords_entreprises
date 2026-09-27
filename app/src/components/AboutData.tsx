import React from "react";

const AboutData: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 prose dark:prose-invert max-w-none">
      <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-6">
        Documentation du jeu de données des Accords d'Entreprise sur la Mobilité Durable (Vision Consolidée 2022-2026)
      </h2>
      
      <h3>1. Description fonctionnelle du fichier</h3>
      <p>
        Ce jeu de données est issu du traitement et de l'enrichissement de la base <strong>ACCO</strong> (accords collectifs d'entreprises) publiée par la DILA en open data (accessible sur <a href="https://echanges.dila.gouv.fr/OPENDATA/ACCO/" target="_blank" rel="noreferrer">l'Index Open Data de la DILA ACCO</a>).
      </p>
      <p>
        Pour répondre aux besoins d'analyse d'<strong>Île-de-France Mobilités (IDFM)</strong>, un pipeline complet a été mis en place pour identifier dans ces accords lesquels abordent la thématique des mobilités durables et quelles mesures concrètes y sont actées.
      </p>
      <p>
        Le traitement combine un filtrage sémantique sur la base de mots-clés métiers (Jalon 1), une analyse approfondie par Intelligence Artificielle (Jalon 2, via Azure AI Foundry avec <code>gpt-5.4-nano</code> et <code>qwen/qwen3.8-27b</code>), un enrichissement géographique SIRENE / EPCI / EPT / Départements (Jalon 3 via DuckDB), et un dédoublonnage métier rigoureux.
      </p>

      <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 border-l-4 border-emerald-500 rounded-r-lg my-4">
        ✨ <strong>Couverture multi-annuelle complète :</strong> Ce dataset master consolide désormais les années <strong>2022, 2023, 2024, 2025 et 2026</strong>, représentant <strong>198 497 accords uniques</strong> signés par plus de <strong>54 700 entreprises</strong>.
      </div>

      <hr className="my-6 border-gray-200 dark:border-gray-700"/>

      <h3>2. Deux jeux de données disponibles au téléchargement</h3>
      <p>
        Pour concilier rapidité de navigation et exhaustivité nationale, deux fichiers Parquet officiels sont hébergés et synchronisés sur Hugging Face :
      </p>
      <div className="flex flex-col sm:flex-row gap-4 my-4">
          <a 
              href="https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION_IDF.parquet" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 no-underline"
          >
              <svg className="mr-2 -ml-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Dataset Île-de-France (62 Mo • 50 425 accords)
          </a>
          <a 
              href="https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet" 
              target="_blank" 
              rel="noreferrer"
              className="inline-flex items-center justify-center px-4 py-2 border border-slate-300 dark:border-slate-600 text-sm font-medium rounded-md shadow-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none no-underline"
          >
              <svg className="mr-2 -ml-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
              Dataset France Entière (179 Mo • 198 497 accords)
          </a>
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/40 p-4 border border-slate-200 dark:border-slate-700 rounded-lg text-sm my-4">
        <strong>💡 Recommandation d'usage :</strong> L'application démarre par défaut sur le sous-ensemble <em>Île-de-France</em> pour un temps de chargement immédiat. Vous pouvez basculer à tout moment sur la vision <em>France Entière</em> via le sélecteur situé dans l'en-tête du Dashboard.
      </div>

      <h3>3. Répartition temporelle et volumétrie par année de signature</h3>
      <p>
        Le tableau ci-dessous synthétise la volumétrie d'accords collectifs consolidés par année de signature (DATE_TEXTE) :
      </p>
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border-collapse text-sm border border-gray-200 dark:border-gray-700">
            <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                    <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-200">Année de signature (DATE_TEXTE)</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200">Total Accords Collectifs</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200">Accords Mobilité Confirmés IA</th>
                    <th className="px-4 py-2 text-right font-semibold text-gray-700 dark:text-gray-200">Part Mobilité (%)</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
                <tr><td className="px-4 py-2 font-mono">2022</td><td className="px-4 py-2 text-right font-mono">52 023</td><td className="px-4 py-2 text-right font-mono text-emerald-600 font-semibold">9 256</td><td className="px-4 py-2 text-right font-mono">17,8 %</td></tr>
                <tr><td className="px-4 py-2 font-mono">2023</td><td className="px-4 py-2 text-right font-mono">50 852</td><td className="px-4 py-2 text-right font-mono text-emerald-600 font-semibold">8 397</td><td className="px-4 py-2 text-right font-mono">16,5 %</td></tr>
                <tr><td className="px-4 py-2 font-mono">2024</td><td className="px-4 py-2 text-right font-mono">45 681</td><td className="px-4 py-2 text-right font-mono text-emerald-600 font-semibold">8 372</td><td className="px-4 py-2 text-right font-mono">18,3 %</td></tr>
                <tr><td className="px-4 py-2 font-mono">2025</td><td className="px-4 py-2 text-right font-mono">40 398</td><td className="px-4 py-2 text-right font-mono text-emerald-600 font-semibold">8 635</td><td className="px-4 py-2 text-right font-mono">21,4 %</td></tr>
                <tr><td className="px-4 py-2 font-mono">2026 (en cours)</td><td className="px-4 py-2 text-right font-mono">8 996</td><td className="px-4 py-2 text-right font-mono text-emerald-600 font-semibold">2 029</td><td className="px-4 py-2 text-right font-mono">22,6 %</td></tr>
                <tr className="bg-indigo-50 dark:bg-indigo-900/30 font-bold">
                    <td className="px-4 py-2">Total Consolidé (2022-2026)</td>
                    <td className="px-4 py-2 text-right font-mono">198 497</td>
                    <td className="px-4 py-2 text-right font-mono text-emerald-600 font-bold">36 800</td>
                    <td className="px-4 py-2 text-right font-mono">18,5 %</td>
                </tr>
            </tbody>
        </table>
      </div>

      <hr className="my-6 border-gray-200 dark:border-gray-700"/>

      <h3>4. Indicateurs Qualitatifs & Détections Clés par IA</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4 not-prose">
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="text-xs uppercase font-bold text-emerald-800 dark:text-emerald-300">Mobilités Durables Actées</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">27 649 accords</div>
          <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">75,1% des accords mobilité encouragent activement les modes actifs et partagés.</div>
        </div>
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
          <div className="text-xs uppercase font-bold text-purple-800 dark:text-purple-300">Forfait FMD & IKV</div>
          <div className="text-2xl font-black text-purple-600 mt-1">5 874 accords</div>
          <div className="text-xs text-purple-700 dark:text-purple-400 mt-1">16,0% mettent en place ou revalorisent le Forfait Mobilités Durables ou l'IKV.</div>
        </div>
        <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="text-xs uppercase font-bold text-indigo-800 dark:text-indigo-300">Transports Publics &gt; 50%</div>
          <div className="text-2xl font-black text-indigo-600 mt-1">3 820 accords</div>
          <div className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">L'employeur dépasse l'obligation légale de 50% (prise en charge à 60%, 75% ou 100%).</div>
        </div>
      </div>

      <hr className="my-6 border-gray-200 dark:border-gray-700"/>

      <h3>5. Dictionnaire des données complet (45 colonnes)</h3>
      <p>
        Les champs pivots sont <strong><code>mentionne_mobilite_ia</code></strong> (validation sémantique IA) et <strong><code>mesures_ref_idfm</code></strong> (classification normalisée sur les 16 mesures d'IDFM).
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
                <td className="p-3 font-semibold text-green-600 dark:text-green-400">Validation IA Mobilité (Pivot IDFM)</td>
                <td className="p-3 italic">Confirme que l'extrait traite bien de la mobilité des employés (Oui / Non).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600 font-bold">mesures_ref_idfm</td>
                <td className="p-3 font-semibold text-green-600 dark:text-green-400">Classification Référentiel IDFM (Pivot IDFM)</td>
                <td className="p-3 italic">Association normalisée à l'une des 16 mesures officielles d'IDFM (ex : Promouvoir le vélo, FMD, Télétravail, etc.).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600 font-bold">est_mobilites_durables</td>
                <td className="p-3 font-semibold text-green-600 dark:text-green-400">Qualifiant Mobilités Durables</td>
                <td className="p-3 italic">Indicateur déterminant si la mesure s'inscrit spécifiquement dans les mobilités durables (Oui / Non).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600 font-bold">est_fmd_ikv_mis_en_place</td>
                <td className="p-3 font-semibold text-purple-600 dark:text-purple-400">Mise en place Forfait Mobilités Durables / IKV</td>
                <td className="p-3 italic">Indique si le texte confirme la mise en place ou le maintien du FMD ou de l'IKV (Oui / Non).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600 font-bold">est_superieur_taux_legal</td>
                <td className="p-3 font-semibold text-purple-600 dark:text-purple-400">Prise en charge transports &gt; 50%</td>
                <td className="p-3 italic">Remboursement des abonnements de transport public au-delà des 50% légaux (60%, 75%, 100%) (Oui / Non).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600 font-bold">est_revendication</td>
                <td className="p-3 font-semibold text-amber-600 dark:text-amber-400">Indicateur de revendication syndicale</td>
                <td className="p-3 italic">Distingue une demande préalable ou point de négociation d'une mesure définitivement actée (Oui / Non).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">ID</td>
                <td className="p-3">Identifiant LégiFrance</td>
                <td className="p-3 italic">Clé primaire de l'accord (ex : ACCOTEXT000045063939).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">RAISON_SOCIALE</td>
                <td className="p-3">Raison Sociale</td>
                <td className="p-3 italic">Nom de l'entreprise signataire.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">SIRET</td>
                <td className="p-3">Numéro SIRET</td>
                <td className="p-3 italic">Numéro d'identification de l'établissement (14 chiffres).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">TITRE_TXT</td>
                <td className="p-3">Titre de l'accord</td>
                <td className="p-3 italic">Intitulé officiel de l'accord tel que déposé.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">DATE_TEXTE</td>
                <td className="p-3">Date de signature</td>
                <td className="p-3 italic">Date effective de signature de l'accord.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">DATE_DEPOT</td>
                <td className="p-3">Date de dépôt</td>
                <td className="p-3 italic">Date de dépôt légal et publication DILA.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">SECTEUR</td>
                <td className="p-3">Secteur d'activité</td>
                <td className="p-3 italic">Libellé clair du secteur économique de l'entreprise.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">categorie_entreprise</td>
                <td className="p-3">Taille d'entreprise</td>
                <td className="p-3 italic">Taille de l'entreprise d'après l'INSEE (PME, ETI, GE).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">localisation_departement_nom</td>
                <td className="p-3">Département</td>
                <td className="p-3 italic">Nom du département d'implantation (ex : Paris, Hauts-de-Seine, Rhône).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">localisation_region_nom</td>
                <td className="p-3">Région</td>
                <td className="p-3 italic">Nom de la région administrative (ex : Île-de-France, Auvergne-Rhône-Alpes).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">localisation_epci_nom</td>
                <td className="p-3">EPCI de rattachement</td>
                <td className="p-3 italic">Nom de l'intercommunalité / métropole (ex : Métropole du Grand Paris).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">localisation_ept_nom</td>
                <td className="p-3">Établissement Public Territorial (IDF)</td>
                <td className="p-3 italic">Nom de l'EPT francilien (T1 à T12) (ex : Grand-Orly Seine Bièvre).</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">mesure_extraite</td>
                <td className="p-3">Synthèse sémantique</td>
                <td className="p-3 italic">Mesures concrètes rédigées de façon synthétique par l'IA.</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">url_legifrance</td>
                <td className="p-3">Lien Légifrance</td>
                <td className="p-3 italic text-indigo-500 break-all">Lien d'accès direct au texte intégral officiel sur Légifrance.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AboutData;
