import { useState } from 'react';

export default function Toolbar({
  onSearch, onLoadSample, onAnalyze, onExport, onClear, onRefreshGraph,
  theme, onThemeToggle, loading, layoutMode, onLayoutToggle,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(searchQuery);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-logo">SC</span>
      </div>

      <div className="toolbar-center">
        <form onSubmit={handleSubmit} className="toolbar-search">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, country, material..."
          />
          <button type="submit">Search</button>
        </form>
      </div>

      <div className="toolbar-right">
        <button onClick={onLayoutToggle} title="Toggle layout mode">
          {layoutMode === 'force' ? 'Tiered' : 'Force'}
        </button>
        <button onClick={onLoadSample} title="Load sample supply chain">Sample</button>
        <button onClick={onRefreshGraph} title="Refresh graph">Refresh</button>
        <button
          onClick={onAnalyze}
          disabled={loading}
          className="toolbar-btn-primary"
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
        <button onClick={onExport} title="Export Excel">Export</button>
        <button onClick={onClear} className="toolbar-btn-danger" title="Clear database">Clear</button>
        <button onClick={onThemeToggle} title="Toggle theme">
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>
      </div>
    </div>
  );
}
