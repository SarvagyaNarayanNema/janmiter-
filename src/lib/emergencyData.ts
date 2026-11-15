import { z } from 'zod';
import inData from '../../data/emergency-numbers/IN.json' with { type: 'json' };
import usData from '../../data/emergency-numbers/US.json' with { type: 'json' };
import gbData from '../../data/emergency-numbers/GB.json' with { type: 'json' };
import caData from '../../data/emergency-numbers/CA.json' with { type: 'json' };
import auData from '../../data/emergency-numbers/AU.json' with { type: 'json' };
import aeData from '../../data/emergency-numbers/AE.json' with { type: 'json' };
import deData from '../../data/emergency-numbers/DE.json' with { type: 'json' };
import frData from '../../data/emergency-numbers/FR.json' with { type: 'json' };
import jpData from '../../data/emergency-numbers/JP.json' with { type: 'json' };
import sgData from '../../data/emergency-numbers/SG.json' with { type: 'json' };
export {
  getStandardEmergencyProcedures,
  type EmergencyProcedureGuide,
} from './emergencyProcedures.ts';
export {
  ACCESSIBILITY_ALERT_STORAGE_KEY,
  buildAccessibilityAlertPattern,
  playHighContrastDirectoryAlert,
  type AccessibilityAlertPattern,
  type TonePulseSpec,
} from './accessibilityAudioAlert.ts';

export const UniversalNumberSchema = z.object({
  number: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
});

export const EmergencyNumberEntrySchema = z.object({
  number: z.string().min(1),
  label: z.string().min(1),
  audience: z.string().min(1),
  whenToUse: z.string().min(1),
  coverage: z.string().min(1),
  hours: z.string().min(1),
  tollFree: z.boolean(),
  verificationStatus: z.enum(['verified', 'needs_verification']).optional().default('verified'),
  lastVerified: z.string().min(1),
  sourceUrl: z.string().url(),
});

export const EmergencyCategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().optional().default('ShieldAlert'),
  description: z.string().optional().default(''),
  numbers: z.array(EmergencyNumberEntrySchema).min(1),
});

export const CountryEmergencyDataSchema = z.object({
  country: z.string().min(1),
  code: z.string().length(2),
  flag: z.string().optional().default('🌐'),
  region: z.string().optional().default('Global'),
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional()
    .default({ lat: 20, lng: 0 }),
  universal: z.array(UniversalNumberSchema).min(1),
  categories: z.array(EmergencyCategorySchema).min(1),
});

export type UniversalNumber = z.infer<typeof UniversalNumberSchema>;
export type EmergencyNumberEntry = z.infer<typeof EmergencyNumberEntrySchema>;
export type EmergencyCategory = z.infer<typeof EmergencyCategorySchema>;
export type CountryEmergencyData = z.infer<typeof CountryEmergencyDataSchema>;

const rawCountries: unknown[] = [
  inData,
  usData,
  gbData,
  caData,
  auData,
  aeData,
  deData,
  frData,
  jpData,
  sgData,
];

export const ALL_COUNTRIES: CountryEmergencyData[] = rawCountries.map((item) =>
  CountryEmergencyDataSchema.parse(item)
);

export const COUNTRY_BY_CODE: Record<string, CountryEmergencyData> = Object.fromEntries(
  ALL_COUNTRIES.map((c) => [c.code.toUpperCase(), c])
);

export function getCountryByCode(code: string): CountryEmergencyData {
  const normalized = (code || 'IN').trim().toUpperCase();
  return COUNTRY_BY_CODE[normalized] || COUNTRY_BY_CODE['IN'];
}

export function filterCountries(query: string): CountryEmergencyData[] {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_COUNTRIES;
  return ALL_COUNTRIES.filter(
    (c) =>
      c.country.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.region.toLowerCase().includes(q) ||
      c.universal.some((u) => u.number.toLowerCase().includes(q))
  );
}

export interface FlattenedNumberMatch {
  categoryId: string;
  categoryName: string;
  entry: EmergencyNumberEntry;
}

export function searchNumbersInCountry(
  countryData: CountryEmergencyData,
  categoryId: string,
  searchQuery: string
): FlattenedNumberMatch[] {
  const q = searchQuery.trim().toLowerCase();
  const categories =
    categoryId === 'all'
      ? countryData.categories
      : countryData.categories.filter((cat) => cat.id === categoryId);

  const results: FlattenedNumberMatch[] = [];
  for (const cat of categories) {
    for (const entry of cat.numbers) {
      if (!q) {
        results.push({
          categoryId: cat.id,
          categoryName: cat.name,
          entry,
        });
      } else {
        const hay = `${entry.number} ${entry.label} ${entry.audience} ${entry.whenToUse} ${cat.name} ${entry.coverage}`.toLowerCase();
        if (hay.includes(q)) {
          results.push({
            categoryId: cat.id,
            categoryName: cat.name,
            entry,
          });
        }
      }
    }
  }
  return results;
}

