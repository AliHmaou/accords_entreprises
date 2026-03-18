
import React, { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import { Agreement } from '../types';

interface MapTabProps {
    agreements: Agreement[];
    onMarkerClick: (agreement: Agreement) => void;
}

const MapTab: React.FC<MapTabProps> = ({ agreements, onMarkerClick }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const markersLayerRef = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Initialize map if not already done
        if (!mapInstanceRef.current) {
            mapInstanceRef.current = L.map(mapContainerRef.current).setView([46.603354, 1.888334], 6); // Center of France

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(mapInstanceRef.current);

            markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
        }

        // FIX: Force map resize recalculation to prevent partial rendering (gray tiles)
        // This is necessary because the map might initialize inside a hidden/animating tab
        setTimeout(() => {
            mapInstanceRef.current?.invalidateSize();
        }, 200);

        // Update markers
        if (markersLayerRef.current) {
            markersLayerRef.current.clearLayers();

            const markers: L.Marker[] = [];
            // Limit markers to prevent browser freeze if too many points
            const dataToRender = agreements.filter(a => a.localisation_lat && a.localisation_lon).slice(0, 1000); 

            dataToRender.forEach(a => {
                if (a.localisation_lat && a.localisation_lon) {
                    const marker = L.marker([a.localisation_lat, a.localisation_lon], {
                        // Create a simple icon
                        icon: L.divIcon({
                            className: 'custom-div-icon',
                            html: `<div style="background-color: #4f46e5; width: 10px; height: 10px; border-radius: 50%; border: 1px solid white; cursor: pointer;"></div>`,
                            iconSize: [10, 10],
                            iconAnchor: [5, 5]
                        })
                    });

                    // Add tooltip on hover
                    marker.bindTooltip(`
                        <div class="font-sans text-xs font-semibold text-indigo-700">
                            ${a.RAISON_SOCIALE}
                        </div>
                    `, { direction: 'top', offset: [0, -5] });

                    // Click event to open the main details modal
                    marker.on('click', () => {
                        onMarkerClick(a);
                    });

                    markers.push(marker);
                    markersLayerRef.current?.addLayer(marker);
                }
            });

            // Adjust view to fit markers if there are any
            // We also delay this slightly to ensure the map size is correct before fitting bounds
            if (markers.length > 0 && mapInstanceRef.current) {
                 const group = L.featureGroup(markers);
                 setTimeout(() => {
                     mapInstanceRef.current?.fitBounds(group.getBounds(), { padding: [50, 50] });
                 }, 250);
            }
        }

    }, [agreements, onMarkerClick]);

    return (
        <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-1 h-[600px] flex flex-col relative z-0">
             <div className="absolute top-4 right-4 z-[1000] bg-white/90 dark:bg-gray-800/90 p-2 rounded shadow text-xs">
                {agreements.filter(a => a.localisation_lat).length > 1000 
                    ? `Affichage limité aux 1000 premiers établissements géolocalisés sur ${agreements.length} résultats.`
                    : `${agreements.filter(a => a.localisation_lat).length} établissements géolocalisés.`
                }
            </div>
            <div ref={mapContainerRef} className="w-full h-full rounded-lg" />
        </div>
    );
};

export default MapTab;
