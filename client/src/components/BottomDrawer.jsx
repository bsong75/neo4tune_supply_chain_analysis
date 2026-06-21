import { useRef, useCallback } from 'react';

const TABS = [
  { id: 'stats', label: 'Statistics' },
  { id: 'critical', label: 'High-Risk Nodes' },
  { id: 'zones', label: 'Zones' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'upload', label: 'Upload' },
];

export default function BottomDrawer({
  isOpen, height, onHeightChange, onToggle,
  activeTab, onTabChange, children,
}) {
  const isResizing = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev) => {
      if (!isResizing.current) return;
      const newHeight = Math.max(120, Math.min(500, window.innerHeight - ev.clientY));
      onHeightChange(newHeight);
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
  }, [onHeightChange]);

  return (
    <div className="bottom-drawer" style={{ height: isOpen ? height : 32 }}>
      {isOpen && (
        <div className="drawer-resize-handle" onMouseDown={handleMouseDown} />
      )}

      <div className="drawer-tab-bar">
        <button className="drawer-toggle" onClick={onToggle}>
          {isOpen ? '\u25BC' : '\u25B2'}
        </button>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`drawer-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { onTabChange(tab.id); if (!isOpen) onToggle(); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isOpen && (
        <div className="drawer-content">
          {children}
        </div>
      )}
    </div>
  );
}