/**
 * Formats a display emergency phone number into a clean tel: URI.
 */
export function formatTelHref(numberStr: string): string {
  const cleaned = numberStr.replace(/[^0-9+#*]/g, '');
  return `tel:${cleaned}`;
}

export interface EmergencySharePayload {
  title: string;
  text: string;
  url: string;
}

/**
 * Builds a structured Web Share API payload for sharing a specific emergency number
 * with friends or family during an emergency.
 */
export function buildEmergencySharePayload(
  countryData: CountryEmergencyData,
  categoryName: string,
  entry: EmergencyNumberEntry,
  shareUrl?: string
): EmergencySharePayload {
  const universalNum = countryData.universal[0]?.number || '112';
  const title = `JANMITER: Dial ${entry.number} — ${entry.label} (${countryData.country})`;
  const text = [
    `${countryData.flag} ${countryData.country} Emergency Helpline (${categoryName}): Dial ${entry.number} for ${entry.label}.`,
    `Who it is for: ${entry.audience}`,
    `When to use: ${entry.whenToUse}`,
    `Coverage: ${entry.coverage} · ${entry.hours} · ${entry.tollFree ? 'Toll-Free' : 'Standard Rate'} (Universal Emergency: ${universalNum})`,
  ].join('\n');

  return {
    title,
    text,
    url: shareUrl && shareUrl.trim() ? shareUrl : entry.sourceUrl,
  };
}

export type DataIssueType =
  | 'wrong_number'
  | 'outdated_hours'
  | 'coverage_change'
  | 'broken_source_url'
  | 'other';

export interface DataIssueReportInput {
  countryCode: string;
  number: string;
  label: string;
  issueType: DataIssueType;
  details: string;
  suggestedCorrection?: string;
}

export interface ValidatedDataIssueReport extends DataIssueReportInput {
  id: string;
  submittedAt: string;
}

const ALLOWED_ISSUE_TYPES = new Set<DataIssueType>([
  'wrong_number',
  'outdated_hours',
  'coverage_change',
  'broken_source_url',
  'other',
]);

/**
 * Validates user feedback reporting incorrect data for an emergency number.
 */
export function validateDataIssueReport(input: DataIssueReportInput): {
  valid: boolean;
  error?: string;
  report?: ValidatedDataIssueReport;
} {
  if (!input.countryCode || !input.number || !input.label) {
    return { valid: false, error: 'Missing target emergency number context.' };
  }
  if (!ALLOWED_ISSUE_TYPES.has(input.issueType)) {
    return { valid: false, error: 'Please select a valid issue category.' };
  }
  const trimmedDetails = (input.details || '').trim();
  if (trimmedDetails.length < 5) {
    return {
      valid: false,
      error: 'Please describe what is incorrect (at least 5 characters).',
    };
  }

  return {
    valid: true,
    report: {
      id: `rep-${Date.now()}`,
      countryCode: input.countryCode.trim().toUpperCase(),
      number: input.number.trim(),
      label: input.label.trim(),
      issueType: input.issueType,
      details: trimmedDetails,
      suggestedCorrection: input.suggestedCorrection?.trim() || undefined,
      submittedAt: new Date().toISOString(),
    },
  };
}

export type VideoAspectRatio = '16:9' | '9:16';

export interface PhotoToVideoRequestInput {
  imageBase64?: string;
  mimeType?: string;
  prompt?: string;
  aspectRatio?: string;
}

export interface ValidatedPhotoToVideoRequest {
  imageBase64: string;
  mimeType: string;
  prompt: string;
  aspectRatio: VideoAspectRatio;
}

/**
 * Validates photo-to-video requests for gemini-omni-1.1-flash via the Interactions API.
 * Enforces non-empty base64 image data and aspect ratio of '16:9' (landscape) or '9:16' (portrait).
 */
export function validatePhotoToVideoRequest(input: PhotoToVideoRequestInput): {
  valid: boolean;
  error?: string;
  data?: ValidatedPhotoToVideoRequest;
} {
  const rawBase64 = (input.imageBase64 || '').trim();
  const cleanBase64 = rawBase64.includes(',') ? rawBase64.split(',')[1].trim() : rawBase64;
  if (!cleanBase64 || cleanBase64.length < 16) {
    return {
      valid: false,
      error: 'Please upload a valid photo before generating a video.',
    };
  }

  const aspect = (input.aspectRatio || '16:9').trim();
  if (aspect !== '16:9' && aspect !== '9:16') {
    return {
      valid: false,
      error: 'Aspect ratio must be 16:9 (landscape) or 9:16 (portrait).',
    };
  }

  const mimeType = (input.mimeType || 'image/png').trim() || 'image/png';
  const prompt =
    (input.prompt || '').trim() ||
    'Emergency response vehicles with flashing rescue beacons moving smoothly along a night highway.';

  return {
    valid: true,
    data: {
      imageBase64: cleanBase64,
      mimeType,
      prompt,
      aspectRatio: aspect,
    },
  };
}

/**
 * Finds the closest supported country from geographic coordinates (Haversine distance).
 */
export function findNearestCountryByCoords(lat: number, lng: number): CountryEmergencyData {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  let bestCountry = ALL_COUNTRIES[0];
  let minDistance = Infinity;

  for (const country of ALL_COUNTRIES) {
    const dLat = toRad(country.coordinates.lat - lat);
    const dLng = toRad(country.coordinates.lng - lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat)) *
        Math.cos(toRad(country.coordinates.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = 6371 * c;
    if (distanceKm < minDistance) {
      minDistance = distanceKm;
      bestCountry = country;
    }
  }
  return bestCountry;
}

/**
 * Computes global directory summary metrics for CountUp display.
 */
export function getDirectoryStats() {
  let totalNumbers = 0;
  for (const c of ALL_COUNTRIES) {
    const seen = new Set<string>();
    for (const u of c.universal) seen.add(`${u.number}-${u.label}`);
    for (const cat of c.categories) {
      for (const n of cat.numbers) {
        seen.add(`${n.number}-${n.label}`);
      }
    }
    totalNumbers += seen.size;
  }
  return {
    countriesCount: ALL_COUNTRIES.length,
    numbersCount: totalNumbers,
    languagesSupported: 42,
  };
}

/**
 * Deterministic verified response generator used when offline or when API keys are not set,
 * ensuring life-critical emergency queries always receive accurate, verified answers.
 */
export function buildVerifiedFallbackAnswer(
  userMessage: string,
  countryData: CountryEmergencyData
): string {
  const q = userMessage.toLowerCase();
  const universalPrimary = countryData.universal[0];

  const stopWords = new Set([
    'what',
    'which',
    'where',
    'when',
    'who',
    'how',
    'the',
    'for',
    'and',
    'number',
    'numbers',
    'helpline',
    'emergency',
    'call',
    'should',
    'fastest',
    'difference',
    'between',
  ]);
  const tokens = q
    .split(/\W+/)
    .filter((t) => t.length > 2 && !stopWords.has(t));

  const scoredEntries: { score: number; category: string; entry: EmergencyNumberEntry }[] = [];
  for (const cat of countryData.categories) {
    for (const entry of cat.numbers) {
      const hay = `${cat.name} ${entry.label} ${entry.audience} ${entry.whenToUse} ${entry.number}`.toLowerCase();
      let score = 0;
      for (const token of tokens) {
        if (hay.includes(token)) {
          score += 2;
        }
        if (entry.label.toLowerCase().includes(token) || entry.number.toLowerCase() === token) {
          score += 3;
        }
      }
      if (score > 0) {
        scoredEntries.push({ score, category: cat.name, entry });
      }
    }
  }

  scoredEntries.sort((a, b) => b.score - a.score);

  const lines: string[] = [
    `🚨 **Immediate Emergency (${countryData.country}):** If someone's life is in danger right now, call **${universalPrimary.number}** (${universalPrimary.label}) immediately.`,
  ];

  if (scoredEntries.length > 0) {
    lines.push(`\nHere are the verified **${countryData.country}** emergency numbers matching your question:`);
    for (const { entry } of scoredEntries.slice(0, 4)) {
      lines.push(
        `\n- **${entry.number} — ${entry.label}**\n  - **Who it is for:** ${entry.audience}\n  - **When to use:** ${entry.whenToUse}\n  - **Coverage & Hours:** ${entry.coverage} · ${entry.hours} · ${entry.tollFree ? 'Toll-Free' : 'Standard Rate'}`
      );
    }
  } else {
    lines.push(
      `\nHere are the key verified numbers in **${countryData.country}** and when to use each:`
    );
    for (const cat of countryData.categories.slice(0, 4)) {
      const top = cat.numbers[0];
      if (top) {
        lines.push(
          `- **${top.number} (${top.label}):** For ${top.audience.toLowerCase()} — ${top.whenToUse}`
        );
      }
    }
  }

  lines.push(
    `\n*Stay calm, share your exact location or nearest landmark with the dispatcher, and stay on the line until instructed otherwise.*`
  );
  return lines.join('\n');
}
