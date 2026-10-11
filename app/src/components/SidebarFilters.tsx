import React from 'react';
import { LocationItem } from '../types';

export interface SidebarFiltersProps {
    onCloseSidebar: () => void;
    datasetScope: 'IDF' | 'FRANCE';
    onSwitchDataset: (scope: 'IDF' | 'FRANCE') => void;
    isLoading: boolean;
    activeFiltersCount: number;

    globalSearch: string;
    onGlobalSearchChange: (val: string) => void;
    measureSearch: string;
    onMeasureSearchChange: (val: string) => void;
    availableMeasures: string[];

    sectionsNaf: string[];
    selectedSectionNaf: string;
    onSectionNafChange: (val: string) => void;
    subSectors: string[];
    selectedSubSector: string;
    onSubSectorChange: (val: string) => void;

    years: number[];
    selectedYears: number[];
    onSelectedYearsChange: (val: number[]) => void;

    geoInput: string;
    onGeoInputChange: (val: string) => void;
    showGeoSuggestions: boolean;
    onShowGeoSuggestionsChange: (val: boolean) => void;
    filteredGeoSuggestions: LocationItem[];
    selectedLocations: LocationItem[];
    onAddLocation: (loc: LocationItem) => void;
    onRemoveLocation: (name: string) => void;
    geoWrapperRef: React.RefObject<HTMLDivElement | null>;
    getBadgeColor: (type: string) => string;

    onlyMobiliteIA: boolean;
    onToggleMobiliteIA: () => void;
    onlyIDF: boolean;
    onToggleIDF: () => void;
    ignoreRevendications: boolean;
    onToggleIgnoreRevendications: () => void;
    onlyFmdIkv: boolean;
    onToggleFmdIkv: () => void;
    onlyEffortRemboursement: boolean;
    onToggleEffortRemboursement: () => void;
    onlyPrimeCarburant: boolean;
    onTogglePrimeCarburant: () => void;
    onlyInfraVelo: boolean;
    onToggleInfraVelo: () => void;
    hasActiveFilters: boolean;
    onResetFilters: () => void;
}

