import axios from 'axios';

const KITE_BASE_URL = 'https://api.kite.trade';

class KiteAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.apiKey = process.env.REACT_APP_KITE_API_KEY;
    this.client = axios.create({
      baseURL: KITE_BASE_URL,
      headers: {
        'X-Kite-Version': '3',
      },
    });
  }

  // Get user holdings
  async getHoldings() {
    try {
      const response = await this.client.get('/portfolio/holdings', {
        headers: {
          'Authorization': `token ${this.apiKey}:${this.accessToken}`,
        },
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
      params.append('i', instruments.join(','));

      const response = await this.client.get('/quote', {
        params,
        headers: {
          'Authorization': `token ${this.apiKey}:${this.accessToken}`,
        },
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
          i: 'NSE:NIFTY50',
        },
        headers: {
          'Authorization': `token ${this.apiKey}:${this.accessToken}`,
        },
      });
      return response.data.data || {};
    } catch (error) {
      console.error('Error fetching Nifty 50 data:', error);
      throw new Error('Failed to fetch Nifty 50 data.');
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
        headers: {
          'Authorization': `token ${this.apiKey}:${this.accessToken}`,
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
