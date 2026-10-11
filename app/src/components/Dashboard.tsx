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
import SidebarFilters from './SidebarFilters';
import { initDuckDB, loadParquetFile, runQuery } from '../duckdbClient';
import * as XLSX from 'xlsx';

import { 
    HF_PARQUET_URL_IDF, 
    HF_PARQUET_URL_FRANCE, 
    IDFM_OFFICIAL_MEASURES 
} from '../constants';

const TABLE_NAME = "agreements";
const ITEMS_PER_PAGE = 20;

type TabType = 'stats' | 'measures' | 'map' | 'live_sql' | 'about_data' | 'about_dash';

function formatDate(value: string | number | null | undefined): string {
    if (!value) return '';
    const num = typeof value === 'number' ? value : Number(value);
    let date: Date;
    if (!isNaN(num) && num > 1e10) {
        date = new Date(num);
    } else if (typeof value === 'string' && value.length >= 8) {
        date = new Date(value);
    } else {
        return String(value);
    }
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Type for the location filter item
interface LocationItem {
    name: string;
    type: 'Région' | 'Département' | 'EPCI' | 'EPT' | 'Commune';
}

const Dashboard: React.FC = () => {
    const [agreements, setAgreements] = useState<Agreement[]>([]);
    const [filteredAgreements, setFilteredAgreements] = useState<Agreement[]>([]);
    const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
    
    // Dataset Scope State (par défaut IDF pour un démarrage ultra-rapide)
    const [datasetScope, setDatasetScope] = useState<'IDF' | 'FRANCE'>('IDF');
    
    // Tab State (Carte par défaut)
    const [activeTab, setActiveTab] = useState<TabType>('map');

    // Search States
    const [globalSearch, setGlobalSearch] = useState('');
    const [measureSearch, setMeasureSearch] = useState('');
    const [availableMeasures, setAvailableMeasures] = useState<string[]>(IDFM_OFFICIAL_MEASURES);
    const [onlyMobiliteIA, setOnlyMobiliteIA] = useState(true);
    const [onlyIDF, setOnlyIDF] = useState(true); 
    const [ignoreRevendications, setIgnoreRevendications] = useState(true);
    const [onlyFmdIkv, setOnlyFmdIkv] = useState(false);
    const [onlyEffortRemboursement, setOnlyEffortRemboursement] = useState(false);
    const [onlyPrimeCarburant, setOnlyPrimeCarburant] = useState(false);
    const [onlyInfraVelo, setOnlyInfraVelo] = useState(false);
    
    // Sector State (Section NAF macro + sous-secteur fin)
    const [sectionsNaf, setSectionsNaf] = useState<string[]>([]);
    const [selectedSectionNaf, setSelectedSectionNaf] = useState<string>('');
    const [subSectors, setSubSectors] = useState<string[]>([]);
    const [selectedSubSector, setSelectedSubSector] = useState<string>('');

    // Geographic Filter State
    const [geoOptions, setGeoOptions] = useState<LocationItem[]>([]);
    const [selectedLocations, setSelectedLocations] = useState<LocationItem[]>([]);
    const [geoInput, setGeoInput] = useState('');
    const [showGeoSuggestions, setShowGeoSuggestions] = useState(false);
    
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [dbReady, setDbReady] = useState(false);
    
    const toggleSidebar = () => {
        setIsSidebarOpen(prev => {
            const next = !prev;
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
            return next;
        });
    };
    
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);

    // Filters States
    const [selectedYears, setSelectedYears] = useState<number[]>([]);
    const [years, setYears] = useState<number[]>([]);

    // Sorting States
    const [sortField, setSortField] = useState<string>('DATE_DEPOT');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    const geoWrapperRef = useRef<HTMLDivElement>(null);

    const IDFM_MEASURES = availableMeasures;

    // Fonction réutilisable pour alimenter les listes déroulantes de filtres depuis DuckDB
    const loadOptionsFromDB = async () => {
        // 1. Sections NAF (21 macro-secteurs Insee A à U)
        const nafResult = await runQuery(`SELECT DISTINCT SECTION_NAF FROM ${TABLE_NAME} WHERE SECTION_NAF IS NOT NULL AND SECTION_NAF != 'Non renseigné' ORDER BY SECTION_NAF`);
        const nafList = nafResult.map((r: any) => r.SECTION_NAF).filter(Boolean);
        setSectionsNaf(nafList);

        // 1b. Sous-secteurs précis d'activité
        const subSectorResult = await runQuery(`SELECT DISTINCT SECTEUR FROM ${TABLE_NAME} WHERE SECTEUR IS NOT NULL ORDER BY SECTEUR`);
        const subSectorList = subSectorResult.map((r: any) => r.SECTEUR).filter(Boolean);
        setSubSectors(subSectorList);

        // 2. Options géographiques (Régions, Départements, EPCI, EPT)
        const geoQuery = `
            SELECT DISTINCT localisation_region_nom as name, 'Région' as type FROM ${TABLE_NAME} WHERE localisation_region_nom IS NOT NULL
            UNION
            SELECT DISTINCT (localisation_departement_nom || ' (' || coalesce(localisation_departement_code, '') || ')') as name, 'Département' as type FROM ${TABLE_NAME} WHERE localisation_departement_nom IS NOT NULL
            UNION
            SELECT DISTINCT localisation_epci_nom as name, 'EPCI' as type FROM ${TABLE_NAME} WHERE localisation_epci_nom IS NOT NULL
            UNION
            SELECT DISTINCT localisation_ept_nom as name, 'EPT' as type FROM ${TABLE_NAME} WHERE localisation_ept_nom IS NOT NULL
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

    // Mise à jour dynamique des sous-secteurs selon la Section NAF choisie
    useEffect(() => {
        if (!dbReady) return;
        const updateSubSectors = async () => {
            if (selectedSectionNaf) {
                const safeSection = selectedSectionNaf.replace(/'/g, "''");
                const res = await runQuery(`SELECT DISTINCT SECTEUR FROM ${TABLE_NAME} WHERE SECTION_NAF = '${safeSection}' AND SECTEUR IS NOT NULL ORDER BY SECTEUR`);
                const list = res.map((r: any) => r.SECTEUR).filter(Boolean);
                setSubSectors(list);
            } else {
                const res = await runQuery(`SELECT DISTINCT SECTEUR FROM ${TABLE_NAME} WHERE SECTEUR IS NOT NULL ORDER BY SECTEUR`);
                const list = res.map((r: any) => r.SECTEUR).filter(Boolean);
                setSubSectors(list);
            }
        };
        updateSubSectors();
    }, [selectedSectionNaf, dbReady]);

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
                alert("Impossible de charger le dataset distant. Veuillez vérifier votre connexion.");
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
            
            // Global Search multi-termes (ID, SIRET, Entreprise, Titre, Mots-clés, Mesure, Moyens, Chunks)
            if (globalSearch.trim()) {
                const tokens = globalSearch.trim().toLowerCase().split(/\s+/).filter(Boolean);
                tokens.forEach(token => {
                    const safe = token.replace(/'/g, "''");
                    query += ` AND (
                        lower(COALESCE(ID, '')) LIKE '%${safe}%' OR 
                        lower(COALESCE(SIRET, '')) LIKE '%${safe}%' OR 
                        lower(COALESCE(RAISON_SOCIALE, '')) LIKE '%${safe}%' OR 
                        lower(COALESCE(TITRE_TXT, '')) LIKE '%${safe}%' OR 
                        lower(COALESCE(theme_recherche, '')) LIKE '%${safe}%' OR 
                        lower(COALESCE(mot_cle_calcule, '')) LIKE '%${safe}%' OR 
                        lower(COALESCE(mesure_extraite, '')) LIKE '%${safe}%' OR 
                        lower(COALESCE(moyens_materiels, '')) LIKE '%${safe}%' OR 
                        lower(COALESCE(extrait_chunk, '')) LIKE '%${safe}%'
                    )`;
                });
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

            // Section NAF Macro Filter (A à U)
            if (selectedSectionNaf) {
                const safeSection = selectedSectionNaf.replace(/'/g, "''");
                query += ` AND SECTION_NAF = '${safeSection}'`;
            }

            // Sub-Sector Detailed Filter
            if (selectedSubSector) {
                const safeSub = selectedSubSector.replace(/'/g, "''");
                query += ` AND SECTEUR = '${safeSub}'`;
            }

            // Location Chips Filter (Hybrid: Region, Département, EPCI, EPT)
            if (selectedLocations.length > 0) {
                const conditions: string[] = [];
                selectedLocations.forEach(loc => {
                    const safeName = loc.name.replace(/'/g, "''");
                    if (loc.type === 'Région') {
                        conditions.push(`localisation_region_nom = '${safeName}'`);
                    } else if (loc.type === 'Département') {
                        const deptMatch = loc.name.match(/^(.*?)(?:\s*\((.*?)\))?$/);
                        const deptNom = (deptMatch ? deptMatch[1] : loc.name).trim().replace(/'/g, "''");
                        const deptCode = deptMatch && deptMatch[2] ? deptMatch[2].trim().replace(/'/g, "''") : '';
                        if (deptCode) {
                            conditions.push(`(localisation_departement_nom = '${deptNom}' OR localisation_departement_code = '${deptCode}')`);
                        } else {
                            conditions.push(`localisation_departement_nom = '${deptNom}'`);
                        }
                    } else if (loc.type === 'EPCI') {
                        conditions.push(`localisation_epci_nom = '${safeName}'`);
                    } else if (loc.type === 'EPT') {
                        conditions.push(`localisation_ept_nom = '${safeName}'`);
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

            // Uniquement Prime Carburant
            if (onlyPrimeCarburant) {
                query += ` AND lower(CAST(COALESCE(est_prime_carburant, 'Non') AS VARCHAR)) IN ('oui', 'true', '1')`;
            }

            // Uniquement Infrastructures Vélo
            if (onlyInfraVelo) {
                query += ` AND lower(CAST(COALESCE(est_infra_velo, 'Non') AS VARCHAR)) IN ('oui', 'true', '1')`;
            }

            // Year Filter (filtrage multiple sur l'année de signature issue de DATE_TEXTE)
            if (selectedYears.length > 0) {
                query += ` AND EXTRACT(YEAR FROM CAST(DATE_TEXTE AS DATE)) IN (${selectedYears.join(', ')})`;
            }

            try {
                const results = await runQuery(query);
                if (!isCancelled) {
                    setFilteredAgreements(results as Agreement[]);
                    setCurrentPage(1);
                }
            } catch (e) {
                console.error("Erreur requête SQL:", e);
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
    }, [globalSearch, measureSearch, selectedSectionNaf, selectedSubSector, selectedLocations, onlyMobiliteIA, onlyIDF, ignoreRevendications, onlyFmdIkv, onlyEffortRemboursement, onlyPrimeCarburant, onlyInfraVelo, selectedYears, dbReady]);

    // Export des accords filtrés au format tableur Excel .xlsx (avec troncature sécurisée à 32 700 car. max par cellule)
    const handleExportXLSX = () => {
        if (!filteredAgreements || filteredAgreements.length === 0) return;
        setIsExporting(true);

        const truncateForExcel = (val: any, maxLen = 32700): string => {
            if (val === null || val === undefined) return "";
            const s = String(val);
            if (s.length <= maxLen) return s;
            return s.substring(0, maxLen) + " ... [tronqué pour Excel]";
        };

        try {
            const exportRows = filteredAgreements.map(a => ({
                "Identifiant Accord": truncateForExcel(a.ID),
                "Raison Sociale": truncateForExcel(a.RAISON_SOCIALE),
                "SIRET": truncateForExcel(a.SIRET),
                "Date de Signature": formatDate(a.DATE_TEXTE),
                "Date de Dépôt": formatDate(a.DATE_DEPOT),
                "Section NAF": truncateForExcel(a.SECTION_NAF),
                "Sous-secteur d'activité": truncateForExcel(a.SECTEUR),
                "Code APE": truncateForExcel(a.CODE_APE),
                "Taille d'Entreprise": truncateForExcel(a.categorie_entreprise),
                "Région": truncateForExcel(a.localisation_region_nom),
                "Département": truncateForExcel(a.localisation_departement_nom ? `${a.localisation_departement_nom} (${a.localisation_departement_code || ''})` : ""),
                "EPCI": truncateForExcel(a.localisation_epci_nom),
                "EPT (Grand Paris)": truncateForExcel(a.localisation_ept_nom),
                "Mesure IDFM": truncateForExcel(a.mesures_ref_idfm),
                "Synthèse Mesure IA": truncateForExcel(a.mesure_extraite || a.resume_mesure_proposee),
                "Mot-clé Détecté": truncateForExcel(a.theme_recherche),
                "Mobilité Confirmée IA": a.mentionne_mobilite_ia || "Non",
                "Mobilités Durables": a.est_mobilites_durables || "Non",
                "Prime Carburant": a.est_prime_carburant || "Non",
                "Infrastructures Vélo": a.est_infra_velo || "Non",
                "FMD / IKV en place": a.est_fmd_ikv_mis_en_place || "Non",
                "Remboursement TC > 50%": a.est_superieur_taux_legal || "Non",
                "Moyens Matériels": truncateForExcel(a.moyens_materiels && a.moyens_materiels !== 'AUCUNE_CORRESPONDANCE' ? a.moyens_materiels : ""),
                "Moyens Financiers": truncateForExcel(a.moyens_financiers && a.moyens_financiers !== 'AUCUNE_CORRESPONDANCE' ? a.moyens_financiers : ""),
                "Titre de l'Accord": truncateForExcel(a.TITRE_TXT),
                "Extrait de l'Accord": truncateForExcel(a.extrait_chunk),
                "Lien Légifrance": truncateForExcel(a.url_legifrance || (a.ID ? `https://www.legifrance.gouv.fr/acco/id/${a.ID}` : ""))
            }));

            const worksheet = XLSX.utils.json_to_sheet(exportRows);

            // Ajustement automatique des largeurs de colonnes (plafonnées à 60)
            const colWidths = Object.keys(exportRows[0] || {}).map(key => {
                const sampleValues = exportRows.slice(0, 50).map(row => String((row as any)[key] || '').slice(0, 60).length);
                const maxLen = Math.max(key.length, ...sampleValues);
                return { wch: Math.min(Math.max(maxLen + 2, 10), 60) };
            });
            worksheet['!cols'] = colWidths;

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Accords Mobilités");

            const today = new Date().toISOString().split('T')[0];
            const scopeLabel = datasetScope === 'IDF' ? 'idf' : 'national';
            const filename = `accords_mobilites_${scopeLabel}_${today}.xlsx`;
            XLSX.writeFile(workbook, filename);
        } catch (err) {
            console.error("Erreur export Excel:", err);
            alert("Une erreur est survenue lors de la création du fichier Excel.");
        } finally {
            setIsExporting(false);
        }
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
            case 'Département': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200';
            case 'EPCI': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
            case 'EPT': return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
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

    // Helper pour identifier la zone de couronne francilienne
    const getCouronneZone = (depCode: string | undefined): 'PARIS' | 'PC' | 'GC' | null => {
        if (!depCode) return null;
        const clean = depCode.trim();
        if (clean === '75') return 'PARIS';
        if (['92', '93', '94'].includes(clean)) return 'PC';
        if (['77', '78', '91', '95'].includes(clean)) return 'GC';
        return null;
    };

    // Helper réutilisable pour calculer les proportions d'accords mentionnant la mobilité par zone
    const computeMobilityForZone = (targetZone: 'PARIS' | 'PC' | 'GC', color: string) => {
        if (!filteredAgreements || filteredAgreements.length === 0) return [];
        let oui = 0;
        let non = 0;
        
        const processedIds = new Set();
        const idsWithMobility = new Set();
        filteredAgreements.forEach(a => {
            if (checkMobility(a)) idsWithMobility.add(a.ID);
        });

        filteredAgreements.forEach(a => {
            const zone = getCouronneZone(a.localisation_departement_code);
            if (zone === targetZone && !processedIds.has(a.ID)) {
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
            { name: "Mentionne la mobilité", value: oui, fill: color },
            { name: "Ne mentionne pas", value: non, fill: "#E5E7EB" }
        ];
    };

    // 1. Donut : Paris (75)
    const parisMobilityData = useMemo(() => {
        return computeMobilityForZone('PARIS', '#3B82F6');
    }, [filteredAgreements]);

    // 2. Donut : Petite Couronne (92, 93, 94)
    const petiteCouronneMobilityData = useMemo(() => {
        return computeMobilityForZone('PC', '#6366F1');
    }, [filteredAgreements]);

    // 3. Donut : Grande Couronne (77, 78, 91, 95)
    const grandeCouronneMobilityData = useMemo(() => {
        return computeMobilityForZone('GC', '#10B981');
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

    // Active filters count badge
    const activeFiltersCount = useMemo(() => {
        let count = 0;
        if (globalSearch.trim()) count++;
        if (measureSearch) count++;
        if (selectedSectionNaf) count++;
        if (selectedSubSector) count++;
        if (selectedLocations.length > 0) count += selectedLocations.length;
        if (selectedYears.length > 0) count += selectedYears.length;
        if (onlyMobiliteIA) count++;
        if (onlyIDF) count++;
        if (ignoreRevendications) count++;
        if (onlyFmdIkv) count++;
        if (onlyEffortRemboursement) count++;
        if (onlyPrimeCarburant) count++;
        if (onlyInfraVelo) count++;
        return count;
    }, [globalSearch, measureSearch, selectedSectionNaf, selectedSubSector, selectedLocations, selectedYears, onlyMobiliteIA, onlyIDF, ignoreRevendications, onlyFmdIkv, onlyEffortRemboursement, onlyPrimeCarburant, onlyInfraVelo]);
    const hasActiveFilters = activeFiltersCount > 0;

    const handleResetFilters = () => {
        setGlobalSearch('');
        setMeasureSearch('');
        setSelectedSectionNaf('');
        setSelectedSubSector('');
        setSelectedLocations([]);
        setSelectedYears([]);
        setOnlyMobiliteIA(false);
        setOnlyIDF(false);
        setIgnoreRevendications(false);
        setOnlyFmdIkv(false);
        setOnlyEffortRemboursement(false);
        setOnlyPrimeCarburant(false);
        setOnlyInfraVelo(false);
    };


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
        <div className="relative min-h-[500px]">
            {isLoading && (
                 <div className="absolute inset-0 bg-white/80 z-50 flex items-start justify-center pt-40 backdrop-blur-sm h-full rounded-lg">
                    <div className="flex flex-col items-center p-6 bg-white shadow-xl rounded-xl border border-indigo-100">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mb-4"></div>
                        <p className="text-indigo-900 font-semibold">Chargement des données...</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col lg:flex-row items-start gap-5">
                {/* Volet Latéral / Sidebar (Périmètre + Filtres) */}
                {isSidebarOpen && (
                    <SidebarFilters
                        onCloseSidebar={toggleSidebar}
                        datasetScope={datasetScope}
                        onSwitchDataset={switchDataset}
                        isLoading={isLoading}
                        activeFiltersCount={activeFiltersCount}
                        globalSearch={globalSearch}
                        onGlobalSearchChange={setGlobalSearch}
                        measureSearch={measureSearch}
                        onMeasureSearchChange={setMeasureSearch}
                        availableMeasures={availableMeasures}
                        sectionsNaf={sectionsNaf}
                        selectedSectionNaf={selectedSectionNaf}
                        onSectionNafChange={setSelectedSectionNaf}
                        subSectors={subSectors}
                        selectedSubSector={selectedSubSector}
                        onSubSectorChange={setSelectedSubSector}
                        years={years}
                        selectedYears={selectedYears}
                        onSelectedYearsChange={setSelectedYears}
                        geoInput={geoInput}
                        onGeoInputChange={setGeoInput}
                        showGeoSuggestions={showGeoSuggestions}
                        onShowGeoSuggestionsChange={setShowGeoSuggestions}
                        filteredGeoSuggestions={filteredGeoSuggestions}
                        selectedLocations={selectedLocations}
                        onAddLocation={addLocation}
                        onRemoveLocation={removeLocation}
                        geoWrapperRef={geoWrapperRef}
                        getBadgeColor={getBadgeColor}
                        onlyMobiliteIA={onlyMobiliteIA}
                        onToggleMobiliteIA={() => setOnlyMobiliteIA(!onlyMobiliteIA)}
                        onlyIDF={onlyIDF}
                        onToggleIDF={() => setOnlyIDF(!onlyIDF)}
                        ignoreRevendications={ignoreRevendications}
                        onToggleIgnoreRevendications={() => setIgnoreRevendications(!ignoreRevendications)}
                        onlyFmdIkv={onlyFmdIkv}
                        onToggleFmdIkv={() => setOnlyFmdIkv(!onlyFmdIkv)}
                        onlyEffortRemboursement={onlyEffortRemboursement}
                        onToggleEffortRemboursement={() => setOnlyEffortRemboursement(!onlyEffortRemboursement)}
                        onlyPrimeCarburant={onlyPrimeCarburant}
                        onTogglePrimeCarburant={() => setOnlyPrimeCarburant(!onlyPrimeCarburant)}
                        onlyInfraVelo={onlyInfraVelo}
                        onToggleInfraVelo={() => setOnlyInfraVelo(!onlyInfraVelo)}
                        hasActiveFilters={hasActiveFilters}
                        onResetFilters={handleResetFilters}
                    />
                )}

                {/* Zone Principale de Données */}
                <div className="flex-1 w-full min-w-0 space-y-4">

                    {/* Top Control Bar */}
                    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xs border border-gray-200/80 dark:border-gray-700/80 p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={toggleSidebar}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700/60 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-200 transition shadow-2xs cursor-pointer"
                                title={isSidebarOpen ? "Masquer le volet des filtres" : "Afficher le volet des filtres"}
                            >
                                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                                <span>{isSidebarOpen ? "Masquer volet" : "Filtres"}</span>
                                {activeFiltersCount > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                                        {activeFiltersCount}
                                    </span>
                                )}
                            </button>
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                <span className="text-indigo-600 dark:text-indigo-400 font-bold">{measuresDetectedCount}</span> mesure(s) dans <span className="text-indigo-600 dark:text-indigo-400 font-bold">{agreementsWithMobilityCount}</span> accord(s) (<span className="text-indigo-600 dark:text-indigo-400 font-bold">{establishmentsWithMobilityCount}</span> sites).
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleExportXLSX}
                            disabled={isExporting || filteredAgreements.length === 0}
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 transition-all shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                            title="Télécharger les accords actuellement filtrés au format tableur Excel .xlsx"
                        >
                            {isExporting ? (
                                <>
                                    <span className="animate-spin h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent rounded-full" />
                                    <span>Génération Excel...</span>
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm1.8 14.5-1.4-2.5 1.4-2.5h-1.6l-.7 1.5-.7-1.5h-1.6l1.4 2.5-1.4 2.5h1.6l.7-1.6.7 1.6h1.6zM13 9V3.5L18.5 9H13z"/>
                                    </svg>
                                    <span>Exporter en Excel (.xlsx)</span>
                                    <span className="text-[11px] opacity-80">({filteredAgreements.length.toLocaleString('fr-FR')})</span>
                                </>
                            )}
                        </button>
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
                                    Proportion d'accords mentionnant la mobilité par zone francilienne
                                </h2>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2 border-l-4 border-indigo-500 pl-4 py-1">
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                                        Combien d’accords évoquent le sujet de la mobilité des salariés selon les couronnes franciliennes ?
                                    </p>
                                    <p>
                                        <span className="font-semibold">Définition :</span> Nombre distinct d’accords (les avenants comptant aussi pour un accord), comprenant au moins un extrait dont on estime qu’il mentionne les mobilités (validé par l'IA), ventilé entre Paris (75), la Petite Couronne (92, 93, 94) et la Grande Couronne (77, 78, 91, 95).
                                    </p>
                                </div>
                            </div>
                            
                        {/* Les 3 Donuts sur la même ligne : Paris, Petite Couronne, Grande Couronne */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <DonutChart title="Paris (75)" data={parisMobilityData} />
                            <DonutChart title="Petite Couronne (92, 93, 94)" data={petiteCouronneMobilityData} />
                            <DonutChart title="Grande Couronne (77, 78, 91, 95)" data={grandeCouronneMobilityData} />
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
                            onSwitchToMeasures={(companyName) => {
                                setGlobalSearch(companyName);
                                setActiveTab('measures');
                            }}
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
            </div>
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
