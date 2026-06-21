import { useState, useCallback } from 'react';
import './App.css';
import api from './api';
import useGraphData from './hooks/useGraphData';
import Toolbar from './components/Toolbar';
import RightPanel from './components/RightPanel';
import GraphCanvas from './components/GraphCanvas';
import NodeDetail from './components/NodeDetail';
import StatsPanel from './components/StatsPanel';
import AnalysisPanel from './components/AnalysisPanel';
import UploadPanel from './components/UploadPanel';
import RiskNodesList from './components/RiskNodesList';

export default function App() {
  const { graphData, replaceGraphData, mergeGraphData, removeNodes, clearGraphData } = useGraphData();
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [stats, setStats] = useState(null);
  const [criticalNodes, setCriticalNodes] = useState([]);
  const [zones, setZones] = useState([]);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(320);
  const [activeTab, setActiveTab] = useState('stats');
  const [layoutMode, setLayoutMode] = useState('force');

  const refreshGraph = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get('/graph/full');
      replaceGraphData(resp.data);
    } catch (err) {
      console.error('Failed to load graph:', err);
    }
    setLoading(false);
  }, [replaceGraphData]);

  const refreshStats = useCallback(async () => {
    try {
      const resp = await api.get('/analyze/stats');
      setStats(resp.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  const refreshCriticalNodes = useCallback(async () => {
    try {
      const resp = await api.get('/graph/critical');
      setCriticalNodes(resp.data.nodes || []);
    } catch (err) {
      console.error('Failed to load critical nodes:', err);
    }
  }, []);

  const refreshZones = useCallback(async () => {
    try {
      const resp = await api.get('/graph/zones');
      setZones(resp.data.zones || []);
    } catch (err) {
      console.error('Failed to load zones:', err);
    }
  }, []);

  const handleRefreshAll = useCallback(() => {
    refreshGraph();
    refreshStats();
    refreshCriticalNodes();
    refreshZones();
  }, [refreshGraph, refreshStats, refreshCriticalNodes, refreshZones]);

  const handleSearch = useCallback(async (query) => {
    if (!query.trim()) {
      refreshGraph();
      return;
    }
    setLoading(true);
    try {
      const resp = await api.get(`/graph/search?q=${encodeURIComponent(query)}`);
      replaceGraphData(resp.data);
    } catch (err) {
      console.error('Search failed:', err);
    }
    setLoading(false);
  }, [replaceGraphData, refreshGraph]);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    try {
      await api.post('/analyze/run', { critical_threshold: 0.5 });
      handleRefreshAll();
    } catch (err) {
      console.error('Analysis failed:', err);
    }
    setLoading(false);
  }, [handleRefreshAll]);

  const handleExport = useCallback(() => {
    const link = document.createElement('a');
    link.href = '/api/analyze/export';
    link.download = 'supply_chain_risk_results.xlsx';
    link.click();
  }, []);

  const handleLoadSample = useCallback(async () => {
    setLoading(true);
    try {
      await api.post('/ingest/sample');
      handleRefreshAll();
    } catch (err) {
      console.error('Failed to load sample:', err);
    }
    setLoading(false);
  }, [handleRefreshAll]);

  const handleClear = useCallback(async () => {
    try {
      await api.post('/ingest/clear');
      clearGraphData();
      setStats(null);
      setCriticalNodes([]);
      setZones([]);
      setSelectedNode(null);
      setSelectedLink(null);
    } catch (err) {
      console.error('Failed to clear:', err);
    }
  }, [clearGraphData]);

  const handleViewZone = useCallback(async (zoneId) => {
    setLoading(true);
    try {
      const resp = await api.get(`/graph/zone/${zoneId}`);
      replaceGraphData(resp.data);
    } catch (err) {
      console.error('Failed to load zone:', err);
    }
    setLoading(false);
  }, [replaceGraphData]);

  const handleNodeSelect = useCallback(async (entityId) => {
    setLoading(true);
    try {
      const resp = await api.get(`/graph/search?q=${encodeURIComponent(entityId)}`);
      mergeGraphData(resp.data);
    } catch (err) {
      console.error('Failed to search node:', err);
    }
    setLoading(false);
  }, [mergeGraphData]);

  return (
    <div className="app-container" data-theme={theme}>
      <div className="side-title">
        <span className="side-title-text">EV Battery Supply Chain Analysis</span>
      </div>
      <div className="app-main">
      <Toolbar
        onSearch={handleSearch}
        onLoadSample={handleLoadSample}
        onAnalyze={handleAnalyze}
        onExport={handleExport}
        onClear={handleClear}
        onRefreshGraph={refreshGraph}
        theme={theme}
        onThemeToggle={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        loading={loading}
        layoutMode={layoutMode}
        onLayoutToggle={() => setLayoutMode((m) => (m === 'force' ? 'tiered' : 'force'))}
      />

      <div className="main-area">
        <GraphCanvas
          graphData={graphData}
          removeNodes={removeNodes}
          selectedNode={selectedNode}
          onNodeClick={(node) => { setSelectedNode(node); if (node) setSelectedLink(null); }}
          selectedLink={selectedLink}
          onLinkClick={(link) => { setSelectedLink(link); if (link) setSelectedNode(null); }}
          loading={loading}
          theme={theme}
          layoutMode={layoutMode}
        />

        <RightPanel
          isOpen={panelOpen}
          width={panelWidth}
          onWidthChange={setPanelWidth}
          onToggle={() => setPanelOpen((o) => !o)}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        >
          {(selectedNode || selectedLink) && (
            <NodeDetail
              node={selectedNode}
              link={selectedLink}
              onClose={() => { setSelectedNode(null); setSelectedLink(null); }}
              theme={theme}
            />
          )}
          {activeTab === 'stats' && (
            <StatsPanel stats={stats} onRefresh={refreshStats} />
          )}
          {activeTab === 'critical' && (
            <RiskNodesList
              nodes={criticalNodes}
              onRefresh={refreshCriticalNodes}
              onNodeSelect={handleNodeSelect}
            />
          )}
          {activeTab === 'zones' && (
            <div className="drawer-panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '14px', color: 'var(--text-primary)' }}>Risk Zones</h3>
                <button
                  onClick={refreshZones}
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
              {zones.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                  No risk zones detected yet.
                </div>
              )}
              {zones.map((zone) => (
                <div
                  key={zone.zone_id}
                  onClick={() => handleViewZone(zone.zone_id)}
                  style={{
                    padding: '8px',
                    marginBottom: '4px',
                    background: 'var(--bg-panel)',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                >
                  <div style={{ fontWeight: 'bold', color: 'var(--accent)', marginBottom: '4px' }}>
                    {zone.zone_id} ({zone.member_count} entities)
                  </div>
                  {zone.members.map((m, i) => (
                    <div key={i} style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                      {m.name} | {m.type} | Score: {((m.risk_score || 0) * 100).toFixed(0)}%
                      {m.is_articulation_point && ' [AP]'}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
          {activeTab === 'analysis' && (
            <AnalysisPanel onAnalysisComplete={handleRefreshAll} />
          )}
          {activeTab === 'upload' && (
            <UploadPanel onIngestComplete={handleRefreshAll} />
          )}
        </RightPanel>
      </div>
      </div>
    </div>
  );
}