const SidebarFilters: React.FC<SidebarFiltersProps> = (props) => {
    const {
        onCloseSidebar, datasetScope, onSwitchDataset, isLoading, activeFiltersCount,
        globalSearch, onGlobalSearchChange, measureSearch, onMeasureSearchChange, availableMeasures,
        sectionsNaf, selectedSectionNaf, onSectionNafChange, subSectors, selectedSubSector, onSubSectorChange,
        years, selectedYears, onSelectedYearsChange, geoInput, onGeoInputChange, showGeoSuggestions,
        onShowGeoSuggestionsChange, filteredGeoSuggestions, selectedLocations, onAddLocation, onRemoveLocation,
        geoWrapperRef, getBadgeColor, onlyMobiliteIA, onToggleMobiliteIA, onlyIDF, onToggleIDF,
        ignoreRevendications, onToggleIgnoreRevendications, onlyFmdIkv, onToggleFmdIkv,
        onlyEffortRemboursement, onToggleEffortRemboursement, onlyPrimeCarburant, onTogglePrimeCarburant,
        onlyInfraVelo, onToggleInfraVelo, hasActiveFilters, onResetFilters
    } = props;

    return (
        <aside className="w-full lg:w-96 flex-shrink-0 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200/80 dark:border-gray-700/80 p-4 sm:p-5 space-y-4 lg:sticky lg:top-4 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Header Sidebar */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                        <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filtres & Périmètre
                    </span>
                    {activeFiltersCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-[10px]">
                            {activeFiltersCount}
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onCloseSidebar}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition cursor-pointer"
                    title="Masquer le volet des filtres"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                </button>
            </div>

            {/* Bloc Périmètre Actif */}
            <div className="p-3 rounded-lg border bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-200 dark:border-indigo-800 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{datasetScope === 'IDF' ? '🗼' : '🇫🇷'}</span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                            {datasetScope === 'IDF' ? 'Île-de-France' : 'France Entière'}
                        </span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold uppercase">
                        {datasetScope === 'IDF' ? 'Rapide' : 'Exhaustif'}
                    </span>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-tight">
                    {datasetScope === 'IDF' 
                        ? 'Périmètre régional allégé (32 703 accords).' 
                        : 'Périmètre national complet (123 431 accords).'}
                </p>
                {datasetScope === 'IDF' ? (
                    <button
                        type="button"
                        onClick={() => onSwitchDataset('FRANCE')}
                        disabled={isLoading}
                        className="w-full py-1.5 px-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                        <span>🇫🇷 Charger France entière</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onSwitchDataset('IDF')}
                        disabled={isLoading}
                        className="w-full py-1.5 px-2 bg-white dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-md text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                        <span>🗼 Revenir à Île-de-France</span>
                    </button>
                )}
            </div>

            {/* Recherche Globale */}
            <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Recherche Globale
                </label>
                <input
                    type="text"
                    value={globalSearch}
                    onChange={e => onGlobalSearchChange(e.target.value)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                    placeholder="ID, SIRET, entreprise, mot-clé, texte..."
                />
            </div>

            {/* Mesure IDFM */}
            <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Mesure IDFM
                </label>
                <select
                    value={measureSearch}
                    onChange={e => onMeasureSearchChange(e.target.value)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                >
                    <option value="">Toutes les mesures IDFM ({availableMeasures.length})</option>
                    {availableMeasures.map((measure) => (
                        <option key={measure} value={measure}>
                            {measure}
                        </option>
                    ))}
                </select>
            </div>

            {/* Secteur d'activité macro (Section NAF) & Sous-secteur */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                        Secteur (Section NAF)
                    </label>
                    {selectedSectionNaf && (
                        <button
                            type="button"
                            onClick={() => {
                                onSectionNafChange('');
                                onSubSectorChange('');
                            }}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                        >
                            Effacer
                        </button>
                    )}
                </div>
                <select
                    value={selectedSectionNaf}
                    onChange={e => {
                        const val = e.target.value;
                        onSectionNafChange(val);
                        onSubSectorChange('');
                    }}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                >
                    <option value="">Toutes les sections NAF ({sectionsNaf.length})</option>
                    {sectionsNaf.map((sec) => (
                        <option key={sec} value={sec}>
                            {sec}
                        </option>
                    ))}
                </select>

                {selectedSectionNaf && subSectors.length > 0 && (
                    <div className="mt-2">
                        <label className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
                            ↳ Sous-secteur précis ({subSectors.length}) :
                        </label>
                        <select
                            value={selectedSubSector}
                            onChange={e => onSubSectorChange(e.target.value)}
                            className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-xs focus:border-indigo-500 focus:ring-indigo-500 text-xs bg-gray-50 dark:bg-gray-700/80 text-gray-900 dark:text-gray-200 py-1.5 px-2.5"
                        >
                            <option value="">Tous les sous-secteurs ({subSectors.length})</option>
                            {subSectors.map((sub) => (
                                <option key={sub} value={sub}>
                                    {sub}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {/* Années de signature */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                        Année(s) de signature
                    </label>
                    {selectedYears.length > 0 && (
                        <button
                            type="button"
                            onClick={() => onSelectedYearsChange([])}
                            className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                        >
                            Toutes ({selectedYears.length} sélec.)
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-1 p-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md min-h-[36px] items-center">
                    <button
                        type="button"
                        onClick={() => onSelectedYearsChange([])}
                        className={`px-2 py-0.5 rounded text-xs font-medium transition cursor-pointer ${
                            selectedYears.length === 0
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                        }`}
                    >
                        Toutes
                    </button>
                    {years.map((y) => {
                        const isSelected = selectedYears.includes(y);
                        return (
                            <button
                                key={y}
                                type="button"
                                onClick={() => {
                                    if (isSelected) {
                                        onSelectedYearsChange(selectedYears.filter(yr => yr !== y));
                                    } else {
                                        onSelectedYearsChange([...selectedYears, y].sort((a, b) => b - a));
                                    }
                                }}
                                className={`px-2 py-0.5 rounded text-xs font-medium transition flex items-center gap-1 cursor-pointer ${
                                    isSelected
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
                                }`}
                            >
                                {y}
                                {isSelected && <span className="text-[10px] leading-none opacity-80">✕</span>}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Territoire */}
            <div className="relative" ref={geoWrapperRef}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1">
                    Territoire (Région, Dép, EPCI, EPT)
                </label>
                <input
                    type="text"
                    value={geoInput}
                    onChange={e => {
                        onGeoInputChange(e.target.value);
                        onShowGeoSuggestionsChange(true);
                    }}
                    onFocus={() => onShowGeoSuggestionsChange(true)}
                    className="w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200 py-2 px-3"
                    placeholder={selectedLocations.length > 0 ? "Ajouter un lieu..." : "Ex: 75, Paris, Grand Paris..."}
                />
                {showGeoSuggestions && geoInput && (
                    <ul className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-700 shadow-xl max-h-56 rounded-md py-1 text-xs ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none">
                        {filteredGeoSuggestions.length > 0 ? filteredGeoSuggestions.map((loc, idx) => (
                            <li
                                key={loc.name + loc.type + idx}
                                className="text-gray-900 dark:text-gray-200 cursor-pointer select-none relative py-1.5 pl-3 pr-3 hover:bg-indigo-600 hover:text-white flex justify-between items-center"
                                onClick={() => onAddLocation(loc)}
                            >
                                <span className="truncate">{loc.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider ${getBadgeColor(loc.type)}`}>
                                    {loc.type}
                                </span>
                            </li>
                        )) : (
                            <li className="text-gray-500 dark:text-gray-400 cursor-default select-none relative py-1.5 pl-3 pr-3">
                                Aucun lieu trouvé
                            </li>
                        )}
                    </ul>
                )}
                {selectedLocations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedLocations.map((loc, idx) => (
                            <span key={loc.name + idx} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getBadgeColor(loc.type)}`}>
                                {loc.name}
                                <button
                                    type="button"
                                    onClick={() => onRemoveLocation(loc.name)}
                                    className="flex-shrink-0 ml-1 h-3.5 w-3.5 rounded-full inline-flex items-center justify-center opacity-60 hover:opacity-100 focus:outline-none cursor-pointer"
                                >
                                    ✕
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Interrupteurs / Toggles */}
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400">
                    Filtres Spécifiques
                </label>
                
                {/* Mobilité IA */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium" title="Filtre sur les accords où l'IA a validé la dimension mobilité">
                        🌿 Mobilités confirmées IA
                    </span>
                    <button 
                        type="button" 
                        className={`${onlyMobiliteIA ? 'bg-teal-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-5 w-9 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200`}
                        role="switch"
                        aria-checked={onlyMobiliteIA}
                        onClick={onToggleMobiliteIA}
                    >
                        <span aria-hidden="true" className={`${onlyMobiliteIA ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                </div>

                {/* IDF uniquement */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                        📍 Île-de-France uniquement
                    </span>
                    <button 
                        type="button" 
                        className={`${onlyIDF ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-5 w-9 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200`}
                        role="switch"
                        aria-checked={onlyIDF}
                        onClick={onToggleIDF}
                    >
                        <span aria-hidden="true" className={`${onlyIDF ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                </div>

                {/* Ignorer revendications */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium" title="Exclut les simples demandes syndicales non actées">
                        🚫 Ignorer revendications
                    </span>
                    <button 
                        type="button" 
                        className={`${ignoreRevendications ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-5 w-9 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200`}
                        role="switch"
                        aria-checked={ignoreRevendications}
                        onClick={onToggleIgnoreRevendications}
                    >
                        <span aria-hidden="true" className={`${ignoreRevendications ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                </div>

                {/* FMD / IKV */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium" title="Forfait Mobilités Durables ou Indemnité Kilométrique Vélo">
                        🚲 FMD / IKV en place
                    </span>
                    <button 
                        type="button" 
                        className={`${onlyFmdIkv ? 'bg-emerald-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-5 w-9 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200`}
                        role="switch"
                        aria-checked={onlyFmdIkv}
                        onClick={onToggleFmdIkv}
                    >
                        <span aria-hidden="true" className={`${onlyFmdIkv ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                </div>
                {/* Effort remboursement > 50% */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium" title="Prise en charge des transports publics supérieure au minimum légal">
                        📈 Remboursement TC &gt; 50%
                    </span>
                    <button 
                        type="button" 
                        className={`${onlyEffortRemboursement ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-5 w-9 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200`}
                        role="switch"
                        aria-checked={onlyEffortRemboursement}
                        onClick={onToggleEffortRemboursement}
                    >
                        <span aria-hidden="true" className={`${onlyEffortRemboursement ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                </div>

                {/* Prime carburant */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium" title="Prime carburant / chèque carburant accordé">
                        ⛽ Prime carburant
                    </span>
                    <button 
                        type="button" 
                        className={`${onlyPrimeCarburant ? 'bg-amber-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-5 w-9 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200`}
                        role="switch"
                        aria-checked={onlyPrimeCarburant}
                        onClick={onTogglePrimeCarburant}
                    >
                        <span aria-hidden="true" className={`${onlyPrimeCarburant ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                </div>

                {/* Infra vélo */}
                <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium" title="Infrastructures et équipements matériels vélo (abris, douches, casiers, bornes VAE...)">
                        🚲 Infra vélo
                    </span>
                    <button 
                        type="button" 
                        className={`${onlyInfraVelo ? 'bg-cyan-600' : 'bg-gray-200 dark:bg-gray-700'} relative inline-flex flex-shrink-0 h-5 w-9 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200`}
                        role="switch"
                        aria-checked={onlyInfraVelo}
                        onClick={onToggleInfraVelo}
                    >
                        <span aria-hidden="true" className={`${onlyInfraVelo ? 'translate-x-4' : 'translate-x-0'} pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition ease-in-out duration-200`}></span>
                    </button>
                </div>
            </div>

            {/* Reset Button */}
            {hasActiveFilters && (
                <button
                    type="button"
                    onClick={onResetFilters}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
                >
                    ✕ Réinitialiser tous les filtres
                </button>
            )}
        </aside>
    );
};

export default SidebarFilters;

