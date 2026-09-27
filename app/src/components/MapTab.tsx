import React, { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { Agreement } from "../types";

interface MapTabProps {
    agreements: Agreement[];
    onMarkerClick: (agreement: Agreement) => void;
}

const MapTab: React.FC<MapTabProps> = ({ agreements, onMarkerClick }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const clusterGroupRef = useRef<any>(null);

    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Initialize map if not already done
        if (!mapInstanceRef.current) {
            mapInstanceRef.current = L.map(mapContainerRef.current).setView([46.603354, 1.888334], 6); // Center of France

            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
            }).addTo(mapInstanceRef.current);
        }

        // Remove previous cluster layer if any
        if (clusterGroupRef.current && mapInstanceRef.current) {
            mapInstanceRef.current.removeLayer(clusterGroupRef.current);
            clusterGroupRef.current = null;
        }

        // Initialize marker cluster group with chunked loading for 10k+ points
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
                let bgClass = "background: linear-gradient(135deg, #4f46e5, #4338ca);";
                let size = 36;
                if (count > 500) {
                    bgClass = "background: linear-gradient(135deg, #7c3aed, #6d28d9);";
                    size = 46;
                } else if (count > 100) {
                    bgClass = "background: linear-gradient(135deg, #2563eb, #1d4ed8);";
                    size = 40;
                }
                const formattedCount = count > 999 ? (count / 1000).toFixed(1) + "k" : count;
                return L.divIcon({
                    html: `<div style="${bgClass} width: ${size}px; height: ${size}px; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; border: 2px solid white; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);">${formattedCount}</div>`,
                    className: "custom-cluster-icon",
                    iconSize: L.point(size, size)
                });
            }
        });

        clusterGroupRef.current = clusterGroup;

        // Collect all geolocated agreements without arbitrary 1000 limit
        const geocodedAgreements = agreements.filter(a => a.localisation_lat && a.localisation_lon);
        const markers: L.CircleMarker[] = [];

        geocodedAgreements.forEach(a => {
            if (a.localisation_lat && a.localisation_lon) {
                const isDurable = a.est_mobilites_durables === "Oui";
                const marker = L.circleMarker([a.localisation_lat, a.localisation_lon], {
                    radius: 5,
                    fillColor: isDurable ? "#10b981" : "#6366f1",
                    color: "#ffffff",
                    weight: 1.5,
                    opacity: 1,
                    fillOpacity: 0.85
                });

                marker.bindTooltip(`
                    <div style="font-family: inherit; min-width: 140px; padding: 2px;">
                        <div style="font-size: 12px; font-weight: 700; color: #1e1b4b; line-height: 1.2;">
                            ${a.RAISON_SOCIALE || "Établissement"}
                        </div>
                        <div style="font-size: 11px; color: #475569; margin-top: 3px;">
                            ${a.localisation_departement_nom ? a.localisation_departement_nom + " • " : ""}${a.mesures_ref_idfm || ""}
                        </div>
                        ${isDurable ? '<span style="display: inline-block; font-size: 10px; background: #d1fae5; color: #065f46; padding: 1px 6px; border-radius: 9999px; margin-top: 4px; font-weight: 600;">Mobilité Durable</span>' : ""}
                    </div>
                `, { direction: "top", offset: [0, -4] });

                marker.on("click", () => {
                    onMarkerClick(a);
                });

                markers.push(marker);
            }
        });

        clusterGroup.addLayers(markers);
        mapInstanceRef.current.addLayer(clusterGroup);

        // Adjust view to fit markers if there are any
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

    }, [agreements, onMarkerClick]);

    const totalGeocoded = agreements.filter(a => a.localisation_lat && a.localisation_lon).length;

    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-1 h-[600px] flex flex-col relative z-0">
            {/* Legend & Counter Badge */}
            <div className="absolute top-4 right-4 z-[1000] bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-gray-200/80 dark:border-gray-700 text-xs flex flex-col gap-1.5 max-w-xs">
                <div className="font-bold text-gray-900 dark:text-gray-100 flex items-center justify-between gap-3">
                    <span>Établissements géolocalisés</span>
                    <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-mono text-xs">
                        {totalGeocoded.toLocaleString("fr-FR")}
                    </span>
                </div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Agrégation dynamique par clusters de points. Zoomez pour explorer par site.
                </div>
                <div className="flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-gray-700 text-[11px]">
                    <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white inline-block"></span>
                        <span className="text-gray-600 dark:text-gray-300">Mobilité durable</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 border border-white inline-block"></span>
                        <span className="text-gray-600 dark:text-gray-300">Autre mesure</span>
                    </div>
                </div>
            </div>
            <div ref={mapContainerRef} className="w-full h-full rounded-lg" />
        </div>
    );
};

export default MapTab;
