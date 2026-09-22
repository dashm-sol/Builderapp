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
const liveTradingEnabled = process.env.ENABLE_LIVE_TRADING === 'true';
const autoTradingState = {
  enabled: false,
  activeTrade: null,
  lastSignalKey: null,
};

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

function getKiteHeaders(sessionData) {
  return {
    'X-Kite-Version': '3',
    Authorization: `token ${sessionData.kiteApiKey || kiteApiKey}:${sessionData.kiteAccessToken}`,
  };
}

async function placeKiteOrder(sessionData, order) {
  const body = new URLSearchParams(order);
  const response = await axios.post(`${kiteBaseUrl}/orders/regular`, body.toString(), {
    headers: {
      ...getKiteHeaders(sessionData),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data?.data?.order_id;
}

async function cancelKiteOrder(sessionData, orderId) {
  if (!orderId) return;
  await axios.delete(`${kiteBaseUrl}/orders/regular/${encodeURIComponent(orderId)}`, {
    headers: getKiteHeaders(sessionData),
  });
}

async function getKiteOrderStatus(sessionData, orderId) {
  const response = await axios.get(`${kiteBaseUrl}/orders/${encodeURIComponent(orderId)}`, {
    headers: getKiteHeaders(sessionData),
  });
  const orders = response.data?.data || [];
  return orders.at(-1)?.status || null;
}

async function armAutoExitOrders(activeTrade) {
  const targetOrderId = await placeKiteOrder(activeTrade.sessionData, {
    exchange: activeTrade.exchange,
    tradingsymbol: activeTrade.tradingsymbol,
    transaction_type: activeTrade.exitSide,
    quantity: String(activeTrade.quantity),
    product: activeTrade.product,
    order_type: 'LIMIT',
    price: activeTrade.target.toFixed(2),
    validity: 'DAY',
    tag: 'AUTOTARGET',
  });

  try {
    const stopOrderId = await placeKiteOrder(activeTrade.sessionData, {
      exchange: activeTrade.exchange,
      tradingsymbol: activeTrade.tradingsymbol,
      transaction_type: activeTrade.exitSide,
      quantity: String(activeTrade.quantity),
      product: activeTrade.product,
      order_type: 'SL-M',
      trigger_price: activeTrade.stopLoss.toFixed(2),
      validity: 'DAY',
      market_protection: '-1',
      tag: 'AUTOSTOP',
    });
    activeTrade.targetOrderId = targetOrderId;
    activeTrade.stopOrderId = stopOrderId;
    activeTrade.entryComplete = true;
    writeSessionDebugLog('auto-trade-exits-armed', { symbol: activeTrade.tradingsymbol, targetOrderId, stopOrderId });
  } catch (error) {
    await Promise.allSettled([cancelKiteOrder(activeTrade.sessionData, targetOrderId)]);
    throw error;
  }
}

async function closeActiveAutoTrade(reason) {
  const activeTrade = autoTradingState.activeTrade;
  if (!activeTrade) return;

  try {
    if (!activeTrade.entryComplete) {
      await cancelKiteOrder(activeTrade.sessionData, activeTrade.entryOrderId);
      writeSessionDebugLog('auto-trade-entry-cancelled', { reason, symbol: activeTrade.tradingsymbol });
      return;
    }
    await Promise.allSettled([
      cancelKiteOrder(activeTrade.sessionData, activeTrade.targetOrderId),
      cancelKiteOrder(activeTrade.sessionData, activeTrade.stopOrderId),
    ]);
    await placeKiteOrder(activeTrade.sessionData, {
      exchange: activeTrade.exchange,
      tradingsymbol: activeTrade.tradingsymbol,
      transaction_type: activeTrade.exitSide,
      quantity: String(activeTrade.quantity),
      product: activeTrade.product,
      order_type: 'MARKET',
      validity: 'DAY',
      market_protection: '-1',
      tag: 'AUTOEXIT',
    });
    writeSessionDebugLog('auto-trade-closed', { reason, symbol: activeTrade.tradingsymbol });
  } catch (error) {
    console.error('Failed to close auto trade:', error.response?.data || error.message);
  } finally {
    autoTradingState.activeTrade = null;
  }
}

function isWithinTradingHours() {
  const now = new Date();
  const indiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const day = indiaTime.getDay();
  const minutes = indiaTime.getHours() * 60 + indiaTime.getMinutes();
  return day >= 1 && day <= 5 && minutes >= 9 * 60 + 15 && minutes < 15 * 60 + 20;
}

setInterval(async () => {
  const activeTrade = autoTradingState.activeTrade;
  if (!activeTrade) return;

  try {
    if (!isWithinTradingHours()) {
      await closeActiveAutoTrade('intraday-cutoff');
      return;
    }
    if (!activeTrade.entryComplete) {
      const entryStatus = await getKiteOrderStatus(activeTrade.sessionData, activeTrade.entryOrderId);
      if (entryStatus === 'COMPLETE') {
        try {
          await armAutoExitOrders(activeTrade);
        } catch (error) {
          console.error('Failed to arm automatic exits:', error.response?.data || error.message);
          activeTrade.entryComplete = true;
          await closeActiveAutoTrade('protective-exit-rejected');
        }
      } else if (['REJECTED', 'CANCELLED'].includes(entryStatus)) {
        autoTradingState.activeTrade = null;
        writeSessionDebugLog('auto-trade-entry-not-filled', { status: entryStatus, symbol: activeTrade.tradingsymbol });
      }
      return;
    }
    const [targetStatus, stopStatus] = await Promise.all([
      getKiteOrderStatus(activeTrade.sessionData, activeTrade.targetOrderId),
      getKiteOrderStatus(activeTrade.sessionData, activeTrade.stopOrderId),
    ]);
    if (targetStatus === 'COMPLETE' || stopStatus === 'COMPLETE') {
      const filledOrderId = targetStatus === 'COMPLETE' ? activeTrade.targetOrderId : activeTrade.stopOrderId;
      const openOrderId = targetStatus === 'COMPLETE' ? activeTrade.stopOrderId : activeTrade.targetOrderId;
      await Promise.allSettled([cancelKiteOrder(activeTrade.sessionData, openOrderId)]);
      autoTradingState.activeTrade = null;
      writeSessionDebugLog('auto-trade-exit-filled', { filledOrderId, symbol: activeTrade.tradingsymbol });
    }
  } catch (error) {
    console.error('Automatic trade monitor failed:', error.response?.data || error.message);
  }
}, 5000);

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

app.get('/api/kite/auto-trading/status', requireKiteSession, (req, res) => {
  res.json({
    liveTradingEnabled,
    enabled: autoTradingState.enabled,
    activeTrade: autoTradingState.activeTrade
      ? { symbol: autoTradingState.activeTrade.tradingsymbol, side: autoTradingState.activeTrade.side, quantity: autoTradingState.activeTrade.quantity, entryComplete: autoTradingState.activeTrade.entryComplete }
      : null,
  });
});

app.post('/api/kite/auto-trading/start', requireKiteSession, (req, res) => {
  if (!liveTradingEnabled) {
    return res.status(403).json({ error: 'Live trading is disabled. Set ENABLE_LIVE_TRADING=true on the server before starting it.' });
  }
  autoTradingState.enabled = true;
  autoTradingState.lastSignalKey = null;
  writeSessionDebugLog('auto-trading-started');
  res.json({ enabled: true });
});

app.post('/api/kite/auto-trading/stop', requireKiteSession, async (req, res) => {
  autoTradingState.enabled = false;
  await closeActiveAutoTrade('manual-stop');
  writeSessionDebugLog('auto-trading-stopped');
  res.json({ enabled: false });
});

app.post('/api/kite/auto-trading/signal', requireKiteSession, async (req, res) => {
  if (!liveTradingEnabled || !autoTradingState.enabled) {
    return res.status(403).json({ error: 'Automatic trading is not enabled.' });
  }
  if (!isWithinTradingHours()) {
    return res.status(409).json({ error: 'Automatic orders are allowed only between 09:15 and 15:20 IST.' });
  }
  if (autoTradingState.activeTrade) {
    return res.status(409).json({ error: 'An automatic trade is already active.' });
  }

  const { action, tradingsymbol, exchange, quantity, entry, target, stopLoss, signalTime } = req.body || {};
  const normalizedAction = String(action || '').toUpperCase();
  const normalizedExchange = String(exchange || '').toUpperCase();
  const normalizedSymbol = String(tradingsymbol || '').trim();
  const normalizedQuantity = Number(quantity);
  const normalizedEntry = Number(entry);
  const normalizedTarget = Number(target);
  const normalizedStopLoss = Number(stopLoss);
  const signalKey = `${normalizedSymbol}:${normalizedAction}:${signalTime}`;

  if (!['BUY', 'SELL'].includes(normalizedAction) || normalizedExchange !== 'NFO' || !normalizedSymbol
    || !Number.isInteger(normalizedQuantity) || normalizedQuantity <= 0
    || !Number.isFinite(normalizedEntry) || !Number.isFinite(normalizedTarget) || !Number.isFinite(normalizedStopLoss)) {
    return res.status(400).json({ error: 'A valid NFO signal, quantity, target, and stop loss are required.' });
  }
  const invalidExitLevels = normalizedAction === 'BUY'
    ? normalizedTarget <= normalizedEntry || normalizedStopLoss >= normalizedEntry
    : normalizedTarget >= normalizedEntry || normalizedStopLoss <= normalizedEntry;
  if (invalidExitLevels) {
    return res.status(400).json({ error: 'Target and stop loss must be on opposite sides of the entry price.' });
  }
  if (autoTradingState.lastSignalKey === signalKey) {
    return res.status(409).json({ error: 'This signal has already been submitted.' });
  }

  const exitSide = normalizedAction === 'BUY' ? 'SELL' : 'BUY';
  try {
    const sessionData = { kiteApiKey: req.session.kiteApiKey, kiteAccessToken: req.session.kiteAccessToken };
    const entryOrderId = await placeKiteOrder(sessionData, {
      exchange: normalizedExchange,
      tradingsymbol: normalizedSymbol,
      transaction_type: normalizedAction,
      quantity: String(normalizedQuantity),
      product: 'MIS',
      order_type: 'MARKET',
      validity: 'DAY',
      market_protection: '-1',
      tag: 'AUTOENTRY',
    });

    autoTradingState.activeTrade = {
      sessionData,
      exchange: normalizedExchange,
      tradingsymbol: normalizedSymbol,
      quantity: normalizedQuantity,
      product: 'MIS',
      side: normalizedAction,
      exitSide,
      entryOrderId,
      target: normalizedTarget,
      stopLoss: normalizedStopLoss,
      entryComplete: false,
    };
    autoTradingState.lastSignalKey = signalKey;
    writeSessionDebugLog('auto-trade-entry-submitted', { symbol: normalizedSymbol, action: normalizedAction, entryOrderId });
    res.status(202).json({ entryOrderId, status: 'Entry submitted. Target and stop-loss orders will be armed after entry execution.' });
  } catch (error) {
    console.error('Automatic order placement failed:', error.response?.data || error.message);
    res.status(error.response?.status || 502).json({ error: error.response?.data?.message || 'Automatic order placement failed.' });
  }
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
