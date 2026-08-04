import React, { useState, useEffect } from 'react';
import './App.css';
import Holdings from './components/Holdings';
import PCRAnalysis from './components/PCRAnalysis';
import ApiConfig from './components/ApiConfig';
import GithubAuth from './components/GithubAuth';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userEmail, setUserEmail] = useState(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [apiKey, setApiKey] = useState(null);
  const [sessionTimer, setSessionTimer] = useState(null);

  // Check authentication on mount
  useEffect(() => {
    const authData = JSON.parse(sessionStorage.getItem('githubAuth') || 'null');
    if (authData) {
      const sessionTime = Date.now() - authData.timestamp;
      const oneHourMs = 60 * 60 * 1000;
      
      if (sessionTime < oneHourMs) {
        setIsAuthenticated(true);
        setUserEmail(authData.email);
        startSessionTimer(oneHourMs - sessionTime);
      } else {
        sessionStorage.removeItem('githubAuth');
      }
    }
  }, []);

  const startSessionTimer = (remainingTime) => {
    const timer = setTimeout(() => {
      handleLogout();
    }, remainingTime);
    setSessionTimer(timer);
  };

  const handleAuthSuccess = (email) => {
    setIsAuthenticated(true);
    setUserEmail(email);
    startSessionTimer(60 * 60 * 1000); // 1 hour
  };

  const handleConfigured = (key) => {
    setApiKey(key);
    setIsConfigured(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('githubAuth');
    if (sessionTimer) clearTimeout(sessionTimer);
    setIsAuthenticated(false);
    setUserEmail(null);
    setIsConfigured(false);
    setApiKey(null);
  };

  if (!isAuthenticated) {
    return <GithubAuth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="App">
      <header className="app-header">
        <div className="header-content">
          <div className="header-title">
            <h1>🚀 BuilderApp - Kite Connect</h1>
            <p>Portfolio Holdings & Nifty 50 Put-Call Ratio Analysis</p>
          </div>
          <div className="header-user">
            <span className="user-badge">👤 {userEmail}</span>
            <button onClick={handleLogout} className="logout-btn">🚪 Logout</button>
          </div>
        </div>
      </header>

      <div className="container">
        {!isConfigured ? (
          <ApiConfig onConfigured={handleConfigured} />
        ) : (
          <div className="dashboard">
            <Holdings apiKey={apiKey} />
            <PCRAnalysis apiKey={apiKey} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
