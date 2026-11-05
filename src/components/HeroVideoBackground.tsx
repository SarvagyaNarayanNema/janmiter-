import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Upload, PhoneCall } from 'lucide-react';
import { CountryEmergencyData, formatTelHref } from '../lib/emergencyData';

export interface HeroVideoBackgroundProps {
  selectedCountry: CountryEmergencyData;
  variant?: 'ambient' | 'showcase';
}

export const HeroVideoBackground: React.FC<HeroVideoBackgroundProps> = ({
  selectedCountry,
  variant = 'showcase',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState<boolean>(false);

  const activeVideoSrc = customVideoUrl || '/earth-night-loop.mp4';
  const primaryUniversal = selectedCountry.universal[0];

  // Ensure muted looping playback starts reliably and resumes when tab becomes visible
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    const attemptPlay = () => {
      video
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
    };

    attemptPlay();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && video.paused && isPlaying) {
        attemptPlay();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeVideoSrc]);

  useEffect(() => {
    return () => {
      if (customVideoUrl) {
        URL.revokeObjectURL(customVideoUrl);
      }
    };
  }, [customVideoUrl]);

  const handleTogglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.muted = true;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    setCustomVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
  };

  if (variant === 'ambient') {
    return (
      <div
        aria-hidden="true"
        data-testid="hero-ambient-video-bg"
        className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl"
      >
        <video
          ref={videoRef}
          key={activeVideoSrc}
          src={activeVideoSrc}
          poster="/earth-night-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={() => setVideoReady(true)}
          className={`h-full w-full object-cover transition-opacity duration-700 ${
            videoReady ? 'opacity-35' : 'opacity-20'
          }`}
        />
        {/* Measured contrast scrim so hero text and CTAs maintain >4.5:1 WCAG AA legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#090A0F] via-[#090A0F]/85 to-[#090A0F]/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090A0F] via-transparent to-[#090A0F]/60" />
      </div>
    );
  }

  return (
    <div
      data-testid="hero-video-showcase"
      className="group relative h-[340px] w-full sm:h-[420px] overflow-hidden rounded-xl bg-[#05070D]"
    >
      <video
        ref={videoRef}
        key={activeVideoSrc}
        src={activeVideoSrc}
        poster="/earth-night-poster.jpg"
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setVideoReady(true)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        aria-label={`Looping muted emergency global satellite video focused on ${selectedCountry.country}`}
        className="h-full w-full object-cover"
      />

      {/* Measured contrast scrim for overlay legibility */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 bg-gradient-to-t from-[#090A0F]/90 via-[#090A0F]/20 to-transparent"
      />

      {/* Top-left Play/Pause & Custom Video Controls */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleTogglePlay}
          aria-label={isPlaying ? 'Pause background video' : 'Play background video'}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-[#090A0F]/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 backdrop-blur-md hover:border-white/30 hover:text-white transition-colors whitespace-nowrap"
        >
          {isPlaying ? (
            <>
              <Pause className="h-3 w-3 text-red-400" />
              <span>Pause Video</span>
            </>
          ) : (
            <>
              <Play className="h-3 w-3 text-emerald-400" />
              <span>Play Video</span>
            </>
          )}
        </button>

        <label
          title="Load a custom local video file"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#090A0F]/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 focus-within:opacity-100 hover:border-white/30 hover:text-white whitespace-nowrap"
        >
          <Upload className="h-3 w-3 text-sky-400" />
          <span>Custom Video</span>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            aria-label="Load custom looping emergency video"
            className="sr-only"
          />
        </label>
      </div>

      {/* Bottom Active Country Emergency Triage Bar over Video */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#090A0F]/85 px-3.5 py-2.5 backdrop-blur-md">
        <div className="min-w-0">
          <div className="text-[11px] text-slate-400 truncate">
            Active Emergency Grid · {selectedCountry.region}
          </div>
          <div className="text-xs font-bold text-white truncate">
            {selectedCountry.flag} {selectedCountry.country} — {primaryUniversal.label}
          </div>
        </div>

        <a
          href={formatTelHref(primaryUniversal.number)}
          aria-label={`Dial ${primaryUniversal.number} for ${selectedCountry.country}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0"
        >
          <PhoneCall className="h-3.5 w-3.5" />
          <span className="font-mono-tabular">{primaryUniversal.number}</span>
        </a>
      </div>
    </div>
  );
};
