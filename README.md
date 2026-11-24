# Weather_tells

**Check the Weather_tells score before you step out.**

A CRED-inspired, white-and-purple single-page weather dashboard built with plain HTML, CSS and vanilla JavaScript. Search any city, see live conditions and AQI from WeatherAPI.com, get a simple weather personality + score, and inspect the exact API response in a developer JSON viewer.

> The Weather_tells score and verdict are application-generated interpretations. They are **not** real credit scores.

---

## Live demo

**https://weather-tells.vercel.app**

Production deployment on Vercel. The WeatherAPI key is stored as an encrypted Vercel environment variable and read only by the serverless proxy.

---

## What it does

- Loads Mumbai automatically on first launch.
- Searches any city with a button or the Enter key.
- Provides popular-city shortcuts: Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad, New York and London.
- Shows live temperature in Celsius, condition, feels-like temperature, local city time and a condition-matched icon.
- Displays three primary metric cards: humidity, wind and UV index.
- Displays a live air-quality card with the US EPA 1–6 index, category, advice, PM2.5 and PM10.
- Displays secondary details: cloud cover, visibility, pressure, wind speed, Fahrenheit temperature and last-updated time.
- Generates a weather personality and a 0–100 Weather_tells score from live temperature, condition, wind, UV and humidity.
- Includes a developer JSON viewer with Formatted/Raw tabs, copy-to-clipboard, size indicator and scroll support.
- Handles empty input, invalid cities, invalid API keys, rate limits, offline/network failures, upstream timeouts, server failures and malformed responses.
- Keeps the last valid weather visible when a later request fails, and blocks stale responses from overwriting newer searches.
- Responsive from desktop to 360px mobile with no horizontal page overflow.
- Keyboard-friendly controls, visible focus states, ARIA labels/live regions and reduced-motion support.

---

## Stack

- **HTML5** — semantic, accessible page structure.
- **CSS3** — custom design system, responsive layout, animations.
- **Vanilla JavaScript (ES modules)** — no framework or runtime dependencies.
- **WeatherAPI.com** — `GET /v1/current.json`.
- **Vercel** — static hosting + one stateless serverless proxy (`api/weather.js`).

### Why there is one serverless function

The PRD requires the WeatherAPI key to live in `.env`, and a frontend key cannot be treated as a secure secret. `api/weather.js` is a thin, stateless proxy that:

1. Reads `WEATHER_API_KEY` from the server environment.
2. Calls WeatherAPI with the requested city.
3. Passes the upstream status and raw response body back unchanged.

There is no database, authentication, user profile or application backend. The proxy exists only to keep the key out of the browser and to avoid CORS issues.

---

## Project structure

```
.
├── api/
│   └── weather.js          # Serverless WeatherAPI proxy
├── css/
│   └── styles.css          # Full visual system + responsive rules
├── js/
│   ├── api.js              # Fetch + error classification + payload validation
│   ├── app.js              # App state, search, loading/error states, rendering
│   ├── json-viewer.js      # Formatted/raw JSON viewer, tabs, copy
│   └── weather.js          # Personalities, score, icons, thresholds, formatting
├── index.html
├── vercel.json
├── package.json
├── .env.example
└── README.md
```

---

## Local development

**Requirements:** Node.js 18+ and the Vercel CLI.

```bash
npm install -g vercel
cp .env.example .env
# put your WeatherAPI key in .env
vercel dev
```

Open the local URL printed by Vercel. The static files are served by Vercel and `/api/weather` runs the proxy with the key from `.env`.

A plain static server will render the page but will not provide the `/api/weather` function, so searches will fail with a network/service error.

---

## Deployment

1. Import the GitHub repository into Vercel, or link it with `vercel link`.
2. Add the environment variable:

   | Key | Value | Environments |
   | --- | --- | --- |
   | `WEATHER_API_KEY` | WeatherAPI.com key | Production, Preview, Development |

3. Deploy:

   ```bash
   vercel --prod
   ```

The `vercel.json` file sets basic security headers and a 10-second max duration for the proxy.

---

## Weather interpretation

Personality priority is resolved top to bottom, so overlapping conditions have a deterministic outcome:

