import { useEffect } from 'react';

export default function StatsPanel({ stats, onRefresh }) {
  useEffect(() => {
    onRefresh();
  }, []);

  if (!stats) {
    return (
      <div className="drawer-panel">
        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Loading...</div>
      </div>
    );
  }

  const rows = [
    ['Total Entities', stats.total_entities],
    ['Total Supply Links', stats.total_links],
    ['Articulation Points', stats.articulation_points],
    ['High-Risk Entities', stats.critical_entities],
    ['Risk Zones', stats.total_zones],
    ['Critical Paths', stats.critical_paths],
    ['Max Risk Score', stats.max_risk != null ? (stats.max_risk * 100).toFixed(1) + '%' : 'N/A'],
    ['High-Risk Rate', `${stats.critical_rate}%`],
  ];

  return (
    <div className="drawer-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Statistics</h3>
        <button
          onClick={onRefresh}
          style={{
            padding: '2px 8px',
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-light)',
            borderRadius: '4px',
            color: 'var(--text-muted)',
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          Refresh
        </button>
      </div>
      <table style={{ width: '100%', fontSize: '12px' }}>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td style={{ color: 'var(--text-dim)', padding: '3px 8px 3px 0' }}>{label}</td>
              <td style={{ color: 'var(--text-primary)', padding: '3px 0', fontWeight: 'bold', textAlign: 'right' }}>
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
