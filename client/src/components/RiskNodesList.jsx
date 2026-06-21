export default function RiskNodesList({ nodes, onRefresh, onNodeSelect }) {
  return (
    <div className="drawer-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>High-Risk Nodes</h3>
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
      {nodes.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
          No analysis results yet. Run analysis first.
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {nodes.map((node) => (
          <div
            key={node.entity_id}
            onClick={() => onNodeSelect(node.entity_id)}
            style={{
              padding: '8px',
              background: 'var(--bg-panel)',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              border: '1px solid transparent',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                {node.name}
              </span>
              <span style={{
                fontWeight: 'bold',
                fontSize: '14px',
                color: node.score >= 0.7 ? '#FF4444' : node.score >= 0.5 ? '#FF8844' : 'var(--text-muted)',
              }}>
                {(node.score * 100).toFixed(0)}%
              </span>
            </div>
            <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
              {node.type} | {node.country}
              {node.is_ap && ' | AP'}
              {node.cascade_impact > 0 && ` | Impact: ${node.cascade_impact}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
