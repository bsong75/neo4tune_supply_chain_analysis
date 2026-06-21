import { NODE_COLORS } from '../constants';

const FIELD_LABELS = {
  entity_id: 'Entity ID',
  name: 'Name',
  country: 'Country',
  material: 'Material',
  component: 'Component',
  capacity: 'Capacity',
  capacity_unit: 'Capacity Unit',
  tier: 'Tier',
  status: 'Status',
  risk_score: 'Risk Score',
  is_articulation_point: 'Articulation Point',
  cascade_impact: 'Cascade Impact',
  betweenness_centrality: 'Betweenness Centrality',
  degree_centrality: 'Degree Centrality',
  zone_id: 'Zone ID',
  member_count: 'Member Count',
  failure_impact: 'Failure Impact',
  volume: 'Volume',
  lead_time_days: 'Lead Time (days)',
  cost_per_unit: 'Cost per Unit',
};

export default function NodeDetail({ node, link, onClose, theme }) {
  if (!node && !link) return null;

  if (link) {
    const props = {};
    if (link.type) props.type = link.type;
    if (link.material != null) props.material = link.material;
    if (link.volume != null) props.volume = link.volume;
    if (link.lead_time_days != null) props.lead_time_days = link.lead_time_days;
    if (link.cost_per_unit != null) props.cost_per_unit = link.cost_per_unit;
    if (link.score != null) props.score = link.score;
    if (link.method) props.method = link.method;

    const entries = Object.entries(props);

    return (
      <div className="node-detail-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            Link: {link.type}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>
            x
          </button>
        </div>
        <table style={{ width: '100%', fontSize: '12px' }}>
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key}>
                <td style={{ color: 'var(--text-dim)', padding: '3px 8px 3px 0', verticalAlign: 'top' }}>
                  {FIELD_LABELS[key] || key}
                </td>
                <td style={{ color: 'var(--text-primary)', padding: '3px 0', wordBreak: 'break-all' }}>
                  {String(value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const entries = Object.entries(node.properties || {}).filter(
    ([key]) => key !== 'created_at'
  );

  return (
    <div className="node-detail-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <span style={{
          background: NODE_COLORS[theme || 'dark']?.[node.label] || '#999',
          padding: '2px 8px',
          borderRadius: '4px',
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#fff',
        }}>
          {node.label}
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '16px' }}>
          x
        </button>
      </div>
      <table style={{ width: '100%', fontSize: '12px' }}>
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key}>
              <td style={{ color: 'var(--text-dim)', padding: '3px 8px 3px 0', verticalAlign: 'top' }}>
                {FIELD_LABELS[key] || key}
              </td>
              <td style={{ color: 'var(--text-primary)', padding: '3px 0', wordBreak: 'break-all' }}>
                {typeof value === 'boolean' ? (value ? 'Yes' : 'No') :
                 typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(4)) :
                 String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
