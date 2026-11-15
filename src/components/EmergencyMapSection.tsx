import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Navigation,
  PhoneCall,
  ExternalLink,
  Building2,
  ShieldAlert,
  HeartPulse,
  Pill,
  Search,
  Compass,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { CountryEmergencyData, formatTelHref } from '../lib/emergencyData';
import {
  EmergencyFacility,
  getFacilitiesForLocation,
  calculateDistanceKm,
  formatDistance,
} from '../lib/emergencyFacilities';

interface EmergencyMapSectionProps {
  selectedCountry: CountryEmergencyData;
}

type FacilityCategory = 'hospital' | 'police' | 'pharmacy' | 'doctor';

const FACILITY_TYPES: {
  id: FacilityCategory;
  label: string;
  pinColor: string;
  bgBadge: string;
  borderColor: string;
}[] = [
  {
    id: 'hospital',
    label: 'Hospitals & Emergency Rooms',
    pinColor: '#EF4444',
    bgBadge: 'bg-red-500/20 text-red-300 border-red-500/40',
    borderColor: '#991B1B',
  },
  {
    id: 'police',
    label: 'Police Stations & Control',
    pinColor: '#3B82F6',
    bgBadge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    borderColor: '#1D4ED8',
  },
  {
    id: 'pharmacy',
    label: '24h Emergency Pharmacies',
    pinColor: '#10B981',
    bgBadge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderColor: '#047857',
  },
  {
    id: 'doctor',
    label: 'First-Aid & Clinics',
    pinColor: '#F59E0B',
    bgBadge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderColor: '#B45309',
  },
];

function getFacilityIcon(type: FacilityCategory, className = 'h-4 w-4') {
  switch (type) {
    case 'hospital':
      return <HeartPulse className={`${className} text-red-400`} />;
    case 'police':
      return <ShieldAlert className={`${className} text-blue-400`} />;
    case 'pharmacy':
      return <Pill className={`${className} text-emerald-400`} />;
    case 'doctor':
      return <Building2 className={`${className} text-amber-400`} />;
  }
}

