const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const port = Number(process.env.BACKEND_PORT || 4000);
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const kiteApiKey = process.env.KITE_API_KEY;
const kiteApiSecret = process.env.KITE_API_SECRET;
const sessionSecret = process.env.SESSION_SECRET;
const kiteBaseUrl = 'https://api.kite.trade';
const sessionStorePath = path.resolve(__dirname, '.sessions');
const sessionDebugLogPath = path.resolve(__dirname, 'session-debug.log');
const sessionDebugCountPath = path.resolve(__dirname, '.session-debug-count');
const maxDebugLogRecords = 100;

fs.mkdirSync(sessionStorePath, { recursive: true });

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required');
}

function getDebugLogRecordCount() {
  try {
    const count = fs.readFileSync(sessionDebugCountPath, 'utf8').trim();
    return Number.isFinite(Number(count)) ? Number(count) : 0;
  } catch {
    return 0;
  }
}

function setDebugLogRecordCount(count) {
  try {
    fs.writeFileSync(sessionDebugCountPath, String(count), 'utf8');
  } catch (error) {
    console.error('Failed to update debug log count:', error.message);
  }
}

function writeSessionDebugLog(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };
  try {
    fs.appendFileSync(sessionDebugLogPath, `${JSON.stringify(entry)}\n`, 'utf8');
    const currentCount = getDebugLogRecordCount();
    const newCount = currentCount + 1;
    
    if (newCount >= maxDebugLogRecords) {
      // Clear log after reaching 100 records
      fs.writeFileSync(sessionDebugLogPath, '', 'utf8');
      setDebugLogRecordCount(0);
      console.log(`Session debug log cleared after ${maxDebugLogRecords} records`);
    } else {
      setDebugLogRecordCount(newCount);
    }
  } catch (error) {
    console.error('Failed to write session debug log:', error.message);
  }
}

app.set('trust proxy', 1);
app.use(cors({ origin: frontendUrl, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: 'builderapp.sid',
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: new FileStore({
    path: sessionStorePath,
    ttl: 24 * 60 * 60,
    reapAsyncDelete: true,
    reapSyncFallback: true,
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));

function requireKiteSession(req, res, next) {
  const sessionState = {
    hasAccessToken: Boolean(req.session.kiteAccessToken),
    kiteApiKey: req.session.kiteApiKey || null,
    kiteLoginAt: req.session.kiteLoginAt || null,
  };
  console.log('Checking Kite session for protected route:', sessionState);
  writeSessionDebugLog('protected-session-check', sessionState);
  if (!req.session.kiteAccessToken) {
    return res.status(401).json({ error: 'Kite login required' });
  }
  next();
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells.map(value => value.trim());
}

async function proxyKiteRequest(req, res, pathName, params = {}, options = {}) {
  const apiKey = req.session.kiteApiKey || kiteApiKey;
  try {
    const response = await axios.get(`${kiteBaseUrl}${pathName}`, {
      params,
      responseType: options.responseType || 'json',
      headers: {
        'X-Kite-Version': '3',
        Authorization: `token ${apiKey}:${req.session.kiteAccessToken}`,
      },
    });

    if (options.parseCsv) {
      const csvText = String(response.data || '');
      const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length === 0) {
        return res.json([]);
      }
      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        return headers.reduce((row, header, index) => {
          row[header] = values[index] ?? '';
          return row;
        }, {});
      });
      return res.json(rows);
    }

    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    const message = error.response?.data?.message || 'Kite API request failed';
    console.error('Kite API request failed:', {
      path: pathName,
      status,
      response: error.response?.data || null,
      hasSessionAccessToken: Boolean(req.session.kiteAccessToken),
    });
    writeSessionDebugLog('kite-api-request-failed', {
      path: pathName,
      status,
      response: error.response?.data || null,
      hasSessionAccessToken: Boolean(req.session.kiteAccessToken),
    });
    if (status === 403) {
      req.session.kiteAccessToken = null;
      writeSessionDebugLog('session-token-cleared', { reason: 'kite-api-403' });
      return res.status(401).json({ error: 'Kite session expired or is invalid. Please connect Kite again.' });
    }
    res.status(status).json({ error: message });
  }
}

