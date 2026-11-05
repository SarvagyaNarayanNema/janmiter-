# SOS World — Global Emergency Numbers Directory & 3D AI Assistant

SOS World is an offline-ready, mobile-first global emergency numbers directory paired with an interactive 3D AI Rescue Assistant. Visitors select or auto-detect their country, choose an emergency category, and immediately see verified numbers along with **WHO** each number is for and **WHEN** to use it.

---

## 1. Project Structure

```text
├── .env.example                           # Environment variable template
├── index.html                             # HTML entry point & PWA head metadata
├── package.json                           # Scripts & dependencies
├── server.ts                              # Express + Vite server (/api/chat, /api/tts, /api/countries)
├── vite.config.ts                         # Vite + Tailwind v4 + VitePWA offline service worker config
├── public/
│   ├── icon.svg                           # Brand vector icon
│   ├── apple-touch-icon.png               # iOS home screen icon (180x180)
│   ├── pwa-192x192.png                    # Android/Chromium PWA icon (192x192)
│   ├── pwa-512x512.png                    # Android/Chromium PWA icon (512x512)
│   └── pwa-maskable-512x512.png           # Maskable PWA icon with safe-zone padding
├── data/
│   └── emergency-numbers/                 # Verified country JSON files
│       ├── IN.json                        # India (112, 100, 101, 108, 102, 1033, 1073, 1091, 181, 1098, 1930, 1078, 1070, 139, 14416)
│       ├── US.json                        # United States (911, 988, Poison Control, Domestic Violence, Childhelp, FEMA, 511, CISA)
│       ├── GB.json                        # United Kingdom (999, 101, NHS 111, Samaritans, Refuge, Childline, National Highways, Action Fraud)
│       ├── CA.json                        # Canada (911, 988, 811, Poison Control, Kids Help Phone, 511, Anti-Fraud Centre)
│       ├── AU.json                        # Australia (000, 131 444, Lifeline 13 11 14, Poisons, 1800RESPECT, Kids Helpline, SES 13 25 00, Cyber)
│       ├── AE.json                        # United Arab Emirates (999, 901, 998, 997, 996, 116 111, 800 111, 800 2626, 991)
│       ├── DE.json                        # Germany (112, 110, 116 117, 116 123, 116 016, 116 111, 116 116)
│       ├── FR.json                        # France (112, 15 SAMU, 17 Police, 18 Pompiers, 114 SMS, 3114, 196, 3919, 119)
│       ├── JP.json                        # Japan (110, 119, 118, #7119, #9110, 189, 0120-279-889, #9910, JNTO Hotline)
│       └── SG.json                        # Singapore (999, 995, 1777, 1800 255 0000, 1767, 1800 777 0000, 1799 ScamShield, LTA EMAS)
└── src/
    ├── App.tsx                            # Main directory flow, hero, pinned universal banner, category & number cards
    ├── main.tsx                           # React root entry
    ├── index.css                          # Tailwind CSS v4 & reduced-motion rules
    ├── lib/
    │   ├── emergencyData.ts               # Zod schemas, country registry, search/filter, geolocation, fallback responder
    │   └── emergencyData.test.ts          # Unit tests (node:test)
    └── components/
        ├── NumberDetailModal.tsx          # Dispatcher script & deep-dive modal
        ├── PWAInstallModal.tsx            # Offline service worker status, install prompt & offline banner
        ├── RobotChatDrawer.tsx            # Streaming text + Web Speech API + ElevenLabs TTS assistant drawer
        ├── reactbits/
        │   └── ReactBitsComponents.tsx    # SplitText, DecryptedText, SpotlightCard, CountUp, Magnet, AuroraBackground
        └── three/
            ├── HeroGlobe3D.tsx            # Interactive 3D Emergency Globe with country coordinate beacons
            └── RobotAssistant3D.tsx       # Floating 3D Rescue Robot with cursor eye-tracking & speaking/thinking states
```

---

## 2. Setup, Run & Deployment Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables (`.env` or `.env.local`):**
   Copy `.env.example` to `.env.local` and set your keys:
   ```env
   GEMINI_API_KEY=<your_gemini_api_key>
   GEMINI_MODEL=gemini-3.8-flash
   ELEVENLABS_API_KEY=<your_elevenlabs_api_key>
   ELEVENLABS_VOICE_ID=Fo1P5yVLG09zFcOP3CtY
   ```
   *(All API keys are read strictly on the server in `server.ts` and never exposed to the client bundle.)*
3. **Run unit tests:**
   ```bash
   npx --yes tsx --test src/lib/emergencyData.test.ts
   ```
4. **Start the development server (Port 3000):**
   ```bash
   npm run dev
   ```
5. **Production build & start:**
   ```bash
   npm run build
   npm start
   ```

---

## 3. How to Add a New Country's JSON

1. Create `/data/emergency-numbers/{CC}.json` (e.g., `/data/emergency-numbers/BR.json`) following the Zod schema in `src/lib/emergencyData.ts`:
   ```json
   {
     "country": "Brazil",
     "code": "BR",
     "flag": "🇧🇷",
     "region": "South America",
     "coordinates": { "lat": -14.235, "lng": -51.9253 },
     "universal": [
       {
         "number": "190",
         "label": "Polícia Militar (Emergency Police)",
         "description": "Primary emergency police dispatch across Brazil."
       }
     ],
     "categories": [
       {
         "id": "medical",
         "name": "Medical & Ambulance",
         "icon": "HeartPulse",
         "description": "SAMU emergency ambulance service.",
         "numbers": [
           {
             "number": "192",
             "label": "SAMU Emergency Ambulance",
             "audience": "Anyone facing a medical emergency in Brazil",
             "whenToUse": "Call immediately for mobile emergency medical care.",
             "coverage": "Nationwide",
             "hours": "24x7",
             "tollFree": true,
             "verificationStatus": "verified",
             "lastVerified": "2026-11",
             "sourceUrl": "https://www.gov.br/saude/"
           }
         ]
       }
     ]
   }
   ```
2. Import the JSON file in `src/lib/emergencyData.ts` and append it to `rawCountries`. Zod automatically validates the file at startup and `HeroGlobe3D` automatically places a 3D beacon pin at its `coordinates`.

---

## 4. React Bits Components Used & Where

- **`AuroraBackground`** (`src/components/reactbits/ReactBitsComponents.tsx` -> `src/App.tsx`): Atmospheric dark emergency crimson/amber light field behind the page.
- **`SplitText`** (`src/components/reactbits/ReactBitsComponents.tsx` -> `src/App.tsx`): Hero headline word-level reveal with zero-latency DOM availability.
- **`DecryptedText`** (`src/components/reactbits/ReactBitsComponents.tsx` -> `src/App.tsx`): Tactical numeric reveal on the pinned Universal Emergency Number banner when switching countries.
- **`SpotlightCard`** (`src/components/reactbits/ReactBitsComponents.tsx` -> `src/App.tsx`): Cursor-tracking radial spotlight and subtle 3D tilt on Service Category cards and Emergency Number detail cards.
- **`CountUp`** (`src/components/reactbits/ReactBitsComponents.tsx` -> `src/App.tsx`): Animated tabular metrics in the Hero proof bar (Countries, Helplines, Languages).
- **`Magnet`** (`src/components/reactbits/ReactBitsComponents.tsx` -> `src/App.tsx`): Magnetic hover pull on the primary "Get Help Now" CTA button.
