import { requestWeather, WeatherApiError } from './api.js';
import { initJsonViewer, setJsonResponse } from './json-viewer.js';
import {
  DEFAULT_CITY,
  POPULAR_CITIES,
  clamp,
  computeSkyScore,
  formatCoordinate,
  formatLocalDateTime,
  formatLocalTime,
  formatNumber,
  formatTemperature,
  getAqiInfo,
  getIconTone,
  getScoreGrade,
  getWeatherIconKey,
  getWeatherPersonality,
  sameCity,
  uvDescriptor,
} from './weather.js';

const REQUEST_TIMEOUT_MS = 15000;
const SCORE_CIRCUMFERENCE = 2 * Math.PI * 56;

const state = {
  hasData: false,
  activeCity: null,
  lastRequestedCity: null,
  requestId: 0,
  controller: null,
  scoreAnimation: null,
  toastTimer: null,
};

const ERROR_CONTENT = {
  not_found: {
    title: 'City not found',
    message: (city) => `We couldn't find “${city}”. Check the spelling or try another city.`,
    retryable: false,
  },
  api_config: {
    title: 'API configuration error',
    message: () =>
      'The weather service rejected the API configuration. Please check the server environment and try again.',
    retryable: false,
  },
  rate_limit: {
    title: 'Temporary service error',
    message: () =>
      'The weather service is receiving too many requests right now. Please try again in a moment.',
    retryable: true,
  },
  network: {
    title: 'Network unavailable',
    message: () =>
      "We couldn't reach the weather service. Check your internet connection and try again.",
    retryable: true,
  },
  timeout: {
    title: 'Request timed out',
    message: () =>
      'The weather service took too long to respond. Please try again.',
    retryable: true,
  },
  server: {
    title: 'Service unavailable',
    message: () =>
      'The weather service is temporarily unavailable. Please try again shortly.',
    retryable: true,
  },
  invalid_response: {
    title: 'Unexpected response',
    message: () =>
      'We received an incomplete response from the weather service. Please try again.',
    retryable: true,
  },
  generic: {
    title: 'Something went wrong',
    message: () =>
      'An unexpected error occurred while fetching the weather. Please try again.',
    retryable: true,
  },
};

const $ = (id) => document.getElementById(id);

const dom = {
  searchForm: $('search-form'),
  cityInput: $('city-input'),
  searchError: $('search-error'),
  searchButton: $('search-btn'),
  searchLabel: $('search-label'),
  searchSpinner: $('search-spinner'),
  searchArrow: $('search-arrow'),
  chips: $('city-chips'),
  liveStatus: $('live-status'),
  errorBanner: $('error-banner'),
  errorTitle: $('error-title'),
  errorMessage: $('error-message'),
  errorAction: $('error-action'),
  skeleton: $('skeleton'),
  dashboard: $('weather-dashboard'),
  weatherCard: $('weather-card'),
  cardProgress: $('card-progress'),
  updatingPill: $('updating-pill'),
  updatedPill: $('updated-pill'),
  cityName: $('city-name'),
  locationRegion: $('location-region'),
  localTime: $('local-time'),
  weatherIcon: $('weather-icon'),
  weatherIconUse: $('weather-icon-use'),
  tempC: $('temp-c'),
  conditionText: $('condition-text'),
  feelsLike: $('feels-like'),
  personalityTitle: $('personality-title'),
  personalityDesc: $('personality-desc'),
  verdictIndex: $('verdict-index'),
  score: $('score'),
  scoreNumber: $('score-number'),
  scoreGrade: $('score-grade'),
  scoreProgress: $('score-progress'),
  humidity: $('humidity'),
  humidityBar: $('humidity-bar'),
  wind: $('wind'),
  windBar: $('wind-bar'),
  uv: $('uv'),
  uvBar: $('uv-bar'),
  uvLabel: $('uv-label'),
  cloud: $('cloud'),
  visibility: $('visibility'),
  pressure: $('pressure'),
  windSpeed: $('wind-speed'),
  tempF: $('temp-f'),
  lastUpdated: $('last-updated'),
  aqiCard: $('aqi-card'),
  aqiIndex: $('aqi-index'),
  aqiLabel: $('aqi-label'),
  aqiAdvice: $('aqi-advice'),
  aqiMeter: $('aqi-meter'),
  aqiPm25: $('aqi-pm25'),
  aqiPm10: $('aqi-pm10'),
  sideCity: $('side-city'),
  sideCountry: $('side-country'),
  coordinates: $('coordinates'),
  sideTime: $('side-time'),
  sideTz: $('side-tz'),
  topProgress: $('top-progress'),
  toast: $('toast'),
};

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function announce(message) {
  dom.liveStatus.textContent = message;
}

