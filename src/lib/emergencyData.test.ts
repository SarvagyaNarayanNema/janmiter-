import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_COUNTRIES,
  getCountryByCode,
  filterCountries,
  searchNumbersInCountry,
  formatTelHref,
  findNearestCountryByCoords,
  getDirectoryStats,
  buildVerifiedFallbackAnswer,
  buildEmergencySharePayload,
  validateDataIssueReport,
  validatePhotoToVideoRequest,
  getStandardEmergencyProcedures,
  buildAccessibilityAlertPattern,
} from './emergencyData.ts';

test('all 10 seeded countries validate against Zod schema and load cleanly', () => {
  assert.equal(ALL_COUNTRIES.length, 10);
  const codes = ALL_COUNTRIES.map((c) => c.code);
  for (const expected of ['IN', 'US', 'GB', 'CA', 'AU', 'AE', 'DE', 'FR', 'JP', 'SG']) {
    assert.ok(codes.includes(expected), `Missing country code ${expected}`);
  }
});

test('India (IN) includes all required verified numbers (112, 100, 101, 102, 108, 1033, 1073, 1091, 1098, 1930, 1078)', () => {
  const india = getCountryByCode('IN');
  assert.equal(india.country, 'India');
  assert.equal(india.universal[0].number, '112');

  const allNumbers = new Set<string>();
  for (const u of india.universal) allNumbers.add(u.number);
  for (const cat of india.categories) {
    for (const n of cat.numbers) {
      allNumbers.add(n.number);
      assert.ok(n.audience.length > 10, `Audience too short for ${n.number}`);
      assert.ok(n.whenToUse.length > 10, `whenToUse too short for ${n.number}`);
    }
  }

  for (const num of ['112', '100', '101', '102', '108', '1033', '1073', '1091', '1098', '1930', '1078', '1070']) {
    assert.ok(allNumbers.has(num), `India is missing required emergency number ${num}`);
  }
});

test('filterCountries and searchNumbersInCountry filter accurately', () => {
  const filtered = filterCountries('japan');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].code, 'JP');

  const india = getCountryByCode('IN');
  const highwayMatches = searchNumbersInCountry(india, 'all', '1033');
  assert.equal(highwayMatches.length, 1);
  assert.equal(highwayMatches[0].entry.number, '1033');

  const medicalMatches = searchNumbersInCountry(india, 'medical', '');
  assert.ok(medicalMatches.length >= 2);
});

test('formatTelHref preserves dialable characters including # and - removal', () => {
  assert.equal(formatTelHref('1-800-799-7233'), 'tel:18007997233');
  assert.equal(formatTelHref('#9910'), 'tel:#9910');
  assert.equal(formatTelHref('0808 2000 247'), 'tel:08082000247');
});

test('findNearestCountryByCoords maps coordinates to closest country', () => {
  const nearDelhi = findNearestCountryByCoords(28.6139, 77.209);
  assert.equal(nearDelhi.code, 'IN');

  const nearTokyo = findNearestCountryByCoords(35.6762, 139.6503);
  assert.equal(nearTokyo.code, 'JP');
});

test('getDirectoryStats and buildVerifiedFallbackAnswer return valid output', () => {
  const stats = getDirectoryStats();
  assert.equal(stats.countriesCount, 10);
  assert.ok(stats.numbersCount >= 50);

  const india = getCountryByCode('IN');
  const reply = buildVerifiedFallbackAnswer('Highway ambulance number?', india);
  assert.ok(reply.includes('112'));
  assert.ok(reply.includes('1033'));
});

test('buildEmergencySharePayload formats Web Share API title, text, and url cleanly with JANMITER branding', () => {
  const india = getCountryByCode('IN');
  const entry = india.categories[0].numbers[0];
  const payload = buildEmergencySharePayload(
    india,
    india.categories[0].name,
    entry,
    'https://janmiter.example/in'
  );
  assert.ok(payload.title.includes('JANMITER'));
  assert.ok(payload.title.includes(entry.number));
  assert.ok(payload.title.includes('India'));
  assert.ok(payload.text.includes(entry.audience));
  assert.ok(payload.text.includes(entry.whenToUse));
  assert.equal(payload.url, 'https://janmiter.example/in');
});

