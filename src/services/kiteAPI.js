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

      const instruments = Array.isArray(response.data?.data) ? response.data.data : [];
      const valid = instruments.filter((instrument) => {
        const tradingsymbol = String(instrument.tradingsymbol || '').toUpperCase();
        const name = String(instrument.name || '').toUpperCase();
        const instrumentType = String(instrument.instrument_type || '').toUpperCase();
        const strike = Number(instrument.strike);

        return instrument.exchange === 'NFO'
          && ['CE', 'PE'].includes(instrumentType)
          && Number.isFinite(strike)
          && (name.includes('NIFTY') || tradingsymbol.includes('NIFTY'));
      });

      const uniqueStrikes = [...new Map(valid.map((item) => [Number(item.strike), item])).values()]
        .map((item) => ({
          strike: Number(item.strike),
          instrumentToken: item.instrument_token,
          tradingsymbol: item.tradingsymbol,
          type: String(item.instrument_type || '').toUpperCase(),
          label: `${item.tradingsymbol}`,
        }))
        .sort((a, b) => a.strike - b.strike);

      return uniqueStrikes;
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

      const instruments = Array.isArray(response.data?.data) ? response.data.data : [];
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
      const data = response.data?.data || response.data || [];
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error('Error fetching historical candle data:', error);
      throw new Error('Failed to fetch historical candle data.');
    }
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
