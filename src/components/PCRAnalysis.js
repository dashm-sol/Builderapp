import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import './PCRAnalysis.css';
import KiteAPI from '../services/kiteAPI';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const TIMEFRAME_OPTIONS = ['minute', '3minute', '5minute', '10minute', '15minute', '30minute', '60minute', 'day'];

function PCRAnalysis({ apiKey }) {
  const [pcrData, setPcrData] = useState(null);
  const [nifty50Data, setNifty50Data] = useState(null);
  const [strikeOptions, setStrikeOptions] = useState([]);
  const [selectedStrike, setSelectedStrike] = useState(null);
  const [selectedInterval, setSelectedInterval] = useState('5minute');
  const [chartData, setChartData] = useState(null);
  const [latestCandle, setLatestCandle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPCRData();
  }, [apiKey]);

  useEffect(() => {
    if (!selectedStrike || !selectedInterval) return;
    fetchHistoricalChart(selectedStrike, selectedInterval);
    fetchRealPCR(selectedStrike);
  }, [selectedStrike, selectedInterval]);

  const fetchRealPCR = async (strike) => {
    if (!strike?.instrumentToken) return;
    try {
      const kiteAPI = new KiteAPI();
      const optionChain = await kiteAPI.getNiftyOptionChain();
      const selectedStrikeNumber = Number(strike.strike);
      const nearTheMoney = optionChain.filter((instrument) => {
        const diff = Math.abs(Number(instrument.strike) - selectedStrikeNumber);
        return diff <= 100;
      });

      if (nearTheMoney.length === 0) {
        return;
      }

      const optionTokens = nearTheMoney.map((instrument) => String(instrument.instrument_token)).filter(Boolean);
      if (optionTokens.length === 0) {
        return;
      }

      const quotes = await kiteAPI.getQuote(optionTokens);
      const values = Object.values(quotes || {});
      const putVolume = values
        .filter((quote) => String(quote?.instrument_type || '').toUpperCase() === 'PE')
        .reduce((sum, quote) => sum + Number(quote?.volume || 0), 0);
      const callVolume = values
        .filter((quote) => String(quote?.instrument_type || '').toUpperCase() === 'CE')
        .reduce((sum, quote) => sum + Number(quote?.volume || 0), 0);
      const putOI = values
        .filter((quote) => String(quote?.instrument_type || '').toUpperCase() === 'PE')
        .reduce((sum, quote) => sum + Number(quote?.oi || 0), 0);
      const callOI = values
        .filter((quote) => String(quote?.instrument_type || '').toUpperCase() === 'CE')
        .reduce((sum, quote) => sum + Number(quote?.oi || 0), 0);

      const nextData = {
        put_volume: putVolume,
        call_volume: callVolume,
        put_oi: putOI,
        call_oi: callOI,
        pcr_volume: callVolume > 0 ? putVolume / callVolume : 0,
        pcr_oi: callOI > 0 ? putOI / callOI : 0,
      };

      setPcrData(nextData);
    } catch (err) {
      console.error('Real PCR fetch failed:', err);
      setError(err.message || 'Unable to compute live PCR.');
    }
  };

  const fetchHistoricalChart = async (strike, interval) => {
    if (!strike?.instrumentToken) return;
    setChartLoading(true);

    try {
      const kiteAPI = new KiteAPI();
      const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const to = new Date();
      const candles = await kiteAPI.getHistoricalData({
        instrumentToken: strike.instrumentToken,
        interval,
        from: formatDate(from),
        to: formatDate(to),
      });

      const normalized = Array.isArray(candles) ? candles : [];
      const labels = normalized.map((item) => {
        const timestamp = Array.isArray(item) ? item[0] : item?.timestamp;
        const date = new Date(timestamp);
        if (interval === 'day') return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        return date.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      });

      const values = normalized.map((item) => {
        const close = Array.isArray(item) ? item[4] : item?.close;
        return Number(close) || 0;
      });

      const latest = normalized[normalized.length - 1];
      setLatestCandle(
        Array.isArray(latest)
          ? { open: latest[1], high: latest[2], low: latest[3], close: latest[4], volume: latest[5], oi: latest[6] }
          : latest || null
      );

      setChartData({
        labels,
        datasets: [{
          label: `${strike.label} • ${interval}`,
          data: values,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.15)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2,
        }],
      });
    } catch (err) {
      setError(err.message);
      console.error('Chart fetch failed:', err);
    } finally {
      setChartLoading(false);
    }
  };

  const fetchPCRData = async () => {
    setLoading(true);
    setError(null);
    try {
      const kiteAPI = new KiteAPI();
      const niftyData = await kiteAPI.getNifty50Data();
      const niftyIndex = niftyData['NSE:NIFTY 50'] || {};
      setNifty50Data(niftyIndex);

      const strikes = await kiteAPI.getNiftyStrikeOptions();
      setStrikeOptions(strikes);
      if (strikes.length > 0) {
        const niftyQuote = Number(niftyIndex.last_price || 0);
        const nearest = strikes.reduce((best, current) => {
          const diffCurrent = Math.abs(current.strike - niftyQuote);
          const diffBest = Math.abs(best.strike - niftyQuote);
          return diffCurrent < diffBest ? current : best;
        }, strikes[0]);
        setSelectedStrike(nearest);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getSentimentColor = (pcr) => {
    if (pcr < 0.8) return '#28a745';
    if (pcr < 1.0) return '#84fab0';
    if (pcr < 1.2) return '#ffc107';
    return '#fa709a';
  };

  const getSentimentLabel = (pcr) => {
    if (pcr < 0.8) return 'Strong Bullish';
    if (pcr < 1.0) return 'Bullish';
    if (pcr < 1.2) return 'Neutral';
    return 'Bearish';
  };

  const formatDate = (value) => value.toISOString().split('T')[0];

  if (loading) {
    return <div className="card"><div className="loading">Loading PCR data...</div></div>;
  }

  if (!nifty50Data) {
    return <div className="card"><div className="error-message">Unable to load Nifty market data</div></div>;
  }

  const pcrVolume = pcrData?.pcr_volume || 0;
  const pcrOI = pcrData?.pcr_oi || 0;

  return (
    <div className="pcr-container">
      <div className="card">
        <div className="pcr-header">
          <h2>📈 Nifty 50 Put-Call Ratio Analysis</h2>
          <button onClick={fetchPCRData} className="refresh-btn">🔄 Refresh</button>
        </div>

        {error && <div className="error-message">{error}</div>}

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

        <div className="chart-panel">
          <div className="chart-header">
            <h3>📉 Nifty Historical Chart</h3>
          </div>
          <div className="chart-controls">
            <label>
              Strike
              <select
                value={selectedStrike ? selectedStrike.instrumentToken : ''}
                onChange={(event) => {
                  const match = strikeOptions.find(option => String(option.instrumentToken) === event.target.value);
                  setSelectedStrike(match || null);
                }}
                disabled={strikeOptions.length === 0}
              >
                {strikeOptions.length === 0 ? <option value="">Loading strikes...</option> : strikeOptions.map((option) => (
                  <option key={option.instrumentToken} value={option.instrumentToken}>
                    {option.strike}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Time Frame
              <select
                value={selectedInterval}
                onChange={(event) => setSelectedInterval(event.target.value)}
              >
                {TIMEFRAME_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          {latestCandle && (
            <div className="ohlc-summary">
              <div className="ohlc-box"><span>Open</span><strong>₹{Number(latestCandle.open || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>High</span><strong>₹{Number(latestCandle.high || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Low</span><strong>₹{Number(latestCandle.low || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Close</span><strong>₹{Number(latestCandle.close || 0).toFixed(2)}</strong></div>
              <div className="ohlc-box"><span>Volume</span><strong>{Number(latestCandle.volume || 0).toLocaleString()}</strong></div>
            </div>
          )}

          {chartLoading ? (
            <div className="chart-loading">Loading chart...</div>
          ) : chartData ? (
            <div className="chart-wrapper">
              <Line
                data={chartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                    },
                    tooltip: {
                      mode: 'index',
                      intersect: false,
                    },
                  },
                  scales: {
                    x: {
                      display: true,
                      ticks: {
                        maxTicksLimit: 8,
                      },
                    },
                    y: {
                      display: true,
                      ticks: {
                        callback: (value) => `₹${value}`,
                      },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="chart-empty">Select a strike and timeframe to view historical candles.</div>
          )}
        </div>

        <div className="pcr-details">
          <h3>📊 Detailed Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-name">Put Volume</span>
              <span className="stat-value">{((pcrData?.put_volume || 0) / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Call Volume</span>
              <span className="stat-value">{((pcrData?.call_volume || 0) / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Put OI</span>
              <span className="stat-value">{((pcrData?.put_oi || 0) / 1000000).toFixed(2)}M</span>
            </div>
            <div className="stat-item">
              <span className="stat-name">Call OI</span>
              <span className="stat-value">{((pcrData?.call_oi || 0) / 1000000).toFixed(2)}M</span>
            </div>
          </div>
        </div>

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

        <div className="pcr-footer">
          <small>Last updated: {new Date().toLocaleTimeString()}</small>
        </div>
      </div>
    </div>
  );
}

export default PCRAnalysis;
