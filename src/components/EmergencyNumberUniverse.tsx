import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  PhoneCall,
  BookOpen,
  MapPin,
  ShieldAlert,
  HeartPulse,
  Flame,
  Car,
  Users,
  GlobeLock,
  ExternalLink,
  GripHorizontal,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Info,
  Radio,
  ArrowRight,
} from 'lucide-react';
import {
  CountryEmergencyData,
  EmergencyNumberEntry,
  formatTelHref,
} from '../lib/emergencyData';

export interface UniverseCardData {
  id: string;
  number: string;
  label: string;
  categoryName: string;
  categoryId: string;
  iconName?: string;
  audience: string;
  whenToUse: string;
  coverage: string;
  hours: string;
  tollFree: boolean;
  isAnchor?: boolean;
  lastVerified: string;
  sourceUrl: string;
  animationDelay: string;
  animationDuration: string;
  entry: EmergencyNumberEntry;
}

interface EmergencyNumberUniverseProps {
  country: CountryEmergencyData;
  onSelectEntry: (categoryName: string, entry: EmergencyNumberEntry) => void;
  onRequestCallConfirm: (card: UniverseCardData) => void;
  onNavigateToNearby: (categoryType?: 'hospital' | 'police' | 'pharmacy' | 'doctor') => void;
  onAskAssistant: (prompt: string) => void;
}

function getCategoryIcon(iconName?: string, className = 'h-5 w-5') {
  switch (iconName) {
    case 'HeartPulse':
      return <HeartPulse className={`${className} text-rose-400`} />;
    case 'Flame':
      return <Flame className={`${className} text-amber-400`} />;
    case 'Car':
      return <Car className={`${className} text-amber-300`} />;
    case 'Users':
      return <Users className={`${className} text-cyan-300`} />;
    case 'GlobeLock':
      return <GlobeLock className={`${className} text-teal-300`} />;
    default:
      return <ShieldAlert className={`${className} text-red-400`} />;
  }
}

