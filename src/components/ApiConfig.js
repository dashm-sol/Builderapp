import React, { useState } from 'react';
import './ApiConfig.css';

function ApiConfig({ onConfigured }) {
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    accessToken: '',
    publicToken: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Validate all fields are filled
      if (!formData.apiKey || !formData.accessToken) {
        throw new Error('API Key and Access Token are required');
      }

      // Store in localStorage (in production, use secure methods)
      localStorage.setItem('kiteConfig', JSON.stringify({
        apiKey: formData.apiKey,
        accessToken: formData.accessToken,
      }));

      onConfigured(formData.apiKey);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="config-container">
      <div className="config-card">
        <h2>🔑 Configure Kite Connect API</h2>
        <p className="config-description">
          Enter your Kite Connect API credentials to get started
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="config-form">
          <div className="form-group">
            <label htmlFor="apiKey">API Key *</label>
            <input
              type="text"
              id="apiKey"
              name="apiKey"
              value={formData.apiKey}
              onChange={handleChange}
              placeholder="Enter your API Key"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="apiSecret">API Secret</label>
            <input
              type="password"
              id="apiSecret"
              name="apiSecret"
              value={formData.apiSecret}
              onChange={handleChange}
              placeholder="Enter your API Secret"
            />
          </div>

          <div className="form-group">
            <label htmlFor="accessToken">Access Token *</label>
            <input
              type="password"
              id="accessToken"
              name="accessToken"
              value={formData.accessToken}
              onChange={handleChange}
              placeholder="Enter your Access Token"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="publicToken">Public Token</label>
            <input
              type="text"
              id="publicToken"
              name="publicToken"
              value={formData.publicToken}
              onChange={handleChange}
              placeholder="Enter your Public Token"
            />
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={loading}
          >
            {loading ? 'Configuring...' : '✓ Configure & Continue'}
          </button>
        </form>

        <div className="security-note">
          <p>🔒 <strong>Security Note:</strong> Your credentials are stored locally in your browser. Never share your API Secret or Access Token.</p>
        </div>
      </div>
    </div>
  );
}

export default ApiConfig;
