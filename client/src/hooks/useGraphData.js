import { useState, useCallback } from 'react';

export default function useGraphData() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });

  const replaceGraphData = useCallback((data) => {
    setGraphData(data);
  }, []);

  const mergeGraphData = useCallback((newData) => {
    setGraphData((prev) => {
      const nodeMap = {};
      prev.nodes.forEach((n) => { nodeMap[n.id] = n; });
      newData.nodes.forEach((n) => {
        if (!nodeMap[n.id]) {
          nodeMap[n.id] = n;
        }
      });

      const linkSet = new Set();
      const links = [];

      const addLink = (link) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        const key = `${sourceId}-${link.type}-${targetId}`;
        if (!linkSet.has(key)) {
          linkSet.add(key);
          links.push({
            source: sourceId,
            target: targetId,
            type: link.type,
            score: link.score,
            method: link.method,
            material: link.material,
            volume: link.volume,
            lead_time_days: link.lead_time_days,
            cost_per_unit: link.cost_per_unit,
          });
        }
      };

      prev.links.forEach(addLink);
      newData.links.forEach(addLink);

      return { nodes: Object.values(nodeMap), links };
    });
  }, []);

  const removeNodes = useCallback((nodeIdsToRemove) => {
    const removeSet = new Set(nodeIdsToRemove);
    setGraphData((prev) => {
      const nodes = prev.nodes.filter((n) => !removeSet.has(n.id));
      const links = prev.links.filter((link) => {
        const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
        const targetId = typeof link.target === 'object' ? link.target.id : link.target;
        return !removeSet.has(sourceId) && !removeSet.has(targetId);
      });
      return { nodes, links };
    });
  }, []);

  const clearGraphData = useCallback(() => {
    setGraphData({ nodes: [], links: [] });
  }, []);

  return { graphData, replaceGraphData, mergeGraphData, removeNodes, clearGraphData };
}
