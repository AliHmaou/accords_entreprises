import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { Agreement } from '../types';

interface MapTabProps {
    agreements: Agreement[];
    onMarkerClick: (agreement: Agreement) => void;
    onSwitchToMeasures?: (companyName: string) => void;
}

export interface Establishment {
    key: string;
    siret: string;
    raisonSociale: string;
    lat: number;
    lon: number;
    departement: string;
    departementCode: string;
    region: string;
    epci: string;
    ept: string;
    categorieEntreprise: string;
    measures: Agreement[];
    uniqueAgreementsCount: number;
    hasDurable: boolean;
    hasFmdIkv: boolean;
    hasSupLegal: boolean;
}

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

const MapTab: React.FC<MapTabProps> = ({ agreements, onMarkerClick, onSwitchToMeasures }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const clusterGroupRef = useRef<any>(null);

    const [selectedEstablishment, setSelectedEstablishment] = useState<Establishment | null>(null);

    // 1. Group agreements by physical establishment (SIRET or name + coordinates)
    const establishments = useMemo(() => {
        const map = new Map<string, Establishment>();

        agreements.forEach(a => {
            if (!a.localisation_lat || !a.localisation_lon) return;

            const key = a.SIRET && a.SIRET.trim() !== ''
                ? a.SIRET.trim()
                : `${(a.RAISON_SOCIALE || '').trim()}_${a.localisation_lat.toFixed(4)}_${a.localisation_lon.toFixed(4)}`;

            const isDurable = a.est_mobilites_durables === 'Oui';
            const isFmdIkv = a.est_fmd_ikv_mis_en_place === 'Oui';
            const isSupLegal = a.est_superieur_taux_legal === 'Oui';

            const existing = map.get(key);
            if (existing) {
                existing.measures.push(a);
                if (isDurable) existing.hasDurable = true;
                if (isFmdIkv) existing.hasFmdIkv = true;
                if (isSupLegal) existing.hasSupLegal = true;
            } else {
                map.set(key, {
                    key,
                    siret: a.SIRET || '',
                    raisonSociale: a.RAISON_SOCIALE || 'Entreprise / Établissement',
                    lat: a.localisation_lat,
                    lon: a.localisation_lon,
                    departement: a.localisation_departement_nom || '',
                    departementCode: a.localisation_departement_code || '',
                    region: a.localisation_region_nom || '',
                    epci: a.localisation_epci_nom || '',
                    ept: a.localisation_ept_nom || '',
                    categorieEntreprise: a.categorie_entreprise || '',
                    measures: [a],
                    uniqueAgreementsCount: 0,
                    hasDurable: isDurable,
                    hasFmdIkv: isFmdIkv,
                    hasSupLegal: isSupLegal
                });
            }
        });

        // Compute unique agreements count per establishment
        map.forEach(est => {
            const uniqueIds = new Set(est.measures.map(m => m.ID).filter(Boolean));
            est.uniqueAgreementsCount = uniqueIds.size || est.measures.length;
        });

        return Array.from(map.values());
    }, [agreements]);

    // 2. Render markers on Leaflet
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Initialize map if not already done
        if (!mapInstanceRef.current) {
            mapInstanceRef.current = L.map(mapContainerRef.current).setView([46.603354, 1.888334], 6); // Center of France

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstanceRef.current);
        }

        // Clear existing cluster group
        if (clusterGroupRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(clusterGroupRef.current);
            clusterGroupRef.current = null;
        }

        // Initialize marker cluster group
        const clusterGroup = (L as any).markerClusterGroup({
            chunkedLoading: true,
            chunkInterval: 100,
            chunkDelay: 10,
            maxClusterRadius: 45,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            removeOutsideVisibleBounds: true,
            disableClusteringAtZoom: 16,
            iconCreateFunction: (cluster: any) => {
                const count = cluster.getChildCount();
                let bgClass = 'background: linear-gradient(135deg, #4f46e5, #4338ca);';
                let size = 36;
                if (count > 500) {
                    bgClass = 'background: linear-gradient(135deg, #7c3aed, #6d28d9);';
                    size = 46;
                } else if (count > 100) {
                    bgClass = 'background: linear-gradient(135deg, #2563eb, #1d4ed8);';
                    size = 40;
                }
                const formattedCount = count > 999 ? (count / 1000).toFixed(1) + 'k' : count;
                return L.divIcon({
                    html: `<div style="${bgClass} width: ${size}px; height: ${size}px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">${formattedCount}</div>`,
                    className: 'custom-cluster-icon',
                    iconSize: L.point(size, size)
                });
            }
        });

        clusterGroupRef.current = clusterGroup;

        // Create 1 marker PER ESTABLISHMENT (no overlapping markers)
        const markers: L.CircleMarker[] = [];

        establishments.forEach(est => {
            const marker = L.circleMarker([est.lat, est.lon], {
                radius: 6,
                fillColor: est.hasDurable ? '#10b981' : '#6366f1',
                color: '#ffffff',
                weight: 1.5,
                opacity: 1,
                fillOpacity: 0.9
            });

            // Tooltip on hover
            marker.bindTooltip(`
                <div style="font-family: inherit; min-width: 160px; padding: 4px;">
                    <div style="font-size: 13px; font-weight: 700; color: #1e1b4b; line-height: 1.2;">
                        🏢 ${est.raisonSociale}
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 3px;">
                        ${est.departement ? est.departement + (est.departementCode ? ' (' + est.departementCode + ')' : '') : ''}
                        ${est.epci ? ' • ' + est.epci : ''}
                    </div>
                    <div style="font-size: 11px; font-weight: 600; color: #4338ca; margin-top: 4px;">
                        📄 ${est.uniqueAgreementsCount} accord(s) • 🎯 ${est.measures.length} mesure(s)
                    </div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 5px;">
                        ${est.hasDurable ? '<span style="font-size: 10px; background: #d1fae5; color: #065f46; padding: 1px 6px; border-radius: 9999px; font-weight: 600;">Mobilité Durable</span>' : ''}
                        ${est.hasFmdIkv ? '<span style="font-size: 10px; background: #f3e8ff; color: #6b21a8; padding: 1px 6px; border-radius: 9999px; font-weight: 600;">FMD/IKV</span>' : ''}
                        ${est.hasSupLegal ? '<span style="font-size: 10px; background: #e0e7ff; color: #3730a3; padding: 1px 6px; border-radius: 9999px; font-weight: 600;">TC &gt; 50%</span>' : ''}
                    </div>
                    <div style="font-size: 10px; color: #4f46e5; margin-top: 6px; font-weight: 600; border-top: 1px dashed #e2e8f0; padding-top: 4px;">
                        ➔ Cliquer pour ouvrir la liste des mesures
                    </div>
                </div>
            `, { direction: 'top', offset: [0, -5] });

            // On click: open the establishment modal with its list of measures
            marker.on('click', () => {
                setSelectedEstablishment(est);
            });

            markers.push(marker);
        });

        clusterGroup.addLayers(markers);
        mapInstanceRef.current.addLayer(clusterGroup);

        // Adjust view to fit markers
        if (markers.length > 0) {
            const bounds = clusterGroup.getBounds();
            if (bounds.isValid()) {
                setTimeout(() => {
                    mapInstanceRef.current?.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
                }, 200);
            }
        }

        setTimeout(() => {
            mapInstanceRef.current?.invalidateSize();
        }, 200);

    }, [establishments]);

    const totalGeocodedMeasures = agreements.filter(a => a.localisation_lat && a.localisation_lon).length;

    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-1 h-[600px] flex flex-col relative z-0">
            {/* Legend & Counter Badge */}
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-200/80 dark:border-gray-700 text-xs flex flex-col gap-1.5 max-w-xs">
                <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between gap-3">
                    <span>Établissements sur la carte</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold">
                        {establishments.length.toLocaleString('fr-FR')}
                    </span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    1 point = 1 établissement unique ({totalGeocodedMeasures.toLocaleString('fr-FR')} mesures associées).
                </div>
                <div className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                    💡 Cliquez sur un site pour ouvrir sa liste de mesures.
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-gray-700 text-[11px]">
                    <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white inline-block"></span>
                        <span className="text-gray-600 dark:text-gray-300">Mobilité durable actée</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white inline-block"></span>
                        <span className="text-gray-600 dark:text-gray-300">Autre accord</span>
                    </div>
                </div>
            </div>

            <div ref={mapContainerRef} className="w-full h-full rounded-lg" />

            {/* MODAL: Liste des mesures restreinte à l'établissement cliqué */}
            {selectedEstablishment && (
                <div 
                    className="fixed inset-0 bg-black/60 z-[1050] flex justify-center items-center p-4 backdrop-blur-sm"
                    onClick={() => setSelectedEstablishment(null)}
                >
                    <div 
                        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="p-4 bg-slate-50 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-bold text-gray-900 dark:text-white">
                                        🏢 {selectedEstablishment.raisonSociale}
                                    </span>
                                    {selectedEstablishment.categorieEntreprise && (
                                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                            {selectedEstablishment.categorieEntreprise}
                                        </span>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {selectedEstablishment.siret && (
                                        <span className="font-mono bg-white dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700">
                                            SIRET: {selectedEstablishment.siret}
                                        </span>
                                    )}
                                    <span>
                                        📍 {selectedEstablishment.departement ? selectedEstablishment.departement + (selectedEstablishment.departementCode ? ' (' + selectedEstablishment.departementCode + ')' : '') : 'Non spécifié'}
                                        {selectedEstablishment.epci ? ' • ' + selectedEstablishment.epci : ''}
                                        {selectedEstablishment.ept ? ' • ' + selectedEstablishment.ept : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {onSwitchToMeasures && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const company = selectedEstablishment.raisonSociale;
                                            setSelectedEstablishment(null);
                                            onSwitchToMeasures(company);
                                        }}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 transition flex items-center gap-1.5"
                                    >
                                        <span>Voir dans l'onglet Mesures & Accords</span>
                                        <span className="text-sm">➔</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setSelectedEstablishment(null)}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                                >
                                    <span className="text-xl leading-none">✕</span>
                                </button>
                            </div>
                        </div>

                        {/* Summary Bar */}
                        <div className="px-4 py-2 bg-indigo-50/50 dark:bg-indigo-950/20 border-b border-indigo-100 dark:border-indigo-900/30 flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-medium">
                                <span>📄 <strong>{selectedEstablishment.uniqueAgreementsCount}</strong> accord(s) collectif(s)</span>
                                <span>•</span>
                                <span>🎯 <strong>{selectedEstablishment.measures.length}</strong> mesure(s) identifiée(s)</span>
                            </div>
                            <div className="text-slate-500 dark:text-slate-400 italic">
                                💡 Cliquez sur une mesure pour afficher son analyse détaillée & texte intégral
                            </div>
                        </div>

                        {/* Modal Body: Table of measures for this establishment */}
                        <div className="overflow-y-auto p-4 flex-1">
                            <table className="min-w-full text-left text-xs border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                <thead className="bg-gray-100 dark:bg-gray-700/80 text-gray-700 dark:text-gray-200 uppercase text-[10px] tracking-wider font-bold">
                                    <tr>
                                        <th className="py-2.5 px-3">Date Signature</th>
                                        <th className="py-2.5 px-3">Accord & Titre</th>
                                        <th className="py-2.5 px-3">Mesure Référentiel IDFM</th>
                                        <th className="py-2.5 px-3">Mesure Extraite (IA)</th>
                                        <th className="py-2.5 px-3 text-center">Dispositifs</th>
                                        <th className="py-2.5 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                                    {selectedEstablishment.measures.map((m, idx) => {
                                        const isDurable = m.est_mobilites_durables === 'Oui';
                                        const isFmd = m.est_fmd_ikv_mis_en_place === 'Oui';
                                        const isSup50 = m.est_superieur_taux_legal === 'Oui';
                                        const isRevendication = m.est_revendication === 'Oui';

                                        return (
                                            <tr 
                                                key={(m.ID || '') + idx}
                                                onClick={() => onMarkerClick(m)}
                                                className="hover:bg-indigo-50/60 dark:hover:bg-gray-700/60 cursor-pointer transition group"
                                            >
                                                {/* Date */}
                                                <td className="py-2.5 px-3 whitespace-nowrap font-medium text-gray-600 dark:text-gray-300">
                                                    {formatDate(m.DATE_TEXTE) || formatDate(m.DATE_DEPOT) || 'N/A'}
                                                </td>

                                                {/* Titre Accord */}
                                                <td className="py-2.5 px-3 max-w-xs">
                                                    <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                                                        {m.TITRE_TXT || "Accord d'entreprise"}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                                                        ID: {m.ID}
                                                    </div>
                                                </td>

                                                {/* Mesure IDFM */}
                                                <td className="py-2.5 px-3">
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                                        {m.mesures_ref_idfm || 'Non classifié'}
                                                    </span>
                                                    {m.theme_recherche && (
                                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                                            Mot-clé: <span className="font-medium text-gray-600 dark:text-gray-300">{m.theme_recherche}</span>
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Mesure Extraite */}
                                                <td className="py-2.5 px-3 max-w-sm">
                                                    <div className="text-gray-700 dark:text-gray-300 line-clamp-2">
                                                        {m.mesure_extraite || m.resume_mesure_proposee || "Mesure renseignée dans l'accord."}
                                                    </div>
                                                </td>

                                                {/* Badges Dispositifs */}
                                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                    <div className="flex items-center justify-center gap-1 flex-wrap">
                                                        {isDurable && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" title="Mobilité durable confirmée">
                                                                🌿 Durable
                                                            </span>
                                                        )}
                                                        {isFmd && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300" title="Forfait Mobilités Durables ou IKV acté">
                                                                🚲 FMD/IKV
                                                            </span>
                                                        )}
                                                        {isSup50 && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" title="Prise en charge transports publics > 50%">
                                                                🚆 &gt;50%
                                                            </span>
                                                        )}
                                                        {isRevendication && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title="Revendication syndicale">
                                                                ⚠️ Revendic.
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Action */}
                                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onMarkerClick(m);
                                                        }}
                                                        className="px-2 py-1 rounded bg-indigo-600 text-white font-medium text-[11px] hover:bg-indigo-700 shadow-xs transition"
                                                    >
                                                        Voir détail ➔
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs text-gray-500">
                            <div>
                                {selectedEstablishment.measures.length} mesure(s) pour cet établissement
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedEstablishment(null)}
                                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition"
                            >
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapTab;
