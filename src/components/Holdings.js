import React, { useState, useEffect } from 'react';
import './Holdings.css';
import KiteAPI from '../services/kiteAPI';

function Holdings({ apiKey }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quotes, setQuotes] = useState({});

  useEffect(() => {
    fetchHoldings();
  }, [apiKey]);

  const fetchHoldings = async () => {
    setLoading(true);
    setError(null);
    try {
      const kiteAPI = new KiteAPI();
      const holdingsData = await kiteAPI.getHoldings();
      
      setHoldings(holdingsData);

      // Fetch quotes for all holdings
      if (holdingsData.length > 0) {
        const instruments = holdingsData.map(h => `${h.exchange}:${h.tradingsymbol}`);
        const quotesData = await kiteAPI.getQuote(instruments);
        setQuotes(quotesData);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalValue = () => {
    return holdings.reduce((sum, holding) => {
      const currentPrice = holding.last_price ?? holding.average_price ?? 0;
      return sum + (holding.quantity * currentPrice);
    }, 0);
  };

  const calculateGainLoss = () => {
    return holdings.reduce((sum, holding) => {
      const currentPrice = holding.last_price ?? holding.average_price ?? 0;
      const averagePrice = holding.average_price ?? 0;
      return sum + (holding.quantity * (currentPrice - averagePrice));
    }, 0);
  };

  if (loading) {
    return <div className="card"><div className="loading">Loading holdings...</div></div>;
  }

  const totalValue = calculateTotalValue();
  const gainLoss = calculateGainLoss();
  const costBasis = totalValue - gainLoss;
  const gainLossPercent = costBasis ? (gainLoss / costBasis) * 100 : 0;

  return (
    <div className="holdings-container">
      <div className="card">
        <div className="holdings-header">
          <h2>📊 Current Holdings</h2>
          <button onClick={fetchHoldings} className="refresh-btn">🔄 Refresh</button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="portfolio-stats">
          <div className="stat-box">
            <span className="stat-label">Total Portfolio Value</span>
            <span className="stat-value">₹{totalValue.toFixed(2)}</span>
          </div>
          <div className={`stat-box ${gainLoss >= 0 ? 'positive' : 'negative'}`}>
            <span className="stat-label">Gain / Loss</span>
            <span className="stat-value">
              ₹{gainLoss.toFixed(2)} ({gainLossPercent.toFixed(2)}%)
            </span>
          </div>
          <div className="stat-box">
            <span className="stat-label">Holdings Count</span>
            <span className="stat-value">{holdings.length}</span>
          </div>
        </div>

        {holdings.length === 0 ? (
          <div className="empty-state">
            <p>No holdings found. Your portfolio is empty!</p>
          </div>
        ) : (
          <div className="holdings-table-wrapper">
            <table className="holdings-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Quantity</th>
                  <th>Avg Cost</th>
                  <th>Current Price</th>
                  <th>Value</th>
                  <th>Gain/Loss</th>
                  <th>Return %</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding, idx) => {
                  const currentPrice = holding.last_price ?? holding.average_price ?? 0;
                  const averagePrice = holding.average_price ?? 0;
                  const holdingValue = holding.quantity * currentPrice;
                  const costValue = holding.quantity * averagePrice;
                  const gain = holdingValue - costValue;
                  const returnPercent = costValue ? (gain / costValue) * 100 : 0;

                  return (
                    <tr key={idx} className={gain >= 0 ? 'positive' : 'negative'}>
                      <td className="symbol">{holding.tradingsymbol}</td>
                      <td>{holding.quantity}</td>
                      <td>₹{averagePrice.toFixed(2)}</td>
                      <td>₹{currentPrice.toFixed(2)}</td>
                      <td>₹{holdingValue.toFixed(2)}</td>
                      <td className={gain >= 0 ? 'gain' : 'loss'}>
                        {gain >= 0 ? '▲' : '▼'} ₹{Math.abs(gain).toFixed(2)}
                      </td>
                      <td className={gain >= 0 ? 'gain' : 'loss'}>
                        {returnPercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Holdings;
