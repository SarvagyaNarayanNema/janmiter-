export interface EmergencyProcedureGuide {
  categoryKey: string;
  title: string;
  summary: string;
  steps: string[];
  criticalWarning: string;
}

const PROCEDURE_GUIDES: Record<string, EmergencyProcedureGuide> = {
  medical: {
    categoryKey: 'medical',
    title: 'Medical & First-Aid Emergency Procedures',
    summary:
      'Immediate life-support actions to stabilize a patient while the ambulance is en route.',
    steps: [
      'Verify scene safety first, then check if the person is responsive and breathing normally.',
      'If unresponsive and not breathing normally, begin Hands-Only CPR: push hard and fast in the center of the chest (100–120 compressions per minute).',
      'For severe bleeding, apply firm, continuous direct pressure with a clean cloth or sterile dressing.',
      'Place an unconscious but breathing person in the recovery position (on their side) to keep their airway clear.',
      'Keep the patient warm and still, unlock the front door, and have someone wave down the arriving paramedics.',
    ],
    criticalWarning:
      'Do not move anyone with a suspected head, neck, or spinal injury unless they are in immediate physical danger, and do not give food or liquids to an unconscious person.',
  },
  fire: {
    categoryKey: 'fire',
    title: 'Fire Evacuation & Smoke Safety Procedures',
    summary:
      'Life-critical evacuation and smoke inhalation prevention steps during a structure or vehicle fire.',
    steps: [
      'Alert everyone nearby immediately and evacuate using the nearest stairwell — never use an elevator.',
      'Stay low or crawl beneath smoke ("Get Low and Go"), covering your nose and mouth with a cloth if available.',
      'Feel closed doors and handles with the back of your hand before opening; if hot, keep the door closed and use an alternate exit or signal from a window.',
      'If your clothes catch fire, Stop, Drop to the ground, and Roll back and forth while covering your face.',
      'Once outside, move to a safe assembly point upwind of the fire and report any trapped occupants to the arriving fire crew.',
    ],
    criticalWarning:
      'Never re-enter a burning building for any reason, and never pour water on an electrical or grease/oil fire.',
  },
  police: {
    categoryKey: 'police',
    title: 'Personal Security & Law Enforcement Procedures',
    summary:
      'Protective steps to stay safe and provide actionable intelligence to police dispatchers.',
    steps: [
      'Prioritize your physical safety first: move to a locked room or well-lit public shelter away from immediate danger.',
      'Quietly note key details without confronting suspects: exact address, physical description, clothing, weapons, and vehicle license plate or direction of travel.',
      'If it is unsafe to speak aloud, leave the phone line open on mute or use your country’s silent/SMS emergency feature so dispatchers can trace your location.',
      'Do not touch or disturb anything at the scene so forensic evidence remains intact.',
      'Keep your hands visible when officers arrive and follow their verbal instructions immediately.',
    ],
    criticalWarning:
      'Never attempt to physically apprehend or pursue an armed or dangerous individual yourself.',
  },
  highway: {
    categoryKey: 'highway',
    title: 'Highway & Road Crash Safety Procedures',
    summary:
      'Roadside collision protocols to prevent secondary crashes and speed up highway patrol arrival.',
    steps: [
      'Switch on hazard warning lights immediately and, if the vehicle can move safely, pull completely onto the emergency shoulder.',
      'Have all uninjured passengers exit away from live traffic lanes and stand behind the safety guardrail.',
      'Place reflective warning triangles 50–100 meters behind the vehicle if it is safe to do so.',
      'Identify the highway number, nearest kilometer/mile marker post, toll plaza direction, or GPS coordinates for the operator.',
      'Check injured occupants for breathing and severe bleeding while keeping them inside or clear of oncoming traffic.',
    ],
    criticalWarning:
      'Never stand in an active highway lane or between two parked vehicles on the shoulder, and do not remove a motorcyclist’s helmet unless CPR is required.',
  },
  women_child: {
    categoryKey: 'women_child',
    title: 'Women & Child Protection Safety Procedures',
    summary:
      'Immediate personal safety and crisis intervention steps when facing harassment, abuse, or distress.',
    steps: [
      'Move toward a crowded, well-lit area, 24-hour store, pharmacy, or transit security booth if you are outside.',
      'Share your live GPS location and vehicle/cab registration number with a trusted contact and the helpline operator.',
      'Keep the helpline call connected so the response team can hear surrounding audio and coordinate the nearest patrol unit.',
      'Preserve all call logs, text messages, photos, or digital evidence without deleting them.',
      'Request transport to a verified One-Stop Crisis Centre, safe shelter, or hospital if returning home is unsafe.',
    ],
    criticalWarning:
      'If you are in the same room as an aggressor and speaking aloud could escalate danger, silence your ringer and use text/SOS location sharing if available.',
  },
  cyber: {
    categoryKey: 'cyber',
    title: 'Financial Cyber Fraud & Account Freeze Procedures',
    summary:
      'Golden-Hour actions to block unauthorized transfers and preserve digital evidence.',
    steps: [
      'Call the cyber crime helpline immediately within the "Golden Hour" so banks can freeze the fraudulent transfer before funds are withdrawn.',
      'Block your compromised debit/credit card, net-banking login, or UPI ID via your bank’s official app or helpline.',
      'Locate and write down the exact Transaction Reference / UTR number, timestamp, and amount debited.',
      'Take clear screenshots of the fraudulent SMS, phishing link, caller number, and bank statement without deleting the original messages.',
      'Disconnect any suspicious remote-access or screen-sharing apps from your phone or computer immediately.',
    ],
    criticalWarning:
      'Never share your OTP, UPI PIN, CVV, or screen-sharing code with anyone claiming to be bank support or law enforcement.',
  },
  disaster: {
    categoryKey: 'disaster',
    title: 'Natural Disaster & Rescue Readiness Procedures',
    summary:
      'Survival and evacuation steps during floods, earthquakes, cyclones, or structural emergencies.',
    steps: [
      'Earthquake: Drop to your hands and knees, take Cover under sturdy furniture away from glass, and Hold On until shaking stops.',
      'Flood or Cyclone: Move immediately to higher ground or an upper floor; disconnect electrical appliances and shut off main gas/power valves if safe.',
      'Conserve mobile phone battery by enabling low-power mode and sending concise SMS location updates if voice networks are congested.',
      'Keep an emergency kit ready with drinking water, essential medications, flashlight, whistle, and waterproof ID documents.',
      'Signal rescue boats or helicopters from a clear roof or window using a bright cloth or flashlight.',
    ],
    criticalWarning:
      'Never walk, swim, or drive through moving floodwater (15 cm of fast water can knock an adult down; 30 cm can sweep a car away), and stay clear of downed power lines.',
  },
};

