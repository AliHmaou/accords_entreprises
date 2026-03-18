
import React from 'react';
import { marked } from 'marked';
import { Agreement } from '../types';

interface DetailsModalProps {
    agreement: Agreement;
    onClose: () => void;
    highlightTerm: string;
}

const HighlightedText: React.FC<{ text: string; highlight: string }> = ({ text, highlight }) => {
    if (!highlight.trim()) {
        return <>{text}</>;
    }
    const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedHighlight})`, 'gi');
    const parts = text.split(regex);
    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-600 rounded px-1 py-0.5">{part}</mark> : <span key={i}>{part}</span>
            )}
        </>
    );
};

const DetailsModal: React.FC<DetailsModalProps> = ({ agreement, onClose, highlightTerm }) => {
    // Safely parse moyens_materiels handling version mismatch or missing data
    let moyens: string[] = [];
    try {
        const rawMoyens = agreement.moyens_materiels_v2 || (agreement as any).moyens_materiels;
        if (rawMoyens) {
            const parsed = JSON.parse(rawMoyens);
            if (Array.isArray(parsed)) {
                moyens = parsed;
            }
        }
    } catch (e) {
        console.warn("Could not parse moyens_materiels:", e);
        moyens = [];
    }
    
    // Handle est_mobilites_durables (bool or string)
    const mobilityVal = String((agreement as any).est_mobilites_durables || agreement.est_mobilites_durables_v2).toLowerCase();
    const isMobility = ['true', '1', 'oui'].includes(mobilityVal);

    const getMarkdownContent = (text: string, highlight: string) => {
        if (!text) return { __html: '' };

        // Pre-process Pandoc-style underline: [text]{.underline} -> <u>text</u>
        const processedText = text.replace(/\[([\s\S]*?)\]\{\.underline\}/g, '<u>$1</u>');

        // Parse markdown to HTML
        let html = marked.parse(processedText, { breaks: true, gfm: true }) as string;

        if (highlight.trim()) {
            const escapedTerm = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedTerm})(?![^<]*>)`, 'gi');
            html = html.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600 rounded px-1 py-0.5">$1</mark>');
        }
        
        return { __html: html };
    };

    const openGoogleMaps = () => {
        let url = '';
        if (agreement.localisation_lat && agreement.localisation_lon) {
            url = `https://www.google.com/maps/search/?api=1&query=${agreement.localisation_lat},${agreement.localisation_lon}`;
        } else {
             const query = `${agreement.RAISON_SOCIALE} ${agreement.localisation_nom_commune || ''} ${agreement.localisation_departement_code || ''} France`;
             url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        }
        window.open(url, '_blank');
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 backdrop-blur-sm"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div 
                className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="sticky top-0 bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center z-10">
                    <div className="flex flex-col">
                        <h2 id="modal-title" className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                            {agreement.RAISON_SOCIALE}
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5">
                             <span className="text-xs text-gray-500 font-mono">SIRET: {agreement.SIRET}</span>
                             <button 
                                onClick={openGoogleMaps}
                                className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1 bg-indigo-50 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition-colors"
                             >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                Localiser
                             </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200" aria-label="Fermer la fenêtre">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </header>

                <main className="p-6 space-y-5 overflow-y-auto">
                    {/* Key Attributes */}
                    <div className="flex flex-wrap gap-2">
                        {isMobility && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                🌿 Mobilités Durables
                            </span>
                        )}
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                             {agreement.SECTEUR}
                        </span>
                         <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                             Code APE: {agreement.CODE_APE}
                        </span>
                         {agreement.localisation_region && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                📍 {agreement.localisation_region}
                            </span>
                        )}
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Titre de l'accord</h3>
                        <p className="text-gray-900 dark:text-gray-200 font-medium leading-snug">
                           <HighlightedText text={agreement.TITRE_TXT} highlight={highlightTerm} />
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm border-t border-b border-gray-100 dark:border-gray-700 py-4">
                        <div>
                            <span className="block text-gray-500 dark:text-gray-400 text-xs">Date de dépôt</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{agreement.DATE_DEPOT}</span>
                        </div>
                        <div>
                            <span className="block text-gray-500 dark:text-gray-400 text-xs">Date de fin</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{agreement.DATE_FIN || "Non spécifiée / Illimitée"}</span>
                        </div>
                         {agreement.localisation_departement_nom && (
                            <div>
                                <span className="block text-gray-500 dark:text-gray-400 text-xs">Département</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{agreement.localisation_departement_nom} ({agreement.localisation_departement_code})</span>
                            </div>
                        )}
                        {agreement.localisation_epci_nom && (
                            <div>
                                <span className="block text-gray-500 dark:text-gray-400 text-xs">EPCI</span>
                                <span className="font-medium text-gray-800 dark:text-gray-200">{agreement.localisation_epci_nom}</span>
                            </div>
                        )}
                        <div>
                            <span className="block text-gray-500 dark:text-gray-400 text-xs">Syndicats</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{agreement.SYNDICATS}</span>
                        </div>
                         <div>
                            <span className="block text-gray-500 dark:text-gray-400 text-xs">Thème Recherche</span>
                            <span className="font-medium text-gray-800 dark:text-gray-200">{agreement.theme_recherche}</span>
                        </div>
                    </div>
                    
                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">⚡ Mesure extraite (IA)</h3>
                        <blockquote className="text-gray-700 dark:text-gray-300 bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-md border-l-4 border-indigo-500 italic">
                            "<HighlightedText text={agreement.mesure_extraite} highlight={highlightTerm} />"
                        </blockquote>
                    </div>
                    
                     <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">🚲 Moyens matériels identifiés</h3>
                        {moyens.length > 0 ? (
                            <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-md">
                                {moyens.map((m: string, i: number) => <li key={i}>{m}</li>)}
                            </ul>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-500 italic text-sm">Aucun moyen matériel spécifique détecté.</p>
                        )}
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">📄 Extrait du texte original</h3>
                        <div className="prose prose-sm dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-900/50 rounded-md text-gray-700 dark:text-gray-300 text-justify leading-relaxed border border-gray-200 dark:border-gray-700">
                           <div dangerouslySetInnerHTML={getMarkdownContent(agreement.extrait_chunk, highlightTerm)} />
                        </div>
                    </div>
                </main>
                
                <footer className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 text-right">
                    <a href={agreement.url_legifrance} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors">
                        Consulter sur Légifrance
                        <svg className="ml-2 -mr-1 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                            <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                            <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                        </svg>
                    </a>
                </footer>
            </div>
        </div>
    );
};

export default DetailsModal;
