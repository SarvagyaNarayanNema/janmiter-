import React, { useEffect } from 'react';
import { PhoneCall, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatTelHref } from '../lib/emergencyData';

interface CallConfirmationModalProps {
  isOpen: boolean;
  number: string;
  categoryName: string;
  label: string;
  audience?: string;
  whenToUse?: string;
  tollFree?: boolean;
  onClose: () => void;
}

export const CallConfirmationModal: React.FC<CallConfirmationModalProps> = ({
  isOpen,
  number,
  categoryName,
  label,
  audience,
  whenToUse,
  tollFree = true,
  onClose,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !number) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="call-confirmation-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-red-500/30 bg-[#0E121E] p-6 shadow-2xl">
        {/* Glow accent */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 rounded-full bg-red-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-cyan-600/15 blur-3xl" />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel emergency call confirmation"
          className="absolute top-4 right-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative space-y-5">
          {/* Header Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span>Emergency Call Confirmation</span>
          </div>

          <div>
            <h2
              id="call-confirmation-title"
              className="text-xl font-bold tracking-tight text-white font-display"
            >
              Confirm Emergency Call
            </h2>
            <p className="mt-1 text-xs text-slate-300">
              You are about to dial an official emergency responder helpline. Please confirm to launch your device dialer.
            </p>
          </div>

          {/* Number & Service Info Box */}
          <div className="rounded-xl border border-white/10 bg-[#07090F]/90 p-4 text-center space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
              {categoryName}
            </div>
            <div className="font-mono-tabular text-4xl sm:text-5xl font-black tracking-tight text-red-400">
              {number}
            </div>
            <div className="text-sm font-semibold text-white">
              {label}
            </div>
            {whenToUse && (
              <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed pt-1 border-t border-white/[0.06]">
                {whenToUse}
              </p>
            )}
            <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Official Government Helpline</span>
              <span>·</span>
              <span>{tollFree ? 'Toll-Free' : 'Standard Rate'}</span>
            </div>
          </div>

          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-200">
            <strong>Safety Notice:</strong> False calls to emergency services are punishable by law. Call only for genuine emergencies.
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/15 bg-white/5 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <a
              href={formatTelHref(number)}
              onClick={() => {
                // Keep modal open or close shortly after system dialer intent is triggered
                setTimeout(onClose, 500);
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 hover:bg-red-500 transition-all active:scale-[0.98]"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Call Now</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
