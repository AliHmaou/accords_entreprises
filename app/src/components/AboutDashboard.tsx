
import React from 'react';

const AboutDashboard: React.FC = () => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-8 prose dark:prose-invert max-w-none">
      <h2 className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mb-6">Architecture Technique et Performance</h2>

      <h3>Vue d'ensemble</h3>
      <p>
        Ce tableau de bord interactif permet l'exploration de données textuelles et structurées volumineuses directement dans le navigateur client, sans dépendre d'une infrastructure backend traditionnelle pour le traitement des requêtes (architecture <em>serverless in-browser</em>).
      </p>

      <h3>Moteur de Données : DuckDB Wasm</h3>
      <p>
        Le cœur technologique de l'application repose sur <strong>DuckDB Wasm</strong>, une version du moteur SQL analytique compilée en WebAssembly. Cette approche a été retenue pour répondre aux contraintes de performance liées à la manipulation de fichiers de données volumineux côté client.
      </p>

      <h4>Avantages techniques :</h4>
      <ul className="list-disc pl-5">
        <li>
            <strong>Traitement local :</strong> L'intégralité du filtrage, de l'agrégation et de la recherche textuelle est effectuée dans le navigateur de l'utilisateur. Cela garantit une réactivité immédiate de l'interface et une confidentialité totale des recherches.
        </li>
        <li>
            <strong>Optimisation Parquet :</strong> Les données sont consommées au format <strong>Apache Parquet</strong>. Ce format de stockage en colonnes permet une compression élevée et une lecture sélective des données (IO efficiency), réduisant drastiquement la bande passante nécessaire et l'empreinte mémoire par rapport à des formats lignes comme le JSON ou le CSV.
        </li>
        <li>
            <strong>Exécution asynchrone :</strong> Les opérations lourdes sont déléguées à des <em>Web Workers</em>, évitant ainsi tout blocage du thread principal (UI freeze) lors des requêtes complexes sur le jeu de données complet.
        </li>
      </ul>

      <h3>Stack Technologique</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 not-prose">
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Frontend & UI</h4>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                <li>• React 19</li>
                <li>• TypeScript</li>
                <li>• Tailwind CSS (Styling)</li>
                <li>• Recharts (Visualisation de données)</li>
            </ul>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Data Engineering</h4>
            <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
                <li>• DuckDB Wasm (Moteur SQL)</li>
                <li>• Apache Arrow (Structure mémoire)</li>
                <li>• Marked (Rendu Markdown)</li>
            </ul>
        </div>
      </div>
    </div>
  );
};

export default AboutDashboard;