async function exchangeRequestToken(apiKey, apiSecret, requestToken) {
  const checksum = crypto
    .createHash('sha256')
    .update(`${apiKey}${requestToken}${apiSecret}`)
    .digest('hex');
  const body = new URLSearchParams({
    api_key: apiKey,
    request_token: requestToken,
    checksum,
  });
  const response = await axios.post(`${kiteBaseUrl}/session/token`, body.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Kite-Version': '3',
    },
  });
  return response.data.data;
}

  app.get('/', (req, res) => {
    res.json({ status: 'healthy', service: 'builderapp-kite-backend' });
  });
app.get('/api/kite/session', (req, res) => {
  res.json({ authenticated: Boolean(req.session.kiteAccessToken) });
});

app.post('/api/kite/connect', async (req, res) => {
  const body = req.body || {};
  const apiKey = body.apiKey || body.api_key;
  const apiSecret = body.apiSecret || body.api_secret;
  const requestToken = body.requestToken || body.request_token;
  if (!apiKey || !apiSecret || !requestToken) {
    return res.status(400).json({ error: 'API key, API secret, and request token are required' });
  }

  try {
    const sessionData = await exchangeRequestToken(apiKey.trim(), apiSecret.trim(), requestToken.trim());
    if (!sessionData || !sessionData.access_token) {
      return res.status(401).json({ error: 'Kite did not return an access token. The request token may be expired or invalid.' });
    }

    console.log('Kite token exchange response keys:', Object.keys(sessionData));
    writeSessionDebugLog('token-exchange-success', {
      responseKeys: Object.keys(sessionData),
      hasAccessToken: Boolean(sessionData.access_token),
      accessTokenLength: sessionData.access_token ? sessionData.access_token.length : 0,
    });
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        console.error('Failed to regenerate Kite session:', regenerateError);
        return res.status(500).json({ error: 'Failed to regenerate Kite session', details: regenerateError.message });
      }

      req.session.kiteApiKey = apiKey.trim();
      req.session.kiteAccessToken = sessionData.access_token;
      req.session.kiteLoginAt = Date.now();
      console.log('Kite session written:', {
        kiteApiKey: req.session.kiteApiKey,
        hasAccessToken: Boolean(req.session.kiteAccessToken),
        accessTokenLength: req.session.kiteAccessToken ? req.session.kiteAccessToken.length : 0,
        kiteLoginAt: req.session.kiteLoginAt,
      });
      writeSessionDebugLog('session-written', {
        hasAccessToken: Boolean(req.session.kiteAccessToken),
        accessTokenLength: req.session.kiteAccessToken ? req.session.kiteAccessToken.length : 0,
        kiteLoginAt: req.session.kiteLoginAt,
      });

      req.session.save((saveError) => {
        if (saveError) {
          console.error('Failed to save Kite session:', saveError);
          return res.status(500).json({
            error: 'Failed to save Kite session',
            details: saveError?.message || String(saveError),
          });
        }
        return res.json({ authenticated: true, accessTokenStored: true });
      });
    });
  } catch (error) {
    console.error('Kite request-token exchange failed:', error.response?.data || error.message);
    const message = error.response?.data?.message || 'Kite rejected the request token';
    res.status(error.response?.status || 502).json({ error: message });
  }
});

app.get('/api/kite/login', (req, res) => {
  if (!kiteApiKey) {
    return res.status(503).json({ error: 'Kite login redirect requires KITE_API_KEY in the server environment' });
  }
  const loginUrl = new URL('https://kite.zerodha.com/connect/login');
  loginUrl.searchParams.set('v', '3');
  loginUrl.searchParams.set('api_key', kiteApiKey);
  res.redirect(loginUrl.toString());
});

