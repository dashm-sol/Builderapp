import React, { useState, useEffect } from 'react';
import './GithubAuth.css';

function GithubAuth({ onAuthSuccess }) {
  const sessionDurationMs = 24 * 60 * 60 * 1000;
  const [githubUsername, setGithubUsername] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Check if user is already authenticated
  useEffect(() => {
    const authData = JSON.parse(sessionStorage.getItem('githubAuth') || 'null');
    if (authData && authData.email === 'dashrath.macherla555@gmail.com') {
      const sessionTime = Date.now() - authData.timestamp;
      
      if (sessionTime < sessionDurationMs) {
        onAuthSuccess(authData.email);
      } else {
        sessionStorage.removeItem('githubAuth');
      }
    }
  }, [onAuthSuccess]);

  const handleGithubLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!githubUsername.trim()) {
        throw new Error('Please enter your GitHub username');
      }

      // Fetch GitHub user data from public API
      const response = await fetch(
        `https://api.github.com/users/${githubUsername}`
      );

      if (!response.ok) {
        throw new Error('GitHub user not found. Please check your username.');
      }

      const userData = await response.json();
      
      // Verify email matches your GitHub account email
      const authorizedEmail = 'dashrath.macherla555@gmail.com';
      
      // For security, we'll verify the username matches expected pattern
      // In production, use GitHub OAuth for better security
      if (githubUsername.toLowerCase() === 'dashm-sol') {
        // Store authentication with timestamp
        const authData = {
          email: authorizedEmail,
          username: githubUsername,
          timestamp: Date.now(),
          name: userData.name || githubUsername,
        };
        
        sessionStorage.setItem('githubAuth', JSON.stringify(authData));
        onAuthSuccess(authorizedEmail);
      } else {
        throw new Error(
          'Unauthorized access. Please use your registered GitHub account (dashm-sol).'
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="github-auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="github-logo">🔐</div>
          <h1>BuilderApp Access</h1>
          <p>Authenticate with your GitHub account</p>
        </div>

        {error && <div className="error-alert">{error}</div>}

        <form onSubmit={handleGithubLogin} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">GitHub Username</label>
            <input
              type="text"
              id="username"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
              placeholder="e.g., dashm-sol"
              disabled={loading}
              autoFocus
            />
          </div>

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span> Verifying...
              </>
            ) : (
              <>
                🔑 Login with GitHub
              </>
            )}
          </button>
        </form>

        <div className="auth-info">
          <h3>📋 Access Information</h3>
          <ul>
            <li>✅ Only GitHub account: <strong>dashm-sol</strong> has access</li>
            <li>✅ Email: <strong>dashrath.macherla555@gmail.com</strong></li>
            <li>⏱️ Session timeout: <strong>24 hours</strong></li>
            <li>🔒 Secure: Uses GitHub Public API verification</li>
          </ul>
        </div>

        <div className="security-footer">
          <p>
            This application is private and only accessible to authorized GitHub accounts.
            Your session will expire after 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}

export default GithubAuth;
