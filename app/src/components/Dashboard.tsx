
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Agreement } from '../types';
import DetailsModal from './DetailsModal';
import DataTable from './DataTable';
import SectorChart from './charts/SectorChart';
import MonthlyTrendChart from './charts/MonthlyTrendChart';
import DistributionChart from './charts/DistributionChart';
import MapTab from './MapTab';
import AboutData from './AboutData';
import AboutDashboard from './AboutDashboard';
import { initDuckDB, loadParquetFile, loadJsonJSONL, runQuery } from '../duckdbClient';

// Updated URL for the new enriched dataset
const PARQUET_URL = import.meta.env.VITE_HF_PARQUET_URL || "https://huggingface.co/datasets/alihmaou/ACCO_ACCORDS_PROFESSIONNELS_MOBILITES/resolve/main/IDFM_ACCO_ACCORDS_PROFESSIONNELS_MOBILITES_LOCALISATION.parquet";
const TABLE_NAME = "agreements";
const ITEMS_PER_PAGE = 20;

type TabType = 'stats' | 'measures' | 'map' | 'about_data' | 'about_dash';

// Type for the location filter item
interface LocationItem {
    name: string;
    type: 'Région' | 'EPCI' | 'Commune';
}

const Dashboard: React.FC = () => {
    const [agreements, setAgreements] = useState<Agreement[]>([]);
    const [filteredAgreements, setFilteredAgreements] = useState<Agreement[]>([]);
    const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
    
    // Tab State
    const [activeTab, setActiveTab] = useState<TabType>('stats');

    // Search States
    const [globalSearch, setGlobalSearch] = useState('');
    const [measureSearch, setMeasureSearch] = useState('');
    const [onlyMobility, setOnlyMobility] = useState(false);
    const [onlyIDF, setOnlyIDF] = useState(false); 
    
    // Sector Chips State
    const [sectors, setSectors] = useState<string[]>([]);
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
    const [sectorInput, setSectorInput] = useState('');
    const [showSectorSuggestions, setShowSectorSuggestions] = useState(false);

    // Geographic Filter State
    const [geoOptions, setGeoOptions] = useState<LocationItem[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<LocationItem[]>([]);
    const [geoInput, setGeoInput] = useState('');
    const [showGeoSuggestions, setShowGeoSuggestions] = useState(false);
    
    const [fileError, setFileError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dbReady, setDbReady] = useState(false);
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);

    const sectorWrapperRef = useRef<HTMLDivElement>(null);
    const geoWrapperRef = useRef<HTMLDivElement>(null);

    // 1. Initialize DuckDB & Load Data + Geo Options
    useEffect(() => {
        const initialize = async () => {
            try {
                setIsLoading(true);
                await initDuckDB();
                await loadParquetFile(TABLE_NAME, PARQUET_URL);
                setDbReady(true);
                
                // Load Sectors
                const sectorResult = await runQuery(`SELECT DISTINCT SECTEUR FROM ${TABLE_NAME} ORDER BY SECTEUR`);
                const sectorList = sectorResult.map((r: any) => r.SECTEUR).filter(Boolean);
                setSectors(sectorList);

                // Load Geographic Options (Distinct Regions, EPCI)
                // Using UNION to get a flat list
                const geoQuery = `
                    SELECT DISTINCT localisation_region_code as name, 'Région' as type FROM ${TABLE_NAME} WHERE localisation_region_code IS NOT NULL
                    UNION
                    SELECT DISTINCT localisation_epci_nom as name, 'EPCI' as type FROM ${TABLE_NAME} WHERE localisation_epci_nom IS NOT NULL
                    ORDER BY name
                `;
                const geoResult = await runQuery(geoQuery);
                setGeoOptions(geoResult as LocationItem[]);

            } catch (err) {
                console.error("Erreur initialisation DuckDB:", err);
                setFileError("Impossible de charger le dataset distant.");
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, []);

    // 2. Click outside handlers
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (sectorWrapperRef.current && !sectorWrapperRef.current.contains(event.target as Node)) {
                setShowSectorSuggestions(false);
            }
            if (geoWrapperRef.current && !geoWrapperRef.current.contains(event.target as Node)) {
                setShowGeoSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [sectorWrapperRef, geoWrapperRef]);

    // 3. Filter Data using SQL
    useEffect(() => {
        let isCancelled = false;

        const performSearch = async () => {
            if (!dbReady) return;

            let query = `SELECT * FROM ${TABLE_NAME} WHERE 1=1`;
            
            // Global Search
            if (globalSearch) {
                const term = globalSearch.replace(/'/g, "''").toLowerCase();
                query += ` AND (
                    lower(RAISON_SOCIALE) LIKE '%${term}%' OR 
                    lower(TITRE_TXT) LIKE '%${term}%' OR 
                    lower(extrait_chunk) LIKE '%${term}%'
                )`;
            }

            // Measure Label Search
            if (measureSearch) {
                const term = measureSearch.replace(/'/g, "''").toLowerCase();
                query += ` AND lower(mesure_extraite) LIKE '%${term}%'`;
            }

            // Sector Chips Filter (OR logic inside chips, but AND logic with other filters)
            if (selectedSectors.length > 0) {
                const sectorList = selectedSectors.map(s => `'${s.replace(/'/g, "''")}'`).join(',');
                query += ` AND SECTEUR IN (${sectorList})`;
            }

            // Location Chips Filter (Hybrid: Region OR EPCI)
            if (selectedLocations.length > 0) {
                const conditions: string[] = [];
                selectedLocations.forEach(loc => {
                    const safeName = loc.name.replace(/'/g, "''");
                    if (loc.type === 'Région') {
                        conditions.push(`localisation_region_code = '${safeName}'`);
                    } else if (loc.type === 'EPCI') {
                        conditions.push(`localisation_epci_nom = '${safeName}'`);
                    }
                });
                if (conditions.length > 0) {
                    query += ` AND (${conditions.join(' OR ')})`;
                }
            }

            // Mobility Only Toggle
            if (onlyMobility) {
                // Using CAST to VARCHAR and LOWER to handle diverse formats (true, 1, oui, True, TRUE)
                query += ` AND lower(CAST(est_mobilites_durables AS VARCHAR)) IN ('true', '1', 'oui')`;
            }

            // Île-de-France Toggle (code région INSEE = '11')
            if (onlyIDF) {
                query += ` AND localisation_region_code = '11'`;
            }

            try {
                const results = await runQuery(query);
                if (!isCancelled) {
                    setFilteredAgreements(results as Agreement[]);
                    setCurrentPage(1);
                }
            } catch (e) {
                console.error("Erreur requête SQL:", e);
                // Clear results on error to avoid stale data persistence
                if (!isCancelled) {
                    setFilteredAgreements([]);
                }
            }
        };

        const timer = setTimeout(() => {
            performSearch();
        }, 300);

        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [globalSearch, measureSearch, selectedSectors, selectedLocations, onlyMobility, onlyIDF, dbReady]);


    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setFileError(null);
        setIsLoading(true);
        const reader = new FileReader();

        reader.onload = async (e) => {
            const text = e.target?.result as string;
            if (!text) return;

            try {
                await loadJsonJSONL(TABLE_NAME, text);
                
                // Refresh filters list
                const sectorResult = await runQuery(`SELECT DISTINCT SECTEUR FROM ${TABLE_NAME} ORDER BY SECTEUR`);
                const sectorList = sectorResult.map((r: any) => r.SECTEUR).filter(Boolean);
                setSectors(sectorList);

                // Refresh Geo options
                const geoQuery = `
                    SELECT DISTINCT localisation_region_code as name, 'Région' as type FROM ${TABLE_NAME} WHERE localisation_region_code IS NOT NULL
                    UNION
                    SELECT DISTINCT localisation_epci_nom as name, 'EPCI' as type FROM ${TABLE_NAME} WHERE localisation_epci_nom IS NOT NULL
                    ORDER BY name
                `;
                const geoResult = await runQuery(geoQuery);
                setGeoOptions(geoResult as LocationItem[]);

                setGlobalSearch('');
                setMeasureSearch('');
                setSelectedSectors([]);
                setSelectedLocations([]);
                setDbReady(true);
                
            } catch (error) {
                console.error("Error loading file:", error);
                setFileError("Erreur format JSONL.");
            } finally {
                setIsLoading(false);
            }
        };
        reader.readAsText(file);
    };

    // Sector Chips Handlers
    const addSector = (sector: string) => {
        if (!selectedSectors.includes(sector)) {
            setSelectedSectors([...selectedSectors, sector]);
        }
        setSectorInput('');
        setShowSectorSuggestions(false);
    };

    const removeSector = (sector: string) => {
        setSelectedSectors(selectedSectors.filter(s => s !== sector));
    };

    const filteredSectorSuggestions = sectors.filter(s => 
        s.toLowerCase().includes(sectorInput.toLowerCase()) && !selectedSectors.includes(s)
    );

    // Geo Chips Handlers
    const addLocation = (loc: LocationItem) => {
        // Avoid duplicates
        if (!selectedLocations.some(l => l.name === loc.name && l.type === loc.type)) {
            setSelectedLocations([...selectedLocations, loc]);
        }
        setGeoInput('');
        setShowGeoSuggestions(false);
    };

    const removeLocation = (locName: string) => {
        setSelectedLocations(selectedLocations.filter(l => l.name !== locName));
    };

    const filteredGeoSuggestions = useMemo(() => {
        if (!geoInput) return [];
        const lowerInput = geoInput.toLowerCase();
        return geoOptions
            .filter(g => g.name.toLowerCase().includes(lowerInput) && !selectedLocations.some(sl => sl.name === g.name))
            .slice(0, 50); // Limit to 50 suggestions for performance
    }, [geoInput, geoOptions, selectedLocations]);

    // Helpers for badges
    const getBadgeColor = (type: string) => {
        switch(type) {
            case 'Région': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'EPCI': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'Commune': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // --- Stats Calculations ---

    const topMeasuresData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];
        const counts: Record<string, number> = {};
        filteredAgreements.forEach(a => {
            if (a.mesure_extraite) {
                const label = a.mesure_extraite.trim();
                counts[label] = (counts[label] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
    }, [filteredAgreements]);

    const monthlyTrendData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];
        const counts: Record<string, number> = {};
        filteredAgreements.forEach(a => {
            const dateStr = a.DATE_DEPOT || a.DATE_TEXTE;
            if (dateStr && dateStr.length >= 7) {
                const monthKey = dateStr.substring(0, 7); 
                counts[monthKey] = (counts[monthKey] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredAgreements]);

    // Territorial Stats
    const regionsData = useMemo(() => {
        if (!filteredAgreements) return [];
        const counts: Record<string, number> = {};
        filteredAgreements.forEach(a => {
            const reg = a.localisation_region_code || a.localisation_region;
            if (reg) {
                counts[reg] = (counts[reg] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [filteredAgreements]);

    const departmentsData = useMemo(() => {
        if (!filteredAgreements) return [];
        const counts: Record<string, number> = {};
        filteredAgreements.forEach(a => {
            const dep = a.localisation_departement_code || a.localisation_departement_nom;
            if (dep) {
                counts[dep] = (counts[dep] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 20);
    }, [filteredAgreements]);

    const epciData = useMemo(() => {
        if (!filteredAgreements) return [];
        const counts: Record<string, number> = {};
        filteredAgreements.forEach(a => {
            if (a.localisation_epci_nom) {
                counts[a.localisation_epci_nom] = (counts[a.localisation_epci_nom] || 0) + 1;
            }
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 20);
    }, [filteredAgreements]);


    // Pagination Logic
    const paginatedAgreements = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredAgreements.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredAgreements, currentPage]);

    return (
        <div className="space-y-6 relative min-h-[500px]">
            {isLoading && (
                 <div className="absolute inset-0 bg-white/80 z-50 flex items-start justify-center pt-40 backdrop-blur-sm h-full rounded-lg">
                    <div className="flex flex-col items-center p-6 bg-white shadow-xl rounded-xl border border-indigo-100">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-4"></div>
                        <p className="text-indigo-900 font-semibold">Chargement des données...</p>
                    </div>
                </div>
            )}

            {/* Filters Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Global Search */}
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Recherche Globale
                        </label>
                        <input
                            type="text"
                            value={globalSearch}
                            onChange={e => setGlobalSearch(e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                            placeholder="Entreprise, texte..."
                        />
                    </div>

                    {/* Measure Search */}
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Recherche Libellé Mesure
                        </label>
                        <input
                            type="text"
                            value={measureSearch}
                            onChange={e => setMeasureSearch(e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                            placeholder="Ex: forfait, vélo..."
                        />
                    </div>

                    {/* Sector Chips Input */}
                    <div className="md:col-span-3 relative" ref={sectorWrapperRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Filtrer par Secteur(s)
                        </label>
                        <input
                            type="text"
                            value={sectorInput}
                            onChange={e => {
                                setSectorInput(e.target.value);
                                setShowSectorSuggestions(true);
                            }}
                            onFocus={() => setShowSectorSuggestions(true)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                            placeholder={selectedSectors.length > 0 ? "Ajouter..." : "Sélectionner..."}
                        />
                        {showSectorSuggestions && sectorInput && (
                            <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                {filteredSectorSuggestions.length > 0 ? filteredSectorSuggestions.map((sector) => (
                                    <li
                                        key={sector}
                                        className="text-gray-900 dark:text-gray-200 cursor-default select-none relative py-2 pl-3 pr-9 hover:bg-indigo-600 hover:text-white"
                                        onClick={() => addSector(sector)}
                                    >
                                        {sector}
                                    </li>
                                )) : (
                                    <li className="text-gray-500 dark:text-gray-400 cursor-default select-none relative py-2 pl-3 pr-9">
                                        Aucun secteur trouvé
                                    </li>
                                )}
                            </ul>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {selectedSectors.map(sector => (
                                <span key={sector} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                    {sector}
                                    <button
                                        type="button"
                                        onClick={() => removeSector(sector)}
                                        className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-indigo-400 hover:bg-indigo-200 hover:text-indigo-500 focus:outline-none focus:bg-indigo-500 focus:text-white"
                                    >
                                        <span className="sr-only">Remove {sector}</span>
                                        <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                                            <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                                        </svg>
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Geo Location Filter (Hybrid) */}
                    <div className="md:col-span-3 relative" ref={geoWrapperRef}>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Lieu (Région INSEE, EPCI)
                        </label>
                        <input
                            type="text"
                            value={geoInput}
                            onChange={e => {
                                setGeoInput(e.target.value);
                                setShowGeoSuggestions(true);
                            }}
                            onFocus={() => setShowGeoSuggestions(true)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"
                            placeholder={selectedLocations.length > 0 ? "Ajouter un lieu..." : "Taper un lieu..."}
                        />
                        {showGeoSuggestions && geoInput && (
                            <ul className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                {filteredGeoSuggestions.length > 0 ? filteredGeoSuggestions.map((loc, idx) => (
                                    <li
                                        key={loc.name + loc.type + idx}
                                        className="text-gray-900 dark:text-gray-200 cursor-pointer select-none relative py-2 pl-3 pr-4 hover:bg-indigo-600 hover:text-white flex justify-between items-center"
                                        onClick={() => addLocation(loc)}
                                    >
                                        <span className="truncate">{loc.name}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${getBadgeColor(loc.type)}`}>
                                            {loc.type === 'Région' ? 'Région (code)' : loc.type}
                                        </span>
                                    </li>
                                )) : (
                                    <li className="text-gray-500 dark:text-gray-400 cursor-default select-none relative py-2 pl-3 pr-9">
                                        Aucun lieu trouvé
                                    </li>
                                )}
                            </ul>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {selectedLocations.map((loc, idx) => (
                                <span key={loc.name + idx} className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(loc.type)}`}>
                                    {loc.name}
                                    <button
                                        type="button"
                                        onClick={() => removeLocation(loc.name)}
                                        className="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center opacity-60 hover:opacity-100 focus:outline-none"
                                    >
                                        <span className="sr-only">Remove {loc.name}</span>
                                        <svg className="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
                                            <path strokeLinecap="round" strokeWidth="1.5" d="M1 1l6 6m0-6L1 7" />
                                        </svg>
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                    {/* Mobility Only */}
                    <div className="flex items-center">
                        <button 
                            type="button" 
                            className={`${onlyMobility ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                            role="switch"
                            aria-checked={onlyMobility}
                            onClick={() => setOnlyMobility(!onlyMobility)}
                        >
                            <span className="sr-only">Mobilités Durables uniquement</span>
                            <span aria-hidden="true" className={`${onlyMobility ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}></span>
                        </button>
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                            Mobilités Durables
                        </span>
                    </div>
                    {/* IDF Only */}
                    <div className="flex items-center">
                        <button 
                            type="button" 
                            className={`${onlyIDF ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
                            role="switch"
                            aria-checked={onlyIDF}
                            onClick={() => setOnlyIDF(!onlyIDF)}
                        >
                            <span className="sr-only">Île-de-France uniquement</span>
                            <span aria-hidden="true" className={`${onlyIDF ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}></span>
                        </button>
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                            Île-de-France
                        </span>
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex justify-between items-center">
                     <p className="text-sm text-gray-500 dark:text-gray-400">
                        {filteredAgreements.length} résultats trouvés
                     </p>
                     
                     <label className="text-sm font-medium text-indigo-600 hover:text-indigo-500 cursor-pointer flex items-center">
                        <span className="mr-2">Importer un JSONL local</span>
                        <input
                            type="file"
                            accept=".json,.jsonl"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                     </label>
                     {fileError && <p className="ml-4 text-xs text-red-500">{fileError}</p>}
                </div>
            </div>

            {/* Tabs Navigation */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <nav className="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`${activeTab === 'stats' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Stats générales
                    </button>
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`${activeTab === 'map' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Carte
                    </button>
                    <button
                        onClick={() => setActiveTab('measures')}
                        className={`${activeTab === 'measures' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        Mesures et Accords
                    </button>
                    <button
                        onClick={() => setActiveTab('about_data')}
                        className={`${activeTab === 'about_data' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        A propos des données
                    </button>
                     <button
                        onClick={() => setActiveTab('about_dash')}
                        className={`${activeTab === 'about_dash' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        A propos du dashboard
                    </button>
                </nav>
            </div>

            {/* Tabs Content */}
            <div className="pt-2">
                {activeTab === 'stats' && (
                    <div className="space-y-8 animate-fade-in">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <SectorChart data={topMeasuresData} />
                            <MonthlyTrendChart data={monthlyTrendData} />
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                             <DistributionChart title="Répartition par Région" data={regionsData} />
                             <DistributionChart title="Top 20 Départements" data={departmentsData} />
                        </div>
                         <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                             <DistributionChart title="Top 20 EPCI" data={epciData} />
                         </div>
                    </div>
                )}

                {activeTab === 'map' && (
                    <div className="animate-fade-in">
                        <MapTab 
                            agreements={filteredAgreements} 
                            onMarkerClick={setSelectedAgreement} 
                        />
                    </div>
                )}

                {activeTab === 'measures' && (
                    <div className="animate-fade-in">
                        <DataTable 
                            agreements={paginatedAgreements} 
                            totalItems={filteredAgreements.length}
                            currentPage={currentPage}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentPage}
                            onRowClick={setSelectedAgreement} 
                            highlightTerm={globalSearch || measureSearch} 
                        />
                    </div>
                )}

                {activeTab === 'about_data' && (
                    <div className="animate-fade-in">
                        <AboutData />
                    </div>
                )}

                {activeTab === 'about_dash' && (
                    <div className="animate-fade-in">
                         <AboutDashboard />
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {selectedAgreement && (
                <DetailsModal 
                    agreement={selectedAgreement} 
                    onClose={() => setSelectedAgreement(null)} 
                    highlightTerm={globalSearch || measureSearch} 
                />
            )}
        </div>
    );
};

export default Dashboard;
