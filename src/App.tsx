import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Lenis from 'lenis';
import {
  PhoneCall,
  Copy,
  Check,
  Share2,
  Search,
  MapPin,
  ShieldAlert,
  HeartPulse,
  Flame,
  Car,
  Users,
  GlobeLock,
  ExternalLink,
  AlertTriangle,
  Sparkles,
  BookOpen,
  Download,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ALL_COUNTRIES,
  CountryEmergencyData,
  EmergencyNumberEntry,
  getCountryByCode,
  filterCountries,
  searchNumbersInCountry,
  formatTelHref,
  buildEmergencySharePayload,
  findNearestCountryByCoords,
  getDirectoryStats,
  ACCESSIBILITY_ALERT_STORAGE_KEY,
  buildAccessibilityAlertPattern,
  playHighContrastDirectoryAlert,
} from './lib/emergencyData';
import {
  AuroraBackground,
  SplitText,
  DecryptedText,
  SpotlightCard,
  CountUp,
  Magnet,
} from './components/reactbits/ReactBitsComponents';
import { RobotChatDrawer } from './components/RobotChatDrawer';
import { NumberDetailModal } from './components/NumberDetailModal';
import { OfflineBanner, PWAOfflineModal } from './components/PWAInstallModal';
import { EmergencyMapSection } from './components/EmergencyMapSection';

const LazyHeroVideoBackground = React.lazy(() =>
  import('./components/HeroVideoBackground').then((m) => ({
    default: m.HeroVideoBackground,
  }))
);

const STORAGE_KEY = 'sos_world_selected_country';
const JANMITER_LOGO_URL =
  '/assets/aistudio/Gemini_Generated_Image_jdwhpejdwhpejdwh-clean_141afd63.png';

function getCategoryIcon(iconName?: string) {
  switch (iconName) {
    case 'HeartPulse':
      return <HeartPulse className="h-5 w-5 text-red-400" />;
    case 'Flame':
      return <Flame className="h-5 w-5 text-amber-400" />;
    case 'Car':
      return <Car className="h-5 w-5 text-amber-400" />;
    case 'Users':
      return <Users className="h-5 w-5 text-red-400" />;
    case 'GlobeLock':
      return <GlobeLock className="h-5 w-5 text-amber-400" />;
    default:
      return <ShieldAlert className="h-5 w-5 text-red-400" />;
  }
}

