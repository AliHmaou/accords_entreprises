
import React, { useMemo } from 'react';
import { Agreement } from '../types';
import ChartCard from './charts/ChartCard';

// List of common French stop words
const STOP_WORDS = new Set(['de', 'la', 'le', 'les', 'des', 'un', 'une', 'et', 'en', 'à', 'au', 'aux', 'pour', 'par', 'sur', 'avec', 'du', 'd\'', 'l\'', 'que', 'qui', 'dans', 'il', 'elle', 'sont', 'est', 'son', 'sa', 'ses', 'des', 'ce', 'cet', 'cette', 'afin', 'relatif', 'les', 'des', 'aux', 'mise', 'place', 'dans', 'cadre']);

interface KeyMeasuresProps {
    agreements: Agreement[];
    onKeywordClick: (keyword: string) => void;
}

const KeyMeasures: React.FC<KeyMeasuresProps> = ({ agreements, onKeywordClick }) => {
    const keywords = useMemo(() => {
        const wordCounts: Record<string, number> = {};
        
        agreements.forEach(agreement => {
            const text = `${agreement.mesure_extraite.toLowerCase()} ${agreement.TITRE_TXT.toLowerCase()}`;
            const words = text.match(/\b(\w{4,})\b/g) || []; // Match words with 4+ letters
            
            words.forEach(word => {
                if (!/^\d+$/.test(word) && !STOP_WORDS.has(word)) { // Exclude numbers and stop words
                    wordCounts[word] = (wordCounts[word] || 0) + 1;
                }
            });
        });
        
        return Object.entries(wordCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 20); // Top 20 keywords
    }, [agreements]);

    if (agreements.length === 0) {
        return (
            <ChartCard title="Mots-clés des Mesures">
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                    Aucune donnée à analyser.
                </div>
            </ChartCard>
        )
    }

    return (
        <ChartCard title="Mots-clés des Mesures">
            <div className="flex flex-wrap gap-2" role="list">
                {keywords.map(([word, count]) => (
                    <button 
                        key={word} 
                        onClick={() => onKeywordClick(word)}
                        className="bg-indigo-100 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-100 text-sm font-medium px-3 py-1 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800 transition-colors"
                        aria-label={`Rechercher les mesures contenant le mot ${word} (${count} occurrences)`}
                        role="listitem"
                    >
                        {word} <span className="text-xs opacity-75 ml-1 px-1.5 py-0.5 bg-white/50 dark:bg-black/20 rounded-full">{count}</span>
                    </button>
                ))}
            </div>
        </ChartCard>
    );
};

export default KeyMeasures;
