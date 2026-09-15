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

fs.mkdirSync(sessionStorePath, { recursive: true });

if (!sessionSecret) {
  throw new Error('SESSION_SECRET is required');
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
  if (!req.session.kiteAccessToken) {
    return res.status(401).json({ error: 'Kite login required' });
  }
  next();
}

async function proxyKiteRequest(req, res, pathName, params) {
  const apiKey = req.session.kiteApiKey || kiteApiKey;
  try {
    const response = await axios.get(`${kiteBaseUrl}${pathName}`, {
      params,
      headers: {
        'X-Kite-Version': '3',
        Authorization: `token ${apiKey}:${req.session.kiteAccessToken}`,
      },
    });
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    const message = error.response?.data?.message || 'Kite API request failed';
    if (status === 403) {
      req.session.kiteAccessToken = null;
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
    req.session.kiteApiKey = apiKey.trim();
    req.session.kiteAccessToken = sessionData.access_token;
    req.session.kiteLoginAt = Date.now();
    req.session.save(() => res.json({ authenticated: true }));
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
    req.session.kiteApiKey = kiteApiKey;
    req.session.kiteAccessToken = sessionData.access_token;
    req.session.kiteLoginAt = Date.now();
    req.session.save(() => res.redirect(`${frontendUrl}/?kite=connected`));
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
  proxyKiteRequest(req, res, '/instruments', params);
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

  proxyKiteRequest(req, res, '/instruments/historical', {
    instrument_token: instrumentToken,
    interval,
    from,
    to,
  });
});

app.get('/instruments/historical', requireKiteSession, (req, res) => {
  return res.redirect(307, '/api/kite/instruments/historical' + req.originalUrl.replace(/^\/instruments\/historical/, ''));
});

app.listen(port, () => {
  console.log(`Kite backend listening on http://localhost:${port}`);
});