function showToast(message) {
  window.clearTimeout(state.toastTimer);
  dom.toast.textContent = message;
  dom.toast.classList.add('is-visible');

  state.toastTimer = window.setTimeout(() => {
    dom.toast.classList.remove('is-visible');
  }, 2200);
}

function showSearchError(message) {
  dom.searchError.textContent = message;
  dom.searchError.hidden = false;
  dom.cityInput.setAttribute('aria-invalid', 'true');
}

function clearSearchError() {
  dom.searchError.hidden = true;
  dom.searchError.textContent = '';
  dom.cityInput.removeAttribute('aria-invalid');
}

function hideError() {
  dom.errorBanner.hidden = true;
  dom.errorBanner.classList.remove('error-banner--standalone');
  dom.errorAction.dataset.action = '';
}

function setLoading(isLoading, city) {
  dom.topProgress.classList.toggle('is-active', isLoading);
  dom.searchButton.classList.toggle('is-busy', isLoading);
  dom.searchButton.setAttribute('aria-busy', String(isLoading));
  dom.searchSpinner.hidden = !isLoading;
  dom.searchArrow.hidden = isLoading;
  dom.searchLabel.textContent = isLoading ? 'Checking…' : 'Check the score';

  if (isLoading) {
    dom.errorBanner.hidden = true;
    dom.skeleton.hidden = state.hasData;
    dom.dashboard.hidden = !state.hasData;
    dom.cardProgress.hidden = !state.hasData;
    dom.updatingPill.hidden = !state.hasData;
    dom.updatedPill.hidden = state.hasData;
    dom.weatherCard.classList.toggle('is-updating', state.hasData);
    announce(state.hasData ? `Updating weather for ${city}…` : `Loading weather for ${city}…`);
  } else {
    dom.skeleton.hidden = true;
    dom.cardProgress.hidden = true;
    dom.updatingPill.hidden = true;
    dom.updatedPill.hidden = !state.hasData;
    dom.weatherCard.classList.remove('is-updating');
  }
}

function showError(kind, city) {
  const content = ERROR_CONTENT[kind] || ERROR_CONTENT.generic;
  const baseMessage = content.message(city);
  const lastKnownNote =
    state.hasData && state.activeCity
      ? ` Showing the last known weather for ${state.activeCity}.`
      : '';

  dom.errorTitle.textContent = content.title;
  dom.errorMessage.textContent = `${baseMessage}${lastKnownNote}`;
  dom.errorAction.textContent = content.retryable ? 'Retry' : 'Try another city';
  dom.errorAction.dataset.action = content.retryable ? 'retry' : 'focus';
  dom.errorBanner.classList.toggle('error-banner--standalone', !state.hasData);
  dom.errorBanner.hidden = false;

  if (!state.hasData) dom.dashboard.hidden = true;

  setLoading(false);
  announce(`${content.title}. ${baseMessage}`);

  if (state.hasData) {
    dom.errorBanner.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest',
    });
  }
}

function renderChips() {
  const fragment = document.createDocumentFragment();

  POPULAR_CITIES.forEach((city) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.dataset.city = city;
    button.textContent = city;
    button.setAttribute('aria-pressed', 'false');
    fragment.appendChild(button);
  });

  dom.chips.replaceChildren(fragment);
}

function setActiveChip(city) {
  dom.chips.querySelectorAll('.chip').forEach((chip) => {
    const isActive = sameCity(chip.dataset.city, city);
    chip.classList.toggle('is-active', isActive);
    chip.setAttribute('aria-pressed', String(isActive));
  });
}

function animateScore(target) {
  window.cancelAnimationFrame(state.scoreAnimation);

  if (prefersReducedMotion()) {
    dom.scoreNumber.textContent = String(target);
    return;
  }

  const current = Number(dom.scoreNumber.textContent);
  const start = Number.isFinite(current) ? current : 0;
  const startedAt = performance.now();
  const duration = 750;

  function step(now) {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    dom.scoreNumber.textContent = String(Math.round(start + (target - start) * eased));

    if (progress < 1) {
      state.scoreAnimation = window.requestAnimationFrame(step);
    } else {
      dom.scoreNumber.textContent = String(target);
    }
  }

  state.scoreAnimation = window.requestAnimationFrame(step);
}

