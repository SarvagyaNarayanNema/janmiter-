import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
  Pin,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Navigation,
  PhoneCall,
  ExternalLink,
  Building2,
  ShieldAlert,
  HeartPulse,
  Pill,
} from 'lucide-react';
import { CountryEmergencyData, formatTelHref } from '../lib/emergencyData';

interface EmergencyMapSectionProps {
  selectedCountry: CountryEmergencyData;
}

type FacilityCategory = 'hospital' | 'police' | 'pharmacy' | 'doctor';

interface NearbyFacility {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  phoneNumber?: string;
  googleMapsURI?: string;
  rating?: number;
}

const FACILITY_TYPES: {
  id: FacilityCategory;
  label: string;
  pinColor: string;
  borderColor: string;
}[] = [
  {
    id: 'hospital',
    label: 'Hospitals & Emergency Rooms',
    pinColor: '#EF4444',
    borderColor: '#991B1B',
  },
  {
    id: 'police',
    label: 'Police Stations',
    pinColor: '#3B82F6',
    borderColor: '#1D4ED8',
  },
  {
    id: 'pharmacy',
    label: '24h Pharmacies',
    pinColor: '#10B981',
    borderColor: '#047857',
  },
  {
    id: 'doctor',
    label: 'Medical Clinics',
    pinColor: '#F59E0B',
    borderColor: '#B45309',
  },
];

function getFacilityIcon(type: FacilityCategory) {
  switch (type) {
    case 'hospital':
      return <HeartPulse className="h-4 w-4 text-red-400" />;
    case 'police':
      return <ShieldAlert className="h-4 w-4 text-blue-400" />;
    case 'pharmacy':
      return <Pill className="h-4 w-4 text-emerald-400" />;
    case 'doctor':
      return <Building2 className="h-4 w-4 text-amber-400" />;
  }
}

interface PlacesSearchControllerProps {
  center: { lat: number; lng: number };
  facilityType: FacilityCategory;
  onResults: (places: NearbyFacility[]) => void;
  onStatusChange: (status: string | null) => void;
}

const PlacesSearchController: React.FC<PlacesSearchControllerProps> = ({
  center,
  facilityType,
  onResults,
  onStatusChange,
}) => {
  const map = useMap();
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!map) return;
    map.panTo(center);
  }, [map, center.lat, center.lng]);

  useEffect(() => {
    if (!placesLib) return;
    let cancelled = false;

    async function runNearbySearch() {
      onStatusChange(`Searching nearby ${facilityType} facilities...`);
      try {
        const PlaceClass = (placesLib as any).Place;
        if (!PlaceClass || typeof PlaceClass.searchNearby !== 'function') {
          onStatusChange(null);
          return;
        }

        const { places } = await PlaceClass.searchNearby({
          fields: [
            'id',
            'displayName',
            'location',
            'formattedAddress',
            'nationalPhoneNumber',
            'googleMapsURI',
            'rating',
          ],
          locationRestriction: {
            center,
            radius: 15000,
          },
          includedPrimaryTypes: [facilityType],
          maxResultCount: 10,
        });

        if (cancelled) return;

        const mapped: NearbyFacility[] = (places || [])
          .map((p: any, idx: number) => {
            const loc = p.location;
            const lat =
              typeof loc?.lat === 'function' ? loc.lat() : Number(loc?.lat ?? center.lat);
            const lng =
              typeof loc?.lng === 'function' ? loc.lng() : Number(loc?.lng ?? center.lng);

            return {
              id: p.id || `place-${idx}`,
              name: p.displayName || 'Emergency Facility',
              address: p.formattedAddress || '',
              lat,
              lng,
              phoneNumber: p.nationalPhoneNumber || undefined,
              googleMapsURI: p.googleMapsURI || undefined,
              rating: typeof p.rating === 'number' ? p.rating : undefined,
            };
          })
          .filter((item: NearbyFacility) => !Number.isNaN(item.lat) && !Number.isNaN(item.lng));

        onResults(mapped);
        onStatusChange(
          mapped.length > 0
            ? `Found ${mapped.length} verified nearby ${facilityType} locations via Google Places API (New).`
            : `No ${facilityType} locations returned within 15 km of this center point.`
        );
      } catch (err) {
        if (cancelled) return;
        const msg = String((err as Error)?.message ?? err);
        if (
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT') ||
          msg.includes('QuotaExceeded')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
        onStatusChange(
          'Nearby Places search unavailable at this location. Use the country emergency numbers above to call directly.'
        );
      }
    }

    runNearbySearch();

    return () => {
      cancelled = true;
    };
  }, [placesLib, center.lat, center.lng, facilityType]);

  return null;
};

