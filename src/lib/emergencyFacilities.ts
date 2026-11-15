export interface EmergencyFacility {
  id: string;
  name: string;
  category: 'hospital' | 'police' | 'pharmacy' | 'doctor';
  address: string;
  lat: number;
  lng: number;
  phoneNumber?: string;
  tollFree?: boolean;
  hours?: string;
  countryCode: string;
  rating?: number;
  googleMapsURI?: string;
  distanceKm?: number;
}

// Haversine formula to compute great-circle distance between two coordinates in kilometers
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function formatDistance(distanceKm?: number): string {
  if (distanceKm === undefined || Number.isNaN(distanceKm)) return '';
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }
  return `${distanceKm.toFixed(1)} km away`;
}

// Curated verified emergency facilities per country
export const VERIFIED_EMERGENCY_FACILITIES: EmergencyFacility[] = [
  // ================= INDIA (IN) =================
  // Hospitals & Trauma Centers
  {
    id: 'in-hosp-1',
    name: 'AIIMS Jai Prakash Narayan Apex Trauma Center',
    category: 'hospital',
    address: 'Ring Road, Raj Nagar, Safdarjung Enclave, New Delhi 110029',
    lat: 28.5684,
    lng: 77.2069,
    phoneNumber: '+91-11-2658-8500',
    tollFree: false,
    hours: '24x7 Emergency Trauma Care',
    countryCode: 'IN',
    rating: 4.6,
  },
  {
    id: 'in-hosp-2',
    name: 'Safdarjung Hospital & VMMC Emergency Ward',
    category: 'hospital',
    address: 'Ansari Nagar West, New Delhi 110029',
    lat: 28.5702,
    lng: 77.2081,
    phoneNumber: '+91-11-2616-5060',
    tollFree: false,
    hours: '24x7 Emergency Casualty',
    countryCode: 'IN',
    rating: 4.2,
  },
  {
    id: 'in-hosp-3',
    name: 'King Edward Memorial (KEM) Hospital & Casualty',
    category: 'hospital',
    address: 'Acharya Donde Marg, Parel, Mumbai, Maharashtra 400012',
    lat: 19.0026,
    lng: 72.8427,
    phoneNumber: '+91-22-2410-7000',
    tollFree: false,
    hours: '24x7 Emergency & Critical Care',
    countryCode: 'IN',
    rating: 4.4,
  },
  {
    id: 'in-hosp-4',
    name: 'Victoria Hospital (Bangalore Medical College)',
    category: 'hospital',
    address: 'Fort Road, Near City Market, Bengaluru, Karnataka 560002',
    lat: 12.9647,
    lng: 77.5756,
    phoneNumber: '+91-80-2670-1150',
    tollFree: false,
    hours: '24x7 Trauma & Burn Unit',
    countryCode: 'IN',
    rating: 4.3,
  },
  {
    id: 'in-hosp-5',
    name: 'Apollo Emergency Trauma Centre (Pan-India Dispatch)',
    category: 'hospital',
    address: 'Greams Lane, Thousand Lights, Chennai, Tamil Nadu 600006',
    lat: 13.0604,
    lng: 80.2518,
    phoneNumber: '1066',
    tollFree: true,
    hours: '24x7 Critical Care Ambulance Service',
    countryCode: 'IN',
    rating: 4.7,
  },
  {
    id: 'in-hosp-6',
    name: 'PGIMER Advanced Trauma Centre',
    category: 'hospital',
    address: 'Sector 12, Chandigarh, 160012',
    lat: 30.7645,
    lng: 76.7766,
    phoneNumber: '+91-172-274-7837',
    tollFree: false,
    hours: '24x7 Emergency Care',
    countryCode: 'IN',
    rating: 4.6,
  },

  // Police Stations & Control Rooms
  {
    id: 'in-pol-1',
    name: 'National Emergency Response Support System (ERSS 112 Control Centre)',
    category: 'police',
    address: 'Ministry of Home Affairs, Jai Singh Road, New Delhi 110001',
    lat: 28.6275,
    lng: 77.2144,
    phoneNumber: '112',
    tollFree: true,
    hours: '24x7 Pan-India GPS Dispatch',
    countryCode: 'IN',
    rating: 4.8,
  },
  {
    id: 'in-pol-2',
    name: 'Delhi Police Headquarters & Modern Control Room',
    category: 'police',
    address: 'Jai Singh Road, Connaught Place, New Delhi 110001',
    lat: 28.6288,
    lng: 77.2132,
    phoneNumber: '100',
    tollFree: true,
    hours: '24x7 Law Enforcement',
    countryCode: 'IN',
    rating: 4.3,
  },
  {
    id: 'in-pol-3',
    name: 'Greater Mumbai Police Headquarters Control Room',
    category: 'police',
    address: 'Opposite Crawford Market, Fort, Mumbai, Maharashtra 400001',
    lat: 18.9467,
    lng: 72.8342,
    phoneNumber: '100',
    tollFree: true,
    hours: '24x7 PCR Dispatch',
    countryCode: 'IN',
    rating: 4.5,
  },
  {
    id: 'in-pol-4',
    name: 'Bengaluru City Police Command & Control Centre',
    category: 'police',
    address: 'Infantry Road, Shivaji Nagar, Bengaluru, Karnataka 560001',
    lat: 12.9818,
    lng: 77.6046,
    phoneNumber: '112',
    tollFree: true,
    hours: '24x7 Namma 112 Command',
    countryCode: 'IN',
    rating: 4.6,
  },
  {
    id: 'in-pol-5',
    name: 'National Cyber Crime Reporting Portal (I4C Command Unit)',
    category: 'police',
    address: 'CISF Complex, Block 14, CGO Complex, Lodhi Road, New Delhi 110003',
    lat: 28.5878,
    lng: 77.2389,
    phoneNumber: '1930',
    tollFree: true,
    hours: '24x7 Financial Fraud Freeze Line',
    countryCode: 'IN',
    rating: 4.7,
  },

  // 24h Pharmacies & Emergency Chemists
  {
    id: 'in-pharm-1',
    name: 'Apollo Pharmacy 24 Hours Emergency Chemist',
    category: 'pharmacy',
    address: 'Connaught Circus, Block M, New Delhi 110001',
    lat: 28.6328,
    lng: 77.2201,
    phoneNumber: '1860-500-0101',
    tollFree: true,
    hours: 'Open 24 Hours',
    countryCode: 'IN',
    rating: 4.5,
  },
  {
    id: 'in-pharm-2',
    name: 'AIIMS 24-Hour Amrit Pharmacy',
    category: 'pharmacy',
    address: 'Ground Floor, Main Hospital Building, AIIMS, New Delhi 110029',
    lat: 28.5672,
    lng: 77.2104,
    phoneNumber: '+91-11-2659-4444',
    tollFree: false,
    hours: 'Open 24 Hours (Subsidized Medicines)',
    countryCode: 'IN',
    rating: 4.4,
  },
  {
    id: 'in-pharm-3',
    name: 'Wellness Forever 24x7 Day & Night Pharmacy',
    category: 'pharmacy',
    address: 'Bandra West, Hill Road, Mumbai, Maharashtra 400050',
    lat: 19.0553,
    lng: 72.8335,
    phoneNumber: '1800-102-4247',
    tollFree: true,
    hours: 'Open 24 Hours',
    countryCode: 'IN',
    rating: 4.6,
  },
  {
    id: 'in-pharm-4',
    name: 'MedPlus 24-Hour Emergency Medical Store',
    category: 'pharmacy',
    address: 'Indiranagar 100 Feet Road, Bengaluru, Karnataka 560038',
    lat: 12.9719,
    lng: 77.6412,
    phoneNumber: '040-6700-6700',
    tollFree: false,
    hours: 'Open 24 Hours',
    countryCode: 'IN',
    rating: 4.3,
  },

  // Emergency Clinics & First-Aid Centers
  {
    id: 'in-doc-1',
    name: 'Indian Red Cross Society National Emergency First-Aid Post',
    category: 'doctor',
    address: '1 Red Cross Road, New Delhi 110001',
    lat: 28.6195,
    lng: 77.209,
    phoneNumber: '+91-11-2371-6441',
    tollFree: false,
    hours: '24x7 First-Aid & Blood Bank Dispatch',
    countryCode: 'IN',
    rating: 4.5,
  },
  {
    id: 'in-doc-2',
    name: 'St. John Ambulance Emergency Medical Brigade',
    category: 'doctor',
    address: 'Red Cross Building, Parliament Street, New Delhi 110001',
    lat: 28.6214,
    lng: 77.2128,
    phoneNumber: '+91-11-2371-5220',
    tollFree: false,
    hours: '24x7 Mobile Medical Support',
    countryCode: 'IN',
    rating: 4.4,
  },
  {
    id: 'in-doc-3',
    name: 'National Health Mission Emergency Helpline Clinic (104)',
    category: 'doctor',
    address: 'Directorate of Health Services, Sector 34, Chandigarh 160022',
    lat: 30.7225,
    lng: 76.7682,
    phoneNumber: '104',
    tollFree: true,
    hours: '24x7 Medical Advice & Doctor Consultation',
    countryCode: 'IN',
    rating: 4.6,
  },

  // ================= UNITED STATES (US) =================
  {
    id: 'us-hosp-1',
    name: 'NYC Health + Hospitals / Bellevue Trauma Center',
    category: 'hospital',
    address: '462 1st Ave., New York, NY 10016',
    lat: 40.7397,
    lng: -73.9763,
    phoneNumber: '+1-212-562-4141',
    tollFree: false,
    hours: '24x7 Level 1 Trauma Center',
    countryCode: 'US',
    rating: 4.5,
  },
  {
    id: 'us-pol-1',
    name: 'NYPD Emergency Communications & 911 Operations',
    category: 'police',
    address: '1 Police Plaza, New York, NY 10038',
    lat: 40.7121,
    lng: -74.0019,
    phoneNumber: '911',
    tollFree: true,
    hours: '24x7 Emergency Dispatch',
    countryCode: 'US',
    rating: 4.7,
  },
  {
    id: 'us-pharm-1',
    name: 'Walgreens 24-Hour Emergency Pharmacy',
    category: 'pharmacy',
    address: '145 4th Ave, New York, NY 10003',
    lat: 40.7335,
    lng: -73.9897,
    phoneNumber: '+1-212-677-0214',
    tollFree: false,
    hours: 'Open 24 Hours',
    countryCode: 'US',
    rating: 4.2,
  },
  {
    id: 'us-doc-1',
    name: 'CityMD 24x7 Urgent Care & Walk-in Emergency Clinic',
    category: 'doctor',
    address: '14 W 14th St, New York, NY 10011',
    lat: 40.7366,
    lng: -73.9944,
    phoneNumber: '+1-212-390-0558',
    tollFree: false,
    hours: 'Walk-in Medical Clinic',
    countryCode: 'US',
    rating: 4.4,
  },

  // ================= UNITED KINGDOM (GB) =================
  {
    id: 'gb-hosp-1',
    name: "St Thomas' Hospital A&E and Major Trauma",
    category: 'hospital',
    address: 'Westminster Bridge Rd, London SE1 7EH',
    lat: 51.4988,
    lng: -0.1186,
    phoneNumber: '+44-20-7188-7188',
    tollFree: false,
    hours: '24x7 Accident & Emergency',
    countryCode: 'GB',
    rating: 4.5,
  },
  {
    id: 'gb-pol-1',
    name: 'Metropolitan Police Service (New Scotland Yard)',
    category: 'police',
    address: 'Victoria Embankment, London SW1A 2JL',
    lat: 51.5029,
    lng: -0.1246,
    phoneNumber: '999',
    tollFree: true,
    hours: '24x7 Police Emergency Response',
    countryCode: 'GB',
    rating: 4.6,
  },
  {
    id: 'gb-pharm-1',
    name: 'Boots 24-Hour Emergency Chemist',
    category: 'pharmacy',
    address: 'Piccadilly Circus, London W1D 7NE',
    lat: 51.5101,
    lng: -0.1342,
    phoneNumber: '+44-20-7734-6126',
    tollFree: false,
    hours: 'Open 24 Hours',
    countryCode: 'GB',
    rating: 4.3,
  },
  {
    id: 'gb-doc-1',
    name: 'NHS 111 Urgent Care Medical Centre',
    category: 'doctor',
    address: 'Soho Walk-in Centre, 1 Frith St, London W1D 3HZ',
    lat: 51.5147,
    lng: -0.1322,
    phoneNumber: '111',
    tollFree: true,
    hours: '24x7 Urgent Medical Advice',
    countryCode: 'GB',
    rating: 4.5,
  },

  // ================= AUSTRALIA (AU) =================
  {
    id: 'au-hosp-1',
    name: 'The Royal Melbourne Hospital Emergency Department',
    category: 'hospital',
    address: '300 Grattan St, Parkville VIC 3050',
    lat: -37.7993,
    lng: 144.956,
    phoneNumber: '+61-3-9342-7000',
    tollFree: false,
    hours: '24x7 Emergency Care',
    countryCode: 'AU',
    rating: 4.6,
  },
  {
    id: 'au-pol-1',
    name: 'Victoria Police Centre (Triple Zero 000)',
    category: 'police',
    address: '311 Spencer St, Docklands VIC 3008',
    lat: -37.8184,
    lng: 144.9515,
    phoneNumber: '000',
    tollFree: true,
    hours: '24x7 Emergency Dispatch',
    countryCode: 'AU',
    rating: 4.7,
  },

  // ================= CANADA (CA) =================
  {
    id: 'ca-hosp-1',
    name: 'Toronto General Hospital Emergency Department',
    category: 'hospital',
    address: '200 Elizabeth St, Toronto, ON M5G 2C4',
    lat: 43.6591,
    lng: -79.3877,
    phoneNumber: '+1-416-340-4800',
    tollFree: false,
    hours: '24x7 Emergency Room',
    countryCode: 'CA',
    rating: 4.5,
  },
  {
    id: 'ca-pol-1',
    name: 'Toronto Police Service Headquarters',
    category: 'police',
    address: '40 College St, Toronto, ON M5G 2J3',
    lat: 43.6617,
    lng: -79.3854,
    phoneNumber: '911',
    tollFree: true,
    hours: '24x7 Police Dispatch',
    countryCode: 'CA',
    rating: 4.6,
  },

  // ================= JAPAN (JP) =================
  {
    id: 'jp-hosp-1',
    name: 'The University of Tokyo Hospital Emergency Center',
    category: 'hospital',
    address: '7-3-1 Hongo, Bunkyo City, Tokyo 113-8655',
    lat: 35.7126,
    lng: 139.7619,
    phoneNumber: '+81-3-3815-5411',
    tollFree: false,
    hours: '24x7 Critical Care Emergency Unit',
    countryCode: 'JP',
    rating: 4.7,
  },
  {
    id: 'jp-pol-1',
    name: 'Tokyo Metropolitan Police Department Headquarters (110)',
    category: 'police',
    address: '2-1-1 Kasumigaseki, Chiyoda City, Tokyo 100-8929',
    lat: 35.6764,
    lng: 139.7528,
    phoneNumber: '110',
    tollFree: true,
    hours: '24x7 Police Emergency Center',
    countryCode: 'JP',
    rating: 4.8,
  },

  // ================= GERMANY (DE) =================
  {
    id: 'de-hosp-1',
    name: 'Charité - Universitätsmedizin Berlin Emergency Department',
    category: 'hospital',
    address: 'Charitéplatz 1, 10117 Berlin',
    lat: 52.5255,
    lng: 13.3777,
    phoneNumber: '+49-30-450-50',
    tollFree: false,
    hours: '24x7 Notaufnahme (Emergency)',
    countryCode: 'DE',
    rating: 4.5,
  },
  {
    id: 'de-pol-1',
    name: 'Polizei Berlin Einsatzleitzentrale (110)',
    category: 'police',
    address: 'Platz der Luftbrücke 6, 12101 Berlin',
    lat: 52.4842,
    lng: 13.3871,
    phoneNumber: '110',
    tollFree: true,
    hours: '24x7 Police Dispatch',
    countryCode: 'DE',
    rating: 4.6,
  },

  // ================= FRANCE (FR) =================
  {
    id: 'fr-hosp-1',
    name: 'Hôpital Pitié-Salpêtrière Urgences (SAMU 15)',
    category: 'hospital',
    address: '47-83 Bd de l Hôpital, 75013 Paris',
    lat: 48.8384,
    lng: 2.3644,
    phoneNumber: '15',
    tollFree: true,
    hours: '24x7 SAMU Emergency Care',
    countryCode: 'FR',
    rating: 4.6,
  },

  // ================= SINGAPORE (SG) =================
  {
    id: 'sg-hosp-1',
    name: 'Singapore General Hospital Emergency Department',
    category: 'hospital',
    address: 'Outram Rd, Singapore 169608',
    lat: 1.2794,
    lng: 103.8344,
    phoneNumber: '+65-6321-4311',
    tollFree: false,
    hours: '24x7 Emergency Care',
    countryCode: 'SG',
    rating: 4.6,
  },

  // ================= UAE (AE) =================
  {
    id: 'ae-hosp-1',
    name: 'Rashid Hospital Trauma & Emergency Centre',
    category: 'hospital',
    address: 'Umm Hurair 2, Dubai',
    lat: 25.2443,
    lng: 55.3218,
    phoneNumber: '+971-4-219-2000',
    tollFree: false,
    hours: '24x7 Major Trauma Unit',
    countryCode: 'AE',
    rating: 4.7,
  },
];

export function getFacilitiesForLocation(
  countryCode: string,
  category: 'hospital' | 'police' | 'pharmacy' | 'doctor',
  centerLat: number,
  centerLng: number
): EmergencyFacility[] {
  const normCode = (countryCode || 'IN').toUpperCase();

  // Filter by category and optionally countryCode
  let matches = VERIFIED_EMERGENCY_FACILITIES.filter(
    (f) => f.category === category && f.countryCode === normCode
  );

  // If no country-specific facilities exist in that category, include all facilities in category
  if (matches.length === 0) {
    matches = VERIFIED_EMERGENCY_FACILITIES.filter((f) => f.category === category);
  }

  // Calculate distance from center coordinates
  const withDistance = matches.map((f) => {
    const dist = calculateDistanceKm(centerLat, centerLng, f.lat, f.lng);
    const googleMapsURI = `https://www.google.com/maps/dir/?api=1&destination=${f.lat},${f.lng}`;
    return {
      ...f,
      distanceKm: dist,
      googleMapsURI,
    };
  });

  // Sort by closest distance
  return withDistance.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
}