| Priority | Condition | Personality | Recommendation |
| --- | --- | --- | --- |
| 1 | Rain, drizzle, showers or storms | **Rain Check** | Carry an umbrella before stepping out. |
| 2 | Snow, sleet, ice or blizzard | **Freeze Frame** | Bone-chilling cold. Bundle up tight. |
| 3 | Temperature ≥ 35 °C | **Sun Alert** | Stay hydrated and avoid excessive sun exposure. |
| 4 | Temperature ≤ 12 °C | **Freeze Frame** | Bone-chilling cold. Bundle up tight. |
| 5 | Wind ≥ 35 km/h | **Breezy Mode** | Expect strong winds. Dress accordingly. |
| 6 | Everything else | **Perfect Day** | Great weather to step outside. |

The score starts at 100 and subtracts transparent penalties for temperature discomfort, precipitation, high wind, UV and humidity. It is labelled in the UI as an application-generated interpretation.

---

## Requirement-wise implementation & testing checklist

Legend: **✅ Verified** = exercised in the browser against the acceptance criteria. **🟡 Implemented, pending test** = code is in place but has not yet been verified end-to-end.

| ID | Requirement | Implementation | Status |
| --- | --- | --- | --- |
| FR-01.1 | Mumbai is the default city | `DEFAULT_CITY`, input default, chip list | ✅ Verified (deployed) |
| FR-01.2 | Initial API call on load | `init()` → `searchCity('Mumbai')` | ✅ Verified (deployed) |
| FR-01.3 | Initial loading indicator | Skeleton dashboard + search button busy state + top progress | 🟡 Implemented, not directly observed |
| FR-01.4 | Successful response renders card | `renderWeather()` | ✅ Verified (deployed) |
| FR-01.5 | Failed response shows error state | `showError()` / standalone error banner | 🟡 API error verified; UI banner not exercised |
| FR-02.1 | City search input | `#city-input` | ✅ Verified (deployed) |
| FR-02.2 | Search button | `#search-btn` | ✅ Verified (deployed) |
| FR-02.3 | Enter triggers search | Native form submit | ✅ Verified (Delhi via Enter) |
| FR-02.4 | Empty input validation, no request | `searchCity()` validation branch | 🟡 Implemented, not exercised |
| FR-02.5 | Search fetches entered city | `/api/weather?q=…` | ✅ Verified (deployed) |
| FR-02.6 | Result updates weather card | `renderWeather()` | ✅ Verified (Hyderabad) |
| FR-02.7 | Search failure shows city-not-found | API error code `1006` mapping | 🟡 API 400 verified; UI copy not exercised |
| FR-03.1 | Popular city chips | `renderChips()` | ✅ Verified (all 10 render) |
| FR-03.2 | Chip click triggers API request | `handleChipClick()` | 🟡 Rendering and pressed state verified; click not exercised |
| FR-03.3 | Search input syncs with chip | `searchCity()` sets input | ✅ Verified (Hyderabad) |
| FR-03.4 | Selected city highlighted, previous cleared | `setActiveChip()` / `sameCity()` | ✅ Verified (Hyderabad only active) |
| FR-03.5 | All weather components update | Single render path | ✅ Verified (Hyderabad card + chip + JSON) |
| FR-04 | Current weather: Celsius, km/h, condition icon, local time, dynamic | `renderWeather()`, `weather.js` icon map | ✅ Verified (Mumbai: 29.7 °C, hpa, local time) |
| FR-05 | Dynamic personality, thresholds, priority, title/description | `getWeatherPersonality()` + priority table | ✅ Verified (Mumbai → Perfect Day, score 93) |
| FR-06 | Three primary metrics + six secondary details | `renderWeather()` | ✅ Verified (humidity 48, wind 11.5, UV 0 + details) |
| FR-06.1 | AQI card: index, category, advice, meter, PM2.5/PM10 | `getAqiInfo()`, `renderAqi()` | ✅ Verified (Mumbai AQI 3, PM2.5 63.6, PM10 65.2) |
| FR-07.1 | Formatted JSON | `JSON.stringify(data, null, 2)` + highlighting | ✅ Verified (formatted tab, 1012 B) |
| FR-07.2 | Raw JSON preserves response text | `response.text()` passed through proxy unchanged | 🟡 Raw tab present; not exercised |
| FR-07.3 | Tab switching | `setActiveTab()` + keyboard arrows | 🟡 Not exercised |
| FR-07.4 | Copy current representation | `copyActiveView()` | 🟡 Not exercised |
| FR-07.5 | JSON sync after every success | `setJsonResponse()` | ✅ Verified (scroll reset to 0) |
| FR-07.6 | Scroll support | `.json-view { overflow: auto }` | ✅ Verified (scrollHeight 1068 > clientHeight 398) |
| FR-08 | Error scenarios + retry + no blank card + no stale overwrite | `ERROR_CONTENT`, request IDs, abort controller, payload validation | 🟡 API errors verified; UI error flows not exercised |
| FR-09 | Responsive layout, mobile stacking, no horizontal overflow | CSS breakpoints at 1020/860/700/420px | 🟡 Desktop 912px verified with no overflow; mobile widths not tested |
| FR-10 | WeatherAPI integration, key in `.env`, dynamic data | `api/weather.js`, Vercel env | ✅ Verified (deployed proxy, 3 live cities, AQI) |
| NFR | Performance, reliability, security, maintainability, compatibility, accessibility, scalability | Modules, semantic HTML, ARIA, server-side key, no dependencies | 🟡 Code checks passed; no performance/accessibility audit |
| Scope | No auth, database, profiles, history, forecast, notifications, payments, admin | Not present | ✅ Confirmed |