export default function App() {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'IN';
    } catch {
      return 'IN';
    }
  });

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [countrySearch, setCountrySearch] = useState<string>('');
  const [numberSearch, setNumberSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedCardState, setSharedCardState] = useState<{
    id: string;
    mode: 'shared' | 'copied';
  } | null>(null);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);
  const [isDetectingGeo, setIsDetectingGeo] = useState<boolean>(false);

  const [isRobotOpen, setIsRobotOpen] = useState<boolean>(false);
  const [assistantPrompt, setAssistantPrompt] = useState<string | null>(null);
  const [autoStartLiveVoice, setAutoStartLiveVoice] = useState<boolean>(false);
  const [activeDetailModal, setActiveDetailModal] = useState<{
    categoryName: string;
    entry: EmergencyNumberEntry;
  } | null>(null);
  const [isPwaModalOpen, setIsPwaModalOpen] = useState<boolean>(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState<boolean>(false);

  // Optional Accessibility Feature: Distinct, high-contrast audio alert when opening the emergency directory
  const [audioAlertEnabled, setAudioAlertEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(ACCESSIBILITY_ALERT_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [audioAlertBanner, setAudioAlertBanner] = useState<string | null>(null);

  useEffect(() => {
    const onQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  const selectedCountry: CountryEmergencyData = useMemo(
    () => getCountryByCode(selectedCountryCode),
    [selectedCountryCode]
  );

  const directoryStats = useMemo(() => getDirectoryStats(), []);

  // Initialize Lenis smooth scrolling (respecting prefers-reduced-motion)
  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.05,
      smoothWheel: true,
    });

    let rafId = 0;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, []);

  const triggerDirectoryAudioAlert = async (
    countryObj: CountryEmergencyData = selectedCountry
  ) => {
    const universalNum = countryObj.universal[0]?.number || '112';
    const pattern = buildAccessibilityAlertPattern(
      countryObj.country,
      universalNum
    );
    setAudioAlertBanner(pattern.spokenAnnouncement);
    const played = await playHighContrastDirectoryAlert(
      countryObj.country,
      universalNum,
      { speakAnnouncement: true }
    );
    return played;
  };

  const handleToggleAudioAlert = async () => {
    const next = !audioAlertEnabled;
    setAudioAlertEnabled(next);
    try {
      localStorage.setItem(ACCESSIBILITY_ALERT_STORAGE_KEY, String(next));
    } catch {
      // ignore storage errors
    }
    if (next) {
      await triggerDirectoryAudioAlert(selectedCountry);
    } else {
      setAudioAlertBanner('Accessibility audio alert on directory open disabled.');
    }
  };

  // When the optional Accessibility Audio Alert is enabled, play the distinct high-contrast
  // locator chime when the user opens the emergency directory (with first-gesture fallback if autoplay is suspended).
  useEffect(() => {
    if (!audioAlertEnabled) return;
    let cancelled = false;

    const runAlert = async () => {
      const played = await triggerDirectoryAudioAlert(selectedCountry);
      if (!played && !cancelled) {
        const onFirstInteraction = () => {
          if (!cancelled) {
            triggerDirectoryAudioAlert(selectedCountry);
          }
          window.removeEventListener('pointerdown', onFirstInteraction);
          window.removeEventListener('keydown', onFirstInteraction);
        };
        window.addEventListener('pointerdown', onFirstInteraction, { once: true });
        window.addEventListener('keydown', onFirstInteraction, { once: true });
      }
    };

    runAlert();

    return () => {
      cancelled = true;
    };
  }, [selectedCountry.code]);

  // Persist country choice in localStorage
  const handleSelectCountry = (code: string) => {
    setSelectedCountryCode(code);
    setSelectedCategoryId('all');
    setNumberSearch('');
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // ignore storage quota errors
    }
  };

  // Detect country via browser Geolocation API
  const handleDetectCountry = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('Geolocation is not supported by your browser. Please pick your country below.');
      return;
    }

    setIsDetectingGeo(true);
    setGeoStatus('Detecting your nearest country...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = findNearestCountryByCoords(
          pos.coords.latitude,
          pos.coords.longitude
        );
        handleSelectCountry(nearest.code);
        setIsDetectingGeo(false);
        setGeoStatus(`Detected nearest directory: ${nearest.flag} ${nearest.country} (${nearest.code})`);
      },
      () => {
        setIsDetectingGeo(false);
        setGeoStatus(
          'Location permission declined or unavailable. Showing your selected country directory.'
        );
      },
      { timeout: 6000 }
    );
  };

  const handleCopyNumber = async (key: string, numberStr: string) => {
    try {
      await navigator.clipboard.writeText(numberStr);
    } catch {
      // clipboard fallback
    }
    setCopiedId(key);
    setTimeout(() => {
      setCopiedId((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const handleQuickShareNumber = async (
    cardKey: string,
    categoryName: string,
    entry: EmergencyNumberEntry
  ) => {
    const payload = buildEmergencySharePayload(
      selectedCountry,
      categoryName,
      entry,
      typeof window !== 'undefined' ? window.location.href : undefined
    );

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        setSharedCardState({ id: cardKey, mode: 'shared' });
        setTimeout(() => {
          setSharedCardState((prev) => (prev?.id === cardKey ? null : prev));
        }, 2000);
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }
        // Fall through to clipboard fallback when Web Share is blocked or fails
      }
    }

    try {
      await navigator.clipboard.writeText(
        `${payload.title}\n${payload.text}\n${payload.url}`
      );
    } catch {
      // ignore clipboard errors
    }
    setSharedCardState({ id: cardKey, mode: 'copied' });
    setTimeout(() => {
      setSharedCardState((prev) => (prev?.id === cardKey ? null : prev));
    }, 2000);
  };

  const filteredCountries = useMemo(
    () => filterCountries(countrySearch),
    [countrySearch]
  );

  const filteredNumbers = useMemo(
    () =>
      searchNumbersInCountry(
        selectedCountry,
        selectedCategoryId,
        numberSearch
      ),
    [selectedCountry, selectedCategoryId, numberSearch]
  );

  const primaryUniversal = selectedCountry.universal[0];

  return (
    <div className="relative min-h-screen bg-[#090A0F] text-[#F8FAFC]">
      <AuroraBackground />
      <OfflineBanner />

      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 border-b border-white/[0.08] bg-[#090A0F]/90 px-6 py-2.5">
        {/* Zone 1: Brand logo & wordmark */}
        <a
          href="#top"
          aria-label="JANMITER Home"
          className="flex items-center gap-3 font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          <img
            src={JANMITER_LOGO_URL}
            alt="JANMITER — Global Emergency Directory & AI Assistant"
            className="h-10 sm:h-11 w-44 sm:w-52 rounded-lg border border-white/10 object-cover object-center shadow-sm"
          />
          <span className="sr-only">JANMITER</span>
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <a
            href="#directory"
            onClick={() => {
              if (audioAlertEnabled) {
                triggerDirectoryAudioAlert(selectedCountry);
              }
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Directory
          </a>
          <a
            href="#categories"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Categories
          </a>
          <a
            href="#nearby-map"
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Nearby Map
          </a>
          <button
            type="button"
            onClick={() => setIsPwaModalOpen(true)}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Offline Access
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRobotOpen(true);
              setAutoStartLiveVoice(true);
            }}
            className="hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            Live Voice AI
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action — Always-visible Call Universal Emergency Number */}
        <div className="flex items-center shrink-0">
          <a
            href={formatTelHref(primaryUniversal.number)}
            aria-label={`Call universal emergency number ${primaryUniversal.number} for ${selectedCountry.country}`}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0 shadow-sm"
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>
              Call {primaryUniversal.number} ({selectedCountry.code})
            </span>
          </a>
        </div>
      </header>

      {mapsQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 flex items-center justify-between gap-4 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span>
            The Google Maps Platform Demo Key has exceeded its shared quota. To restore map functionality, configure your own Google Cloud API key.
          </span>
          <a
            href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded bg-amber-900 px-3 py-1 font-medium text-white hover:bg-amber-800"
          >
            Learn how to use your own key
          </a>
        </div>
      )}

      <main id="top" className="relative z-10 mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        {/* HERO SECTION WITH LOOPING MUTED EMERGENCY VIDEO BACKGROUND */}
        <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0B0D14] px-6 py-8 sm:px-8 lg:px-10 lg:py-12 mt-6 mb-10">
          <Suspense fallback={null}>
            <LazyHeroVideoBackground
              selectedCountry={selectedCountry}
              variant="ambient"
            />
          </Suspense>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Hero Left Column: Headline, Country Picker & Primary Actions */}
            <div className="lg:col-span-7 space-y-6">
              <div className="flex flex-wrap items-center gap-3">
                <img
                  src={JANMITER_LOGO_URL}
                  alt="JANMITER Official Logo"
                  className="h-14 sm:h-16 w-60 sm:w-68 rounded-xl border border-white/15 object-cover object-center shadow-md"
                />
                <div className="text-xs font-medium text-slate-400">
                  <span>Verified Global Emergency Response Directory</span>
                  <span aria-hidden="true" className="mx-2">·</span>
                  <span>Offline-Ready PWA</span>
                  <span aria-hidden="true" className="mx-2">·</span>
                  <span>{selectedCountry.flag} Active: {selectedCountry.country}</span>
                </div>
              </div>

              <h1 className="font-display text-[clamp(2.25rem,4vw,3.6rem)] font-bold leading-[1.08] tracking-tight text-white max-w-2xl">
                <SplitText
                  text="The Right Emergency Number in Under Three Seconds."
                  highlightWords={['Emergency', 'Three', 'Seconds.']}
                />
              </h1>

              <p className="text-base text-slate-300 leading-relaxed max-w-xl">
                Know whether to dial <strong className="text-white">112</strong>,{' '}
                <strong className="text-white">108</strong>,{' '}
                <strong className="text-white">1033</strong>, or{' '}
                <strong className="text-white">1930</strong> when every second counts.
                Select your country to see verified emergency numbers, exactly who each
                line serves, and when to call.
              </p>

              {/* Primary CTA & Country Detection Controls */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Magnet>
                  <a
                    href="#directory"
                    onClick={() => {
                      if (audioAlertEnabled) {
                        triggerDirectoryAudioAlert(selectedCountry);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 text-sm font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap shadow-lg"
                  >
                    <PhoneCall className="h-4 w-4" />
                    <span>Get Help Now ({selectedCountry.country})</span>
                  </a>
                </Magnet>

                <button
                  type="button"
                  onClick={handleDetectCountry}
                  disabled={isDetectingGeo}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11131C] px-4 py-3.5 text-sm font-semibold text-slate-200 hover:border-red-500/50 hover:text-white transition-colors whitespace-nowrap"
                >
                  <MapPin className="h-4 w-4 text-amber-400" />
                  <span>{isDetectingGeo ? 'Detecting...' : 'Detect My Country'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsRobotOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] transition-colors whitespace-nowrap"
                >
                  <Sparkles className="h-4 w-4 text-red-400" />
                  <span>Ask 3D AI Assistant</span>
                </button>
              </div>

              {geoStatus && (
                <p
                  role="status"
                  className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3.5 py-2 max-w-xl"
                >
                  {geoStatus}
                </p>
              )}

              {/* Searchable Country Picker + Scrolling Country Gallery Strip */}
              <div className="rounded-2xl border border-white/10 bg-[#11131C] p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label
                    htmlFor="country-select"
                    className="text-xs font-semibold text-slate-300"
                  >
                    Select Country Directory ({ALL_COUNTRIES.length} Verified Nations)
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input
                        id="country-search-input"
                        type="search"
                        value={countrySearch}
                        onChange={(e) => setCountrySearch(e.target.value)}
                        placeholder="Filter country or code..."
                        aria-label="Filter countries by name or code"
                        className="w-full rounded-lg border border-white/10 bg-[#090A0F] pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none"
                      />
                    </div>

                    <select
                      id="country-select"
                      aria-label="Choose country directory"
                      value={selectedCountry.code}
                      onChange={(e) => handleSelectCountry(e.target.value)}
                      className="rounded-lg border border-white/15 bg-[#090A0F] px-3 py-1.5 text-xs font-semibold text-white focus:border-red-500 focus:outline-none"
                    >
                      {ALL_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.country} ({c.code}) — {c.universal[0].number}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Scrolling Country Carousel / Gallery */}
                <div
                  role="region"
                  aria-label="Quick country selector carousel"
                  className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5"
                >
                  {filteredCountries.map((c) => {
                    const isActive = c.code === selectedCountry.code;
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleSelectCountry(c.code)}
                        aria-pressed={isActive}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-red-600 text-white shadow-sm'
                            : 'bg-[#090A0F] text-slate-300 border border-white/[0.07] hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <span className="text-base leading-none">{c.flag}</span>
                        <span>{c.country}</span>
                        <span className="font-mono-tabular opacity-75">
                          {c.universal[0].number}
                        </span>
                      </button>
                    );
                  })}
                  {filteredCountries.length === 0 && (
                    <span className="text-xs text-slate-400 py-1">
                      No matching country found. Try India (IN), United States (US), UK (GB), or Japan (JP).
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Hero Right Column: Looping Muted Emergency Video Showcase */}
            <div className="lg:col-span-5">
              <div className="relative rounded-2xl border border-white/[0.08] bg-[#11131C]/85 p-4 backdrop-blur-sm">
                <Suspense
                  fallback={
                    <div className="flex h-[340px] sm:h-[420px] w-full items-center justify-center text-xs text-slate-400">
                      Loading Emergency Video Feed...
                    </div>
                  }
                >
                  <LazyHeroVideoBackground
                    selectedCountry={selectedCountry}
                    variant="showcase"
                  />
                </Suspense>
                <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-400">
                  <span>
                    {selectedCountry.flag} {selectedCountry.country} ({selectedCountry.region})
                  </span>
                  <span className="font-mono-tabular text-slate-300">
                    Universal: {primaryUniversal.number}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Full-width 3-Column Stats Bar below Hero */}
          <div className="relative z-10 mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.08] bg-[#11131C] p-5">
              <div className="text-2xl sm:text-3xl font-bold text-white">
                <CountUp end={directoryStats.countriesCount} /> Nations
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Verified government emergency directories cached for offline access
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#11131C] p-5">
              <div className="text-2xl sm:text-3xl font-bold text-white">
                <CountUp end={directoryStats.numbersCount} suffix="+" /> Helplines
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Categorized with explicit audience and when-to-call triage rules
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-[#11131C] p-5">
              <div className="text-2xl sm:text-3xl font-bold text-white">
                <CountUp end={directoryStats.languagesSupported} suffix="+" /> Languages
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Supported by the 3D AI voice & text emergency assistant
              </p>
            </div>
          </div>
        </section>

        {/* PINNED UNIVERSAL EMERGENCY NUMBER BANNER */}
        <section
          id="directory"
          aria-labelledby="universal-emergency-heading"
          className="scroll-mt-20 py-4"
        >
          <div className="rounded-2xl border border-red-500/40 bg-gradient-to-r from-red-950/60 via-[#15121B] to-[#11131C] p-6 shadow-xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="text-xs font-semibold text-red-400">
                  <span>Pinned Universal Emergency Number</span>
                  <span aria-hidden="true" className="mx-2">·</span>
                  <span>
                    {selectedCountry.flag} {selectedCountry.country} ({selectedCountry.code})
                  </span>
                  <span aria-hidden="true" className="mx-2">·</span>
                  <span>24x7 Toll-Free</span>
                </div>
                <h2
                  id="universal-emergency-heading"
                  className="font-display text-2xl sm:text-3xl font-bold text-white"
                >
                  {primaryUniversal.label}
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {primaryUniversal.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4 shrink-0">
                <div className="rounded-xl border border-white/10 bg-[#090A0F] px-5 py-3 text-center">
                  <div className="text-[11px] text-slate-400">Dial Immediately</div>
                  <div className="font-mono-tabular text-4xl sm:text-5xl font-bold text-white tracking-tight">
                    <DecryptedText text={primaryUniversal.number} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                  <a
                    href={formatTelHref(primaryUniversal.number)}
                    aria-label={`Call universal number ${primaryUniversal.number} now`}
                    className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-red-600 px-6 py-4 text-base font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap shadow-lg"
                  >
                    <PhoneCall className="h-5 w-5" />
                    <span>Call {primaryUniversal.number} Now</span>
                  </a>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopyNumber(
                        `universal-${primaryUniversal.number}`,
                        primaryUniversal.number
                      )
                    }
                    aria-label={`Copy universal number ${primaryUniversal.number}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-4 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
                  >
                    {copiedId === `universal-${primaryUniversal.number}` ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Optional Visual Impairment Accessibility Control: High-Contrast Audio Locator Alert */}
            <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    Accessibility Audio Locator Alert (For Visual Impairments)
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Plays a distinct, high-contrast 3-tone acoustic beacon and announces{' '}
                  <strong className="text-white">{primaryUniversal.number}</strong> when
                  opening the emergency directory.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleAudioAlert}
                  aria-pressed={audioAlertEnabled}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                    audioAlertEnabled
                      ? 'bg-amber-400 text-slate-950 shadow-sm hover:bg-amber-300'
                      : 'border border-white/20 bg-[#090A0F] text-white hover:border-amber-400/60'
                  }`}
                >
                  {audioAlertEnabled ? (
                    <>
                      <Volume2 className="h-4 w-4" />
                      <span>Audio Alert On Open: Enabled</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="h-4 w-4 text-slate-400" />
                      <span>Enable Audio Alert On Open</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => triggerDirectoryAudioAlert(selectedCountry)}
                  aria-label={`Play high-contrast audio alert for ${selectedCountry.country} emergency directory`}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/50 bg-amber-500/15 px-3.5 py-2.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25 transition-colors whitespace-nowrap"
                >
                  <Volume2 className="h-3.5 w-3.5 text-amber-300" />
                  <span>Play Audio Alert Now</span>
                </button>
              </div>
            </div>

            {audioAlertBanner && (
              <div
                role="status"
                aria-live="assertive"
                className="mt-3 rounded-xl border-2 border-amber-400 bg-slate-950 px-4 py-2.5 text-xs font-bold text-amber-200 flex items-center justify-between gap-3"
              >
                <span>{audioAlertBanner}</span>
                <button
                  type="button"
                  onClick={() => setAudioAlertBanner(null)}
                  className="text-[11px] underline text-amber-300 hover:text-white shrink-0"
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        </section>

        {/* SERVICE CATEGORY SELECTION & SEARCH */}
        <section
          id="categories"
          aria-labelledby="service-categories-heading"
          className="scroll-mt-20 py-10 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h2
                id="service-categories-heading"
                className="font-display text-2xl sm:text-3xl font-bold text-white"
              >
                {selectedCountry.flag} {selectedCountry.country} Emergency Categories
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Pick a service category or search by symptom, highway, or department to find the fastest direct number.
              </p>
            </div>

            {/* Search within selected country */}
            <div className="relative w-full md:w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={numberSearch}
                onChange={(e) => setNumberSearch(e.target.value)}
                placeholder={`Search ${selectedCountry.country} numbers (e.g. highway, 108, cyber)...`}
                aria-label={`Search emergency numbers in ${selectedCountry.country}`}
                className="w-full rounded-xl border border-white/10 bg-[#11131C] pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-400 focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Interactive Category Cards (3 to 6 per country) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {selectedCountry.categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <SpotlightCard
                  key={cat.id}
                  enableTilt={true}
                  className={
                    isSelected
                      ? 'border-red-500/70 bg-[#161926]'
                      : 'hover:border-white/20'
                  }
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedCategoryId((prev) =>
                        prev === cat.id ? 'all' : cat.id
                      )
                    }
                    aria-pressed={isSelected}
                    className="flex h-full w-full flex-col justify-between p-5 text-left"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          {getCategoryIcon(cat.icon)}
                          <h3 className="font-display text-base font-bold text-white">
                            {cat.name}
                          </h3>
                        </div>
                        <span className="font-mono-tabular text-xs text-slate-400">
                          {cat.numbers.length}{' '}
                          {cat.numbers.length === 1 ? 'number' : 'numbers'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                        {cat.description}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                      <span className="font-mono-tabular font-semibold text-slate-200">
                        Primary: {cat.numbers.map((n) => n.number).join(' · ')}
                      </span>
                      <span className="font-medium text-red-400">
                        {isSelected ? 'Showing Only This' : 'Filter Category →'}
                      </span>
                    </div>
                  </button>
                </SpotlightCard>
              );
            })}
          </div>

          {/* Interactive Segmented Filter Bar */}
          <div
            role="tablist"
            aria-label="Filter emergency numbers by category"
            className="flex items-center gap-1.5 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#11131C] p-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedCategoryId === 'all'}
              onClick={() => setSelectedCategoryId('all')}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                selectedCategoryId === 'all'
                  ? 'bg-red-600 text-white'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              All Categories ({selectedCountry.categories.reduce((acc, c) => acc + c.numbers.length, 0)})
            </button>
            {selectedCountry.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={selectedCategoryId === cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategoryId === cat.id
                    ? 'bg-red-600 text-white'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {cat.name} ({cat.numbers.length})
              </button>
            ))}
          </div>

          {/* NUMBER DETAIL VIEW CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {filteredNumbers.map(({ categoryId, categoryName, entry }) => {
              const cardKey = `${selectedCountry.code}-${categoryId}-${entry.number}-${entry.label}`;
              const isCopied = copiedId === cardKey;
              const isShared = sharedCardState?.id === cardKey;

              return (
                <SpotlightCard key={cardKey} className="p-6 flex flex-col justify-between">
                  <div>
                    {/* Quiet 1-line unboxed kicker */}
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                      <div>
                        <span>{categoryName}</span>
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        <span>
                          {entry.verificationStatus === 'needs_verification'
                            ? 'Needs Verification'
                            : `Verified ${entry.lastVerified}`}
                        </span>
                      </div>
                      <a
                        href={entry.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-slate-400 hover:text-white transition-colors whitespace-nowrap"
                      >
                        <span>Official Source</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>

                    {/* Sub-department & Large Callable Number */}
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                      <div>
                        <h3 className="font-display text-lg font-bold text-white">
                          {entry.label}
                        </h3>
                        <div className="mt-1 font-mono-tabular text-3xl sm:text-4xl font-bold tracking-tight text-red-400">
                          {entry.number}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <a
                          href={formatTelHref(entry.number)}
                          aria-label={`Call ${entry.number} for ${entry.label}`}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0"
                        >
                          <PhoneCall className="h-4 w-4" />
                          <span>Call {entry.number}</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleCopyNumber(cardKey, entry.number)}
                          aria-label={`Copy ${entry.number}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#090A0F] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-white/30 hover:text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleQuickShareNumber(cardKey, categoryName, entry)
                          }
                          aria-label={`Quick share ${entry.number} for ${entry.label}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#090A0F] px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-sky-400/50 hover:text-white transition-colors whitespace-nowrap shrink-0"
                        >
                          {isShared ? (
                            <>
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                              <span>
                                {sharedCardState?.mode === 'shared'
                                  ? 'Shared'
                                  : 'Share Copied'}
                              </span>
                            </>
                          ) : (
                            <>
                              <Share2 className="h-3.5 w-3.5 text-sky-400" />
                              <span>Quick Share</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* WHO IT IS FOR & WHEN TO USE IT */}
                    <div className="mt-4 space-y-3 text-sm">
                      <div className="rounded-xl bg-[#090A0F]/80 border border-white/[0.06] p-3.5">
                        <div className="text-xs font-semibold text-slate-400">
                          Who It Is For
                        </div>
                        <p className="mt-1 text-xs sm:text-sm text-slate-100 leading-relaxed">
                          {entry.audience}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#090A0F]/80 border border-white/[0.06] p-3.5">
                        <div className="text-xs font-semibold text-amber-400">
                          When To Use It
                        </div>
                        <p className="mt-1 text-xs sm:text-sm text-slate-200 leading-relaxed">
                          {entry.whenToUse}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Unboxed Metadata Footer + Modal Trigger */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3.5 text-xs text-slate-400">
                    <div>
                      <span>Coverage: {entry.coverage}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>Hours: {entry.hours}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>{entry.tollFree ? 'Toll-Free' : 'Standard Call Rate'}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveDetailModal({
                          categoryName,
                          entry,
                        })
                      }
                      className="font-semibold text-red-400 hover:text-red-300 transition-colors whitespace-nowrap"
                    >
                      Dispatcher Guide →
                    </button>
                  </div>
                </SpotlightCard>
              );
            })}
          </div>

          {filteredNumbers.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-[#11131C] p-8 text-center space-y-3">
              <p className="text-sm text-slate-300">
                No specific helpline matched &ldquo;{numberSearch}&rdquo; in{' '}
                {selectedCountry.country}.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNumberSearch('');
                    setSelectedCategoryId('all');
                  }}
                  className="rounded-xl bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors"
                >
                  Show All {selectedCountry.country} Numbers
                </button>
                <a
                  href={formatTelHref(primaryUniversal.number)}
                  className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors"
                >
                  Call Universal ({primaryUniversal.number})
                </a>
              </div>
            </div>
          )}
        </section>

        {/* INTERACTIVE NEARBY EMERGENCY FACILITIES MAP (Google Maps Platform + Places API New) */}
        <EmergencyMapSection selectedCountry={selectedCountry} />

        {/* HOW IT WORKS & ADDING A COUNTRY GUIDE */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="scroll-mt-20 py-12 border-t border-white/[0.08] space-y-8"
        >
          <div className="max-w-2xl">
            <h2
              id="how-it-works-heading"
              className="font-display text-2xl sm:text-3xl font-bold text-white"
            >
              How JANMITER Works in an Emergency
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Engineered for high-stress moments on mobile devices: maximum three taps from landing to dialing the exact right responder.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-2xl border border-white/[0.08] bg-[#11131C] p-6 space-y-2.5">
              <div className="font-display text-lg font-bold text-white">
                01. Select or Auto-Detect Country
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pick your location from the searchable flag bar or tap{' '}
                <em>Detect My Country</em>. Your choice is saved in{' '}
                <code>localStorage</code> and pre-cached offline by the service worker.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#11131C] p-6 space-y-2.5">
              <div className="font-display text-lg font-bold text-white">
                02. Distinguish Specialized Helplines
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Understand critical differences immediately — such as India&apos;s{' '}
                <strong>108</strong> (trauma ambulance) vs <strong>102</strong>{' '}
                (maternal/neonatal) vs <strong>1033</strong> (NHAI National Highway patrol).
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-[#11131C] p-6 space-y-2.5">
              <div className="font-display text-lg font-bold text-white">
                03. One-Tap Call or Multilingual Voice AI
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tap any number to launch your phone dialer immediately, or press the
                microphone inside the 3D AI Rescue Assistant to ask in any language.
              </p>
            </div>
          </div>

          {/* Extensible Open-Data Architecture Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#11131C] p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400">
                <BookOpen className="h-4 w-4" />
                <span>Open Emergency Data Architecture (Zod Validated)</span>
              </div>
              <h3 className="font-display text-lg font-bold text-white">
                Add New Countries via a Single JSON File
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Every country directory lives in{' '}
                <code className="text-slate-200">/data/emergency-numbers/&#123;countryCode&#125;.json</code>{' '}
                and is validated at startup against{' '}
                <code className="text-slate-200">CountryEmergencyDataSchema</code> in{' '}
                <code className="text-slate-200">src/lib/emergencyData.ts</code>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsPwaModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#090A0F] px-5 py-3 text-xs font-bold text-white hover:border-red-500/50 transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="h-4 w-4 text-red-400" />
              <span>Check Offline Cache & Install App</span>
            </button>
          </div>
        </section>

        {/* MANDATORY VISIBLE EMERGENCY DISCLAIMER & FOOTER */}
        <footer className="mt-8 border-t border-white/[0.08] py-8 space-y-6 text-xs text-slate-400">
          <div
            role="note"
            aria-label="Emergency Medical and Legal Disclaimer"
            className="rounded-xl border border-amber-500/30 bg-amber-500/[0.07] p-4 text-slate-200 flex items-start gap-3"
          >
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <div className="font-bold text-white">
                Important Safety & Emergency Disclaimer
              </div>
              <p className="text-xs text-slate-300">
                Emergency numbers, regional routing, and toll-free status can change. For
                any life-threatening emergency, call your local universal emergency
                number (such as <strong>112</strong>, <strong>911</strong>,{' '}
                <strong>999</strong>, or <strong>000</strong>) immediately. JANMITER and
                its AI assistant provide informational guidance only and are not a
                substitute for professional emergency dispatch, law enforcement, or
                qualified medical care.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <img
                src={JANMITER_LOGO_URL}
                alt="JANMITER Logo"
                className="h-9 w-36 rounded-lg border border-white/10 object-cover object-center"
              />
              <div>
                <span className="font-display font-bold text-white">JANMITER</span>
                <span aria-hidden="true" className="mx-2">·</span>
                <span>Global Emergency Numbers Directory & Multilingual AI Assistant</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <a href="#directory" className="hover:text-white transition-colors">
                Universal Number ({primaryUniversal.number})
              </a>
              <a href="#categories" className="hover:text-white transition-colors">
                Service Categories
              </a>
              <button
                type="button"
                onClick={() => setIsPwaModalOpen(true)}
                className="hover:text-white transition-colors"
              >
                Offline PWA Status
              </button>
            </div>
          </div>
        </footer>
      </main>

      {/* Deep-Dive Number Detail Modal */}
      <NumberDetailModal
        country={selectedCountry}
        categoryName={activeDetailModal?.categoryName || ''}
        entry={activeDetailModal?.entry || null}
        onClose={() => setActiveDetailModal(null)}
        onAskAssistant={(prompt) => {
          setAssistantPrompt(prompt);
          setIsRobotOpen(true);
        }}
      />

      {/* Offline PWA Install & Cache Modal */}
      <PWAOfflineModal
        isOpen={isPwaModalOpen}
        onClose={() => setIsPwaModalOpen(false)}
      />

      {/* Floating 3D Robot Assistant & Chat Drawer */}
      <RobotChatDrawer
        country={selectedCountry}
        isOpen={isRobotOpen}
        onToggleOpen={setIsRobotOpen}
        externalPrompt={assistantPrompt}
        onClearExternalPrompt={() => setAssistantPrompt(null)}
        autoStartLiveVoice={autoStartLiveVoice}
        onClearAutoStartLiveVoice={() => setAutoStartLiveVoice(false)}
      />
    </div>
  );
}