/**
 * Returns category-specific Standard Emergency Procedures (first-aid and safety steps)
 * from the static emergency procedure library.
 */
export function getStandardEmergencyProcedures(
  categoryNameOrId: string,
  entryLabel = ''
): EmergencyProcedureGuide {
  const labelLower = entryLabel.toLowerCase();
  const combined = `${categoryNameOrId} ${entryLabel}`.toLowerCase();

  // Check entryLabel first so combined categories like "Cyber Crime & Disaster"
  // resolve accurately for disaster entries (NDMA, FEMA, SES) vs cyber entries (1930, I4C).
  if (
    labelLower.includes('disaster') ||
    labelLower.includes('flood') ||
    labelLower.includes('earthquake') ||
    labelLower.includes('cyclone') ||
    labelLower.includes('ndma') ||
    labelLower.includes('ses') ||
    labelLower.includes('fema')
  ) {
    return PROCEDURE_GUIDES.disaster;
  }

  if (
    combined.includes('cyber') ||
    combined.includes('fraud') ||
    combined.includes('1930') ||
    combined.includes('scam')
  ) {
    return PROCEDURE_GUIDES.cyber;
  }

  if (
    combined.includes('disaster') ||
    combined.includes('flood') ||
    combined.includes('earthquake') ||
    combined.includes('cyclone') ||
    combined.includes('ndma') ||
    combined.includes('ses') ||
    combined.includes('fema')
  ) {
    return PROCEDURE_GUIDES.disaster;
  }

  if (
    combined.includes('fire') ||
    combined.includes('hazmat') ||
    combined.includes('smoke')
  ) {
    return PROCEDURE_GUIDES.fire;
  }

  if (
    combined.includes('highway') ||
    combined.includes('road') ||
    combined.includes('traffic') ||
    combined.includes('motorway') ||
    combined.includes('nhai')
  ) {
    return PROCEDURE_GUIDES.highway;
  }

  if (
    combined.includes('women') ||
    combined.includes('child') ||
    combined.includes('domestic') ||
    combined.includes('abuse') ||
    combined.includes('distress')
  ) {
    return PROCEDURE_GUIDES.women_child;
  }

  if (
    combined.includes('medical') ||
    combined.includes('ambulance') ||
    combined.includes('health') ||
    combined.includes('suicide') ||
    combined.includes('poison') ||
    combined.includes('samu') ||
    combined.includes('ems') ||
    combined.includes('trauma') ||
    combined.includes('maternal')
  ) {
    return PROCEDURE_GUIDES.medical;
  }

  if (
    combined.includes('police') ||
    combined.includes('crime') ||
    combined.includes('security') ||
    combined.includes('gendarmerie') ||
    combined.includes('railway')
  ) {
    return PROCEDURE_GUIDES.police;
  }

  return PROCEDURE_GUIDES.medical;
}
