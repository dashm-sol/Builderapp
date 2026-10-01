import React, { useState } from 'react';

/**
 * AutoTradePanel Component
 * 
 * Handles automatic trading controls, acknowledgement, and status display
 * 
 * Props:
 * - autoTradingEnabled: Whether auto-trading is active
 * - autoTradingAcknowledged: Whether user has acknowledged live trading risks
 * - autoTradingStatus: Current status message
 * - autoTradingBusy: Whether a trade operation is in progress
 * - autoTradePlan: Current trade plan object
 * - onStartAutomaticTrading: Callback to start auto-trading
 * - onStopAutomaticTrading: Callback to stop auto-trading
 * - onAcknowledgeTrading: Callback when user acknowledges trading
 */

function AutoTradePanel({
  autoTradingEnabled,
  autoTradingAcknowledged,
  autoTradingStatus,
  autoTradingBusy,
  autoTradePlan,
  onStartAutomaticTrading,
  onStopAutomaticTrading,
  onAcknowledgeTrading,
}) {
  const [showAcknowledgement, setShowAcknowledgement] = useState(false);

  const handleAcknowledge = () => {
    onAcknowledgeTrading();
    setShowAcknowledgement(false);
    // Start trading immediately after acknowledgement
    setTimeout(() => onStartAutomaticTrading(), 100);
  };

  return (
    <div style={{
      marginTop: '24px',
      padding: '16px',
      backgroundColor: '#f8fafc',
      borderRadius: '8px',
      border: '1px solid #e2e8f0',
    }}>
      <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>
        🤖 Automatic Trading Control
      </h3>

      {/* Status Display */}
      <div style={{
        padding: '12px',
        marginBottom: '16px',
        backgroundColor: '#ffffff',
        borderRadius: '6px',
        border: '1px solid #cbd5e1',
        fontSize: '14px',
        color: autoTradingEnabled ? '#059669' : '#64748b',
        fontWeight: '500',
      }}>
        {autoTradingStatus}
      </div>

      {/* Current Trade Plan */}
      {autoTradePlan && autoTradePlan.action !== 'HOLD' && (
        <div style={{
          padding: '12px',
          marginBottom: '16px',
          backgroundColor: '#fff8f0',
          borderRadius: '6px',
          border: '1px solid #fed7aa',
          fontSize: '13px',
        }}>
          <div style={{ fontWeight: 'bold', color: '#b45309', marginBottom: '8px' }}>
            📊 Current Trade Opportunity:
          </div>
          <div style={{ color: '#92400e', lineHeight: '1.6' }}>
            <div><strong>Action:</strong> {autoTradePlan.action}</div>
            <div><strong>Pattern:</strong> {autoTradePlan.pattern}</div>
            <div><strong>Entry:</strong> ₹{autoTradePlan.entry?.toFixed(2)}</div>
            <div><strong>Target:</strong> ₹{autoTradePlan.target?.toFixed(2)}</div>
            <div><strong>Stop Loss:</strong> ₹{autoTradePlan.stopLoss?.toFixed(2)}</div>
            <div style={{ marginTop: '8px', fontSize: '12px', fontStyle: 'italic' }}>
              {autoTradePlan.reason}
            </div>
          </div>
        </div>
      )}

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {!autoTradingEnabled ? (
          <>
            <button
              onClick={() => setShowAcknowledgement(true)}
              disabled={autoTradingBusy}
              style={{
                padding: '10px 16px',
                backgroundColor: '#0ea5e9',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                cursor: autoTradingBusy ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '14px',
                opacity: autoTradingBusy ? 0.5 : 1,
              }}
            >
              {autoTradingBusy ? '⏳ Processing...' : '▶️ Start Automatic Trading'}
            </button>
          </>
        ) : (
          <button
            onClick={onStopAutomaticTrading}
            disabled={autoTradingBusy}
            style={{
              padding: '10px 16px',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              cursor: autoTradingBusy ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '14px',
              opacity: autoTradingBusy ? 0.5 : 1,
            }}
          >
            {autoTradingBusy ? '⏳ Processing...' : '⏹️ Stop Automatic Trading'}
          </button>
        )}
      </div>

      {/* Acknowledgement Modal */}
      {showAcknowledgement && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>
              ⚠️ Live Order Acknowledgement
            </h2>

            <div style={{ color: '#475569', lineHeight: '1.6', marginBottom: '20px', fontSize: '14px' }}>
              <p>
                <strong>You are about to enable LIVE AUTOMATIC TRADING</strong> with real money orders.
                By proceeding, you acknowledge and agree to the following:
              </p>

              <ul style={{ margin: '12px 0', paddingLeft: '20px' }}>
                <li>Real orders will be placed on the Kite.trade brokerage account</li>
                <li>Financial loss is possible and you accept full responsibility</li>
                <li>The system may place orders outside market hours or due to technical errors</li>
                <li>You will monitor positions actively and can stop trading immediately</li>
                <li>The developer/system is not liable for any losses incurred</li>
              </ul>

              <p style={{ marginTop: '16px', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '6px', borderLeft: '4px solid #dc2626' }}>
                <strong>DO NOT ENABLE</strong> if you are not comfortable with automated trading or cannot monitor the positions regularly.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowAcknowledgement(false)}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#e2e8f0',
                  color: '#1e293b',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                ❌ Decline
              </button>
              <button
                onClick={handleAcknowledge}
                style={{
                  padding: '10px 16px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500',
                }}
              >
                ✅ I Understand & Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div style={{
        padding: '12px',
        backgroundColor: '#ecfdf5',
        borderRadius: '6px',
        border: '1px solid #a7f3d0',
        fontSize: '12px',
        color: '#065f46',
        lineHeight: '1.5',
      }}>
        <strong>💡 How it works:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>Trading is armed after acknowledgement</li>
          <li>When next BUY/SELL signal confirms, one order is auto-submitted</li>
          <li>Entry executed at market, target and stop-loss orders armed automatically</li>
          <li>After order fills, you can manually update exit price or let auto-exit trigger</li>
          <li>Only ONE order per signal cycle; monitoring required</li>
        </ul>
      </div>
    </div>
  );
}

export default AutoTradePanel;
