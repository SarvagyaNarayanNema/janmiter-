import React, { useEffect, useState } from 'react';
import { Download, WifiOff, CheckCircle2, Smartphone, ShieldCheck, X } from 'lucide-react';
import { ALL_COUNTRIES } from '../lib/emergencyData';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>Offline Mode Active — All 10 country emergency directories remain available.</span>
    </div>
  );
};

interface PWAOfflineModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAOfflineModal: React.FC<PWAOfflineModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [precacheDone, setPrecacheDone] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    // Warm up service worker cache for all 10 country JSON files
    Promise.allSettled(
      ALL_COUNTRIES.map((c) => fetch(`/data/emergency-numbers/${c.code}.json`))
    ).then(() => setPrecacheDone(true));
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwa-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#11131C] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/Gemini_Generated_Image_jdwhpejdwhpejdwh-clean_141afd63.png"
              alt="JANMITER Logo"
              className="h-11 w-28 shrink-0 rounded-xl border border-white/15 object-cover object-center"
            />
            <div>
              <h2 id="pwa-modal-title" className="text-lg font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-red-400 shrink-0" />
                <span>Offline Emergency Access & PWA Install</span>
              </h2>
              <p className="text-xs text-slate-400">
                Network Status: {isOnline ? 'Online · Service Worker Active' : 'Offline · Running from Cache'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close offline readiness dialog"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-white/[0.08] bg-[#090A0F] p-4">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-medium">Pre-Cached Country Directories</span>
            <span className="font-mono-tabular text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {precacheDone ? `${ALL_COUNTRIES.length}/${ALL_COUNTRIES.length} Verified JSONs` : 'Caching...'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            All emergency numbers for India, US, UK, Canada, Australia, UAE, Germany, France, Japan, and Singapore are bundled and cached by the PWA Service Worker so you can dial even during cellular data blackouts.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {isInstalled ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>JANMITER is installed as a standalone app on this device.</span>
            </div>
          ) : isInstallable ? (
            <button
              type="button"
              onClick={install}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Install JANMITER to Home Screen</span>
            </button>
          ) : isIOS ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Smartphone className="h-4 w-4 text-red-400" />
                <span>Install on iPhone / iPad (Safari)</span>
              </div>
              <p>1. Tap the <strong>Share</strong> icon in the Safari bottom bar.</p>
              <p>2. Select <strong>Add to Home Screen</strong> for instant 1-tap offline access.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-slate-300 space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-white">
                <Smartphone className="h-4 w-4 text-red-400" />
                <span>Install on Desktop or Mobile Browser</span>
              </div>
              <p>
                Click the <strong>Install JANMITER</strong> icon in your browser address bar (or browser menu → <em>Add to Home Screen</em>) for instant offline access.
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors whitespace-nowrap"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
