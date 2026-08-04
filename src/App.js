import React, { useState } from 'react';
import './App.css';
import Holdings from './components/Holdings';
import PCRAnalysis from './components/PCRAnalysis';
import ApiConfig from './components/ApiConfig';

function App() {
  const [isConfigured, setIsConfigured] = useState(false);
  const [apiKey, setApiKey] = useState(null);

  const handleConfigured = (key) => {
    setApiKey(key);
    setIsConfigured(true);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🚀 BuilderApp - Kite Connect</h1>
        <p>Portfolio Holdings & Nifty 50 Put-Call Ratio Analysis</p>
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
