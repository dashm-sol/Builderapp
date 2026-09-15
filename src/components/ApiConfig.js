import React, { useEffect, useState } from 'react';
import './ApiConfig.css';

function ApiConfig({ onConfigured }) {
  const [formData, setFormData] = useState({
    apiKey: '',
    apiSecret: '',
    requestToken: '',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/kite/session', { credentials: 'include' })
      .then(response => response.json())
      .then(data => {
        if (data.authenticated) onConfigured();
      })
      .catch(() => setError('Unable to contact the Kite server.'));
  }, [onConfigured]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(previous => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/kite/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          apiKey: formData.apiKey.trim(),
          apiSecret: formData.apiSecret.trim(),
          requestToken: formData.requestToken.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kite connection failed');
      onConfigured(formData.apiKey.trim());
    } catch (connectError) {
      setError(connectError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="config-container">
      <div className="config-card">
        <h2>🔑 Connect Kite Connect</h2>
        <p className="config-description">
          Enter the credentials and the one-time request token from Kite. The request token is valid only for about 30 seconds to 2 minutes, so exchange it immediately.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="config-form">
          <div className="form-group">
            <label htmlFor="apiKey">API Key</label>
            <input id="apiKey" name="apiKey" value={formData.apiKey} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="apiSecret">API Secret</label>
            <input id="apiSecret" name="apiSecret" type="password" value={formData.apiSecret} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label htmlFor="requestToken">Request Token</label>
            <input id="requestToken" name="requestToken" value={formData.requestToken} onChange={handleChange} required />
          </div>
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Connecting...' : 'Connect Kite'}
          </button>
        </form>

        <div className="security-note">
          <p>🔒 Request token: short-lived handshake token (~30 sec to 2 min). Access token: longer-lived (~24 hours, refreshed daily) and kept server-side in the session, never exposed to the browser.</p>
        </div>
      </div>
    </div>
  );
}

export default ApiConfig;
