
import React from 'react';
import { Agreement } from '../types';

interface DataTableProps {
    agreements: Agreement[];
    onRowClick: (agreement: Agreement) => void;
    highlightTerm: string;
    // Pagination props
    totalItems: number;
    currentPage: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
}

const HighlightedText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) {
        return <>{text}</>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600 rounded px-1 py-0.5">{part}</mark> : <span key={i}>{part}</span>
            )}
        </>
    );
};

// Simple Leaf Icon
const LeafIcon = () => (
    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"></path>
    </svg>
);

const LocationIcon = () => (
    <svg className="w-4 h-4 text-indigo-500 hover:text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
    </svg>
);

const DataTable: React.FC<DataTableProps> = ({ 
    agreements, 
    onRowClick, 
    highlightTerm,
    totalItems,
    currentPage,
    itemsPerPage,
    onPageChange
}) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const openGoogleMaps = (e: React.MouseEvent, agreement: Agreement) => {
        e.stopPropagation();
        let url = '';
        if (agreement.localisation_lat && agreement.localisation_lon) {
            url = `https://www.google.com/maps/search/?api=1&query=${agreement.localisation_lat},${agreement.localisation_lon}`;
        } else {
             // Fallback to address search (using whatever info we have)
             const query = `${agreement.RAISON_SOCIALE} ${agreement.localisation_nom_commune || ''} ${agreement.localisation_departement_code || ''} France`;
             url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        }
        window.open(url, '_blank');
    };

    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Résultats ({totalItems})
                </h3>
            </div>
            
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-10">
                                
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/5">
                                Secteur
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/4">
                                Raison Sociale
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-1/3">
                                Mesure extraite
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                Date dépôt
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {agreements.length > 0 ? agreements.map((agreement, index) => {
                             // Robust check for mobility flag
                             const mobilityVal = String((agreement as any).est_mobilites_durables || agreement.est_mobilites_durables_v2).toLowerCase();
                             const isMobility = ['true', '1', 'oui'].includes(mobilityVal);
                             
                             // Using ID and index to ensure uniqueness for React reconciliation
                             const rowKey = `${agreement.ID}-${index}`;

                             return (
                            <tr key={rowKey} onClick={() => onRowClick(agreement)} className="hover:bg-indigo-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-200">
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                    {isMobility && <span title="Mobilité Durable"><LeafIcon /></span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 max-w-[150px] truncate" title={agreement.SECTEUR}>
                                    {agreement.SECTEUR}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[200px]" title={agreement.RAISON_SOCIALE}>
                                       <HighlightedText text={agreement.RAISON_SOCIALE} highlight={highlightTerm} />
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-500 flex items-center gap-2">
                                        <span>{agreement.SIRET}</span>
                                        <button 
                                            onClick={(e) => openGoogleMaps(e, agreement)} 
                                            className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                                            title="Localiser sur Google Maps"
                                        >
                                            <LocationIcon />
                                        </button>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                     <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2" title={agreement.mesure_extraite}>
                                        <HighlightedText text={agreement.mesure_extraite} highlight={highlightTerm} />
                                     </p>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{agreement.DATE_DEPOT}</td>
                            </tr>
                        )}) : (
                            <tr>
                                <td colSpan={5} className="text-center py-10 text-gray-500 dark:text-gray-400">
                                    Aucun résultat trouvé.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalItems > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600 sm:px-6">
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                                Affichage de <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> à <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> sur <span className="font-medium">{totalItems}</span> résultats
                            </p>
                        </div>
                        <div>
                            <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                <button
                                    onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                    className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="sr-only">Précédent</span>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                                
                                <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Page {currentPage} / {totalPages}
                                </span>

                                <button
                                    onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage === totalPages}
                                    className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <span className="sr-only">Suivant</span>
                                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </nav>
                        </div>
                    </div>
                    {/* Mobile Pagination View */}
                    <div className="flex items-center justify-between sm:hidden w-full">
                        <button
                            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                            disabled={currentPage === 1}
                            className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${currentPage === 1 ? 'opacity-50' : ''}`}
                        >
                            Préc.
                        </button>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                             {currentPage} / {totalPages}
                        </span>
                        <button
                            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                            disabled={currentPage === totalPages}
                            className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 ${currentPage === totalPages ? 'opacity-50' : ''}`}
                        >
                            Suiv.
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DataTable;
