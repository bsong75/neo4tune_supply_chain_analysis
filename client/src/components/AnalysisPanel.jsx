import { useState } from 'react';
import api from '../api';

export default function AnalysisPanel({ onAnalysisComplete }) {
  const [running, setRunning] = useState(false);
  const [threshold, setThreshold] = useState(0.5);
  const [result, setResult] = useState(null);

  const handleAnalyze = async () => {
    setRunning(true);
    setResult(null);
    try {
      const resp = await api.post('/analyze/run', { critical_threshold: threshold });
      setResult(resp.data);
      onAnalysisComplete();
    } catch (err) {
      setResult({ error: err.response?.data?.error || err.message });
    }
    setRunning(false);
  };

  const handleExport = () => {
    const link = document.createElement('a');
    link.href = '/api/analyze/export';
    link.download = 'supply_chain_risk_results.xlsx';
    link.click();
  };

  return (
    <div className="drawer-panel">
      <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '8px' }}>Supply Chain Risk Analysis</h3>
      <label style={{ fontSize: '12px', display: 'block', margin: '8px 0', color: 'var(--text-muted)' }}>
        Risk Threshold: <strong style={{ color: 'var(--text-primary)' }}>{threshold}</strong>
        <input
          type="range"
          min="0.2"
          max="0.9"
          step="0.05"
          value={threshold}
          onChange={(e) => setThreshold(parseFloat(e.target.value))}
          style={{ width: '100%', marginTop: '4px' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-dim)' }}>
          <span>Sensitive (0.2)</span>
          <span>Strict (0.9)</span>
        </div>
      </label>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleAnalyze}
          disabled={running}
          style={{
            flex: 1,
            padding: '8px',
            background: '#e0e0e0',
            border: 'none',
            borderRadius: '4px',
            color: '#1a1a1a',
            fontSize: '13px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          {running ? 'Analyzing...' : 'Run Analysis'}
        </button>
        <button
          onClick={handleExport}
          style={{
            padding: '8px 12px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-light)',
            borderRadius: '4px',
            color: 'var(--text-muted)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Export
        </button>
      </div>
      {result && (
        <pre style={{
          fontSize: '11px',
          marginTop: '8px',
          color: result.error ? '#FF4444' : 'var(--text-dim)',
          background: 'var(--bg-panel)',
          padding: '8px',
          borderRadius: '4px',
          overflowX: 'auto',
        }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