test('validateDataIssueReport rejects empty details and accepts valid feedback', () => {
  const invalid = validateDataIssueReport({
    countryCode: 'IN',
    number: '108',
    label: 'Emergency Trauma Ambulance',
    issueType: 'wrong_number',
    details: '  ',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.error);

  const valid = validateDataIssueReport({
    countryCode: 'IN',
    number: '108',
    label: 'Emergency Trauma Ambulance',
    issueType: 'coverage_change',
    details: 'In our district 108 now connects directly to ERSS 112.',
    suggestedCorrection: '112 / 108 integrated',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.report?.countryCode, 'IN');
  assert.equal(valid.report?.number, '108');
  assert.equal(valid.report?.suggestedCorrection, '112 / 108 integrated');
});

test('validatePhotoToVideoRequest enforces 16:9 or 9:16 aspect ratio and non-empty photo data', () => {
  const missingPhoto = validatePhotoToVideoRequest({
    imageBase64: '',
    aspectRatio: '16:9',
  });
  assert.equal(missingPhoto.valid, false);

  const badAspect = validatePhotoToVideoRequest({
    imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
    aspectRatio: '4:3',
  });
  assert.equal(badAspect.valid, false);

  const validLandscape = validatePhotoToVideoRequest({
    imageBase64: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
    mimeType: 'image/png',
    prompt: 'Emergency ambulance lights flashing in rain',
    aspectRatio: '16:9',
  });
  assert.equal(validLandscape.valid, true);
  assert.equal(validLandscape.data?.aspectRatio, '16:9');
  assert.equal(validLandscape.data?.imageBase64, 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ');

  const validPortrait = validatePhotoToVideoRequest({
    imageBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ',
    aspectRatio: '9:16',
  });
  assert.equal(validPortrait.valid, true);
  assert.equal(validPortrait.data?.aspectRatio, '9:16');
});

test('getStandardEmergencyProcedures returns category-specific first-aid and safety steps', () => {
  const medical = getStandardEmergencyProcedures('Medical & Ambulance', 'Emergency Trauma Ambulance');
  assert.equal(medical.categoryKey, 'medical');
  assert.ok(medical.steps.length >= 4);
  assert.ok(medical.criticalWarning.length > 10);

  const fire = getStandardEmergencyProcedures('Fire & Rescue', 'Fire & Rescue Services');
  assert.equal(fire.categoryKey, 'fire');
  assert.ok(fire.title.toLowerCase().includes('fire'));

  const highway = getStandardEmergencyProcedures('Highway & Road Emergency', 'National Highway Helpline (NHAI)');
  assert.equal(highway.categoryKey, 'highway');

  const cyber = getStandardEmergencyProcedures('Cyber Crime & Disaster', 'National Cyber Crime Helpline (I4C)');
  assert.equal(cyber.categoryKey, 'cyber');

  const disaster = getStandardEmergencyProcedures('Cyber Crime & Disaster', 'National Disaster Management Authority (NDMA)');
  assert.equal(disaster.categoryKey, 'disaster');

  const womenChild = getStandardEmergencyProcedures('Women & Child Safety', 'CHILDLINE India (Child in Distress)');
  assert.equal(womenChild.categoryKey, 'women_child');

  const police = getStandardEmergencyProcedures('Police & Public Safety', 'Police Control Room');
  assert.equal(police.categoryKey, 'police');
});

test('buildAccessibilityAlertPattern creates 3 ascending high-contrast pulses and spoken digit announcement', () => {
  const pattern = buildAccessibilityAlertPattern('India', '112');
  assert.equal(pattern.countryName, 'India');
  assert.equal(pattern.universalNumber, '112');
  assert.equal(pattern.pulses.length, 3);
  assert.ok(pattern.pulses[0].frequencyHz < pattern.pulses[1].frequencyHz);
  assert.ok(pattern.pulses[1].frequencyHz < pattern.pulses[2].frequencyHz);
  assert.ok(pattern.spokenAnnouncement.includes('JANMITER Emergency Directory open for India'));
  assert.ok(pattern.spokenAnnouncement.includes('1 1 2'));
});



