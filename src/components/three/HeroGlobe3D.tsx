import React, { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { CountryEmergencyData } from '../../lib/emergencyData';

interface HeroGlobe3DProps {
  selectedCountry: CountryEmergencyData;
  onSelectCountry?: (code: string) => void;
}

export const HeroGlobe3D: React.FC<HeroGlobe3DProps> = ({ selectedCountry }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    video.play().catch(() => {
      // Autoplay fallback handled by poster
    });
  }, [customVideoUrl]);

  useEffect(() => {
    return () => {
      if (customVideoUrl) {
        URL.revokeObjectURL(customVideoUrl);
      }
    };
  }, [customVideoUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const nextUrl = URL.createObjectURL(file);
    setCustomVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return nextUrl;
    });
  };

  return (
    <div
      data-testid="hero-globe-video-container"
      className="group relative h-[340px] w-full sm:h-[420px] overflow-hidden rounded-xl bg-[#05070D]"
    >
      <video
        ref={videoRef}
        key={customVideoUrl || '/earth-night-loop.mp4'}
        src={customVideoUrl || '/earth-night-loop.mp4'}
        poster="/earth-night-poster.jpg"
        autoPlay
        loop
        muted
        playsInline
        aria-label={`Looping orbital night view of Earth focused on ${selectedCountry.country}`}
        className="h-full w-full object-cover"
      />

      {/* Subtle atmospheric edge vignette */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10 bg-gradient-to-t from-[#090A0F]/65 via-transparent to-transparent"
      />

      {/* Optional custom video swap trigger on hover */}
      <label
        title="Replace with a local video file"
        className="absolute bottom-3 right-3 z-10 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#090A0F]/80 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 opacity-0 backdrop-blur-md transition-opacity group-hover:opacity-100 focus-within:opacity-100 hover:border-white/30 hover:text-white"
      >
        <Upload className="h-3 w-3 text-sky-400" />
        <span>Load Custom Video</span>
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          aria-label="Load custom looping Earth video"
          className="sr-only"
        />
      </label>
    </div>
  );
};
