# Weather_tells

**Check the Weather_tells score before you step out.**

A CRED-inspired, single-page weather dashboard built with plain HTML, CSS and vanilla JavaScript. Search any city, see live conditions from WeatherAPI.com, get a simple weather personality + score, and inspect the exact API response in a developer JSON viewer.

> The Weather_tells score and verdict are application-generated interpretations. They are **not** real credit scores.

---

## Live demo

_Deployment URL is added after the production deploy._

---

## What it does

- Loads Mumbai automatically on first launch.
- Searches any city with a button or the Enter key.
- Provides popular-city shortcuts: Mumbai, Delhi, Bengaluru, Hyderabad, Chennai, Kolkata, Pune, Ahmedabad, New York and London.
- Shows live temperature in Celsius, condition, feels-like temperature, local city time and a condition-matched icon.
- Displays three primary metric cards: humidity, wind and UV index.
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
| FR-01.1 | Mumbai is the default city | `DEFAULT_CITY`, input default, chip list | 🟡 Pending test |
| FR-01.2 | Initial API call on load | `init()` → `searchCity('Mumbai')` | 🟡 Pending test |
| FR-01.3 | Initial loading indicator | Skeleton dashboard + search button busy state + top progress | 🟡 Pending test |
| FR-01.4 | Successful response renders card | `renderWeather()` | 🟡 Pending test |
| FR-01.5 | Failed response shows error state | `showError()` / standalone error banner | 🟡 Pending test |
| FR-02.1 | City search input | `#city-input` | 🟡 Pending test |
| FR-02.2 | Search button | `#search-btn` | 🟡 Pending test |
| FR-02.3 | Enter triggers search | Native form submit | 🟡 Pending test |
| FR-02.4 | Empty input validation, no request | `searchCity()` validation branch | 🟡 Pending test |
| FR-02.5 | Search fetches entered city | `/api/weather?q=…` | 🟡 Pending test |
| FR-02.6 | Result updates weather card | `renderWeather()` | 🟡 Pending test |
| FR-02.7 | Search failure shows city-not-found | API error code `1006` mapping | 🟡 Pending test |
| FR-03.1 | Popular city chips | `renderChips()` | 🟡 Pending test |
| FR-03.2 | Chip click triggers API request | `handleChipClick()` | 🟡 Pending test |
| FR-03.3 | Search input syncs with chip | `searchCity()` sets input | 🟡 Pending test |
| FR-03.4 | Selected city highlighted, previous cleared | `setActiveChip()` / `sameCity()` | 🟡 Pending test |
| FR-03.5 | All weather components update | Single render path | 🟡 Pending test |
| FR-04 | Current weather: Celsius, km/h, condition icon, local time, dynamic | `renderWeather()`, `weather.js` icon map | 🟡 Pending test |
| FR-05 | Dynamic personality, thresholds, priority, title/description | `getWeatherPersonality()` + priority table | 🟡 Pending test |
| FR-06 | Three primary metrics + six secondary details | `renderWeather()` | 🟡 Pending test |
| FR-07.1 | Formatted JSON | `JSON.stringify(data, null, 2)` + highlighting | 🟡 Pending test |
| FR-07.2 | Raw JSON preserves response text | `response.text()` passed through proxy unchanged | 🟡 Pending test |
| FR-07.3 | Tab switching | `setActiveTab()` + keyboard arrows | 🟡 Pending test |
| FR-07.4 | Copy current representation | `copyActiveView()` | 🟡 Pending test |
| FR-07.5 | JSON sync after every success | `setJsonResponse()` | 🟡 Pending test |
| FR-07.6 | Scroll support | `.json-view { overflow: auto }` | 🟡 Pending test |
| FR-08 | Error scenarios + retry + no blank card + no stale overwrite | `ERROR_CONTENT`, request IDs, abort controller, payload validation | 🟡 Pending test |
| FR-09 | Responsive layout, mobile stacking, no horizontal overflow | CSS breakpoints at 1020/860/700/420px | 🟡 Pending test |
| FR-10 | WeatherAPI integration, key in `.env`, dynamic data | `api/weather.js`, Vercel env | 🟡 Pending test |
| NFR | Performance, reliability, security, maintainability, compatibility, accessibility, scalability | Modules, semantic HTML, ARIA, server-side key, no dependencies | 🟡 Pending test |
| Scope | No auth, database, profiles, history, forecast, notifications, payments, admin | Not present | ✅ Confirmed |

### Test evidence

- [x] WeatherAPI key and `/v1/current.json` response verified from the command line (Mumbai returned live data).
- [ ] Initial load and Mumbai values verified in the deployed browser.
- [ ] Delhi/London searches verified.
- [ ] Popular-city chips and active-state behavior verified.
- [ ] Empty input, invalid city and error states verified.
- [ ] JSON formatted/raw content, copy and scroll verified.
- [ ] Mobile layout and horizontal-overflow check verified.
- [ ] Keyboard navigation and accessible names spot-checked.

> Statuses will be updated with actual browser evidence after the production deployment. Nothing in this README should be read as claiming an untested behavior works.

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
