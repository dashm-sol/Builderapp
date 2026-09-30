import React, { useState } from 'react';
import './SignalTable.css';

/**
 * SignalTable Component
 * 
 * Displays trading signals in a sortable, filterable table with outcomes
 * 
 * Props:
 * - signals: Array of signal objects with time, action, entry, target, stopLoss, outcome
 * - reverseSignals: Array of reverse signals
 * - dayFilter: Current date filter
 * - signalFilter: Filter type (ALL, TRUE, FALSE, PENDING)
 * - onSignalFilter: Callback when filter changes
 * - onLockSignal: Callback to lock a signal
 * - onUpdateSignalExit: Callback to update signal exit details
 */

function SignalTable({
  signals,
  reverseSignals,
  dayFilter,
  signalFilter,
  onSignalFilter,
  onLockSignal,
  onUpdateSignalExit,
}) {
  const [showReverseSignals, setShowReverseSignals] = useState(false);
  const [sortColumn, setSortColumn] = useState('time');
  const [sortOrder, setSortOrder] = useState('desc');

  const displayedSignals = showReverseSignals ? reverseSignals : signals;

  // Filter signals by outcome and date
  const filteredSignals = displayedSignals.filter(signal => {
    const signalDate = new Date(signal.time).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

    if (dayFilter && signalDate !== dayFilter) return false;

    if (signalFilter === 'TRUE') return signal.outcome === 'True';
    if (signalFilter === 'FALSE') return signal.outcome === 'False';
    if (signalFilter === 'PENDING') return signal.outcome === 'Pending';

    return true;
  });

  // Sort signals
  const sortedSignals = [...filteredSignals].sort((a, b) => {
    let aVal = a[sortColumn];
    let bVal = b[sortColumn];

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    return sortOrder === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortOrder('desc');
    }
  };

  return (
    <div style={{ marginTop: '24px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <h3 style={{ margin: '0', fontSize: '16px', fontWeight: 'bold' }}>
          {showReverseSignals ? 'Reverse Signals' : 'Combined Signals'}
        </h3>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowReverseSignals(!showReverseSignals)}
            style={{
              padding: '8px 12px',
              borderRadius: '4px',
              border: '1px solid #cbd5e1',
              backgroundColor: showReverseSignals ? '#e0f2fe' : '#ffffff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            {showReverseSignals ? 'Show Original' : 'Show Reverse'}
          </button>

          {['ALL', 'TRUE', 'FALSE', 'PENDING'].map(filter => (
            <button
              key={filter}
              onClick={() => onSignalFilter(filter)}
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #cbd5e1',
                backgroundColor: signalFilter === filter ? '#0ea5e9' : '#ffffff',
                color: signalFilter === filter ? '#ffffff' : '#000000',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px',
          backgroundColor: '#ffffff',
        }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <th onClick={() => handleSort('time')} style={tableHeaderStyle}>Time</th>
              <th onClick={() => handleSort('action')} style={tableHeaderStyle}>Action</th>
              <th onClick={() => handleSort('entry')} style={tableHeaderStyle}>Entry</th>
              <th onClick={() => handleSort('target')} style={tableHeaderStyle}>Target</th>
              <th onClick={() => handleSort('stopLoss')} style={tableHeaderStyle}>Stop Loss</th>
              <th onClick={() => handleSort('outcome')} style={tableHeaderStyle}>Outcome</th>
              <th style={{ ...tableHeaderStyle, cursor: 'default' }}>Details</th>
            </tr>
          </thead>
          <tbody>
            {sortedSignals.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                  No signals to display
                </td>
              </tr>
            ) : (
              sortedSignals.map((signal, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid #e2e8f0',
                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#f1f5f9' : '#e2e8f0';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
                  }}
                >
                  <td style={tableCellStyle}>
                    {new Date(signal.time).toLocaleString('en-IN', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </td>
                  <td style={{ ...tableCellStyle, color: signal.action === 'BUY' ? '#059669' : '#dc2626', fontWeight: 'bold' }}>
                    {signal.action}
                  </td>
                  <td style={tableCellStyle}>₹{signal.entry?.toFixed(2) || 'N/A'}</td>
                  <td style={tableCellStyle}>₹{signal.target?.toFixed(2) || 'N/A'}</td>
                  <td style={tableCellStyle}>₹{signal.stopLoss?.toFixed(2) || 'N/A'}</td>
                  <td style={{
                    ...tableCellStyle,
                    fontWeight: 'bold',
                    color: signal.outcome === 'True' ? '#059669' : signal.outcome === 'False' ? '#dc2626' : '#f59e0b',
                  }}>
                    {signal.outcome || 'Pending'}
                  </td>
                  <td style={tableCellStyle}>
                    <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '200px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {signal.evaluation || signal.reason || '—'}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748b' }}>
        Showing {sortedSignals.length} of {displayedSignals.length} signals
      </div>
    </div>
  );
}

const tableHeaderStyle = {
  padding: '12px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '12px',
  cursor: 'pointer',
  userSelect: 'none',
  color: '#334155',
};

const tableCellStyle = {
  padding: '12px',
  textAlign: 'left',
  verticalAlign: 'middle',
};

export default SignalTable;