// Generate inline SVG icon for Leaflet DivIcon
function createFacilityDivIcon(type: FacilityCategory, isSelected: boolean) {
  let color = '#EF4444';
  let svgPath = '';

  if (type === 'hospital') {
    color = '#EF4444';
    // Heart pulse
    svgPath =
      '<path fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>';
  } else if (type === 'police') {
    color = '#3B82F6';
    // Shield
    svgPath =
      '<path fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>';
  } else if (type === 'pharmacy') {
    color = '#10B981';
    // Pill
    svgPath =
      '<path fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8.5 8.5 7 7"/>';
  } else {
    color = '#F59E0B';
    // Building
    svgPath =
      '<path fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>';
  }

  const size = isSelected ? 42 : 34;
  const html = `
    <div style="
      width: ${size}px;
      height: ${size}px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: ${color};
      border: 2px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      cursor: pointer;
      transform: translate(-50%, -50%);
      transition: transform 0.2s ease;
    ">
      <svg width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24">
        ${svgPath}
      </svg>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-emergency-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function createUserLocationDivIcon() {
  const html = `
    <div style="
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #06B6D4;
      border: 3px solid #FFFFFF;
      border-radius: 50%;
      box-shadow: 0 0 16px #06B6D4, 0 4px 12px rgba(0,0,0,0.6);
      transform: translate(-50%, -50%);
    ">
      <div style="width: 6px; height: 6px; background: #FFFFFF; border-radius: 50%;"></div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'custom-user-location-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export const EmergencyMapSection: React.FC<EmergencyMapSectionProps> = ({
  selectedCountry,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [facilityType, setFacilityType] = useState<FacilityCategory>('hospital');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: selectedCountry.coordinates.lat,
    lng: selectedCountry.coordinates.lng,
  });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<EmergencyFacility | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);
  const [searchLocationQuery, setSearchLocationQuery] = useState<string>('');
  const [isSearchingLocation, setIsSearchingLocation] = useState<boolean>(false);

  const activeCategoryMeta =
    FACILITY_TYPES.find((f) => f.id === facilityType) || FACILITY_TYPES[0];
  const primaryUniversal = selectedCountry.universal[0];

  // Derive verified facilities for active location and category
  const facilities: EmergencyFacility[] = useMemo(() => {
    const centerPoint = userLocation || mapCenter;
    return getFacilitiesForLocation(
      selectedCountry.code,
      facilityType,
      centerPoint.lat,
      centerPoint.lng
    );
  }, [selectedCountry.code, facilityType, mapCenter.lat, mapCenter.lng, userLocation]);

  // Sync map center when selected country changes
  useEffect(() => {
    const nextCenter = {
      lat: selectedCountry.coordinates.lat,
      lng: selectedCountry.coordinates.lng,
    };
    setMapCenter(nextCenter);
    setSelectedFacility(null);
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([nextCenter.lat, nextCenter.lng], 12);
    }
  }, [selectedCountry.code]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (leafletMapRef.current) return;

    // Use CartoDB Dark Matter / Voyager tiles for sleek dark emergency UI
    const map = L.map(mapContainerRef.current, {
      center: [mapCenter.lat, mapCenter.lng],
      zoom: 12,
      zoomControl: false,
    });

    L.control
      .zoom({
        position: 'bottomright',
      })
      .addTo(map);

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(map);

    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;
    leafletMapRef.current = map;

    // Invalidate size to guarantee tiles render properly
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      leafletMapRef.current = null;
      markersLayerRef.current = null;
      userMarkerRef.current = null;
    };
  }, []);

  // Update Markers when facilities or selected facility changes
  useEffect(() => {
    const map = leafletMapRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    // User or Reference Location Marker
    if (userLocation) {
      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: createUserLocationDivIcon(),
      }).bindPopup(
        `<div style="font-family: inherit; font-size: 12px; color: #1E293B;">
          <strong>Your Current Location</strong><br/>
          <span style="color: #64748B;">GPS Active</span>
        </div>`
      );
      userMarker.addTo(markersLayer);
      userMarkerRef.current = userMarker;
    }

    // Facility Markers
    facilities.forEach((fac) => {
      const isSelected = selectedFacility?.id === fac.id;
      const marker = L.marker([fac.lat, fac.lng], {
        icon: createFacilityDivIcon(fac.category, isSelected),
      });

      const distText = formatDistance(fac.distanceKm);
      const telLink = fac.phoneNumber ? formatTelHref(fac.phoneNumber) : '#';
      const gmapsLink = `https://www.google.com/maps/dir/?api=1&destination=${fac.lat},${fac.lng}`;

      const popupHtml = `
        <div style="font-family: system-ui, sans-serif; min-width: 220px; max-width: 280px; padding: 4px; color: #0F172A;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: ${activeCategoryMeta.pinColor}; margin-bottom: 2px;">
            ${activeCategoryMeta.label}
          </div>
          <div style="font-size: 14px; font-weight: 700; line-height: 1.3; margin-bottom: 4px;">
            ${fac.name}
          </div>
          ${distText ? `<div style="font-size: 11px; font-weight: 600; color: #0284C7; margin-bottom: 4px;">📍 ${distText}</div>` : ''}
          <div style="font-size: 11px; color: #475569; line-height: 1.4; margin-bottom: 8px;">
            ${fac.address}
          </div>
          <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; border-top: 1px solid #E2E8F0; padding-top: 6px;">
            ${
              fac.phoneNumber
                ? `<a href="${telLink}" style="flex: 1; text-align: center; background: #DC2626; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 6px 8px; border-radius: 6px; text-decoration: none;">📞 Call ${fac.phoneNumber}</a>`
                : ''
            }
            <a href="${gmapsLink}" target="_blank" rel="noopener noreferrer" style="flex: 1; text-align: center; background: #0F172A; color: #FFFFFF; font-size: 11px; font-weight: 600; padding: 6px 8px; border-radius: 6px; text-decoration: none;">🗺 Directions</a>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        setSelectedFacility(fac);
      });

      marker.addTo(markersLayer);

      if (isSelected) {
        marker.openPopup();
      }
    });

    map.invalidateSize();
  }, [facilities, selectedFacility?.id, userLocation, activeCategoryMeta]);

  // Center on User GPS Location
  const handleLocateMeOnMap = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatusMessage('Browser geolocation is not supported on this device.');
      return;
    }

    setIsLocatingUser(true);
    setStatusMessage('Acquiring live GPS coordinates...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
        setMapCenter(coords);
        setIsLocatingUser(false);
        setStatusMessage(
          `Centered on your live GPS location (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}). Facilities sorted by nearest proximity.`
        );

        if (leafletMapRef.current) {
          leafletMapRef.current.setView([coords.lat, coords.lng], 13, {
            animate: true,
          });
        }
      },
      () => {
        setIsLocatingUser(false);
        setStatusMessage(
          `Location permission declined or unavailable. Showing ${selectedCountry.country} regional center.`
        );
      },
      { timeout: 7000 }
    );
  };

  // Search any city / address via OpenStreetMap Nominatim Free Geocoder
  const handleSearchCity = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchLocationQuery.trim();
    if (!query) return;

    setIsSearchingLocation(true);
    setStatusMessage(`Searching for location "${query}"...`);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=${selectedCountry.code.toLowerCase()}&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
          },
        }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const hit = data[0];
        const newCenter = {
          lat: parseFloat(hit.lat),
          lng: parseFloat(hit.lon),
        };
        setMapCenter(newCenter);
        setStatusMessage(`Panned to ${hit.display_name.split(',')[0]} (${newCenter.lat.toFixed(4)}, ${newCenter.lng.toFixed(4)}).`);
        if (leafletMapRef.current) {
          leafletMapRef.current.setView([newCenter.lat, newCenter.lng], 13, {
            animate: true,
          });
        }
      } else {
        setStatusMessage(`No matches found for "${query}" in ${selectedCountry.country}. Try another landmark or city.`);
      }
    } catch {
      setStatusMessage(`Unable to geocode "${query}". Showing regional center.`);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  const handleSelectFacilityFromList = (fac: EmergencyFacility) => {
    setSelectedFacility(fac);
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([fac.lat, fac.lng], 15, {
        animate: true,
      });
    }
  };

  return (
    <section
      id="nearby-map"
      aria-labelledby="nearby-map-heading"
      className="scroll-mt-20 py-10 border-t border-white/[0.08] space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-0.5 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span>Interactive Emergency Facility Finder Active</span>
            <span aria-hidden="true" className="text-white/20">·</span>
            <span>{selectedCountry.flag} {selectedCountry.country}</span>
          </div>

          <h2
            id="nearby-map-heading"
            className="font-display text-2xl sm:text-3xl font-bold text-white"
          >
            Nearby Emergency Facilities & Responders
          </h2>
          <p className="text-sm text-slate-300">
            Locate verified trauma hospitals, police command units, 24-hour pharmacies, and medical clinics around{' '}
            {selectedCountry.country} or your live GPS coordinates. In any life-threatening situation, always call{' '}
            <strong className="text-white">{primaryUniversal.number}</strong> first.
          </p>
        </div>

        {/* Location & Call Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleLocateMeOnMap}
            disabled={isLocatingUser}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11131C] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-cyan-500/50 hover:text-white transition-colors whitespace-nowrap shadow-sm"
          >
            <Navigation className="h-3.5 w-3.5 text-cyan-400" />
            <span>{isLocatingUser ? 'Locating...' : 'Center on My GPS Location'}</span>
          </button>

          <a
            href={formatTelHref(primaryUniversal.number)}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap shadow-md"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Call {primaryUniversal.number} Dispatch</span>
          </a>
        </div>
      </div>

      {/* City/Address Search Bar & Facility Filter Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Facility Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Select nearby emergency facility type"
          className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#11131C] p-1.5"
        >
          {FACILITY_TYPES.map((ft) => {
            const isSelected = facilityType === ft.id;
            return (
              <button
                key={ft.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => {
                  setFacilityType(ft.id);
                  setSelectedFacility(null);
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {getFacilityIcon(ft.id)}
                <span>{ft.label}</span>
              </button>
            );
          })}
        </div>

        {/* City / Landmark Search Box */}
        <form
          onSubmit={handleSearchCity}
          className="relative flex items-center w-full md:w-80"
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchLocationQuery}
            onChange={(e) => setSearchLocationQuery(e.target.value)}
            placeholder={`Jump to city (e.g. Delhi, Mumbai, London)...`}
            className="w-full rounded-xl border border-white/10 bg-[#11131C] pl-9 pr-16 py-2 text-xs text-white placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isSearchingLocation}
            className="absolute right-1.5 rounded-lg bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-white/20 transition-colors"
          >
            {isSearchingLocation ? '...' : 'Go'}
          </button>
        </form>
      </div>

      {/* Interactive Map + Nearby Facilities Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Map View */}
        <div className="lg:col-span-8 overflow-hidden rounded-2xl border border-white/10 bg-[#11131C] shadow-xl flex flex-col">
          <div
            data-testid="emergency-interactive-map"
            ref={mapContainerRef}
            className="relative h-[440px] w-full z-0"
          />

          {/* Map Status Bar */}
          <div className="border-t border-white/[0.08] bg-[#0A0D15] px-4 py-2.5 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>
                {statusMessage ||
                  `Displaying ${facilities.length} verified ${activeCategoryMeta.label} in ${selectedCountry.country}. Click any pin to view emergency details.`}
              </span>
            </div>
            <div className="font-mono-tabular text-slate-400 text-[11px] shrink-0">
              Center: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
            </div>
          </div>
        </div>

        {/* Right Sidebar List of Verified Emergency Locations */}
        <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-[#11131C] p-4 flex flex-col justify-between shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                {getFacilityIcon(facilityType)}
                <h3 className="font-display text-sm font-bold text-white">
                  {activeCategoryMeta.label}
                </h3>
              </div>
              <span className="font-mono-tabular text-xs font-semibold text-cyan-300 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                {facilities.length} Verified
              </span>
            </div>

            <div className="max-h-[340px] space-y-2.5 overflow-y-auto pr-1">
              {facilities.map((fac) => {
                const isSelected = selectedFacility?.id === fac.id;
                const distanceStr = formatDistance(fac.distanceKm);

                return (
                  <div
                    key={fac.id}
                    className={`rounded-xl border p-3 transition-all ${
                      isSelected
                        ? 'border-red-500/70 bg-[#191D2C] ring-1 ring-red-500/50'
                        : 'border-white/[0.06] bg-[#090A0F]/80 hover:border-white/20'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectFacilityFromList(fac)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-xs text-white leading-snug">
                          {fac.name}
                        </div>
                        {distanceStr && (
                          <span className="font-mono-tabular text-[10px] font-semibold text-cyan-300 whitespace-nowrap bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-500/30">
                            {distanceStr}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 text-[11px] text-slate-300 line-clamp-2">
                        {fac.address}
                      </div>

                      {fac.hours && (
                        <div className="mt-1 text-[10px] text-amber-300/90 font-medium">
                          🕒 {fac.hours}
                        </div>
                      )}
                    </button>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.06]">
                      {fac.phoneNumber && (
                        <a
                          href={formatTelHref(fac.phoneNumber)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-500 transition-colors"
                        >
                          <PhoneCall className="h-3 w-3" />
                          <span>Call {fac.phoneNumber}</span>
                        </a>
                      )}

                      <a
                        href={
                          fac.googleMapsURI ||
                          `https://www.google.com/maps/dir/?api=1&destination=${fac.lat},${fac.lng}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white transition-colors"
                      >
                        <span>Directions</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                );
              })}

              {facilities.length === 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-[#090A0F]/60 p-4 text-xs text-slate-400 space-y-2">
                  <p>
                    No emergency facilities listed for this specific filter.
                  </p>
                  <p className="text-slate-300">
                    For immediate emergency dispatch in {selectedCountry.country}, dial{' '}
                    <strong className="text-white">{primaryUniversal.number}</strong>.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400 leading-relaxed">
            Emergency locator powered by OpenStreetMap and verified national dispatch data. Not a substitute for official 112 emergency routing.
          </div>
        </div>
      </div>
    </section>
  );
};
