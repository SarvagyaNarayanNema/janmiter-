import React, { useEffect, useState } from 'react';
import {
  PhoneCall,
  Copy,
  Check,
  Share2,
  ExternalLink,
  X,
  ShieldAlert,
  Flag,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
} from 'lucide-react';
import {
  CountryEmergencyData,
  EmergencyNumberEntry,
  DataIssueType,
  ValidatedDataIssueReport,
  formatTelHref,
  buildEmergencySharePayload,
  validateDataIssueReport,
  getStandardEmergencyProcedures,
} from '../lib/emergencyData';

interface NumberDetailModalProps {
  country: CountryEmergencyData;
  categoryName: string;
  entry: EmergencyNumberEntry | null;
  onClose: () => void;
  onAskAssistant: (question: string) => void;
}

const REPORTED_ISSUES_STORAGE_KEY = 'sos_world_reported_issues';

const ISSUE_TYPE_OPTIONS: { value: DataIssueType; label: string }[] = [
  { value: 'wrong_number', label: 'Wrong or disconnected phone number' },
  { value: 'outdated_hours', label: 'Outdated operating hours or toll-free status' },
  { value: 'coverage_change', label: 'Coverage area or regional routing changed' },
  { value: 'broken_source_url', label: 'Official government source link is broken' },
  { value: 'other', label: 'Other correction or clarification' },
];

