import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Agreement } from '../types';
import DetailsModal from './DetailsModal';
import DataTable from './DataTable';
import DonutChart from './charts/DonutChart';
import CouronneBarChart from './charts/CouronneBarChart';
import CategoryMeasuresChart from './charts/CategoryMeasuresChart';
import CategoryMeasuresDistributionChart from './charts/CategoryMeasuresDistributionChart';
import MapTab from './MapTab';
import AboutData from './AboutData';
import AboutDashboard from './AboutDashboard';
import LiveSQL from './LiveSQL';
import { initDuckDB, loadParquetFile, loadJsonJSONL, runQuery } from '../duckdbClient';

import { 
    HF_PARQUET_URL_IDF, 
    HF_PARQUET_URL_FRANCE, 
    IDFM_OFFICIAL_MEASURES 
} from '../constants';

const TABLE_NAME = "agreements";
const ITEMS_PER_PAGE = 20;

type TabType = 'stats' | 'measures' | 'map' | 'live_sql' | 'about_data' | 'about_dash';

// Type for the location filter item
interface LocationItem {
    name: string;
    type: 'Région' | 'EPCI' | 'Commune';
}

const Dashboard: React.FC = () => {
    const [agreements, setAgreements] = useState<Agreement[]>([]);
    const [filteredAgreements, setFilteredAgreements] = useState<Agreement[]>([]);
    const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
    
    // Dataset Scope State (par défaut IDF pour un démarrage ultra-rapide)
    const [datasetScope, setDatasetScope] = useState<'IDF' | 'FRANCE'>('IDF');
    
    // Tab State
    const [activeTab, setActiveTab] = useState<TabType>('stats');

    // Search States
    const [globalSearch, setGlobalSearch] = useState('');
    const [measureSearch, setMeasureSearch] = useState('');
    const [availableMeasures, setAvailableMeasures] = useState<string[]>(IDFM_OFFICIAL_MEASURES);
    const [onlyMobiliteIA, setOnlyMobiliteIA] = useState(false);
    const [onlyIDF, setOnlyIDF] = useState(false); 
    const [ignoreRevendications, setIgnoreRevendications] = useState(false);
    const [onlyFmdIkv, setOnlyFmdIkv] = useState(false);
    const [onlyEffortRemboursement, setOnlyEffortRemboursement] = useState(false);
    
    // Sector State
    const [sectors, setSectors] = useState<string[]>([]);
    const [selectedSectors, setSelectedSectors] = useState<string[]>([]);

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

    // Filters States
    const [searchId, setSearchId] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [years, setYears] = useState<number[]>([]);

    // Sorting States
    const [sortField, setSortField] = useState<string>('DATE_DEPOT');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const geoWrapperRef = useRef<HTMLDivElement>(null);

    const IDFM_MEASURES = availableMeasures;

    // Fonction réutilisable pour alimenter les listes déroulantes de filtres depuis DuckDB
    const loadOptionsFromDB = async () => {
        // 1. Secteurs d'activité
        const sectorResult = await runQuery(`SELECT DISTINCT SECTEUR FROM ${TABLE_NAME} WHERE SECTEUR IS NOT NULL ORDER BY SECTEUR`);
        const sectorList = sectorResult.map((r: any) => r.SECTEUR).filter(Boolean);
        setSectors(sectorList);

        // 2. Options géographiques (Régions, EPCI)
        const geoQuery = `
            SELECT DISTINCT localisation_region_nom as name, 'Région' as type FROM ${TABLE_NAME} WHERE localisation_region_nom IS NOT NULL
            UNION
            SELECT DISTINCT localisation_epci_nom as name, 'EPCI' as type FROM ${TABLE_NAME} WHERE localisation_epci_nom IS NOT NULL
            ORDER BY name
        `;
        const geoResult = await runQuery(geoQuery);
        setGeoOptions(geoResult as LocationItem[]);

        // 3. Années de signature issues de DATE_TEXTE
        const yearsResult = await runQuery(`
            SELECT DISTINCT EXTRACT(YEAR FROM CAST(DATE_TEXTE AS DATE)) as year 
            FROM ${TABLE_NAME} 
            WHERE DATE_TEXTE IS NOT NULL 
              AND EXTRACT(YEAR FROM CAST(DATE_TEXTE AS DATE)) >= 2018
            ORDER BY year DESC
        `);
        const yearList = yearsResult.map((r: any) => r.year || r.YEAR).filter((y: any) => Boolean(y) && !isNaN(y));
        setYears(yearList);

        // 4. Mesures IDFM distinctes réelles du jeu de données
        const measuresResult = await runQuery(`
            SELECT DISTINCT mesures_ref_idfm 
            FROM ${TABLE_NAME} 
            WHERE mesures_ref_idfm IS NOT NULL 
              AND mesures_ref_idfm NOT IN ('AUCUNE_CORRESPONDANCE', 'hors mesures IDFM')
            ORDER BY mesures_ref_idfm ASC
        `);
        const measureList = measuresResult.map((r: any) => r.mesures_ref_idfm).filter(Boolean);
        if (measureList.length > 0) {
            setAvailableMeasures(measureList);
        }
    };

    // Bascule de périmètre (Île-de-France rapide vs France entière)
    const switchDataset = async (targetScope: 'IDF' | 'FRANCE') => {
        if (targetScope === datasetScope) return;
        try {
            setIsLoading(true);
            const targetUrl = targetScope === 'IDF' ? HF_PARQUET_URL_IDF : HF_PARQUET_URL_FRANCE;
            await loadParquetFile(TABLE_NAME, targetUrl);
            setDatasetScope(targetScope);
            await loadOptionsFromDB();
            setCurrentPage(1);
        } catch (err) {
            console.error("Erreur bascule dataset:", err);
            alert("Erreur lors du chargement du jeu de données.");
        } finally {
            setIsLoading(false);
        }
    };

    // 1. Initialisation DuckDB avec le dataset IDF allégé par défaut
    useEffect(() => {
        const initialize = async () => {
            try {
                setIsLoading(true);
                await initDuckDB();
                await loadParquetFile(TABLE_NAME, HF_PARQUET_URL_IDF);
                setDbReady(true);
                await loadOptionsFromDB();
            } catch (err) {
                console.error("Erreur initialisation DuckDB:", err);
                setFileError("Impossible de charger le dataset distant.");
            } finally {
                setIsLoading(false);
            }
        };

        initialize();
    }, []);

    // 2. Click outside handlers pour le dropdown géographique
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (geoWrapperRef.current && !geoWrapperRef.current.contains(event.target as Node)) {
                setShowGeoSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [geoWrapperRef]);

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

            // Measure Label Search (cherche dans mesures_ref_idfm, mesure_extraite, resume_mesure_proposee et theme_recherche)
            if (measureSearch) {
                const term = measureSearch.replace(/'/g, "''").toLowerCase();
                query += ` AND (
                    lower(COALESCE(mesures_ref_idfm, '')) LIKE '%${term}%' OR
                    lower(COALESCE(mesure_extraite, '')) LIKE '%${term}%' OR
                    lower(COALESCE(resume_mesure_proposee, '')) LIKE '%${term}%' OR
                    lower(COALESCE(theme_recherche, '')) LIKE '%${term}%'
                )`;
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
                        conditions.push(`localisation_region_nom = '${safeName}'`);
                    } else if (loc.type === 'EPCI') {
                        conditions.push(`localisation_epci_nom = '${safeName}'`);
                    }
                });
                if (conditions.length > 0) {
                    query += ` AND (${conditions.join(' OR ')})`;
                }
            }

            // Mobilité confirmée par IA Toggle
            if (onlyMobiliteIA) {
                query += ` AND lower(CAST(mentionne_mobilite_ia AS VARCHAR)) IN ('oui', 'true', '1')`;
            }

            // Île-de-France Toggle
            if (onlyIDF) {
                query += ` AND localisation_region_nom = 'Île-de-France'`;
            }

            // Ignorer revendications
            if (ignoreRevendications) {
                query += ` AND lower(CAST(COALESCE(est_revendication, 'Non') AS VARCHAR)) NOT IN ('oui', 'true', '1')`;
            }

            // Uniquement FMD/IKV en place
            if (onlyFmdIkv) {
                query += ` AND lower(CAST(COALESCE(est_fmd_ikv_mis_en_place, 'Non') AS VARCHAR)) IN ('oui', 'true', '1')`;
            }

            // Uniquement effort de remboursement > 50%
            if (onlyEffortRemboursement) {
                query += ` AND lower(CAST(COALESCE(est_superieur_taux_legal, 'Non') AS VARCHAR)) IN ('oui', 'true', '1')`;
            }

            // ID Filter
            if (searchId) {
                const idTerm = searchId.replace(/'/g, "''").trim().toLowerCase();
                query += ` AND lower(ID) LIKE '%${idTerm}%'`;
            }

            // Year Filter (filtrage sur l'année de signature issue de DATE_TEXTE)
            if (selectedYear) {
                query += ` AND EXTRACT(YEAR FROM CAST(DATE_TEXTE AS DATE)) = ${selectedYear}`;
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
    }, [globalSearch, measureSearch, selectedSectors, selectedLocations, onlyMobiliteIA, onlyIDF, ignoreRevendications, onlyFmdIkv, onlyEffortRemboursement, searchId, selectedYear, dbReady]);


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
                    SELECT DISTINCT localisation_region_nom as name, 'Région' as type FROM ${TABLE_NAME} WHERE localisation_region_nom IS NOT NULL
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

    const handleSort = (field: string) => {
        if (sortField === field) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
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
    
    // Fonction d'aide pour déduire si un accord mentionne la mobilité (OUI/NON)
    const checkMobility = (a: Agreement) => {
        const iaVal = String(a.mentionne_mobilite_ia || '').toLowerCase();
        return ['oui', 'true', '1'].includes(iaVal);
    };

    // 1. Donut : Proportion Globale (France entière)
    const globalMobilityData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];
        let oui = 0;
        let non = 0;
        
        const processedIds = new Set();
        const idsWithMobility = new Set();
        filteredAgreements.forEach(a => {
            if (checkMobility(a)) idsWithMobility.add(a.ID);
        });

        filteredAgreements.forEach(a => {
            if (!processedIds.has(a.ID)) {
                processedIds.add(a.ID);
                if (idsWithMobility.has(a.ID)) {
                    oui++;
                } else {
                    non++;
                }
            }
        });
        
        if (oui === 0 && non === 0) return [];
        return [
            { name: "Mentionne la mobilité", value: oui, fill: "#10B981" },
            { name: "Ne mentionne pas", value: non, fill: "#E5E7EB" }
        ];
    }, [filteredAgreements]);

    // 2. Donut : Proportion Île-de-France (IDF)
    const idfMobilityData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];
        let oui = 0;
        let non = 0;
        
        const processedIds = new Set();
        const idsWithMobility = new Set();
        filteredAgreements.forEach(a => {
            if (checkMobility(a)) idsWithMobility.add(a.ID);
        });

        filteredAgreements.forEach(a => {
            const reg = a.localisation_region_nom || a.localisation_region;
            if (reg === 'Île-de-France' && !processedIds.has(a.ID)) {
                processedIds.add(a.ID);
                if (idsWithMobility.has(a.ID)) {
                    oui++;
                } else {
                    non++;
                }
            }
        });
        
        if (oui === 0 && non === 0) return [];
        return [
            { name: "Mentionne la mobilité", value: oui, fill: "#3B82F6" },
            { name: "Ne mentionne pas", value: non, fill: "#E5E7EB" }
        ];
    }, [filteredAgreements]);

    // 3. Donut : Proportion Hors Île-de-France (Hors IDF)
    const horsIdfMobilityData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];
        let oui = 0;
        let non = 0;
        
        const processedIds = new Set();
        const idsWithMobility = new Set();
        filteredAgreements.forEach(a => {
            if (checkMobility(a)) idsWithMobility.add(a.ID);
        });

        filteredAgreements.forEach(a => {
            const reg = a.localisation_region_nom || a.localisation_region;
            if (reg !== 'Île-de-France' && !processedIds.has(a.ID)) {
                processedIds.add(a.ID);
                if (idsWithMobility.has(a.ID)) {
                    oui++;
                } else {
                    non++;
                }
            }
        });
        
        if (oui === 0 && non === 0) return [];
        return [
            { name: "Mentionne la mobilité", value: oui, fill: "#F59E0B" },
            { name: "Ne mentionne pas", value: non, fill: "#E5E7EB" }
        ];
    }, [filteredAgreements]);

    // 3. Taux de mobilité par catégorie d'entreprise (BarChart)
    const categoryMobilityData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];
        
        const idsWithMobility = new Set();
        filteredAgreements.forEach(a => {
            if (checkMobility(a)) idsWithMobility.add(a.ID);
        });

        // Compter les "oui" et le "total" par catégorie (uniquement sur accords uniques)
        const stats: Record<string, { oui: number, total: number }> = {};
        const processedIds = new Set();

        filteredAgreements.forEach(a => {
            if (!processedIds.has(a.ID)) {
                processedIds.add(a.ID);
                const cat = a.categorie_entreprise || "Non classifié";
                if (!stats[cat]) stats[cat] = { oui: 0, total: 0 };
                
                stats[cat].total++;
                if (idsWithMobility.has(a.ID)) {
                    stats[cat].oui++;
                }
            }
        });
        
        // Transformer en %
        const results = Object.entries(stats)
            .map(([name, data]) => {
                const percent = Math.round((data.oui / data.total) * 100);
                return { 
                    name, 
                    value: percent, // La valeur affichée est le %
                    details: `${data.oui} sur ${data.total}` 
                };
            })
            // Trier du + fort % au plus faible
            .sort((a, b) => b.value - a.value);

        return results;
    }, [filteredAgreements]);

    // 4. Top 5 Mesures IDFM
    const top5IDFMData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];
        const counts: Record<string, number> = {};
        
        filteredAgreements.forEach(a => {
            const label = a.mesures_ref_idfm;
            if (label && label !== 'AUCUNE_CORRESPONDANCE' && label !== 'hors mesures IDFM') {
                const key = label.trim();
                counts[key] = (counts[key] || 0) + 1;
            }
        });
        
        return Object.entries(counts)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [filteredAgreements]);

    // 5. Taux de mesures par couronne en IDF
    const couronneMobilityData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];

        const idfAgreements = filteredAgreements.filter(a => {
            const reg = a.localisation_region_nom || a.localisation_region;
            const measure = a.mesures_ref_idfm;
            return (
                reg === 'Île-de-France' &&
                measure &&
                measure !== 'AUCUNE_CORRESPONDANCE' &&
                measure !== 'hors mesures IDFM'
            );
        });

        if (idfAgreements.length === 0) return [];

        const uniqueAccordsByCouronne: Record<string, Set<string>> = {
            'PARIS': new Set(),
            'PC': new Set(),
            'GC': new Set()
        };

        const getCouronne = (dep: string) => {
            if (dep === '75') return 'PARIS';
            if (['92', '93', '94'].includes(dep)) return 'PC';
            if (['78', '77', '95', '91'].includes(dep)) return 'GC';
            return null;
        };

        idfAgreements.forEach(a => {
            const depCode = a.localisation_departement_code;
            const couronne = getCouronne(depCode || '');
            if (couronne) {
                uniqueAccordsByCouronne[couronne].add(a.ID);
            }
        });

        const totalParis = uniqueAccordsByCouronne['PARIS'].size;
        const totalPC = uniqueAccordsByCouronne['PC'].size;
        const totalGC = uniqueAccordsByCouronne['GC'].size;

        const counts: Record<string, { PARIS: Set<string>, PC: Set<string>, GC: Set<string> }> = {};

        idfAgreements.forEach(a => {
            const measure = a.mesures_ref_idfm;
            if (!measure) return;
            const depCode = a.localisation_departement_code;
            const couronne = getCouronne(depCode || '');
            if (!couronne) return;

            if (!counts[measure]) {
                counts[measure] = {
                    PARIS: new Set(),
                    PC: new Set(),
                    GC: new Set()
                };
            }
            counts[measure][couronne].add(a.ID);
        });

        const data = Object.entries(counts).map(([measure, couronnes]) => {
            const nbParis = couronnes.PARIS.size;
            const nbPC = couronnes.PC.size;
            const nbGC = couronnes.GC.size;
            const totalMeasure = nbParis + nbPC + nbGC;

            return {
                name: measure,
                total: totalMeasure,
                paris: totalParis > 0 ? Math.round((nbParis / totalParis) * 100) : 0,
                pc: totalPC > 0 ? Math.round((nbPC / totalPC) * 100) : 0,
                gc: totalGC > 0 ? Math.round((nbGC / totalGC) * 100) : 0,
                details: `Paris: ${nbParis}/${totalParis} | PC: ${nbPC}/${totalPC} | GC: ${nbGC}/${totalGC}`
            };
        });

        return data.sort((a, b) => b.total - a.total);
    }, [filteredAgreements]);

    // 6. Proportion d'accords par catégorie d'entreprise en Île-de-France (Donuts)
    const categoriesIdfMobilityData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return {};

        const idfAgreements = filteredAgreements.filter(a => {
            const reg = a.localisation_region_nom || a.localisation_region;
            return reg === 'Île-de-France';
        });

        const idsWithMobility = new Set();
        idfAgreements.forEach(a => {
            if (checkMobility(a)) idsWithMobility.add(a.ID);
        });

        const stats: Record<string, { oui: number, total: number }> = {};
        const processedIds = new Set();

        idfAgreements.forEach(a => {
            if (!processedIds.has(a.ID)) {
                processedIds.add(a.ID);
                let cat = a.categorie_entreprise || 'INDETERMINE';
                cat = cat.trim();
                if (!stats[cat]) stats[cat] = { oui: 0, total: 0 };
                
                stats[cat].total++;
                if (idsWithMobility.has(a.ID)) {
                    stats[cat].oui++;
                }
            }
        });

        const results: Record<string, { name: string, value: number, fill: string }[]> = {};
        Object.entries(stats).forEach(([cat, data]) => {
            results[cat] = [
                { name: "Avec mobilité", value: data.oui, fill: "#3B82F6" },
                { name: "Ne mentionne pas", value: data.total - data.oui, fill: "#E5E7EB" }
            ];
        });

        return results;
    }, [filteredAgreements]);

    // 7. Nombre moyen et médian de mesures distinctes par catégorie d'entreprise en Île-de-France (Moyenne & Médiane)
    const categoryMeasuresAvgMedianData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];

        const idfAgreements = filteredAgreements.filter(a => {
            const reg = a.localisation_region_nom || a.localisation_region;
            return reg === 'Île-de-France';
        });

        const siretData: Record<string, { cat: string, measures: Set<string> }> = {};

        idfAgreements.forEach(a => {
            const siret = a.SIRET;
            if (!siret) return;

            const measure = a.mesures_ref_idfm;
            const isValidMeasure = measure && measure !== 'AUCUNE_CORRESPONDANCE' && measure !== 'hors mesures IDFM';

            // Si la mesure n'est pas valide, on ne comptabilise pas du tout l'établissement dans la sous-requête (conformément au WHERE de la requête SQL)
            if (isValidMeasure) {
                let cat = a.categorie_entreprise;
                if (!cat || cat === 'null' || cat.trim() === '') {
                    cat = 'INDETERMINE';
                } else {
                    cat = cat.trim();
                }

                if (!siretData[siret]) {
                    siretData[siret] = {
                        cat,
                        measures: new Set()
                    };
                }

                siretData[siret].measures.add(measure);
            }
        });

        const catMeasures: Record<string, number[]> = {};
        Object.values(siretData).forEach(item => {
            if (!catMeasures[item.cat]) {
                catMeasures[item.cat] = [];
            }
            catMeasures[item.cat].push(item.measures.size);
        });

        const computeMedian = (arr: number[]) => {
            if (arr.length === 0) return 0;
            const sorted = [...arr].sort((a, b) => a - b);
            const half = Math.floor(sorted.length / 2);
            if (sorted.length % 2 !== 0) {
                return sorted[half];
            }
            return (sorted[half - 1] + sorted[half]) / 2;
        };

        const resultsList = Object.entries(catMeasures)
            .filter(([cat]) => cat !== 'INDETERMINE')
            .map(([cat, counts]) => {
                const sum = counts.reduce((s, c) => s + c, 0);
                const average = counts.length > 0 ? parseFloat((sum / counts.length).toFixed(2)) : 0;
                const medianVal = computeMedian(counts);

                return {
                    name: cat,
                    moyenne: average,
                    mediane: medianVal
                };
            });

        return resultsList;
    }, [filteredAgreements]);

    // 8. Distribution du nombre de mesures de 1 à 10 par catégorie d'entreprise en Île-de-France
    const categoryMeasuresDistributionData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return { chartData: [], categories: [] };

        const idfAgreements = filteredAgreements.filter(a => {
            const reg = a.localisation_region_nom || a.localisation_region;
            return reg === 'Île-de-France';
        });

        const categories = new Set<string>();
        const siretMeasures: Record<string, { cat: string, measures: Set<string> }> = {};

        idfAgreements.forEach(a => {
            const siret = a.SIRET;
            if (!siret) return;

            let cat = a.categorie_entreprise;
            if (!cat || cat === 'null' || cat.trim() === '') {
                cat = 'INDETERMINE';
            } else {
                cat = cat.trim();
            }
            categories.add(cat);

            const measure = a.mesures_ref_idfm;
            const isValidMeasure = measure && measure !== 'AUCUNE_CORRESPONDANCE' && measure !== 'hors mesures IDFM';

            if (isValidMeasure) {
                if (!siretMeasures[siret]) {
                    siretMeasures[siret] = {
                        cat,
                        measures: new Set()
                    };
                }
                siretMeasures[siret].measures.add(measure);
            }
        });

        // Initialiser la distribution de 1 à 10 pour chaque catégorie (accords avec au moins une mesure)
        const dist: Record<string, Record<number, number>> = {};
        categories.forEach(cat => {
            if (cat === 'INDETERMINE') return;
            dist[cat] = {};
            for (let i = 1; i <= 10; i++) {
                dist[cat][i] = 0;
            }
        });

        // Remplir la distribution
        Object.values(siretMeasures).forEach(item => {
            if (item.cat === 'INDETERMINE') return;
            const numMeasures = item.measures.size;
            if (numMeasures >= 1 && numMeasures <= 10) {
                if (dist[item.cat]) {
                    dist[item.cat][numMeasures]++;
                }
            }
        });

        // Formater les données pour Recharts LineChart (1 à 10 mesures)
        const chartData = [];
        for (let i = 1; i <= 10; i++) {
            const row: Record<string, any> = { name: `${i} mes.` };
            categories.forEach(cat => {
                if (cat === 'INDETERMINE') return;
                row[cat] = dist[cat][i] || 0;
            });
            chartData.push(row);
        }

        const filteredCategories = Array.from(categories).filter(cat => cat !== 'INDETERMINE');

        return {
            chartData,
            categories: filteredCategories
        };
    }, [filteredAgreements]);

    // 9. Distribution en PROPORTION (%) du nombre de mesures de 1 à 10 par catégorie d'entreprise en Île-de-France
    const categoryMeasuresDistributionPercentData = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return { chartData: [], categories: [] };

        const idfAgreements = filteredAgreements.filter(a => {
            const reg = a.localisation_region_nom || a.localisation_region;
            return reg === 'Île-de-France';
        });

        const categories = new Set<string>();
        const siretMeasures: Record<string, { cat: string, measures: Set<string> }> = {};

        idfAgreements.forEach(a => {
            const siret = a.SIRET;
            if (!siret) return;

            let cat = a.categorie_entreprise;
            if (!cat || cat === 'null' || cat.trim() === '') {
                cat = 'INDETERMINE';
            } else {
                cat = cat.trim();
            }
            categories.add(cat);

            const measure = a.mesures_ref_idfm;
            const isValidMeasure = measure && measure !== 'AUCUNE_CORRESPONDANCE' && measure !== 'hors mesures IDFM';

            if (isValidMeasure) {
                if (!siretMeasures[siret]) {
                    siretMeasures[siret] = {
                        cat,
                        measures: new Set()
                    };
                }
                siretMeasures[siret].measures.add(measure);
            }
        });

        // Calculer le total d'établissements par catégorie d'entreprise (avec au moins 1 mesure)
        const totalsByCategory: Record<string, number> = {};
        categories.forEach(cat => {
            if (cat === 'INDETERMINE') return;
            totalsByCategory[cat] = 0;
        });

        Object.values(siretMeasures).forEach(item => {
            if (item.cat === 'INDETERMINE') return;
            const numMeasures = item.measures.size;
            if (numMeasures >= 1 && numMeasures <= 10) {
                totalsByCategory[item.cat]++;
            }
        });

        // Initialiser la distribution de 1 à 10 pour chaque catégorie
        const dist: Record<string, Record<number, number>> = {};
        categories.forEach(cat => {
            if (cat === 'INDETERMINE') return;
            dist[cat] = {};
            for (let i = 1; i <= 10; i++) {
                dist[cat][i] = 0;
            }
        });

        // Remplir la distribution brute
        Object.values(siretMeasures).forEach(item => {
            if (item.cat === 'INDETERMINE') return;
            const numMeasures = item.measures.size;
            if (numMeasures >= 1 && numMeasures <= 10) {
                if (dist[item.cat]) {
                    dist[item.cat][numMeasures]++;
                }
            }
        });

        // Formater les données pour Recharts LineChart en PROPORTION (%)
        const chartData = [];
        for (let i = 1; i <= 10; i++) {
            const row: Record<string, any> = { name: `${i} mes.` };
            categories.forEach(cat => {
                if (cat === 'INDETERMINE') return;
                const total = totalsByCategory[cat] || 0;
                const count = dist[cat][i] || 0;
                row[cat] = total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
            });
            chartData.push(row);
        }

        const filteredCategories = Array.from(categories).filter(cat => cat !== 'INDETERMINE');

        return {
            chartData,
            categories: filteredCategories
        };
    }, [filteredAgreements]);

    // 10. Nombre d'entreprises franciliennes dont la catégorie n'a pu être déterminée
    const undeterminedIdfEstablishmentsCount = useMemo(() => {
        if (!filteredAgreements || filteredAgreements.length === 0) return 0;

        const idfAgreements = filteredAgreements.filter(a => {
            const reg = a.localisation_region_nom || a.localisation_region;
            return reg === 'Île-de-France';
        });

        const uniqueSirets = new Set<string>();

        idfAgreements.forEach(a => {
            const siret = a.SIRET;
            if (!siret) return;

            const measure = a.mesures_ref_idfm;
            const isValidMeasure = measure && measure !== 'AUCUNE_CORRESPONDANCE' && measure !== 'hors mesures IDFM';

            if (isValidMeasure) {
                const cat = a.categorie_entreprise;
                if (!cat || cat === 'null' || cat.trim() === '') {
                    uniqueSirets.add(siret);
                }
            }
        });

        return uniqueSirets.size;
    }, [filteredAgreements]);


    // Unique establishments (SIRET) total count
    const uniqueEstablishmentsCount = useMemo(() => {
        const uniqueSirets = new Set(filteredAgreements.map(a => a.SIRET).filter(Boolean));
        return uniqueSirets.size;
    }, [filteredAgreements]);

    // Unique establishments with mobility count
    const establishmentsWithMobilityCount = useMemo(() => {
        const sirets = new Set();
        filteredAgreements.forEach(a => {
            if (checkMobility(a) && a.SIRET) sirets.add(a.SIRET);
        });
        return sirets.size;
    }, [filteredAgreements]);


    // Unique agreements count
    const uniqueAgreementsCount = useMemo(() => {
        const uniqueIds = new Set(filteredAgreements.map(a => a.ID));
        return uniqueIds.size;
    }, [filteredAgreements]);

    // Agreements with mobility count
    const agreementsWithMobilityCount = useMemo(() => {
        const ids = new Set();
        filteredAgreements.forEach(a => {
            if (checkMobility(a)) ids.add(a.ID);
        });
        return ids.size;
    }, [filteredAgreements]);

    // Measures detected count
    const measuresDetectedCount = useMemo(() => {
        return filteredAgreements.filter(a => checkMobility(a)).length;
    }, [filteredAgreements]);

    const sortedAgreements = useMemo(() => {
        if (!sortField) return filteredAgreements;
        
        return [...filteredAgreements].sort((a, b) => {
            let valA = a[sortField as keyof Agreement];
            let valB = b[sortField as keyof Agreement];
            
            if (valA === undefined || valA === null) return 1;
            if (valB === undefined || valB === null) return -1;
            
            if (typeof valA === 'string' && typeof valB === 'string') {
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            
            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [filteredAgreements, sortField, sortOrder]);

    // Pagination Logic
    const paginatedAgreements = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return sortedAgreements.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [sortedAgreements, currentPage]);

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

            {/* Scope Switcher Banner (Île-de-France vs France entière) */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-lg border bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-200 dark:border-indigo-800 shadow-xs">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{datasetScope === 'IDF' ? '🗼' : '🇫🇷'}</span>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-white">
                                {datasetScope === 'IDF' ? 'Périmètre actif : Île-de-France (32 703 accords)' : 'Périmètre actif : France Entière (123 431 accords)'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold uppercase">
                                {datasetScope === 'IDF' ? 'Chargement Rapide' : 'Exhaustif'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            {datasetScope === 'IDF' 
                                ? 'Jeu de données allégé (14.6 Mo). Cliquez pour charger l\'ensemble des départements français si besoin.' 
                                : 'Jeu de données national complet (82.7 Mo). Cliquez pour revenir à la version allégée francilienne.'}
                        </p>
                    </div>
                </div>
                <div>
                    {datasetScope === 'IDF' ? (
                        <button
                            type="button"
                            onClick={() => switchDataset('FRANCE')}
                            disabled={isLoading}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-sm transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                        >
                            <span>🇫🇷 Charger la France entière</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => switchDataset('IDF')}
                            disabled={isLoading}
                            className="px-4 py-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md text-xs font-semibold shadow-sm transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                        >
                            <span>🗼 Revenir à Île-de-France</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filters Section */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                    {/* Global Search */}
                    <div className="lg:col-span-3">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                            Recherche Globale
                        </label>
                        <input
                            type="text"
                            value={globalSearch}
                            onChange={e => setGlobalSearch(e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                            placeholder="Entreprise, SIRET, mot-clé..."
                        />
                    </div>

                    {/* Mesure IDFM (Menu déroulant intuitif) */}
                    <div className="lg:col-span-3">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                            Mesure IDFM
                        </label>
                        <select
                            value={measureSearch}
                            onChange={e => setMeasureSearch(e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                        >
                            <option value="">Toutes les mesures IDFM ({availableMeasures.length})</option>
                            {availableMeasures.map((measure) => (
                                <option key={measure} value={measure}>
                                    {measure}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Secteur d'activité (Menu déroulant intuitif) */}
                    <div className="lg:col-span-3">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                            Secteur d'activité
                        </label>
                        <select
                            value={selectedSectors[0] || ""}
                            onChange={e => {
                                const val = e.target.value;
                                setSelectedSectors(val ? [val] : []);
                            }}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                        >
                            <option value="">Tous les secteurs ({sectors.length})</option>
                            {sectors.map((sector) => (
                                <option key={sector} value={sector}>
                                    {sector}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Année de signature de l'accord (Menu déroulant DATE_TEXTE) */}
                    <div className="lg:col-span-3">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                            Année de signature
                        </label>
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                        >
                            <option value="">Toutes les années ({years.length})</option>
                            {years.map((y) => (
                                <option key={y} value={y}>
                                    {y}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Deuxième rangée de filtres : Territoire & Reset */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1 border-t border-gray-100 dark:border-gray-700/60">

                    {/* Geo Location Filter */}
                    <div className="md:col-span-9 relative" ref={geoWrapperRef}>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                            Territoire (Région, EPCI, EPT)
                        </label>
                        <input
                            type="text"
                            value={geoInput}
                            onChange={e => {
                                setGeoInput(e.target.value);
                                setShowGeoSuggestions(true);
                            }}
                            onFocus={() => setShowGeoSuggestions(true)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                            placeholder={selectedLocations.length > 0 ? "Ajouter un lieu..." : "Rechercher une région, un EPCI ou un EPT (ex: Grand Paris, Métropole de Lyon)..."}
                        />
                        {showGeoSuggestions && geoInput && (
                            <ul className="absolute z-20 mt-1 w-full bg-white dark:bg-gray-700 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                                {filteredGeoSuggestions.length > 0 ? filteredGeoSuggestions.map((loc, idx) => (
                                    <li
                                        key={loc.name + loc.type + idx}
                                        className="text-gray-900 dark:text-gray-200 cursor-pointer select-none relative py-2 pl-3 pr-4 hover:bg-indigo-600 hover:text-white flex justify-between items-center"
                                        onClick={() => addLocation(loc)}
                                    >
                                        <span className="truncate">{loc.name}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider ${getBadgeColor(loc.type)}`}>
                                            {loc.type}
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

                    {/* Reset Button */}
                    <div className="md:col-span-3 flex items-end">
                        {(globalSearch || measureSearch || selectedSectors.length > 0 || selectedLocations.length > 0 || selectedYear || onlyMobiliteIA || onlyIDF || ignoreRevendications || onlyFmdIkv || onlyEffortRemboursement) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setGlobalSearch('');
                                    setMeasureSearch('');
                                    setSelectedSectors([]);
                                    setSelectedLocations([]);
                                    setSelectedYear('');
                                    setOnlyMobiliteIA(false);
                                    setOnlyIDF(false);
                                    setIgnoreRevendications(false);
                                    setOnlyFmdIkv(false);
                                    setOnlyEffortRemboursement(false);
                                }}
                                className="w-full py-2 px-3 rounded-md text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 transition-colors"
                            >
                                ✕ Réinitialiser les filtres
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                    {/* Mobilité confirmée IA */}
                    <div className="flex items-center">
                        <button 
                            type="button" 
                            className={`${onlyMobiliteIA ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500`}
                            role="switch"
                            aria-checked={onlyMobiliteIA}
                            onClick={() => setOnlyMobiliteIA(!onlyMobiliteIA)}
                        >
                            <span className="sr-only">Mentionne les mobilités ?</span>
                            <span aria-hidden="true" className={`${onlyMobiliteIA ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}></span>
                        </button>
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300" title="Filtre sur mentionne_mobilite_ia : l'IA a confirmé que l'extrait traite réellement de mobilité (évite les faux positifs lexicaux)">
                            Mentionne les mobilités ?
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

                    {/* Ignorer Revendications */}
                    <div className="flex items-center">
                        <button 
                            type="button" 
                            className={`${ignoreRevendications ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500`}
                            role="switch"
                            aria-checked={ignoreRevendications}
                            onClick={() => setIgnoreRevendications(!ignoreRevendications)}
                        >
                            <span className="sr-only">Ignorer les revendications</span>
                            <span aria-hidden="true" className={`${ignoreRevendications ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}></span>
                        </button>
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300" title="Exclut les revendications syndicales et objectifs de négociation non actés">
                            Ignorer revendications
                        </span>
                    </div>

                    {/* FMD / IKV en place */}
                    <div className="flex items-center">
                        <button 
                            type="button" 
                            className={`${onlyFmdIkv ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500`}
                            role="switch"
                            aria-checked={onlyFmdIkv}
                            onClick={() => setOnlyFmdIkv(!onlyFmdIkv)}
                        >
                            <span className="sr-only">Uniquement FMD ou IKV confirmé</span>
                            <span aria-hidden="true" className={`${onlyFmdIkv ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}></span>
                        </button>
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300" title="Filtre sur les accords où le Forfait Mobilités Durables ou l'Indemnité Vélo est mis en place de façon confirmée">
                            FMD/IKV confirmés
                        </span>
                    </div>

                    {/* Effort de remboursement */}
                    <div className="flex items-center">
                        <button 
                            type="button" 
                            className={`${onlyEffortRemboursement ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500`}
                            role="switch"
                            aria-checked={onlyEffortRemboursement}
                            onClick={() => setOnlyEffortRemboursement(!onlyEffortRemboursement)}
                        >
                            <span className="sr-only">Effort remboursement transports</span>
                            <span aria-hidden="true" className={`${onlyEffortRemboursement ? 'translate-x-5' : 'translate-x-0'} pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}></span>
                        </button>
                        <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300" title="Filtre sur les accords où le remboursement des transports en commun dépasse l'obligation légale de 50%">
                            Effort remboursement {">"} 50%
                        </span>
                    </div>
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                     <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        <span className="text-indigo-600 dark:text-indigo-400 font-bold">{measuresDetectedCount}</span> mesure(s) détectée(s) dans <span className="text-indigo-600 dark:text-indigo-400 font-bold">{agreementsWithMobilityCount}</span> accord(s) (<span className="text-indigo-600 dark:text-indigo-400 font-bold">{establishmentsWithMobilityCount}</span> établissement(s) distincts) sur un total de <span className="text-indigo-600 dark:text-indigo-400 font-bold">{uniqueAgreementsCount}</span> accord(s) analysés (<span className="text-indigo-600 dark:text-indigo-400 font-bold">{uniqueEstablishmentsCount}</span> établissement(s) distincts).
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
                        onClick={() => setActiveTab('live_sql')}
                        className={`${activeTab === 'live_sql' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                        🦆 Live SQL
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
                        {/* Premier bloc : Proportion d'accords mentionnant la mobilité */}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Proportion d'accords mentionnant la mobilité
                                </h2>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 border-l-4 border-indigo-500 pl-4 py-1">
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                                        Combien d’accords, sur tous les accords franciliens, évoquent le sujet de la mobilité des salariés ?
                                    </p>
                                    <p>
                                        <span className="font-semibold">Définition :</span> Nombre distinct d’accords (les avenants comptant aussi pour un accord), comprenant au moins un extrait dont on estime qu’il mentionne les mobilités (validé par l'IA).
                                    </p>
                                </div>
                            </div>
                            
                        {/* Les 3 Donuts sur la même ligne */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <DonutChart title="Région Île-de-France" data={idfMobilityData} />
                            <DonutChart title="Hors Île-de-France" data={horsIdfMobilityData} />
                            <DonutChart title="France entière" data={globalMobilityData} />
                        </div>
                    </div>

                    {/* Deuxième bloc : Répartition des mesures et proportions par couronne */}
                    {couronneMobilityData.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Répartition des mesures et proportions par couronne
                                </h2>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 border-l-4 border-purple-500 pl-4 py-1">
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                                        Nombre distinct d'accords dans lesquels une mesure du référentiel IDFM est identifiée, par couronne, avec sa proportion d'intégration.
                                    </p>
                                </div>
                            </div>
                            
                            <CouronneBarChart title="Proportion d'intégration par mesure et par couronne (%)" data={couronneMobilityData} />
                        </div>
                    )}

                    {/* Troisième bloc : Taux d'entreprises franciliennes évoquant les mobilités par catégorie */}
                    {Object.keys(categoriesIdfMobilityData).length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Taux d'entreprises franciliennes évoquant les mobilités par catégorie
                                </h2>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 border-l-4 border-blue-500 pl-4 py-1">
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                                        Nombre estimé et proportion d'accords distinct mentionnant les mobilités des salariés par catégorie d'entreprise en Île-de-France.
                                    </p>
                                </div>
                            </div>
                            
                            {/* Les Donuts par catégorie de manière dynamique */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {Object.entries(categoriesIdfMobilityData).map(([cat, chartData]) => (
                                    <DonutChart key={cat} title={`Catégorie : ${cat}`} data={chartData} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quatrième bloc : Nombre moyen et médian de mesures distinctes par catégorie d'entreprise en Île-de-France */}
                    {categoryMeasuresAvgMedianData.length > 0 && (
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md border border-gray-100 dark:border-gray-700">
                            <div className="mb-6">
                                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                                    Nombre moyen, médian et distribution des mesures distinctes par catégorie d'entreprise en Île-de-France
                                </h2>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 border-l-4 border-emerald-500 pl-4 py-1">
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                                        Moyenne, médiane et distribution du nombre de mesures IDFM identifiées par accord d'entreprise présentant au moins une mesure de mobilité en Île-de-France.
                                    </p>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <CategoryMeasuresChart 
                                    title="Moyenne et médiane du nombre de mesures IDFM par accord d'entreprise" 
                                    data={categoryMeasuresAvgMedianData} 
                                />
                                <CategoryMeasuresDistributionChart
                                    title="Distribution du nombre de mesures (1 à 10) en valeur absolue"
                                    data={categoryMeasuresDistributionData.chartData}
                                    categories={categoryMeasuresDistributionData.categories}
                                />
                                <CategoryMeasuresDistributionChart
                                    title="Distribution du nombre de mesures (1 à 10) en proportion (%)"
                                    data={categoryMeasuresDistributionPercentData.chartData}
                                    categories={categoryMeasuresDistributionPercentData.categories}
                                    isPercent={true}
                                />
                            </div>
                        </div>
                    )}
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
                            totalUniqueAgreements={uniqueAgreementsCount}
                            currentPage={currentPage}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={setCurrentPage}
                            onRowClick={setSelectedAgreement} 
                            highlightTerm={globalSearch || measureSearch} 
                        />
                    </div>
                )}

                {activeTab === 'live_sql' && (
                    <div className="animate-fade-in">
                        <LiveSQL />
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
