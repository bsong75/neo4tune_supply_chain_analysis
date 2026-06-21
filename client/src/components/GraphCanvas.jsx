import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { NODE_COLORS, NODE_LABELS, NODE_ICONS, NODE_SIZES, NODE_DISPLAY_PROPERTY, EDGE_COLORS, CRITICAL_COLOR } from '../constants';

function getCssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const TIER_ORDER = {
  Mine: 0,
  Refinery: 1,
  ComponentMfg: 2,
  CellMfg: 3,
  PackAssembly: 4,
  OEM: 5,
};
const TIER_COUNT = 6;

export default function GraphCanvas({ graphData, removeNodes, selectedNode, onNodeClick, selectedLink, onLinkClick, loading, theme, layoutMode }) {
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [ctxMenu, setCtxMenu] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Apply tiered layout forces when layout mode changes
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    if (layoutMode === 'tiered') {
      const usableHeight = dimensions.height * 0.80; // use 80% of canvas height
      const topMargin = dimensions.height * 0.08;  // 8% margin at top
      const tierSpacing = usableHeight / (TIER_COUNT - 1 || 1);
      const bandHalf = tierSpacing * 0.35;
      // Strong Y force + hard clamp to keep nodes in their tier band
      fg.d3Force('tierY', () => {
        graphData.nodes.forEach((node) => {
          const tier = TIER_ORDER[node.label];
          if (tier == null) return;
          const targetY = topMargin + tier * tierSpacing - dimensions.height / 2;
          const minY = targetY - bandHalf;
          const maxY = targetY + bandHalf;
          // Snap toward center of band
          node.vy += (targetY - node.y) * 0.3;
          // Hard clamp: if outside band, force back and kill velocity
          if (node.y < minY) { node.y = minY; node.vy = Math.max(0, node.vy); }
          if (node.y > maxY) { node.y = maxY; node.vy = Math.min(0, node.vy); }
        });
      });
      // Weaken the default center force and charge so tiers stay clean
      fg.d3Force('charge')?.strength(-120);
      fg.d3Force('center')?.strength(0.02);
      fg.d3Force('link')?.distance(tierSpacing * 0.6);
    } else {
      // Restore defaults for force layout
      fg.d3Force('tierY', null);
      fg.d3Force('charge')?.strength(-30);
      fg.d3Force('center')?.strength(1);
      fg.d3Force('link')?.distance(30);
    }

    // Reheat the simulation so the new forces take effect
    fg.d3ReheatSimulation();
  }, [layoutMode, dimensions.height, graphData.nodes]);

  useEffect(() => {
    if (!ctxMenu) return;
    const dismiss = () => setCtxMenu(null);
    const onKey = (e) => { if (e.key === 'Escape') dismiss(); };
    const timer = setTimeout(() => {
      window.addEventListener('click', dismiss);
      window.addEventListener('contextmenu', dismiss);
      window.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', dismiss);
      window.removeEventListener('contextmenu', dismiss);
      window.removeEventListener('keydown', onKey);
    };
  }, [ctxMenu]);

  const handleNodeDragEnd = useCallback((node) => {
    node.fx = node.x;
    node.fy = node.y;
  }, []);

  const handleNodeRightClick = useCallback((node, event) => {
    event.preventDefault();
    const rect = containerRef.current.getBoundingClientRect();
    setCtxMenu({
      node,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }, []);

  const handleUnpin = useCallback(() => {
    if (!ctxMenu) return;
    ctxMenu.node.fx = undefined;
    ctxMenu.node.fy = undefined;
    setCtxMenu(null);
  }, [ctxMenu]);

  const handleRemoveWithChildren = useCallback(() => {
    if (!ctxMenu) return;
    const { node } = ctxMenu;
    const { nodes, links } = graphData;

    const getId = (endpoint) => typeof endpoint === 'object' ? endpoint.id : endpoint;

    const outgoing = new Map();
    const incoming = new Map();
    links.forEach((link) => {
      const s = getId(link.source);
      const t = getId(link.target);
      if (!outgoing.has(s)) outgoing.set(s, []);
      outgoing.get(s).push(t);
      if (!incoming.has(t)) incoming.set(t, []);
      incoming.get(t).push(s);
    });

    const candidates = new Set();
    const stack = [node.id];
    while (stack.length) {
      const current = stack.pop();
      if (candidates.has(current)) continue;
      candidates.add(current);
      const children = outgoing.get(current) || [];
      children.forEach((childId) => {
        if (!candidates.has(childId)) stack.push(childId);
      });
    }

    const toRemove = new Set(candidates);

    let changed = true;
    while (changed) {
      changed = false;
      toRemove.forEach((id) => {
        if (id === node.id) return;
        const parents = incoming.get(id) || [];
        const hasExternalParent = parents.some((p) => !toRemove.has(p));
        if (hasExternalParent) {
          toRemove.delete(id);
          changed = true;
        }
      });
    }

    if (selectedNode && toRemove.has(selectedNode.id)) {
      onNodeClick(null);
    }

    removeNodes([...toRemove]);
    setCtxMenu(null);
  }, [ctxMenu, graphData, removeNodes, selectedNode, onNodeClick]);

  const handleNodeClick = useCallback((node) => {
    onNodeClick(node);
    onLinkClick(null);
  }, [onNodeClick, onLinkClick]);

  const handleLinkClick = useCallback((link) => {
    onLinkClick(link);
    onNodeClick(null);
  }, [onLinkClick, onNodeClick]);

  const paintNode = useCallback((node, ctx, globalScale) => {
    const t = theme || 'dark';
    const icon = NODE_ICONS[node.label];
    const label = NODE_LABELS[node.label] || '?';
    const displayProp = NODE_DISPLAY_PROPERTY[node.label];
    const displayVal = node.properties?.[displayProp] || '';
    const nodeSize = NODE_SIZES[node.label] || node.val || 6;
    const fontSize = nodeSize * 0.9;
    const textColor = getCssVar('--text-primary') || '#fff';
    const subTextColor = getCssVar('--text-secondary') || '#ddd';
    const nodeColor = NODE_COLORS[t]?.[node.label] || '#999';
    const critColor = CRITICAL_COLOR[t] || '#FF4444';

    // Risk glow ring
    const riskScore = node.properties?.risk_score;
    if (riskScore != null && riskScore >= 0.5) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize + 4, 0, 2 * Math.PI);
      const r = parseInt(critColor.slice(1, 3), 16);
      const g = parseInt(critColor.slice(3, 5), 16);
      const b = parseInt(critColor.slice(5, 7), 16);
      ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(riskScore, 1.0)})`;
      ctx.lineWidth = 2.5 / globalScale;
      ctx.stroke();
    }

    // Neon glow effect in dark mode
    if (t === 'dark') {
      ctx.save();
      ctx.shadowColor = nodeColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor;
      ctx.fill();
    }

    if (selectedNode && selectedNode.id === node.id) {
      ctx.strokeStyle = textColor;
      ctx.lineWidth = 2 / globalScale;
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Icon or label
    if (icon) {
      const iconSize = nodeSize * 1.4;
      ctx.font = `${iconSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(icon, node.x, node.y);
    } else {
      ctx.font = `bold ${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = textColor;
      ctx.fillText(label, node.x, node.y);
    }

    // Articulation point diamond marker
    if (node.properties?.is_articulation_point) {
      const s = nodeSize * 0.35;
      const markerY = node.y - nodeSize - s - 3;
      ctx.beginPath();
      ctx.moveTo(node.x, markerY - s);
      ctx.lineTo(node.x + s, markerY);
      ctx.lineTo(node.x, markerY + s);
      ctx.lineTo(node.x - s, markerY);
      ctx.closePath();
      ctx.fillStyle = critColor;
      ctx.fill();
    }

    // Display property below node
    if (displayVal) {
      ctx.font = `${fontSize * 0.8}px Sans-Serif`;
      ctx.fillStyle = subTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(displayVal, node.x, node.y + nodeSize + fontSize);
    }
  }, [selectedNode, theme]);

  const paintLink = useCallback((link, ctx, globalScale) => {
    const t = theme || 'dark';
    const fontSize = 8 / globalScale;
    const start = link.source;
    const end = link.target;

    if (typeof start !== 'object' || typeof end !== 'object') return;

    const isSelected = selectedLink && selectedLink === link;
    const edgeColor = EDGE_COLORS[t]?.[link.type];
    const linkColor = isSelected
      ? (getCssVar('--text-primary') || '#fff')
      : (edgeColor || getCssVar('--link-color') || 'rgba(255,255,255,0.2)');
    const labelColor = isSelected
      ? (getCssVar('--text-primary') || '#fff')
      : (getCssVar('--link-label') || 'rgba(255,255,255,0.4)');

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = linkColor;
    ctx.lineWidth = isSelected ? 3 / globalScale : (link.type === 'CRITICAL_PATH' ? 2.5 / globalScale : 1.5 / globalScale);
    ctx.stroke();

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    ctx.font = `${isSelected ? 'bold ' : ''}${fontSize}px Sans-Serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = labelColor;

    let linkLabel = link.type;
    if (link.type === 'CRITICAL_PATH' && link.score != null) {
      linkLabel = `CRITICAL (${link.score})`;
    } else if (link.type === 'SUPPLIES_TO' && isSelected && link.material) {
      linkLabel = `${link.material}`;
    }
    ctx.fillText(linkLabel, midX, midY);
  }, [theme, selectedLink]);

  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      setTimeout(() => {
        fgRef.current.zoomToFit(400, 60);
        const MAX_ZOOM = 2;
        if (fgRef.current.zoom() > MAX_ZOOM) {
          fgRef.current.zoom(MAX_ZOOM, 400);
        }
      }, 500);
    }
  }, [graphData]);

  const canvasBg = theme === 'light' ? '#e4e4e4' : '#111111';

  const menuBtnStyle = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '8px 12px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: '13px',
  };

  return (
    <div ref={containerRef} style={{ flex: 1, background: 'var(--bg-canvas)', position: 'relative', overflow: 'hidden' }}>
      <ForceGraph2D
        ref={fgRef}
        graphData={graphData}
        width={dimensions.width}
        height={dimensions.height}
        nodeCanvasObject={paintNode}
        linkCanvasObject={paintLink}
        onNodeClick={handleNodeClick}
        onNodeDragEnd={handleNodeDragEnd}
        onNodeRightClick={handleNodeRightClick}
        onLinkClick={handleLinkClick}
        linkHoverPrecision={8}
        nodeId="id"
        linkSource="source"
        linkTarget="target"
        backgroundColor={canvasBg}
        nodeRelSize={6}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />
      {layoutMode === 'tiered' && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-around',
          padding: '12px 0',
          pointerEvents: 'none',
          zIndex: 5,
        }}>
          {[
            { key: 'Mine', name: 'Mine' },
            { key: 'Refinery', name: 'Refinery' },
            { key: 'ComponentMfg', name: 'Component Mfg' },
            { key: 'CellMfg', name: 'Cell Mfg' },
            { key: 'PackAssembly', name: 'Pack Assembly' },
            { key: 'OEM', name: 'OEM' },
          ].map((tier) => (
            <div key={tier.key} style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
            }}>
              <div style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                background: 'var(--bg-stats)',
                padding: '3px 10px',
                borderRadius: '0 4px 4px 0',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {tier.name}
              </div>
              <div style={{
                flex: 1,
                height: '2px',
                background: 'var(--border-color)',
                opacity: 0.7,
                marginLeft: '8px',
              }} />
            </div>
          ))}
        </div>
      )}
      {ctxMenu && (
        <div
          style={{
            position: 'absolute',
            left: ctxMenu.x,
            top: ctxMenu.y,
            zIndex: 20,
            background: 'var(--bg-panel)',
            border: '1px solid var(--border-hover)',
            borderRadius: '6px',
            padding: '4px 0',
            minWidth: '180px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            padding: '4px 12px',
            fontSize: '11px',
            color: 'var(--text-dim)',
            borderBottom: '1px solid var(--border-color)',
          }}>
            {ctxMenu.node.label}: {ctxMenu.node.properties?.[NODE_DISPLAY_PROPERTY[ctxMenu.node.label]] || ctxMenu.node.id}
          </div>
          <button
            onClick={handleUnpin}
            style={menuBtnStyle}
            onMouseEnter={(e) => e.target.style.background = 'var(--border-color)'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            Unpin node
          </button>
          <button
            onClick={handleRemoveWithChildren}
            style={{ ...menuBtnStyle, color: 'var(--accent)' }}
            onMouseEnter={(e) => e.target.style.background = 'var(--border-color)'}
            onMouseLeave={(e) => e.target.style.background = 'none'}
          >
            Remove node & children
          </button>
        </div>
      )}
      {loading && (
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.4)',
          zIndex: 30,
        }}>
          <div style={{ textAlign: 'center', color: 'var(--text-primary)' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid var(--border-color)',
              borderTop: '4px solid var(--accent)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 12px',
            }} />
            <div style={{ fontSize: '14px' }}>Loading...</div>
          </div>
        </div>
      )}
    </div>
  );
}