function renderAqi(current) {
  const aqi = getAqiInfo(current);
  const segments = dom.aqiMeter.querySelectorAll('span');

  if (!aqi) {
    dom.aqiCard.dataset.tone = 'unknown';
    dom.aqiIndex.textContent = '—';
    dom.aqiLabel.textContent = 'Unavailable';
    dom.aqiAdvice.textContent = 'Air-quality data was not returned for this location.';
    dom.aqiPm25.textContent = '—';
    dom.aqiPm10.textContent = '—';
    segments.forEach((segment) => {
      segment.classList.remove('is-filled', 'is-current');
    });
    dom.aqiMeter.setAttribute('aria-label', 'Air quality unavailable');
    dom.aqiCard.setAttribute('aria-label', 'Air quality unavailable');
    return;
  }

  dom.aqiCard.dataset.tone = aqi.tone;
  dom.aqiIndex.textContent = String(aqi.index);
  dom.aqiLabel.textContent = aqi.label;
  dom.aqiAdvice.textContent = aqi.advice;
  dom.aqiPm25.textContent = formatNumber(aqi.pm25, 1);
  dom.aqiPm10.textContent = formatNumber(aqi.pm10, 1);

  segments.forEach((segment) => {
    const level = Number(segment.dataset.level);
    segment.classList.toggle('is-filled', level <= aqi.index);
    segment.classList.toggle('is-current', level === aqi.index);
  });

  dom.aqiMeter.setAttribute(
    'aria-label',
    `Air quality index ${aqi.index} of 6, ${aqi.label}`,
  );
  dom.aqiCard.setAttribute(
    'aria-label',
    `Air quality index ${aqi.index} of 6, ${aqi.label}. PM2.5 ${formatNumber(aqi.pm25, 1)} micrograms per cubic metre.`,
  );
}