export const EmergencyMapSection: React.FC<EmergencyMapSectionProps> = ({
  selectedCountry,
}) => {
  const [apiKey, setApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || ''
  );
  const [isLoadingKey, setIsLoadingKey] = useState<boolean>(!apiKey);
  const [facilityType, setFacilityType] = useState<FacilityCategory>('hospital');
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: selectedCountry.coordinates.lat,
    lng: selectedCountry.coordinates.lng,
  });
  const [facilities, setFacilities] = useState<NearbyFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<NearbyFacility | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLocatingUser, setIsLocatingUser] = useState<boolean>(false);

  // Sync map center when selected country changes
  useEffect(() => {
    setMapCenter({
      lat: selectedCountry.coordinates.lat,
      lng: selectedCountry.coordinates.lng,
    });
    setSelectedFacility(null);
  }, [selectedCountry.code]);

  // Fetch API key from server if not injected at build time
  useEffect(() => {
    if (apiKey) {
      setIsLoadingKey(false);
      return;
    }
    let mounted = true;
    fetch('/api/maps-config')
      .then((r) => r.json())
      .then((data: { apiKey?: string }) => {
        if (!mounted) return;
        if (data.apiKey) {
          setApiKey(data.apiKey);
        }
      })
      .catch(() => {
        // ignore fetch error
      })
      .finally(() => {
        if (mounted) setIsLoadingKey(false);
      });
    return () => {
      mounted = false;
    };
  }, [apiKey]);

  const handleLocateMeOnMap = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setStatusMessage('Browser geolocation is not supported on this device.');
      return;
    }
    setIsLocatingUser(true);
    setStatusMessage('Locating your current coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingUser(false);
        setMapCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setStatusMessage('Centered map on your live GPS coordinates.');
      },
      () => {
        setIsLocatingUser(false);
        setStatusMessage(
          `Location permission declined. Showing ${selectedCountry.country} center.`
        );
      },
      { timeout: 6000 }
    );
  };

  const activeCategoryMeta =
    FACILITY_TYPES.find((f) => f.id === facilityType) || FACILITY_TYPES[0];
  const primaryUniversal = selectedCountry.universal[0];

  return (
    <section
      id="nearby-map"
      aria-labelledby="nearby-map-heading"
      className="scroll-mt-20 py-10 border-t border-white/[0.08] space-y-6"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="text-xs font-semibold text-red-400">
            <span>Google Maps Platform · Places API (New)</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>
              {selectedCountry.flag} {selectedCountry.country}
            </span>
          </div>
          <h2
            id="nearby-map-heading"
            className="font-display text-2xl sm:text-3xl font-bold text-white"
          >
            Informational Nearby Emergency Facility Finder
          </h2>
          <p className="text-sm text-slate-400">
            Locate nearby hospitals, police stations, 24-hour pharmacies, and clinics around{' '}
            {selectedCountry.country} or your live GPS coordinates. For life-threatening
            emergencies, always dial{' '}
            <strong className="text-white">{primaryUniversal.number}</strong> immediately.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleLocateMeOnMap}
            disabled={isLocatingUser}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11131C] px-4 py-2.5 text-xs font-semibold text-slate-200 hover:border-red-500/50 hover:text-white transition-colors whitespace-nowrap"
          >
            <Navigation className="h-3.5 w-3.5 text-amber-400" />
            <span>{isLocatingUser ? 'Locating...' : 'Center on My Location'}</span>
          </button>

          <a
            href={formatTelHref(primaryUniversal.number)}
            className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>Call {primaryUniversal.number} Dispatch</span>
          </a>
        </div>
      </div>

      {/* Facility Type Filter Tabs */}
      <div
        role="tablist"
        aria-label="Select nearby emergency facility type"
        className="flex items-center gap-2 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#11131C] p-1.5"
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
                  ? 'bg-red-600 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              {getFacilityIcon(ft.id)}
              <span>{ft.label}</span>
            </button>
          );
        })}
      </div>

      {/* Interactive Map + Nearby Places List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-8 overflow-hidden rounded-2xl border border-white/10 bg-[#11131C]">
          <div
            data-testid="emergency-google-map"
            className="relative h-[420px] w-full"
          >
            {isLoadingKey ? (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                Loading Google Maps Platform configuration...
              </div>
            ) : apiKey ? (
              <APIProvider apiKey={apiKey}>
                <GoogleMap
                  defaultCenter={mapCenter}
                  defaultZoom={12}
                  mapId="DEMO_MAP_ID"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  className="h-full w-full"
                >
                  <PlacesSearchController
                    center={mapCenter}
                    facilityType={facilityType}
                    onResults={setFacilities}
                    onStatusChange={setStatusMessage}
                  />

                  {/* Center reference marker */}
                  <AdvancedMarker
                    position={mapCenter}
                    title={`${selectedCountry.country} Reference Center`}
                  >
                    <Pin
                      background="#F59E0B"
                      borderColor="#78350F"
                      glyphColor="#090A0F"
                    />
                  </AdvancedMarker>

                  {/* Nearby facility markers from Places API (New) */}
                  {facilities.map((fac) => (
                    <AdvancedMarker
                      key={fac.id}
                      position={{ lat: fac.lat, lng: fac.lng }}
                      title={fac.name}
                      onClick={() => setSelectedFacility(fac)}
                    >
                      <Pin
                        background={activeCategoryMeta.pinColor}
                        borderColor={activeCategoryMeta.borderColor}
                        glyphColor="#FFFFFF"
                      />
                    </AdvancedMarker>
                  ))}

                  {selectedFacility && (
                    <InfoWindow
                      position={{
                        lat: selectedFacility.lat,
                        lng: selectedFacility.lng,
                      }}
                      onCloseClick={() => setSelectedFacility(null)}
                    >
                      <div className="max-w-[240px] space-y-1.5 p-1 text-slate-900">
                        <div className="font-bold text-sm leading-snug">
                          {selectedFacility.name}
                        </div>
                        {selectedFacility.address && (
                          <p className="text-xs text-slate-600">
                            {selectedFacility.address}
                          </p>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {selectedFacility.phoneNumber && (
                            <a
                              href={formatTelHref(selectedFacility.phoneNumber)}
                              className="inline-flex items-center gap-1 rounded bg-red-600 px-2 py-1 text-[11px] font-bold text-white"
                            >
                              <PhoneCall className="h-3 w-3" />
                              <span>{selectedFacility.phoneNumber}</span>
                            </a>
                          )}
                          {selectedFacility.googleMapsURI && (
                            <a
                              href={selectedFacility.googleMapsURI}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-[11px] font-semibold text-slate-700"
                            >
                              <span>Open in Google Maps</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </InfoWindow>
                  )}
                </GoogleMap>
              </APIProvider>
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center text-xs text-slate-400">
                <MapPin className="h-6 w-6 text-red-400" />
                <p className="font-semibold text-white">
                  Google Maps Platform Ready ({selectedCountry.country})
                </p>
                <p className="max-w-md">
                  Coordinates: {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}. For
                  immediate assistance in {selectedCountry.country}, dial{' '}
                  <strong className="text-white">{primaryUniversal.number}</strong>.
                </p>
              </div>
            )}
          </div>

          {statusMessage && (
            <div className="border-t border-white/[0.08] bg-[#0D0F17] px-4 py-2.5 text-xs text-slate-300 flex items-center justify-between gap-2">
              <span>{statusMessage}</span>
              <span className="font-mono-tabular text-slate-400">
                {mapCenter.lat.toFixed(3)}, {mapCenter.lng.toFixed(3)}
              </span>
            </div>
          )}
        </div>

        {/* Sidebar List of Live Places API (New) Results */}
        <div className="lg:col-span-4 rounded-2xl border border-white/10 bg-[#11131C] p-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div className="flex items-center gap-2">
                {getFacilityIcon(facilityType)}
                <h3 className="font-display text-sm font-bold text-white">
                  Nearby {activeCategoryMeta.label}
                </h3>
              </div>
              <span className="font-mono-tabular text-xs text-slate-400">
                {facilities.length} found
              </span>
            </div>

            <div className="max-h-[320px] space-y-2.5 overflow-y-auto pr-1">
              {facilities.map((fac) => {
                const isSelected = selectedFacility?.id === fac.id;
                return (
                  <div
                    key={fac.id}
                    className={`rounded-xl border p-3 transition-colors ${
                      isSelected
                        ? 'border-red-500/60 bg-[#171A26]'
                        : 'border-white/[0.06] bg-[#090A0F]/80 hover:border-white/20'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedFacility(fac)}
                      className="w-full text-left"
                    >
                      <div className="font-semibold text-xs text-white">
                        {fac.name}
                      </div>
                      {fac.address && (
                        <div className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                          {fac.address}
                        </div>
                      )}
                    </button>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      {fac.phoneNumber && (
                        <a
                          href={formatTelHref(fac.phoneNumber)}
                          className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-500"
                        >
                          <PhoneCall className="h-3 w-3" />
                          <span>{fac.phoneNumber}</span>
                        </a>
                      )}
                      {fac.googleMapsURI && (
                        <a
                          href={fac.googleMapsURI}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white"
                        >
                          <span>Google Maps</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}

              {facilities.length === 0 && (
                <div className="rounded-xl border border-white/[0.06] bg-[#090A0F]/60 p-4 text-xs text-slate-400 space-y-2">
                  <p>
                    Select a facility tab above or click{' '}
                    <strong className="text-slate-200">Center on My Location</strong> to
                    query live nearby places via Google Maps Platform.
                  </p>
                  <p className="text-slate-300">
                    For immediate emergency dispatch in {selectedCountry.country}, dial{' '}
                    <strong className="text-white">{primaryUniversal.number}</strong>.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] text-slate-400">
            Informational facility finder powered by Google Maps Platform. Not for
            emergency dispatch routing—call{' '}
            <strong className="text-slate-200">{primaryUniversal.number}</strong> in
            life-threatening situations.
          </div>
        </div>
      </div>
    </section>
  );
};