export const EmergencyNumberUniverse: React.FC<EmergencyNumberUniverseProps> = ({
  country,
  onSelectEntry,
  onRequestCallConfirm,
  onNavigateToNearby,
  onAskAssistant,
}) => {
  const [draggedCard, setDraggedCard] = useState<UniverseCardData | null>(null);
  const [activeDropZone, setActiveDropZone] = useState<'call' | 'learn' | 'nearby' | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Clear drag state safely if user cancels drag
  useEffect(() => {
    const handleDragEndGlobal = () => {
      setDraggedCard(null);
      setActiveDropZone(null);
    };
    window.addEventListener('dragend', handleDragEndGlobal);
    return () => window.removeEventListener('dragend', handleDragEndGlobal);
  }, []);

  // Compute 5-7 verified featured cards from the active country dataset
  const cards: UniverseCardData[] = useMemo(() => {
    const primaryUniversal = country.universal[0] || {
      number: '112',
      label: 'Emergency Response Support System',
      description: 'Unified National Emergency Helpline',
    };

    // Find the matching entry for universal number in categories if available
    let universalEntry: EmergencyNumberEntry | null = null;
    let universalCatName = 'Unified Emergency Assistance';
    let universalCatId = 'universal';

    for (const cat of country.categories) {
      const found = cat.numbers.find((n) => n.number === primaryUniversal.number);
      if (found) {
        universalEntry = found;
        universalCatName = cat.name;
        universalCatId = cat.id;
        break;
      }
    }

    if (!universalEntry) {
      universalEntry = {
        number: primaryUniversal.number,
        label: primaryUniversal.label,
        audience: 'Anyone facing an immediate crisis or threat to life.',
        whenToUse: primaryUniversal.description,
        coverage: 'Nationwide',
        hours: '24x7',
        tollFree: true,
        verificationStatus: 'verified',
        lastVerified: '2026-11',
        sourceUrl: 'https://112.gov.in/',
      };
    }

    const anchorCard: UniverseCardData = {
      id: `anchor-${primaryUniversal.number}`,
      number: primaryUniversal.number,
      label: primaryUniversal.label,
      categoryName: universalCatName,
      categoryId: universalCatId,
      iconName: 'ShieldAlert',
      audience: universalEntry.audience,
      whenToUse: universalEntry.whenToUse,
      coverage: universalEntry.coverage,
      hours: universalEntry.hours,
      tollFree: universalEntry.tollFree,
      isAnchor: true,
      lastVerified: universalEntry.lastVerified,
      sourceUrl: universalEntry.sourceUrl,
      animationDelay: '0s',
      animationDuration: '5.2s',
      entry: universalEntry,
    };

    // Statically deterministic parameters for orbital floating cards (NO Math.random()!)
    const timingParams = [
      { delay: '0.4s', duration: '4.6s' },
      { delay: '1.2s', duration: '5.4s' },
      { delay: '2.0s', duration: '4.8s' },
      { delay: '0.8s', duration: '5.1s' },
      { delay: '1.6s', duration: '4.5s' },
      { delay: '2.5s', duration: '5.0s' },
    ];

    const categoryCards: UniverseCardData[] = [];
    let paramIndex = 0;

    for (const cat of country.categories) {
      // Pick the primary or most crucial number from each category that isn't the universal anchor
      const candidate = cat.numbers.find((n) => n.number !== primaryUniversal.number) || cat.numbers[0];
      if (candidate && candidate.number !== primaryUniversal.number) {
        const timing = timingParams[paramIndex % timingParams.length];
        categoryCards.push({
          id: `${cat.id}-${candidate.number}`,
          number: candidate.number,
          label: candidate.label,
          categoryName: cat.name,
          categoryId: cat.id,
          iconName: cat.icon,
          audience: candidate.audience,
          whenToUse: candidate.whenToUse,
          coverage: candidate.coverage,
          hours: candidate.hours,
          tollFree: candidate.tollFree,
          isAnchor: false,
          lastVerified: candidate.lastVerified,
          sourceUrl: candidate.sourceUrl,
          animationDelay: timing.delay,
          animationDuration: timing.duration,
          entry: candidate,
        });
        paramIndex++;
        if (categoryCards.length >= 6) break;
      }
    }

    return [anchorCard, ...categoryCards];
  }, [country]);

  // Drag Event Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, card: UniverseCardData) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ number: card.number, label: card.label }));
    e.dataTransfer.effectAllowed = 'copyMove';
    setDraggedCard(card);
    setFeedbackMessage(null);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setActiveDropZone(null);
  };

  const handleDropCall = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedCard) return;
    const card = draggedCard;
    setDraggedCard(null);
    setActiveDropZone(null);
    setFeedbackMessage(`Prepared call confirmation for ${card.number} (${card.label})`);
    onRequestCallConfirm(card);
  };

  const handleDropLearn = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedCard) return;
    const card = draggedCard;
    setDraggedCard(null);
    setActiveDropZone(null);
    setFeedbackMessage(`Opening emergency triage details for ${card.number}`);
    onSelectEntry(card.categoryName, card.entry);
  };

  const handleDropNearby = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!draggedCard) return;
    const card = draggedCard;
    setDraggedCard(null);
    setActiveDropZone(null);

    // Map card category to nearby facility filter
    let facilityType: 'hospital' | 'police' | 'pharmacy' | 'doctor' = 'hospital';
    if (card.categoryId === 'medical') {
      facilityType = 'hospital';
    } else if (card.categoryId === 'police' || card.categoryId === 'cyber-disaster') {
      facilityType = 'police';
    }

    setFeedbackMessage(`Locating nearby facilities for ${card.categoryName}`);
    onNavigateToNearby(facilityType);
  };

  return (
    <section
      id="emergency-universe"
      aria-labelledby="universe-heading"
      className="relative scroll-mt-20 py-8 lg:py-12"
    >
      {/* Background Ambience: Subtle Deep Radial Starfield/Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden"
      >
        <div className="h-[520px] w-[520px] lg:h-[720px] lg:w-[720px] rounded-full bg-gradient-to-tr from-cyan-950/20 via-slate-900/30 to-red-950/25 blur-3xl" />
        <div className="absolute top-1/4 h-[300px] w-[300px] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      {/* Section Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-semibold text-cyan-300 backdrop-blur-md">
            <Radio className="h-3 w-3 animate-pulse text-cyan-400" />
            <span>Interactive Emergency Number Universe</span>
            <span aria-hidden="true" className="text-white/20">·</span>
            <span>{country.flag} {country.country}</span>
          </div>

          <h2
            id="universe-heading"
            className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white"
          >
            Explore Emergency Constellations
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Drag any emergency glass card into an action zone below, or tap directly to call, inspect verified dispatcher triage, or locate nearest responders.
          </p>
        </div>

        {/* Desktop Drag & Drop Guide Indicator */}
        <div className="hidden lg:flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0E121E]/80 px-4 py-2.5 backdrop-blur-md text-xs text-slate-300 shrink-0">
          <GripHorizontal className="h-4 w-4 text-cyan-400" />
          <span>
            <strong className="text-white">Hybrid Drag & Drop:</strong> Drag card to{' '}
            <span className="text-red-400 font-semibold">CALL</span>,{' '}
            <span className="text-cyan-400 font-semibold">LEARN</span>, or{' '}
            <span className="text-emerald-400 font-semibold">NEARBY</span>
          </span>
        </div>
      </div>

      {/* REVEALABLE HYBRID DROP ZONES (Visible during drag or as desktop action hub) */}
      <div
        role="region"
        aria-label="Emergency Action Drop Zones"
        className={`transition-all duration-300 mb-8 ${
          draggedCard
            ? 'opacity-100 scale-100 ring-2 ring-cyan-500/40'
            : 'opacity-90 lg:opacity-75 hover:opacity-100'
        }`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Drop Zone 1: CALL */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setActiveDropZone('call');
            }}
            onDragLeave={() => setActiveDropZone(null)}
            onDrop={handleDropCall}
            className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
              activeDropZone === 'call'
                ? 'border-red-500 bg-red-950/60 scale-[1.02] shadow-xl shadow-red-950/50'
                : 'border-red-500/30 bg-[#120D14]/80 hover:border-red-500/60 hover:bg-red-950/30'
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 mb-2">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div className="font-display font-bold text-sm text-red-200 tracking-wide uppercase">
              Drop to Call
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Opens verification dialog (never auto-dials)
            </div>
            {draggedCard && (
              <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-red-400/70 pointer-events-none animate-pulse" />
            )}
          </div>

          {/* Drop Zone 2: LEARN */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setActiveDropZone('learn');
            }}
            onDragLeave={() => setActiveDropZone(null)}
            onDrop={handleDropLearn}
            className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
              activeDropZone === 'learn'
                ? 'border-cyan-400 bg-cyan-950/60 scale-[1.02] shadow-xl shadow-cyan-950/50'
                : 'border-cyan-500/30 bg-[#0C1520]/80 hover:border-cyan-500/60 hover:bg-cyan-950/30'
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 mb-2">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="font-display font-bold text-sm text-cyan-200 tracking-wide uppercase">
              Drop to Learn
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Inspect triage guidelines & official protocol
            </div>
            {draggedCard && (
              <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-cyan-400/70 pointer-events-none animate-pulse" />
            )}
          </div>

          {/* Drop Zone 3: NEARBY */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setActiveDropZone('nearby');
            }}
            onDragLeave={() => setActiveDropZone(null)}
            onDrop={handleDropNearby}
            className={`relative flex flex-col items-center justify-center p-5 rounded-2xl border text-center transition-all duration-200 cursor-pointer ${
              activeDropZone === 'nearby'
                ? 'border-emerald-400 bg-emerald-950/60 scale-[1.02] shadow-xl shadow-emerald-950/50'
                : 'border-emerald-500/30 bg-[#0B1714]/80 hover:border-emerald-500/60 hover:bg-emerald-950/30'
            }`}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
              <MapPin className="h-5 w-5" />
            </div>
            <div className="font-display font-bold text-sm text-emerald-200 tracking-wide uppercase">
              Drop for Nearby
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5">
              Locate nearest emergency facilities on map
            </div>
            {draggedCard && (
              <div className="absolute inset-0 rounded-2xl border-2 border-dashed border-emerald-400/70 pointer-events-none animate-pulse" />
            )}
          </div>
        </div>

        {feedbackMessage && (
          <div
            role="status"
            className="mt-3 flex items-center justify-between rounded-xl border border-cyan-500/40 bg-cyan-950/80 px-4 py-2 text-xs text-cyan-200"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-cyan-300" />
              <span>{feedbackMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-[11px] text-cyan-300 underline hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>

      {/* FLOATING GLASS CONSTELLATION CONTAINER */}
      <div className="relative">
        {/* DESKTOP CONSTELLATION LAYOUT: Central Anchor flanked by balanced orbiting glass cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 items-stretch">
          {cards.map((card, idx) => {
            const isAnchor = card.isAnchor;
            const isSelected = selectedCardId === card.id;

            return (
              <div
                key={card.id}
                draggable
                onDragStart={(e) => handleDragStart(e, card)}
                onDragEnd={handleDragEnd}
                onClick={() => setSelectedCardId(card.id)}
                style={{
                  animationDelay: card.animationDelay,
                  animationDuration: card.animationDuration,
                }}
                className={`group relative flex flex-col justify-between rounded-2xl p-6 transition-all duration-300 select-none cursor-grab active:cursor-grabbing animate-universe-float ${
                  isAnchor
                    ? 'border-2 border-red-500/60 bg-gradient-to-b from-[#1E1119]/90 to-[#120E18]/90 shadow-2xl shadow-red-950/40 lg:col-span-1 lg:row-span-1 ring-1 ring-red-500/30'
                    : 'border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] bg-[#0E121E]/80 hover:border-cyan-400/50 hover:bg-[#111726]/90 shadow-xl'
                } ${
                  isSelected ? 'ring-2 ring-cyan-400 shadow-cyan-950/50' : ''
                } backdrop-blur-md hover:-translate-y-1.5`}
              >
                {/* Top Subtle Edge Reflection / Gloss Highlight */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/25 to-transparent rounded-t-2xl"
                />

                {/* Card Top Zone: Category, Verification & Drag Affordance */}
                <div>
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-300 pb-3 border-b border-white/[0.08]">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded-lg bg-white/5 border border-white/10">
                        {getCategoryIcon(card.iconName, 'h-4 w-4')}
                      </div>
                      <span className="font-semibold text-slate-200">
                        {card.categoryName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAnchor ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 border border-red-500/40 px-2 py-0.5 text-[10px] font-bold text-red-300">
                          Primary Anchor
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          <span>Verified</span>
                        </span>
                      )}
                      <span title="Drag this card" className="inline-flex items-center">
                        <GripHorizontal className="h-3.5 w-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                      </span>
                    </div>
                  </div>

                  {/* Main Large Number Display */}
                  <div className="mt-4 flex items-baseline justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {isAnchor ? 'Unified Emergency Hotline' : 'Direct Responder Line'}
                      </span>
                      <div
                        className={`font-mono-tabular text-4xl sm:text-5xl font-black tracking-tight ${
                          isAnchor ? 'text-red-400' : 'text-white group-hover:text-cyan-200 transition-colors'
                        }`}
                      >
                        {card.number}
                      </div>
                    </div>

                    <span className="font-mono-tabular text-[11px] text-slate-400 bg-white/5 px-2 py-1 rounded-md border border-white/10 shrink-0">
                      {card.tollFree ? 'Toll-Free' : 'Direct Line'}
                    </span>
                  </div>

                  <h3 className="mt-2 font-display text-base font-bold text-white group-hover:text-cyan-100 transition-colors">
                    {card.label}
                  </h3>

                  <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-2">
                    {card.whenToUse || card.audience}
                  </p>
                </div>

                {/* Card Action Hub: Call CTA, Details, Nearby */}
                <div className="mt-6 pt-4 border-t border-white/[0.08] space-y-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRequestCallConfirm(card);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3.5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-red-500 transition-all active:scale-[0.98]"
                    >
                      <PhoneCall className="h-3.5 w-3.5" />
                      <span>Call {card.number}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectEntry(card.categoryName, card.entry);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:border-cyan-400/40 hover:text-white transition-colors"
                    >
                      <BookOpen className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Learn</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        let fType: 'hospital' | 'police' | 'pharmacy' | 'doctor' = 'hospital';
                        if (card.categoryId === 'medical') fType = 'hospital';
                        else if (card.categoryId === 'police' || card.categoryId === 'cyber-disaster') fType = 'police';
                        onNavigateToNearby(fType);
                      }}
                      title="Find nearby facilities on map"
                      className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 p-2.5 text-xs font-semibold text-slate-200 hover:border-emerald-400/40 hover:text-white transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="sr-only">Nearby facilities</span>
                    </button>
                  </div>

                  {/* Coverage & Source metadata */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span>Coverage: {card.coverage}</span>
                    <a
                      href={card.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-slate-400 hover:text-cyan-300 transition-colors"
                    >
                      <span>Gov Source</span>
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* QUICK EMERGENCY PROMPT BRIDGE FOR AI ASSISTANT */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-[#0E121E]/70 p-5 backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
              <Sparkles className="h-4 w-4 text-cyan-300" />
              <span>JanMitra Multilingual AI Triage Support</span>
            </div>
            <p className="text-xs text-slate-300">
              Need immediate guidance in your language? Select a scenario or describe your situation:
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { label: 'Accident on highway', prompt: 'I witnessed a road accident on a highway. Who do I call?' },
              { label: 'Need ambulance', prompt: 'Someone needs an urgent ambulance. Is it 108 or 102?' },
              { label: 'Cyber financial fraud', prompt: 'Where and how can I report cyber fraud to freeze money via 1930?' },
              { label: 'Aag lag gayi hai', prompt: 'Mere area mein aag lag gayi hai, fire brigade ka number kya hai?' },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={() => onAskAssistant(chip.prompt)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-400/50 hover:bg-cyan-950/40 hover:text-white transition-colors"
              >
                <span>&ldquo;{chip.label}&rdquo;</span>
                <ArrowRight className="h-3 w-3 text-cyan-400" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TRANSITION BRIDGE TO COMPLETE SEARCHABLE DIRECTORY */}
      <div className="mt-10 text-center">
        <div className="inline-flex flex-col sm:flex-row items-center gap-3 rounded-2xl border border-white/10 bg-[#111420] px-6 py-4 shadow-lg">
          <span className="text-xs sm:text-sm text-slate-300">
            Looking for all specialized helplines, maternal transport, childlines, or state control rooms?
          </span>
          <a
            href="#categories"
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600/20 border border-cyan-500/40 px-4 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-600/30 transition-colors whitespace-nowrap"
          >
            <span>Explore All Emergency Categories</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
};
