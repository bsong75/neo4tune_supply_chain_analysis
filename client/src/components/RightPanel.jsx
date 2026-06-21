import { useRef, useCallback } from 'react';

const TABS = [
  { id: 'stats', label: 'Statistics' },
  { id: 'critical', label: 'High-Risk' },
  { id: 'zones', label: 'Zones' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'upload', label: 'Upload' },
];

export default function RightPanel({
  isOpen, width, onWidthChange, onToggle,
  activeTab, onTabChange, children,
}) {
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(240, Math.min(500, window.innerWidth - ev.clientX));
      onWidthChange(newWidth);
    };
    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [onWidthChange]);

  return (
    <div className="right-panel" style={{ width: isOpen ? width : 36 }}>
      {isOpen && (
        <div className="panel-resize-handle" onMouseDown={handleMouseDown} />
      )}

      <div className="panel-header">
        <button className="panel-toggle" onClick={onToggle}>
          {isOpen ? '\u25B6' : '\u25C0'}
        </button>
        {isOpen && (
          <div className="panel-tab-bar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`panel-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => { onTabChange(tab.id); if (!isOpen) onToggle(); }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="panel-content">
          {children}
        </div>
      )}
    </div>
  );
}
