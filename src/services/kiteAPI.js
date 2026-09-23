import axios from 'axios';

class KiteAPI {
  constructor() {
    this.client = axios.create({
      baseURL: '/api/kite',
      withCredentials: true,
    });
  }

  // Get user holdings
  async getHoldings() {
    try {
      const response = await this.client.get('/portfolio/holdings', {
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching holdings:', error);
      throw new Error('Failed to fetch holdings. Please check your credentials.');
    }
  }

  // Get quote data for instruments
  async getQuote(instruments) {
    try {
      const params = new URLSearchParams();
      instruments.forEach(instrument => params.append('i', instrument));

      const response = await this.client.get('/quote', {
        params,
      });
      return response.data.data || {};
    } catch (error) {
      console.error('Error fetching quotes:', error);
      throw new Error('Failed to fetch quotes.');
    }
  }

  // Get Nifty 50 index data
  async getNifty50Data() {
    try {
      const response = await this.client.get('/quote', {
        params: {
          i: 'NSE:NIFTY 50',
        },
      });
      return response.data.data || {};
    } catch (error) {
      console.error('Error fetching Nifty 50 data:', error);
      throw new Error('Failed to fetch Nifty 50 data.');
    }
  }

  async getNiftyStrikeOptions() {
    try {
      const response = await this.client.get('/instruments', {
        params: {
          exchange: 'NFO',
        },
      });

      const instruments = Array.isArray(response.data) ? response.data : [];
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      const valid = instruments.filter((instrument) => {
        const tradingsymbol = String(instrument.tradingsymbol || '').toUpperCase();
        const name = String(instrument.name || '').toUpperCase();
        const instrumentType = String(instrument.instrument_type || '').toUpperCase();
        const expiry = String(instrument.expiry || '');
        const expiryDate = expiry ? new Date(`${expiry}T00:00:00`) : null;
        const strike = Number(instrument.strike);

        return instrument.exchange === 'NFO'
          && instrument.segment === 'NFO-OPT'
          && ['CE', 'PE'].includes(instrumentType)
          && Number.isFinite(strike)
          && expiryDate
          && !Number.isNaN(expiryDate.getTime())
          && expiryDate >= currentMonthStart
          && expiryDate <= nextMonthEnd
          && (name.includes('NIFTY') || tradingsymbol.includes('NIFTY'));
      });

      return valid
        .map((item) => ({
          strike: Number(item.strike),
          instrument: String(item.name || '').toUpperCase(),
          instrumentToken: item.instrument_token,
          tradingsymbol: item.tradingsymbol,
          type: String(item.instrument_type || '').toUpperCase(),
          expiry: item.expiry,
          lotSize: Number(item.lot_size) || 1,
          label: `${item.expiry} • ${item.strike} ${String(item.instrument_type || '').toUpperCase()} • ${item.tradingsymbol}`,
        }))
        .sort((a, b) => a.expiry.localeCompare(b.expiry) || a.strike - b.strike || a.type.localeCompare(b.type));
    } catch (error) {
      console.error('Error fetching Nifty strike options:', error);
      throw new Error('Failed to fetch Nifty strikes.');
    }
  }

  async getNiftyOptionChain() {
    try {
      const response = await this.client.get('/instruments', {
        params: {
          exchange: 'NFO',
        },
      });

      const instruments = Array.isArray(response.data) ? response.data : [];
      const filtered = instruments.filter((instrument) => {
        const name = String(instrument.name || '').toUpperCase();
        const tradingsymbol = String(instrument.tradingsymbol || '').toUpperCase();
        const instrumentType = String(instrument.instrument_type || '').toUpperCase();
        return instrument.exchange === 'NFO'
          && ['CE', 'PE'].includes(instrumentType)
          && (name.includes('NIFTY') || tradingsymbol.includes('NIFTY'));
      });

      return filtered.map((instrument) => ({
        ...instrument,
        strike: Number(instrument.strike),
        instrument_type: String(instrument.instrument_type || '').toUpperCase(),
      }));
    } catch (error) {
      console.error('Error fetching Nifty option chain:', error);
      throw new Error('Failed to fetch Nifty option chain.');
    }
  }

  async getHistoricalData({ instrumentToken, interval = 'day', from, to }) {
    try {
      const response = await this.client.get('/instruments/historical', {
        params: {
          instrument_token: instrumentToken,
          interval,
          from,
          to,
        },
      });
      const data = response.data?.data?.candles ?? response.data?.candles ?? response.data ?? [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching historical candle data:', error);
      throw new Error('Failed to fetch historical candle data.');
    }
  }

  async getAutomaticTradingStatus() {
    const response = await this.client.get('/auto-trading/status');
    return response.data;
  }

  async startAutomaticTrading() {
    const response = await this.client.post('/auto-trading/start');
    return response.data;
  }

  async stopAutomaticTrading() {
    const response = await this.client.post('/auto-trading/stop');
    return response.data;
  }

  async submitAutomaticSignal(signal) {
    const response = await this.client.post('/auto-trading/signal', signal);
    return response.data;
  }

  // Get option chain data for PCR calculation
  async getOptionChain(instrumentKey) {
    try {
      const response = await this.client.get('/instruments/historical', {
        params: {
          instrument_token: instrumentKey,
          interval: 'day',
          from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          to: new Date().toISOString().split('T')[0],
        },
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching option chain:', error);
      throw new Error('Failed to fetch option chain data.');
    }
  }
}

export default KiteAPI;