export const NumberDetailModal: React.FC<NumberDetailModalProps> = ({
  country,
  categoryName,
  entry,
  onClose,
  onAskAssistant,
}) => {
  const [copied, setCopied] = useState(false);
  const [sharedStatus, setSharedStatus] = useState<'idle' | 'shared' | 'copied'>('idle');
  const [isProceduresOpen, setIsProceduresOpen] = useState(false);

  // Report Incorrect Data form state
  const [isReporting, setIsReporting] = useState(false);
  const [issueType, setIssueType] = useState<DataIssueType>('wrong_number');
  const [suggestedCorrection, setSuggestedCorrection] = useState('');
  const [details, setDetails] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReport, setSubmittedReport] =
    useState<ValidatedDataIssueReport | null>(null);

  // Reset modal internal state when entry changes
  useEffect(() => {
    setCopied(false);
    setSharedStatus('idle');
    setIsProceduresOpen(false);
    setIsReporting(false);
    setIssueType('wrong_number');
    setSuggestedCorrection('');
    setDetails('');
    setFormError(null);
    setIsSubmitting(false);
    setSubmittedReport(null);
  }, [entry?.number, entry?.label, country.code]);

  if (!entry) return null;

  const procedureGuide = getStandardEmergencyProcedures(categoryName, entry.label);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(entry.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleQuickShare = async () => {
    const payload = buildEmergencySharePayload(
      country,
      categoryName,
      entry,
      typeof window !== 'undefined' ? window.location.href : undefined
    );

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        setSharedStatus('shared');
        setTimeout(() => setSharedStatus('idle'), 2000);
        return;
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(`${payload.title}\n${payload.text}\n${payload.url}`);
    } catch {
      // ignore clipboard errors
    }
    setSharedStatus('copied');
    setTimeout(() => setSharedStatus('idle'), 2000);
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validation = validateDataIssueReport({
      countryCode: country.code,
      number: entry.number,
      label: entry.label,
      issueType,
      details,
      suggestedCorrection,
    });

    if (!validation.valid || !validation.report) {
      setFormError(validation.error || 'Please provide valid feedback details.');
      return;
    }

    setIsSubmitting(true);
    let finalReport = validation.report;

    try {
      const res = await fetch('/api/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryCode: country.code,
          number: entry.number,
          label: entry.label,
          issueType,
          details,
          suggestedCorrection,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { report?: ValidatedDataIssueReport };
        if (data.report) {
          finalReport = data.report;
        }
      }
    } catch {
      // Offline fallback: persist locally below
    } finally {
      try {
        const existingRaw = localStorage.getItem(REPORTED_ISSUES_STORAGE_KEY);
        const existing: ValidatedDataIssueReport[] = existingRaw
          ? JSON.parse(existingRaw)
          : [];
        localStorage.setItem(
          REPORTED_ISSUES_STORAGE_KEY,
          JSON.stringify([finalReport, ...existing].slice(0, 50))
        );
      } catch {
        // ignore storage quota errors
      }
      setIsSubmitting(false);
      setSubmittedReport(finalReport);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="number-detail-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
    >
      <div className="relative my-auto w-full max-w-xl rounded-2xl border border-white/10 bg-[#11131C] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <div className="text-xs text-slate-400">
              <span>
                {country.flag} {country.country}
              </span>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
              <span>{categoryName}</span>
            </div>
            <h2
              id="number-detail-modal-title"
              className="mt-1 text-xl font-bold text-white"
            >
              {entry.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close emergency number details"
            className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-[#090A0F] border border-white/[0.08] p-5">
          <div>
            <div className="text-xs text-slate-400">Direct Dial Number</div>
            <div className="mt-1 font-mono-tabular text-4xl font-bold tracking-tight text-white">
              {entry.number}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <a
              href={formatTelHref(entry.number)}
              aria-label={`Call ${entry.number} for ${entry.label}`}
              className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-500 transition-colors whitespace-nowrap shrink-0"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Call {entry.number}</span>
            </a>
            <button
              type="button"
              onClick={handleCopy}
              aria-label={`Copy number ${entry.number}`}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleQuickShare}
              aria-label={`Quick share ${entry.number} (${entry.label})`}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              {sharedStatus !== 'idle' ? (
                <>
                  <Check className="h-4 w-4 text-emerald-400" />
                  <span>
                    {sharedStatus === 'shared' ? 'Shared' : 'Share Copied'}
                  </span>
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 text-sky-400" />
                  <span>Quick Share</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-4 text-sm">
          <div>
            <h3 className="text-xs font-semibold text-slate-400">
              Who This Number Is For
            </h3>
            <p className="mt-1 text-slate-100 leading-relaxed">{entry.audience}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-slate-400">
              When To Use It
            </h3>
            <p className="mt-1 text-slate-200 leading-relaxed">{entry.whenToUse}</p>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-[#090A0F]/70 p-4">
            <h3 className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4" />
              <span>What To Tell The Dispatcher First</span>
            </h3>
            <ol className="mt-2 space-y-1 text-xs text-slate-300 list-decimal list-inside">
              <li>Your exact location, highway milestone, or nearest visible landmark.</li>
              <li>What happened and how many people need immediate medical or rescue help.</li>
              <li>Your callback phone number in case the call disconnects.</li>
            </ol>
          </div>

          {/* Collapsible Standard Emergency Procedures Section */}
          <div className="rounded-xl border border-white/[0.08] bg-[#090A0F]/90 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsProceduresOpen((prev) => !prev)}
              aria-expanded={isProceduresOpen}
              aria-controls="standard-emergency-procedures-panel"
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-red-400 shrink-0" />
                <div>
                  <span className="block text-xs font-bold text-white">
                    Standard Emergency Procedures
                  </span>
                  <span className="block text-[11px] text-slate-400">
                    {procedureGuide.title} ({categoryName})
                  </span>
                </div>
              </div>
              {isProceduresOpen ? (
                <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
              )}
            </button>

            {isProceduresOpen && (
              <div
                id="standard-emergency-procedures-panel"
                role="region"
                aria-label="Standard Emergency Procedures"
                className="border-t border-white/[0.08] px-4 py-3.5 space-y-3 text-xs"
              >
                <p className="text-slate-300 leading-relaxed">
                  {procedureGuide.summary}
                </p>

                <ol className="space-y-1.5 text-slate-200 list-decimal list-inside leading-relaxed">
                  {procedureGuide.steps.map((step, idx) => (
                    <li key={idx}>{step}</li>
                  ))}
                </ol>

                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200 leading-relaxed">
                  <strong className="text-amber-300">Critical Safety Note:</strong>{' '}
                  {procedureGuide.criticalWarning}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.08] text-xs text-slate-400">
            <div>
              <span>Coverage: {entry.coverage}</span>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
              <span>Hours: {entry.hours}</span>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
              <span>{entry.tollFree ? 'Toll-Free' : 'Standard Rate'}</span>
              <span aria-hidden="true" className="mx-1.5">
                ·
              </span>
              <span>Verified {entry.lastVerified}</span>
            </div>
            <a
              href={entry.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 underline underline-offset-4 whitespace-nowrap"
            >
              <span>Official Source</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Inline Report Incorrect Data Form / Confirmation */}
        {isReporting && (
          <div className="mt-5 rounded-xl border border-white/10 bg-[#090A0F] p-4 space-y-3">
            {submittedReport ? (
              <div
                role="status"
                className="space-y-2 text-xs text-slate-200"
              >
                <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Thank you — Data Feedback Recorded</span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  Your report for{' '}
                  <strong className="text-white">
                    {entry.number} ({entry.label})
                  </strong>{' '}
                  in {country.country} has been logged for verification (Ref:{' '}
                  <code className="text-slate-200">{submittedReport.id}</code>).
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSubmittedReport(null);
                      setIsReporting(false);
                    }}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/15 transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} noValidate className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5 text-amber-400" />
                    <span>
                      Report Incorrect Data for {entry.number} ({country.country})
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReporting(false);
                      setFormError(null);
                    }}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="report-issue-type"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Issue Category
                  </label>
                  <select
                    id="report-issue-type"
                    value={issueType}
                    onChange={(e) => setIssueType(e.target.value as DataIssueType)}
                    className="w-full rounded-lg border border-white/10 bg-[#11131C] px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
                  >
                    {ISSUE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="report-suggested-correction"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    Suggested Number or Official Source (Optional)
                  </label>
                  <input
                    id="report-suggested-correction"
                    type="text"
                    value={suggestedCorrection}
                    onChange={(e) => setSuggestedCorrection(e.target.value)}
                    placeholder="e.g. Updated helpline number or government URL"
                    className="w-full rounded-lg border border-white/10 bg-[#11131C] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="report-issue-details"
                    className="block text-xs font-medium text-slate-300 mb-1"
                  >
                    What needs to be corrected? *
                  </label>
                  <textarea
                    id="report-issue-details"
                    rows={3}
                    value={details}
                    onChange={(e) => {
                      setDetails(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    placeholder="Describe the discrepancy (e.g. regional routing change, updated hours, or official notice)..."
                    className="w-full rounded-lg border border-white/10 bg-[#11131C] px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:border-red-500 focus:outline-none"
                  />
                </div>

                {formError && (
                  <div
                    role="alert"
                    className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300"
                  >
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-400" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReporting(false);
                      setFormError(null);
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onAskAssistant(
                  `Explain when I should call ${entry.number} (${entry.label}) in ${country.country} and what steps to take while waiting for help.`
                );
              }}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              Ask AI Assistant About {entry.number}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsReporting((prev) => !prev);
                setFormError(null);
              }}
              aria-expanded={isReporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Report incorrect data</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/15 transition-colors whitespace-nowrap"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
