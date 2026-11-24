const WEATHER_API_URL = 'https://api.weatherapi.com/v1/current.json';
const UPSTREAM_TIMEOUT_MS = 9000;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    sendJson(res, 405, {
      error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' },
    });
    return;
  }

  const apiKey = process.env.WEATHER_API_KEY;

  if (!apiKey) {
    sendJson(res, 500, {
      error: {
        code: 'CONFIG',
        message: 'Weather service is not configured.',
      },
    });
    return;
  }

  let city = '';

  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    city = String(requestUrl.searchParams.get('q') || requestUrl.searchParams.get('city') || '').trim();
  } catch {
    city = '';
  }

  if (!city || city.length > 80) {
    sendJson(res, 400, {
      error: {
        code: 'INVALID_CITY',
        message: 'A valid city name is required.',
      },
    });
    return;
  }

  const upstreamUrl = new URL(WEATHER_API_URL);
  upstreamUrl.searchParams.set('key', apiKey);
  upstreamUrl.searchParams.set('q', city);
  upstreamUrl.searchParams.set('aqi', 'yes');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    const body = await upstream.text();

    res.statusCode = upstream.status;
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    );
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(body);
  } catch (error) {
    if (error?.name === 'AbortError') {
      sendJson(res, 504, {
        error: {
          code: 'UPSTREAM_TIMEOUT',
          message: 'The weather service timed out.',
        },
      });
      return;
    }

    sendJson(res, 502, {
      error: {
        code: 'UPSTREAM_UNAVAILABLE',
        message: 'The weather service is unavailable.',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
};
