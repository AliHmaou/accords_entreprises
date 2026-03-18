import React, { useState, useRef, useCallback } from 'react';
import { runQuery } from '../duckdbClient';

const EXAMPLE_QUERIES = [
    `SELECT COUNT(*) as total FROM agreements`,
    `SELECT SECTEUR, COUNT(*) as nb\nFROM agreements\nGROUP BY SECTEUR\nORDER BY nb DESC\nLIMIT 10`,
    `SELECT RAISON_SOCIALE, DATE_DEPOT, TITRE_TXT\nFROM agreements\nLIMIT 20`,
    `SELECT localisation_region_nom, COUNT(*) as nb\nFROM agreements\nGROUP BY localisation_region_nom\nORDER BY nb DESC`,
    `SELECT mesure_extraite, COUNT(*) as nb\nFROM agreements\nWHERE mesure_extraite IS NOT NULL\nGROUP BY mesure_extraite\nORDER BY nb DESC\nLIMIT 15`,
    `SHOW TABLES`,
    `DESCRIBE agreements`,
];

const LiveSQL: React.FC = () => {
    const [query, setQuery] = useState<string>(EXAMPLE_QUERIES[0]);
    const [results, setResults] = useState<Record<string, any>[] | null>(null);
    const [columns, setColumns] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [isRunning, setIsRunning] = useState(false);
    const [executionTime, setExecutionTime] = useState<number | null>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const executeQuery = useCallback(async () => {
        if (!query.trim()) return;
        setIsRunning(true);
        setError(null);
        setResults(null);
        setColumns([]);
        setExecutionTime(null);

        const start = performance.now();
        try {
            const rows = await runQuery(query.trim());
            const elapsed = performance.now() - start;
            setExecutionTime(elapsed);
            if (rows.length > 0) {
                setColumns(Object.keys(rows[0]));
            } else {
                setColumns([]);
            }
            setResults(rows);
        } catch (err: any) {
            setError(err?.message || String(err));
        } finally {
            setIsRunning(false);
        }
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // Ctrl+Enter or Cmd+Enter to run
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            executeQuery();
        }
        // Tab inserts spaces
        if (e.key === 'Tab') {
            e.preventDefault();
            const ta = textareaRef.current;
            if (!ta) return;
            const start = ta.selectionStart;
            const end = ta.selectionEnd;
            const newVal = query.substring(0, start) + '    ' + query.substring(end);
            setQuery(newVal);
            requestAnimationFrame(() => {
                ta.selectionStart = ta.selectionEnd = start + 4;
            });
        }
    };

    const formatCellValue = (val: any): string => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const isNullValue = (val: any): boolean => val === null || val === undefined;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5">
                <div className="flex items-center gap-3 mb-1">
                    <span className="text-2xl">🦆</span>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Live SQL — DuckDB WASM</h2>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                    Exécutez des requêtes SQL directement sur les données chargées en mémoire. Utilisez <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">Ctrl+Entrée</kbd> pour lancer.
                </p>
            </div>

            {/* Query Editor */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-5 space-y-3">
                <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Requête SQL</label>
                    <div className="flex items-center gap-2">
                        <select
                            className="text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            defaultValue=""
                            onChange={e => {
                                if (e.target.value) {
                                    setQuery(e.target.value);
                                    e.target.value = '';
                                }
                            }}
                        >
                            <option value="" disabled>Exemples de requêtes…</option>
                            {EXAMPLE_QUERIES.map((q, i) => (
                                <option key={i} value={q}>{q.split('\n')[0].slice(0, 60)}{q.length > 60 ? '…' : ''}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => { setQuery(''); setResults(null); setError(null); setColumns([]); setExecutionTime(null); }}
                            className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            title="Effacer"
                        >
                            Effacer
                        </button>
                    </div>
                </div>

                <textarea
                    ref={textareaRef}
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={6}
                    spellCheck={false}
                    className="w-full font-mono text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-green-300 p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
                    placeholder="SELECT * FROM agreements LIMIT 10"
                />

                <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                        {executionTime !== null && !isRunning && (
                            <span>⏱ {executionTime.toFixed(1)} ms — {results?.length ?? 0} ligne{(results?.length ?? 0) !== 1 ? 's' : ''}</span>
                        )}
                    </div>
                    <button
                        onClick={executeQuery}
                        disabled={isRunning || !query.trim()}
                        className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow transition"
                    >
                        {isRunning ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                </svg>
                                Exécution…
                            </>
                        ) : (
                            <>
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Exécuter
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4">
                    <div className="flex items-start gap-2">
                        <span className="text-red-500 text-lg mt-0.5">⚠️</span>
                        <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Erreur SQL</p>
                            <pre className="text-xs text-red-600 dark:text-red-400 mt-1 whitespace-pre-wrap font-mono">{error}</pre>
                        </div>
                    </div>
                </div>
            )}

            {/* Results Table */}
            {results !== null && !error && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Résultats
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                            {results.length} ligne{results.length !== 1 ? 's' : ''} × {columns.length} colonne{columns.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {results.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                            Aucun résultat retourné.
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                            <table className="min-w-full text-xs divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold text-gray-400 dark:text-gray-500 w-10 select-none">#</th>
                                        {columns.map(col => (
                                            <th
                                                key={col}
                                                className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap"
                                            >
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                                    {results.map((row, rowIdx) => (
                                        <tr
                                            key={rowIdx}
                                            className="hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                                        >
                                            <td className="px-3 py-1.5 text-gray-300 dark:text-gray-600 select-none font-mono">
                                                {rowIdx + 1}
                                            </td>
                                            {columns.map(col => {
                                                const val = row[col];
                                                const isNull = isNullValue(val);
                                                const display = formatCellValue(val);
                                                const isTruncated = display.length > 120;
                                                return (
                                                    <td
                                                        key={col}
                                                        className={`px-3 py-1.5 max-w-xs ${isNull ? 'text-gray-300 dark:text-gray-600 italic' : 'text-gray-800 dark:text-gray-200'}`}
                                                        title={isTruncated ? display : undefined}
                                                    >
                                                        <span className={`font-mono ${isTruncated ? 'cursor-help' : ''}`}>
                                                            {isTruncated ? display.slice(0, 120) + '…' : display}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LiveSQL;
