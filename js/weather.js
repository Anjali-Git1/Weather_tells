/**
 * Weather interpretation and formatting helpers.
 *
 * Personality priority (overlaps resolved top to bottom):
 *   1. Rain / storm conditions  -> Rain Check
 *   2. Snow / ice conditions    -> Freeze Frame
 *   3. Very hot (>= 35 °C)      -> Sun Alert
 *   4. Very cold (<= 12 °C)     -> Freeze Frame
 *   5. Windy (>= 35 km/h)       -> Breezy Mode
 *   6. Everything else          -> Perfect Day
 */

export const DEFAULT_CITY = 'Mumbai';

export const POPULAR_CITIES = Object.freeze([
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'New York',
  'London',
]);

export const THRESHOLDS = Object.freeze({
  veryHotC: 35,
  veryColdC: 12,
  windyKph: 35,
});

const AQI_LEVELS = Object.freeze([
  Object.freeze({
    max: 1,
    label: 'Good',
    tone: 'good',
    advice: 'Air quality is satisfactory for most people.',
  }),
  Object.freeze({
    max: 2,
    label: 'Moderate',
    tone: 'moderate',
    advice: 'Acceptable for most; sensitive groups may notice it.',
  }),
  Object.freeze({
    max: 3,
    label: 'Sensitive groups',
    tone: 'sensitive',
    advice: 'Sensitive groups should limit prolonged outdoor exertion.',
  }),
  Object.freeze({
    max: 4,
    label: 'Unhealthy',
    tone: 'unhealthy',
    advice: 'Everyone may feel effects. Reduce time outdoors.',
  }),
  Object.freeze({
    max: 5,
    label: 'Very unhealthy',
    tone: 'very-unhealthy',
    advice: 'Avoid outdoor exertion. Stay indoors where possible.',
  }),
  Object.freeze({
    max: 6,
    label: 'Hazardous',
    tone: 'hazardous',
    advice: 'Emergency conditions. Avoid outdoor activity.',
  }),
]);

const PERSONALITIES = Object.freeze({
  rain: Object.freeze({
    key: 'rain',
    title: 'Rain Check',
    description: 'Carry an umbrella before stepping out.',
    index: '01',
  }),
  sun: Object.freeze({
    key: 'sun',
    title: 'Sun Alert',
    description: 'Stay hydrated and avoid excessive sun exposure.',
    index: '02',
  }),
  freeze: Object.freeze({
    key: 'freeze',
    title: 'Freeze Frame',
    description: 'Bone-chilling cold. Bundle up tight.',
    index: '03',
  }),
  wind: Object.freeze({
    key: 'wind',
    title: 'Breezy Mode',
    description: 'Expect strong winds. Dress accordingly.',
    index: '04',
  }),
  perfect: Object.freeze({
    key: 'perfect',
    title: 'Perfect Day',
    description: 'Great weather to step outside.',
    index: '05',
  }),
});