### Test evidence

- [x] WeatherAPI key and `/v1/current.json` response verified from the command line (Mumbai returned live data).
- [x] Initial load and Mumbai values verified in the deployed browser (29.7 °C, Perfect Day, score 93, AQI 3).
- [x] Delhi and London verified through the deployed `/api/weather` proxy (200, live data, AQI present).
- [x] Enter-key search verified with Delhi and Hyderabad in the deployed browser.
- [x] Popular-city chips render with correct `aria-pressed` state; active chip clears previous selection.
- [x] Invalid city verified at API level: `/api/weather?q=__notfound__` returns HTTP 400.
- [x] JSON formatted tab renders the real response; viewer scrolls and resets to top after a search.
- [x] No console errors on the deployed Mumbai load; no horizontal overflow at 912px.
- [ ] Empty input validation, error banner/retry, Raw tab, Copy, chip clicks, mobile widths (390/360/320) and keyboard navigation still need a manual pass.
- [ ] Vercel auto-deploy from GitHub is not configured: the account has no GitHub login connection, so deployments are triggered via the Vercel API. See the deployment note below.

> Statuses reflect only what was actually exercised. Items marked 🟡 are implemented but not proven end-to-end in this build.

---

## API response fields used

| UI value | WeatherAPI field |
| --- | --- |
| City | `location.name` |
| Region/country | `location.region`, `location.country` |
| Local time | `location.localtime`, `location.tz_id` |
| Coordinates | `location.lat`, `location.lon` |
| Temperature °C / °F | `current.temp_c`, `current.temp_f` |
| Condition + icon | `current.condition.text`, `current.condition.code`, `current.is_day` |
| Feels like | `current.feelslike_c` |
| Humidity | `current.humidity` |
| Wind | `current.wind_kph` |
| UV | `current.uv` |
| AQI index / category | `current.air_quality["us-epa-index"]` (1–6 US EPA scale) |
| PM2.5 / PM10 | `current.air_quality.pm2_5`, `current.air_quality.pm10` |
| Cloud | `current.cloud` |
| Visibility | `current.vis_km` |
| Pressure | `current.pressure_mb` |
| Last updated | `current.last_updated` |

---

## Notes & limitations

- The app is intentionally scoped to current conditions only; there is no forecast, history, auth or database.
- The proxy forwards the exact upstream JSON, so the JSON viewer reflects the real API response (not a reconstructed object).
- If the WeatherAPI key is missing/invalid or the account hits its quota, the UI shows the corresponding configuration/temporary-service error instead of a blank weather card.
- The free WeatherAPI plan may rate-limit repeated requests.
- **Auto-deploy:** the Vercel project is live, but this Vercel account has no GitHub login connection, so Vercel cannot be linked to `Anjali-Git1/Weather_tells` yet. Until you connect GitHub in Vercel → Account Settings → Login Connections, pushes to `main` do not trigger a deployment automatically. Re-deploy from the Vercel dashboard, or run the same deployment script with the project token.
