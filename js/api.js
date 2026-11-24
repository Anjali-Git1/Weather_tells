const WEATHER_ENDPOINT = '/api/weather';

export class WeatherApiError extends Error {
  constructor(kind, message, { status = 0, code = null, retryable = true } = {}) {
    super(message);
    this.name = 'WeatherApiError';
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isFiniteNumber(value) {
  return value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function errorFromPayload(payload, status) {
  const code = payload?.error?.code;
  const message = payload?.error?.message || 'The weather service returned an error.';

  if (status === 404 || code === 1006) {
    return new WeatherApiError('not_found', message, { status, code, retryable: false });
  }

  if (
    code === 2006 ||
    code === 2007 ||
    code === 2009 ||
    code === 'CONFIG' ||
    status === 401 ||
    status === 403
  ) {
    return new WeatherApiError('api_config', message, { status, code, retryable: false });
  }

  if (code === 2008 || status === 429) {
    return new WeatherApiError('rate_limit', message, { status, code, retryable: true });
  }

  if (code === 'UPSTREAM_TIMEOUT' || status === 504) {
    return new WeatherApiError('timeout', message, { status, code, retryable: true });
  }

  if (status >= 500 || code === 'UPSTREAM_UNAVAILABLE') {
    return new WeatherApiError('server', message, { status, code, retryable: true });
  }

  return new WeatherApiError('generic', message, { status, code, retryable: true });
}

/**
 * Fetch current weather through the server-side WeatherAPI proxy.
 * The raw response text is returned untouched for the JSON viewer.
 */
export async function requestWeather(city, { signal } = {}) {
  let response;

  try {
    response = await fetch(`${WEATHER_ENDPOINT}?q=${encodeURIComponent(city)}`, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new WeatherApiError('network', 'Unable to reach the weather service.');
  }

  let raw = '';

  try {
    raw = await response.text();
  } catch {
    throw new WeatherApiError('network', 'Unable to read the weather response.');
  }

  let payload = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok || payload?.error) {
    throw errorFromPayload(payload, response.status);
  }

  if (!isValidWeatherPayload(payload)) {
    throw new WeatherApiError(
      'invalid_response',
      'The weather service returned an incomplete response.',
    );
  }

  return { data: payload, raw };
}

/**
 * Every field rendered in the UI must be present before valid data is
 * replaced. Missing secondary fields would otherwise leave a half-empty card.
 */
export function isValidWeatherPayload(payload) {
  if (!isObject(payload)) return false;

  const { location, current } = payload;
  if (!isObject(location) || !isObject(current) || !isObject(current.condition)) {
    return false;
  }

  return (
    typeof location.name === 'string' &&
    location.name.trim() !== '' &&
    typeof location.country === 'string' &&
    typeof location.localtime === 'string' &&
    location.localtime.trim() !== '' &&
    typeof location.tz_id === 'string' &&
    typeof current.condition.text === 'string' &&
    current.condition.text.trim() !== '' &&
    typeof current.last_updated === 'string' &&
    current.last_updated.trim() !== '' &&
    isFiniteNumber(current.temp_c) &&
    isFiniteNumber(current.temp_f) &&
    isFiniteNumber(current.feelslike_c) &&
    isFiniteNumber(current.humidity) &&
    isFiniteNumber(current.wind_kph) &&
    isFiniteNumber(current.uv) &&
    isFiniteNumber(current.cloud) &&
    isFiniteNumber(current.vis_km) &&
    isFiniteNumber(current.pressure_mb) &&
    isFiniteNumber(current.is_day)
  );
}