const WEEKDAYS = Object.freeze(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
const MONTHS = Object.freeze([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]);

const CITY_GROUPS = Object.freeze([
  ['mumbai', 'bombay'],
  ['bengaluru', 'bangalore'],
  ['chennai', 'madras'],
  ['kolkata', 'calcutta'],
  ['pune', 'poona'],
  ['ahmedabad', 'ahmadabad'],
  ['delhi', 'new delhi'],
  ['new york', 'new york city', 'nyc'],
]);

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function conditionText(current) {
  return String(current?.condition?.text || '').toLowerCase();
}

function isStormy(text) {
  return /thunder|storm|lightning/.test(text);
}

function isRainy(text) {
  return /rain|drizzle|shower/.test(text);
}

function isSnowy(text) {
  return /snow|blizzard|sleet|ice/.test(text);
}

function isMisty(text) {
  return /fog|mist|haze|smoke/.test(text);
}

export function getWeatherPersonality(current) {
  const text = conditionText(current);
  const temperature = toNumber(current?.temp_c);
  const wind = toNumber(current?.wind_kph);

  if (isStormy(text) || isRainy(text)) return PERSONALITIES.rain;
  if (isSnowy(text)) return PERSONALITIES.freeze;
  if (temperature >= THRESHOLDS.veryHotC) return PERSONALITIES.sun;
  if (temperature <= THRESHOLDS.veryColdC) return PERSONALITIES.freeze;
  if (wind >= THRESHOLDS.windyKph) return PERSONALITIES.wind;
  return PERSONALITIES.perfect;
}

/**
 * A transparent, application-generated comfort score (0-100).
 * It is deliberately labelled in the UI as an interpretation, not a real
 * credit score. Temperature is the biggest factor, followed by precipitation,
 * wind, UV and humidity.
 */
export function computeSkyScore(current) {
  const temperature = toNumber(current?.temp_c);
  const wind = toNumber(current?.wind_kph);
  const uv = toNumber(current?.uv);
  const humidity = toNumber(current?.humidity);
  const text = conditionText(current);

  let score = 100;

  if (Number.isFinite(temperature)) {
    if (temperature < 18) score -= Math.min(28, (18 - temperature) * 2.4);
    else if (temperature > 30) score -= Math.min(34, (temperature - 30) * 2.4);
  }

  if (isStormy(text)) score -= 30;
  else if (isRainy(text)) score -= 19;
  else if (isSnowy(text)) score -= 26;
  else if (isMisty(text)) score -= 7;

  if (Number.isFinite(wind) && wind > 20) {
    score -= Math.min(18, (wind - 20) * 0.6);
  }

  if (Number.isFinite(uv) && uv > 6) {
    score -= Math.min(14, (uv - 6) * 2.2);
  }

  if (Number.isFinite(humidity)) {
    if (humidity > 70) score -= Math.min(9, (humidity - 70) * 0.35);
    else if (humidity < 25) score -= Math.min(7, (25 - humidity) * 0.4);
  }

  return Math.max(5, Math.min(100, Math.round(score)));
}

export function getAqiInfo(current) {
  const air = current?.air_quality;
  const index = toNumber(air?.['us-epa-index']);

  if (!air || !Number.isFinite(index) || index < 1) return null;

  const bounded = Math.min(6, Math.max(1, Math.round(index)));
  const level = AQI_LEVELS[bounded - 1];

  return {
    index: bounded,
    label: level.label,
    tone: level.tone,
    advice: level.advice,
    pm25: toNumber(air.pm2_5),
    pm10: toNumber(air.pm10),
  };
}

export function getScoreGrade(score) {
  if (score >= 90) return { label: 'Excellent', color: '#6d28d9' };
  if (score >= 75) return { label: 'Good', color: '#7c3aed' };
  if (score >= 60) return { label: 'Fair', color: '#a855f7' };
  if (score >= 40) return { label: 'Poor', color: '#c2410c' };
  return { label: 'Risky', color: '#dc2626' };
}

export function getWeatherIconKey(current) {
  const text = conditionText(current);
  const code = toNumber(current?.condition?.code);
  const isDay = Number(current?.is_day) !== 0;

  if (code >= 1273 || isStormy(text)) return 'storm';

  if (
    code === 1114 ||
    code === 1117 ||
    (code >= 1204 && code <= 1237) ||
    (code >= 1255 && code <= 1264) ||
    isSnowy(text)
  ) {
    return 'snow';
  }

  if (
    code === 1063 ||
    code === 1072 ||
    (code >= 1150 && code <= 1201) ||
    (code >= 1240 && code <= 1249) ||
    isRainy(text)
  ) {
    return 'rain';
  }

  if (code === 1030 || code === 1135 || code === 1147 || isMisty(text)) {
    return 'mist';
  }

  if (/wind/.test(text)) return 'wind';

  if (code === 1003 || /partly|mostly/.test(text)) {
    return isDay ? 'cloud-sun' : 'cloud-moon';
  }

  if (code === 1006 || code === 1009 || /cloud|overcast/.test(text)) {
    return 'cloud';
  }

  if (code === 1000 || /sunny|clear/.test(text)) {
    return isDay ? 'sun' : 'moon';
  }

  return isDay ? 'cloud-sun' : 'cloud-moon';
}

export function getIconTone(iconKey) {
  const tones = {
    sun: 'clear',
    moon: 'clear',
    'cloud-sun': 'cloud',
    'cloud-moon': 'cloud',
    cloud: 'cloud',
    rain: 'rain',
    storm: 'storm',
    snow: 'snow',
    mist: 'mist',
    wind: 'wind',
  };
  return tones[iconKey] || 'clear';
}

export function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const fixed = number.toFixed(decimals);
  return decimals > 0 ? fixed.replace(/\.?0+$/, '') : fixed;
}

export function formatTemperature(value) {
  return formatNumber(value, 1);
}

function parseWeatherLocal(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(value || ''));
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: date.getUTCDay(),
  };
}

function formatClock(hour, minute) {
  const normalizedHour = ((hour % 24) + 24) % 24;
  const displayHour = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
  const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
  return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatLocalDateTime(value) {
  const parsed = parseWeatherLocal(value);
  if (!parsed) return value || '—';
  return `${WEEKDAYS[parsed.weekday]}, ${parsed.day} ${MONTHS[parsed.month - 1]} · ${formatClock(parsed.hour, parsed.minute)}`;
}

export function formatLocalTime(value) {
  const parsed = parseWeatherLocal(value);
  if (!parsed) return value || '—';
  return formatClock(parsed.hour, parsed.minute);
}

export function formatCoordinate(value, positive, negative) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  const direction = number >= 0 ? positive : negative;
  return `${Math.abs(number).toFixed(2)}° ${direction}`;
}

export function uvDescriptor(value) {
  const uv = Number(value);
  if (!Number.isFinite(uv)) return 'Unknown';
  if (uv < 3) return 'Low';
  if (uv < 6) return 'Moderate';
  if (uv < 8) return 'High';
  if (uv < 11) return 'Very high';
  return 'Extreme';
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeCity(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function sameCity(a, b) {
  const first = normalizeCity(a);
  const second = normalizeCity(b);
  if (!first || !second) return false;
  if (first === second) return true;
  return CITY_GROUPS.some((group) => group.includes(first) && group.includes(second));
}
