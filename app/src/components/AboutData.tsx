
import React from 'react';

const AboutData: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 prose dark:prose-invert max-w-none">
      <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-6">Documentation du jeu de données des Accords d'Entreprise sur la Mobilité Durable</h2>
      
      <h3>Description fonctionnelle du fichier</h3>
      <p>
        Ce jeu de données est issu de la publication open data de la base ACCO des accords d'entreprises. Ces données sont publiées conformément à l’article du décret n° 2017-752 du 3 mai 2017 relatif à la publicité des accords collectifs.
      </p>
      <p>
        Chaque accord est rattaché à l'échelle de l'établissement identifié par son SIRET.
      </p>
      <p>
        Le dataset créé pour le hackathon est limité aux accords mentionnant des termes en lien avec les mobilités durables et a été enrichi par IA de champs calculés et thématiques (<code>mesure_extraite</code>, <code>est_mobilites_durables</code>, <code>moyens_materiels</code>, <code>moyens_financiers</code>) qui facilitent l'analyse et le filtrage des accords selon leur adéquation avec les enjeux de la transition écologique et des nouvelles pratiques de mobilité (covoiturage, forfait mobilités durables, vélo, etc.).
      </p>
      <p className="italic bg-gray-50 dark:bg-gray-700 p-4 border-l-4 border-indigo-500">
        <strong>Liste des termes utilisés pour sélectionner ces accords :</strong> RSE , Ile-de-France Mobilités, carbone, co-voiturage, covoiturage, domicile-travail, décarbonation, flotte, heure de pointe, heures de pointe, hybride, mobilité durable, mobilités durables, navigo, plan de déplacement, transports en commun, trottinette, véhicule personnel, vélo, vélos d'entreprise, vélos de fonction.
      </p>
      <p><strong>Ce jeu de données n'a pas ambition d'exhaustivité.</strong></p>

      <h3>Source</h3>
      <p>
        Voir le lien data.gouv.fr : <a href="https://www.data.gouv.fr/datasets/acco-accords-dentreprise/" target="_blank" rel="noreferrer">https://www.data.gouv.fr/datasets/acco-accords-dentreprise/</a><br/>
        Documentation complète : <a href="https://echanges.dila.gouv.fr/OPENDATA/ACCO/%20DILA_ACCO_Presentation_20171212.pdf" target="_blank" rel="noreferrer">Présentation DILA ACCO</a>
      </p>
      <p>
        La géolocalisation peut être ajoutée via un croisement avec ce dataset de géolocalisation des établissements fourni par l'INSEE : <a href="https://www.data.gouv.fr/datasets/geolocalisation-des-etablissements-du-repertoire-sirene-pour-les-etudes-statistiques/" target="_blank" rel="noreferrer">Géolocalisation des établissements SIRENE</a>.
      </p>

      <div className="my-6 p-4 bg-indigo-50 dark:bg-gray-700 rounded-lg border border-indigo-100 dark:border-gray-600">
        <h3 className="mt-0 text-indigo-700 dark:text-indigo-300">📥 Téléchargement des données brutes</h3>
        <p className="text-sm mb-4">
            Vous pouvez télécharger les fichiers Parquet utilisés par ce dashboard directement depuis Hugging Face.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
            <a 
                href="https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 no-underline"
            >
                <svg className="mr-2 -ml-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Dataset Complet (Avec Localisation)
            </a>
            <a 
                href="https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES.parquet" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-500 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 no-underline"
            >
                <svg className="mr-2 -ml-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                Dataset Standard (Mesures)
            </a>
        </div>
      </div>

      <h3>Période et Territoire couvert</h3>
      <ul>
        <li><strong>Période :</strong> Textes déposés entre le 04/01/2022 et le 03/07/2025.</li>
        <li><strong>Territoire :</strong> France entière.</li>
      </ul>

      <div className="my-4">
        <table className="min-w-[300px] border-collapse text-sm">
            <thead>
                <tr className="bg-gray-100 dark:bg-gray-700 border-b dark:border-gray-600">
                    <th className="px-4 py-2 text-left">Année</th>
                    <th className="px-4 py-2 text-left">Nombre d'accords mentionnés</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                <tr><td className="px-4 py-2">2022</td><td className="px-4 py-2">3667</td></tr>
                <tr><td className="px-4 py-2">2023</td><td className="px-4 py-2">3699</td></tr>
                <tr><td className="px-4 py-2">2024</td><td className="px-4 py-2">1920</td></tr>
                <tr><td className="px-4 py-2">2025</td><td className="px-4 py-2">3302</td></tr>
                <tr className="bg-indigo-50 dark:bg-indigo-900/20 font-bold">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2">12588</td>
                </tr>
            </tbody>
        </table>
      </div>

      <h3>Champs notables</h3>
      <ul className="list-disc pl-5 space-y-2">
          <li><strong><code>url_legifrance</code></strong> : Lien vers la page Légifrance de l'accord.</li>
          <li><strong><code>est_mobilites_durables</code></strong> : Un champ booléen ( <code>true</code> / <code>false</code> ) qui indique si l'accord est directement lié à une thématique de mobilités durables. C'est le filtre principal pour isoler les accords pertinents.</li>
          <li><strong><code>mesure_extraite</code></strong> : Une chaîne de caractères qui estime les mesures concrètes proposées dans l'accord.</li>
          <li><strong><code>mot_cle_calcule</code></strong> : Un mot-clé résumant le cœur de l'accord.</li>
          <li><strong><code>contexte_etendu</code></strong> : Champ texte contenant une partie ou la totalité du contenu de l'accord.</li>
      </ul>

      <h3>Liste détaillée des champs et exemples</h3>
      <div className="overflow-x-auto mt-4">
        <table className="min-w-full text-left text-sm border border-gray-200 dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="p-3 border-b dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-200">Champ</th>
              <th className="p-3 border-b dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-200">Description</th>
              <th className="p-3 border-b dark:border-gray-600 font-semibold text-gray-700 dark:text-gray-200">Exemple</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600 bg-white dark:bg-gray-800">
            <tr>
                <td className="p-3 font-mono text-indigo-600">url_legifrance</td>
                <td className="p-3">Lien vers la page Legifrance.</td>
                <td className="p-3 italic break-all">.../id/ACCOTEXT000044995138</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">mesure_extraite</td>
                <td className="p-3">Liste des principales actions.</td>
                <td className="p-3 italic">"Augmenter la prise en charge du Transport pass Navigo à 60%"</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">ID</td>
                <td className="p-3">Identifiant unique.</td>
                <td className="p-3 italic">ACCOTEXT000049122745</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">RAISON_SOCIALE</td>
                <td className="p-3">Nom de l'entreprise.</td>
                <td className="p-3 italic">LOIR ET CHER LOGEMENT</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">SIRET</td>
                <td className="p-3">Numéro SIRET.</td>
                <td className="p-3 italic">59582020000011</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">TITRE_TXT</td>
                <td className="p-3">Titre officiel.</td>
                <td className="p-3 italic">Accord relatif au financement de la mobilité</td>
            </tr>
             <tr>
                <td className="p-3 font-mono text-indigo-600">DATE_DEPOT</td>
                <td className="p-3">Date de dépôt.</td>
                <td className="p-3 italic">2024-02-03</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">SECTEUR</td>
                <td className="p-3">Libellé du secteur d'activité.</td>
                <td className="p-3 italic">Location de logements</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">theme_recherche</td>
                <td className="p-3">Mot-clé de classement.</td>
                <td className="p-3 italic">domicile-travail</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">est_mobilites_durables</td>
                <td className="p-3">Indicateur de pertinence.</td>
                <td className="p-3 italic">true</td>
            </tr>
             <tr>
                <td className="p-3 font-mono text-indigo-600">extrait_chunk</td>
                <td className="p-3">Extrait pertinent du texte.</td>
                <td className="p-3 italic line-clamp-2">Chaque salarié s'engage à fournir les justificatifs...</td>
            </tr>
            <tr>
                <td className="p-3 font-mono text-indigo-600">moyens_materiels</td>
                <td className="p-3">Liste des aides matérielles.</td>
                <td className="p-3 italic">["Vélos", "Trottinette"]</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AboutData;
