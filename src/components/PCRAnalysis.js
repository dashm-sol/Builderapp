import React, { useState, useEffect } from 'react';
import './PCRAnalysis.css';
import KiteAPI from '../services/kiteAPI';

function PCRAnalysis({ apiKey }) {
  const [pcrData, setPcrData] = useState(null);
  const [nifty50Data, setNifty50Data] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPCRData();
  }, [apiKey]);

  const fetchPCRData = async () => {
    setLoading(true);
    setError(null);
    try {
      const config = JSON.parse(localStorage.getItem('kiteConfig'));
      const kiteAPI = new KiteAPI(config.accessToken);

      // Fetch Nifty 50 data
      const niftyData = await kiteAPI.getNifty50Data();
      setNifty50Data(niftyData['NSE:NIFTY50'] || {});

      // Mock PCR calculation - In production, fetch from broker's API
      const mockPCRData = calculateMockPCR();
      setPcrData(mockPCRData);
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateMockPCR = () => {
    // This is mock data. Replace with actual API call to get option chain data
    return {
      put_volume: 45230000,
      call_volume: 32150000,
      put_oi: 12340000,
      call_oi: 8920000,
      pcr_volume: 1.407,
      pcr_oi: 1.383,
      sentiment: 'Bullish', // PCR < 1 = Bullish, > 1 = Bearish
    };
  };

  const getSentimentColor = (pcr) => {
    if (pcr < 0.8) return '#28a745'; // Strong Bullish
    if (pcr < 1.0) return '#84fab0'; // Bullish
    if (pcr < 1.2) return '#ffc107'; // Neutral
    return '#fa709a'; // Bearish
  };

  const getSentimentLabel = (pcr) => {
    if (pcr < 0.8) return 'Strong Bullish';
    if (pcr < 1.0) return 'Bullish';
    if (pcr < 1.2) return 'Neutral';
    return 'Bearish';
  };

  if (loading) {
    return <div className="card"><div className="loading">Loading PCR data...</div></div>;
  }

  if (!pcrData || !nifty50Data) {
    return <div className="card"><div className="error-message">Unable to load PCR data</div></div>;
  }

  const pcrVolume = pcrData.pcr_volume;
  const pcrOI = pcrData.pcr_oi;

  return (
    <div className="pcr-container">
      <div className="card">
        <div className="pcr-header">
          <h2>📈 Nifty 50 Put-Call Ratio Analysis</h2>
          <button onClick={fetchPCRData} className="refresh-btn">🔄 Refresh</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Nifty 50 Index Info */}
        <div className="nifty-info">
          <div className="nifty-price">
            <span className="label">NIFTY 50</span>
            <span className="price">
              {nifty50Data.last_price ? `${nifty50Data.last_price.toFixed(2)}` : 'N/A'}
            </span>
          </div>
          <div className={`nifty-change ${nifty50Data.last_traded_quantity >= 0 ? 'positive' : 'negative'}`}>
            <span className="label">Change</span>
            <span className="value">
              {nifty50Data.net_change >= 0 ? '▲' : '▼'} {nifty50Data.net_change?.toFixed(2)} ({nifty50Data.change_percent?.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* PCR Metrics */}
        <div className="pcr-metrics">
          <div className="metric">
            <div className="metric-label">PCR - Volume</div>
            <div className="metric-value" style={{ color: getSentimentColor(pcrVolume) }}>
              {pcrVolume.toFixed(3)}
            </div>
            <div className="metric-sentiment">{getSentimentLabel(pcrVolume)}</div>
          </div>

          <div className="metric">
            <div className="metric-label">PCR - Open Interest</div>
            <div className="metric-value" style={{ color: getSentimentColor(pcrOI) }}>
              {pcrOI.toFixed(3)}
            </div>
            <div className="metric-sentiment">{getSentimentLabel(pcrOI)}</div>
          </div>
        </div>

        {/* Detailed Stats */}
        <div className="pcr-details">
          <h3>📊 Detailed Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-name">Put Volume</span>
              <span className="stat-value">{(pcrData.put_volume / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Call Volume</span>
              <span className="stat-value">{(pcrData.call_volume / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Put OI</span>
              <span className="stat-value">{(pcrData.put_oi / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Call OI</span>
              <span className="stat-value">{(pcrData.call_oi / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        </div>

        {/* Interpretation */}
        <div className="pcr-interpretation">
          <h3>💡 What is PCR?</h3>
          <p>
            The Put-Call Ratio (PCR) measures market sentiment by comparing Put and Call option volumes/open interest.
          </p>
          <ul>
            <li><strong>PCR &lt; 1.0:</strong> More calls than puts - Bullish sentiment</li>
            <li><strong>PCR = 1.0:</strong> Equal puts and calls - Neutral sentiment</li>
            <li><strong>PCR &gt; 1.0:</strong> More puts than calls - Bearish sentiment</li>
          </ul>
        </div>

        {/* Last Updated */}
        <div className="pcr-footer">
          <small>Last updated: {new Date().toLocaleTimeString()}</small>
        </div>
      </div>
    </div>
  );
}

export default PCRAnalysis;