app.get('/api/kite/callback', async (req, res) => {
  const { request_token: requestToken } = req.query;

  if (!requestToken || !kiteApiKey || !kiteApiSecret) {
    return res.redirect(`${frontendUrl}/?kite_error=missing_request_token`);
  }

  try {
    const sessionData = await exchangeRequestToken(kiteApiKey, kiteApiSecret, requestToken);
    if (!sessionData || !sessionData.access_token) {
      return res.redirect(`${frontendUrl}/?kite_error=invalid_access_token`);
    }

    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        console.error('Failed to regenerate session in callback flow:', regenerateError);
        return res.redirect(`${frontendUrl}/?kite_error=session_regenerate_failed`);
      }

      req.session.kiteApiKey = kiteApiKey;
      req.session.kiteAccessToken = sessionData.access_token;
      req.session.kiteLoginAt = Date.now();
      console.log('Kite callback session written:', {
        kiteApiKey: req.session.kiteApiKey,
        hasAccessToken: Boolean(req.session.kiteAccessToken),
        accessTokenLength: req.session.kiteAccessToken ? req.session.kiteAccessToken.length : 0,
        kiteLoginAt: req.session.kiteLoginAt,
      });
      writeSessionDebugLog('session-written', {
        flow: 'callback',
        hasAccessToken: Boolean(req.session.kiteAccessToken),
        accessTokenLength: req.session.kiteAccessToken ? req.session.kiteAccessToken.length : 0,
        kiteLoginAt: req.session.kiteLoginAt,
      });
      req.session.save((saveError) => {
        if (saveError) {
          console.error('Failed to save Kite session in callback flow:', saveError);
          return res.redirect(`${frontendUrl}/?kite_error=session_save_failed`);
        }
        return res.redirect(`${frontendUrl}/?kite=connected`);
      });
    });
  } catch (error) {
    console.error('Kite token exchange failed:', error.response?.data || error.message);
    res.redirect(`${frontendUrl}/?kite_error=token_exchange_failed`);
  }
});

app.post('/api/kite/logout', (req, res) => {
  req.session.destroy(() => res.status(204).end());
});

app.get('/api/kite/portfolio/holdings', requireKiteSession, (req, res) => {
  proxyKiteRequest(req, res, '/portfolio/holdings');
});

app.get('/api/kite/quote', requireKiteSession, (req, res) => {
  const instruments = (Array.isArray(req.query.i) ? req.query.i : [req.query.i])
    .filter(instrument => typeof instrument === 'string')
    .flatMap(instrument => instrument.split(','))
    .map(instrument => instrument.trim())
    .filter(Boolean);
  if (instruments.length === 0) {
    return res.status(400).json({ error: 'At least one instrument is required' });
  }

  const quoteParams = new URLSearchParams();
  instruments.forEach(instrument => quoteParams.append('i', instrument));
  proxyKiteRequest(req, res, '/quote', quoteParams);
});

app.get('/api/kite/instruments', requireKiteSession, (req, res) => {
  const params = {};
  if (req.query.exchange) params.exchange = req.query.exchange;
  if (req.query.segment) params.segment = req.query.segment;
  if (req.query.instrument_type) params.instrument_type = req.query.instrument_type;
  proxyKiteRequest(req, res, '/instruments', params, { responseType: 'text', parseCsv: true });
});

app.get('/api/kite/instruments/historical', requireKiteSession, (req, res) => {
  const instrumentToken = typeof req.query.instrument_token === 'string'
    ? req.query.instrument_token.trim()
    : '';
  const interval = typeof req.query.interval === 'string' ? req.query.interval : 'day';
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';

  if (!instrumentToken || !from || !to) {
    return res.status(400).json({ error: 'instrument_token, from, and to are required' });
  }

  const pathName = `/instruments/historical/${encodeURIComponent(instrumentToken)}/${encodeURIComponent(interval)}`;
  const query = {};
  if (from) query.from = from;
  if (to) query.to = to;
  if (req.query.continuous !== undefined) query.continuous = req.query.continuous;
  if (req.query.oi !== undefined) query.oi = req.query.oi;

  proxyKiteRequest(req, res, pathName, query);
});

app.get('/instruments/historical', requireKiteSession, (req, res) => {
  return res.redirect(307, '/api/kite/instruments/historical' + req.originalUrl.replace(/^\/instruments\/historical/, ''));
});

app.listen(port, () => {
  console.log(`Kite backend listening on http://localhost:${port}`);
});