function renderWeather(data) {
  const { location, current } = data;
  const wasVisible = !dom.dashboard.hidden;
  const region = [location.region, location.country].filter(Boolean).join(', ');
  const iconKey = getWeatherIconKey(current);
  const personality = getWeatherPersonality(current);
  const score = computeSkyScore(current);
  const grade = getScoreGrade(score);
  const humidity = clamp(Number(current.humidity), 0, 100);
  const wind = Number(current.wind_kph);
  const uv = Number(current.uv);

  dom.cityName.textContent = location.name;
  dom.locationRegion.textContent = region || location.country || '—';
  dom.localTime.textContent = `${formatLocalDateTime(location.localtime)} local`;
  dom.updatedPill.textContent = `Updated ${formatLocalTime(current.last_updated)} local`;
  dom.updatedPill.hidden = false;

  dom.tempC.textContent = formatTemperature(current.temp_c);
  dom.conditionText.textContent = current.condition.text;
  dom.feelsLike.textContent = `Feels like ${formatTemperature(current.feelslike_c)}°C`;

  dom.weatherIconUse.setAttribute('href', `#wx-${iconKey}`);
  dom.weatherIcon.dataset.tone = getIconTone(iconKey);
  dom.weatherIcon.setAttribute('aria-label', `${current.condition.text} weather icon`);

  renderAqi(current);

  dom.personalityTitle.textContent = personality.title;
  dom.personalityDesc.textContent = personality.description;
  dom.verdictIndex.textContent = personality.index;

  dom.score.style.setProperty('--score-color', grade.color);
  dom.score.setAttribute(
    'aria-label',
    `Weather_tells score ${score} out of 100, ${grade.label.toLowerCase()}`,
  );
  dom.scoreGrade.textContent = grade.label;
  dom.scoreProgress.style.strokeDasharray = String(SCORE_CIRCUMFERENCE);
  dom.scoreProgress.style.strokeDashoffset = String(
    SCORE_CIRCUMFERENCE * (1 - score / 100),
  );
  animateScore(score);

  dom.humidity.textContent = formatNumber(humidity, 0);
  dom.humidityBar.style.width = `${humidity}%`;
  dom.wind.textContent = formatNumber(wind, 1);
  dom.windBar.style.width = `${clamp((wind / 60) * 100, 0, 100)}%`;
  dom.uv.textContent = formatNumber(uv, 1);
  dom.uvBar.style.width = `${clamp((uv / 11) * 100, 0, 100)}%`;
  dom.uvBar.dataset.tone = uv >= 8 ? 'high' : uv >= 6 ? 'medium' : 'low';
  dom.uvLabel.textContent = 'Index';
  dom.uvBar
    .closest('.metric')
    ?.setAttribute('title', `UV index ${formatNumber(uv, 1)} — ${uvDescriptor(uv)}`);

  dom.cloud.textContent = `${formatNumber(current.cloud, 0)}%`;
  dom.visibility.textContent = `${formatNumber(current.vis_km, 1)} km`;
  dom.pressure.textContent = `${formatNumber(current.pressure_mb, 0)} mb`;
  dom.windSpeed.textContent = `${formatNumber(current.wind_kph, 1)} km/h`;
  dom.tempF.textContent = `${formatNumber(current.temp_f, 0)}°F`;
  dom.lastUpdated.textContent = `${formatLocalTime(current.last_updated)} local`;

  dom.sideCity.textContent = location.name;
  dom.sideCountry.textContent = location.country || region || '—';
  dom.coordinates.textContent = `${formatCoordinate(location.lat, 'N', 'S')} · ${formatCoordinate(location.lon, 'E', 'W')}`;
  dom.sideTime.textContent = formatLocalTime(location.localtime);
  dom.sideTz.textContent = location.tz_id || '—';

  dom.cityInput.value = location.name;
  document.title = `${location.name} · ${formatTemperature(current.temp_c)}°C · Weather_tells`;

  dom.skeleton.hidden = true;
  dom.dashboard.hidden = false;
  setActiveChip(location.name);

  if (wasVisible && !prefersReducedMotion()) {
    dom.weatherCard.animate(
      [
        { opacity: 0.55, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
      { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
    );
  }
}

async function searchCity(rawCity) {
  const city = String(rawCity ?? dom.cityInput.value).trim().replace(/\s+/g, ' ');

  if (!city) {
    showSearchError('Please enter a city name.');
    dom.cityInput.focus();
    announce('Please enter a city name.');
    return;
  }

  if (city.length > 80) {
    showSearchError('City names must be 80 characters or fewer.');
    dom.cityInput.focus();
    return;
  }

  dom.cityInput.value = city;
  clearSearchError();
  hideError();

  if (state.controller) state.controller.abort();

  const requestId = ++state.requestId;
  const controller = new AbortController();
  state.controller = controller;
  state.lastRequestedCity = city;

  setLoading(true, city);

  if (navigator.onLine === false) {
    state.controller = null;
    showError('network', city);
    return;
  }

  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const { data, raw } = await requestWeather(city, { signal: controller.signal });

    if (requestId !== state.requestId) return;

    state.hasData = true;
    state.activeCity = data.location.name;
    state.lastRequestedCity = data.location.name;

    renderWeather(data);
    setJsonResponse(raw, data);
    setLoading(false);

    const aqi = getAqiInfo(data.current);
    announce(
      `Weather updated for ${data.location.name}. ${formatTemperature(data.current.temp_c)} degrees Celsius, ${data.current.condition.text}.${
        aqi ? ` Air quality ${aqi.label}, US EPA index ${aqi.index} of 6.` : ''
      }`,
    );
  } catch (error) {
    if (requestId !== state.requestId) return;

    if (error?.name === 'AbortError' || timedOut) {
      showError('timeout', city);
      return;
    }

    showError(error instanceof WeatherApiError ? error.kind : 'generic', city);
  } finally {
    window.clearTimeout(timeoutId);
    if (requestId === state.requestId) state.controller = null;
  }
}

function handleSubmit(event) {
  event.preventDefault();
  searchCity(dom.cityInput.value);
}

function handleChipClick(event) {
  const chip = event.target.closest('button[data-city]');
  if (!chip) return;
  searchCity(chip.dataset.city);
}

function handleErrorAction() {
  if (dom.errorAction.dataset.action === 'retry') {
    searchCity(state.lastRequestedCity || state.activeCity || DEFAULT_CITY);
    return;
  }

  dom.cityInput.focus();
  dom.cityInput.select();
}

function init() {
  renderChips();
  initJsonViewer({ onCopy: showToast });

  dom.cityInput.value = DEFAULT_CITY;
  dom.searchForm.addEventListener('submit', handleSubmit);
  dom.cityInput.addEventListener('input', clearSearchError);
  dom.chips.addEventListener('click', handleChipClick);
  dom.errorAction.addEventListener('click', handleErrorAction);

  searchCity(DEFAULT_CITY);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
