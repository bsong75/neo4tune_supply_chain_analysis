"""Three-phase supply chain risk analysis algorithm.

Phase 1 - Graph Metrics:
  Compute degree centrality and betweenness centrality (Brandes' algorithm)
  for all supply chain entity nodes.

Phase 2 - Articulation Point Detection:
  Use Tarjan's algorithm to find nodes whose removal disconnects the supply graph.

Phase 3 - Cascade Disruption Simulation:
  For each node, simulate its removal and BFS from OEM nodes backward to count
  how many nodes lose all supply paths. Create RiskZone groups from
  connected high-risk nodes.
"""

import logging
from datetime import datetime

logger = logging.getLogger(__name__)

ENTITY_LABELS = ['Mine', 'Refinery', 'ComponentMfg', 'CellMfg', 'PackAssembly', 'OEM']
ENTITY_MATCH = ' OR '.join(f'e:{label}' for label in ENTITY_LABELS)


def _phase1_graph_metrics(session):
    """Compute degree and betweenness centrality for all entity nodes."""
    result = session.run(f"""
        MATCH (e)
        WHERE {ENTITY_MATCH}
        OPTIONAL MATCH (e)-[:SUPPLIES_TO]-(neighbor)
        WITH e, count(DISTINCT neighbor) AS degree
        RETURN elementId(e) AS id, e.entity_id AS entity_id,
               labels(e)[0] AS label, degree, e.name AS name
    """)

    nodes = {}
    for rec in result:
        nodes[rec['id']] = {
            'entity_id': rec['entity_id'],
            'label': rec['label'],
            'degree': rec['degree'],
            'name': rec['name'],
        }

    edges_result = session.run(f"""
        MATCH (a)-[:SUPPLIES_TO]-(b)
        WHERE ({ENTITY_MATCH.replace('e:', 'a:')})
          AND ({ENTITY_MATCH.replace('e:', 'b:')})
        RETURN DISTINCT elementId(a) AS src, elementId(b) AS dst
    """)

    adj = {}
    for rec in edges_result:
        adj.setdefault(rec['src'], set()).add(rec['dst'])
        adj.setdefault(rec['dst'], set()).add(rec['src'])

    # Brandes' algorithm for betweenness centrality
    betweenness = {nid: 0.0 for nid in nodes}
    all_ids = list(nodes.keys())

    for s in all_ids:
        stack = []
        predecessors = {nid: [] for nid in all_ids}
        sigma = {nid: 0 for nid in all_ids}
        sigma[s] = 1
        dist = {nid: -1 for nid in all_ids}
        dist[s] = 0
        queue = [s]

        while queue:
            v = queue.pop(0)
            stack.append(v)
            for w in adj.get(v, []):
                if w not in nodes:
                    continue
                if dist[w] < 0:
                    queue.append(w)
                    dist[w] = dist[v] + 1
                if dist[w] == dist[v] + 1:
                    sigma[w] += sigma[v]
                    predecessors[w].append(v)

        delta = {nid: 0.0 for nid in all_ids}
        while stack:
            w = stack.pop()
            for v in predecessors[w]:
                if sigma[w] > 0:
                    delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w])
            if w != s:
                betweenness[w] += delta[w]

    n = len(all_ids)
    if n > 2:
        norm = 2.0 / ((n - 1) * (n - 2))
        for nid in betweenness:
            betweenness[nid] *= norm

    max_degree = max((nodes[nid]['degree'] for nid in nodes), default=1)

    metrics = {}
    for nid in nodes:
        metrics[nid] = {
            **nodes[nid],
            'degree_centrality': round(nodes[nid]['degree'] / max(max_degree, 1), 6),
            'betweenness_centrality': round(betweenness.get(nid, 0), 6),
        }

    return metrics, adj


def _phase2_articulation_points(nodes, adj):
    """Find articulation points using Tarjan's algorithm."""
    all_ids = list(nodes.keys())
    visited = set()
    disc = {}
    low = {}
    parent = {}
    ap_set = set()
    timer = [0]

    def dfs(u):
        children = 0
        visited.add(u)
        disc[u] = low[u] = timer[0]
        timer[0] += 1

        for v in adj.get(u, []):
            if v not in nodes:
                continue
            if v not in visited:
                children += 1
                parent[v] = u
                dfs(v)
                low[u] = min(low[u], low[v])

                if parent.get(u) is None and children > 1:
                    ap_set.add(u)
                if parent.get(u) is not None and low[v] >= disc[u]:
                    ap_set.add(u)
            elif v != parent.get(u):
                low[u] = min(low[u], disc[v])

    import sys
    sys.setrecursionlimit(10000)

    for nid in all_ids:
        if nid not in visited:
            parent[nid] = None
            dfs(nid)

    return ap_set


def _phase3_cascade_simulation(nodes, adj, entry_point_id):
    """Simulate removing each node and count unreachable nodes from entry point."""
    all_ids = set(nodes.keys())
    cascade_scores = {}

    for remove_id in all_ids:
        remaining = all_ids - {remove_id}
        if entry_point_id == remove_id or entry_point_id not in remaining:
            cascade_scores[remove_id] = len(all_ids) - 1
            continue

        visited = set()
        queue = [entry_point_id]
        visited.add(entry_point_id)

        while queue:
            current = queue.pop(0)
            for neighbor in adj.get(current, []):
                if neighbor in remaining and neighbor not in visited:
                    visited.add(neighbor)
                    queue.append(neighbor)

        unreachable = len(remaining) - len(visited)
        cascade_scores[remove_id] = unreachable

    return cascade_scores


def run_analysis(driver, config):
    """Run the three-phase supply chain risk analysis.

    Args:
        driver: Neo4j driver
        config: dict with optional keys:
            - critical_threshold (float): score above which a node is high-risk (default 0.5)

    Returns: dict with analysis statistics
    """
    threshold = config.get('critical_threshold', 0.5)

    stats = {
        'nodes_analyzed': 0,
        'articulation_points': 0,
        'critical_nodes': 0,
        'zones_created': 0,
        'max_cascade_impact': 0,
    }

    with driver.session() as session:
        # Clean previous analysis results
        session.run("MATCH ()-[r:CRITICAL_PATH]->() DELETE r").consume()
        session.run("MATCH (rz:RiskZone) DETACH DELETE rz").consume()

        # Reset previous scores
        session.run(f"""
            MATCH (e) WHERE {ENTITY_MATCH}
            REMOVE e.risk_score, e.is_articulation_point,
                   e.cascade_impact, e.betweenness_centrality, e.degree_centrality
        """).consume()

        # Phase 1: Graph Metrics
        metrics, adj = _phase1_graph_metrics(session)
        stats['nodes_analyzed'] = len(metrics)
        logger.info("Phase 1 - Computed metrics for %d nodes", len(metrics))

        if not metrics:
            return stats

        # Phase 2: Articulation Points
        ap_set = _phase2_articulation_points(metrics, adj)
        stats['articulation_points'] = len(ap_set)
        logger.info("Phase 2 - Found %d articulation points", len(ap_set))

        # Determine entry point (OEM with highest degree, or highest-degree node)
        entry_point = None
        for nid, m in metrics.items():
            if m['label'] == 'OEM':
                if entry_point is None or m['degree'] > metrics[entry_point]['degree']:
                    entry_point = nid
        if entry_point is None:
            entry_point = max(metrics, key=lambda k: metrics[k]['degree'])

        # Phase 3: Cascade Disruption Simulation
        cascade_scores = _phase3_cascade_simulation(metrics, adj, entry_point)
        max_cascade = max(cascade_scores.values(), default=0)
        stats['max_cascade_impact'] = max_cascade
        logger.info("Phase 3 - Max cascade impact: %d nodes", max_cascade)

        # Compute final risk scores
        all_scores = {}
        for nid in metrics:
            bc = metrics[nid]['betweenness_centrality']
            dc = metrics[nid]['degree_centrality']
            is_ap = 1.0 if nid in ap_set else 0.0
            cascade_norm = cascade_scores.get(nid, 0) / max(max_cascade, 1)

            risk = (
                0.25 * dc +
                0.30 * bc +
                0.20 * is_ap +
                0.25 * cascade_norm
            )

            all_scores[nid] = {
                **metrics[nid],
                'is_articulation_point': nid in ap_set,
                'cascade_impact': cascade_scores.get(nid, 0),
                'risk_score': round(risk, 4),
                'betweenness_centrality': bc,
                'degree_centrality': dc,
            }

        # Store scores to Neo4j
        score_batch = []
        for nid, s in all_scores.items():
            score_batch.append({
                'id': nid,
                'risk_score': s['risk_score'],
                'is_articulation_point': s['is_articulation_point'],
                'cascade_impact': s['cascade_impact'],
                'betweenness_centrality': s['betweenness_centrality'],
                'degree_centrality': s['degree_centrality'],
            })

        session.run("""
            UNWIND $items AS item
            MATCH (e) WHERE elementId(e) = item.id
            SET e.risk_score = item.risk_score,
                e.is_articulation_point = item.is_articulation_point,
                e.cascade_impact = item.cascade_impact,
                e.betweenness_centrality = item.betweenness_centrality,
                e.degree_centrality = item.degree_centrality
        """, items=score_batch).consume()

        # Create CRITICAL_PATH edges between adjacent high-risk nodes
        critical_ids = [nid for nid, s in all_scores.items()
                        if s['risk_score'] >= threshold]
        stats['critical_nodes'] = len(critical_ids)

        if len(critical_ids) > 1:
            critical_set = set(critical_ids)
            cp_batch = []
            seen = set()
            for nid in critical_ids:
                for neighbor in adj.get(nid, []):
                    if neighbor in critical_set:
                        pair = tuple(sorted([nid, neighbor]))
                        if pair not in seen:
                            seen.add(pair)
                            cp_batch.append({
                                'id1': pair[0],
                                'id2': pair[1],
                                'score': round(
                                    (all_scores[pair[0]]['risk_score'] +
                                     all_scores[pair[1]]['risk_score']) / 2, 4
                                ),
                            })

            if cp_batch:
                session.run("""
                    UNWIND $items AS item
                    MATCH (a) WHERE elementId(a) = item.id1
                    MATCH (b) WHERE elementId(b) = item.id2
                    MERGE (a)-[cp:CRITICAL_PATH]->(b)
                    ON CREATE SET cp.score = item.score, cp.method = 'adjacency'
                """, items=cp_batch).consume()

        # Create RiskZone groups via BFS on critical nodes
        crit_adj = {}
        critical_set = set(critical_ids)
        for nid in critical_ids:
            for neighbor in adj.get(nid, []):
                if neighbor in critical_set:
                    crit_adj.setdefault(nid, set()).add(neighbor)

        visited = set()
        components = []
        for nid in critical_ids:
            if nid in visited:
                continue
            component = []
            queue = [nid]
            while queue:
                current = queue.pop(0)
                if current in visited:
                    continue
                visited.add(current)
                component.append(current)
                for neighbor in crit_adj.get(current, []):
                    if neighbor not in visited:
                        queue.append(neighbor)
            if len(component) > 1:
                components.append(component)

        for i, component in enumerate(components):
            zone_id = f"rz_{i + 1}"
            max_score = max(all_scores[nid]['risk_score'] for nid in component)
            total_impact = sum(all_scores[nid]['cascade_impact'] for nid in component)
            session.run("""
                CREATE (rz:RiskZone {
                    zone_id: $zone_id,
                    risk_score: $max_score,
                    member_count: $count,
                    failure_impact: $impact,
                    created_at: datetime()
                })
                WITH rz
                UNWIND $member_ids AS mid
                MATCH (e) WHERE elementId(e) = mid
                CREATE (e)-[:IDENTIFIED_IN]->(rz)
            """, zone_id=zone_id, max_score=max_score,
                 count=len(component), impact=total_impact,
                 member_ids=component).consume()
            stats['zones_created'] += 1

        logger.info("Created %d risk zones", stats['zones_created'])

    return stats


def get_stats(driver):
    """Get analysis statistics."""
    with driver.session() as session:
        result = session.run(f"""
            CALL {{ MATCH (e) WHERE {ENTITY_MATCH}
                   RETURN count(e) AS total_entities }}
            CALL {{ MATCH ()-[s:SUPPLIES_TO]->() RETURN count(s) AS total_links }}
            CALL {{ MATCH (e) WHERE e.is_articulation_point = true
                   RETURN count(e) AS articulation_points }}
            CALL {{ MATCH (e) WHERE e.risk_score >= 0.5
                   RETURN count(e) AS critical_entities }}
            CALL {{ MATCH (rz:RiskZone) RETURN count(rz) AS total_zones }}
            CALL {{ MATCH ()-[cp:CRITICAL_PATH]->() RETURN count(cp) AS critical_paths }}
            CALL {{ MATCH (e) WHERE e.risk_score IS NOT NULL
                   RETURN coalesce(max(e.risk_score), 0) AS max_risk }}
            RETURN total_entities, total_links, articulation_points,
                   critical_entities, total_zones, critical_paths, max_risk
        """)
        row = result.single()
        total = row['total_entities']
        return {
            'total_entities': total,
            'total_links': row['total_links'],
            'articulation_points': row['articulation_points'],
            'critical_entities': row['critical_entities'],
            'total_zones': row['total_zones'],
            'critical_paths': row['critical_paths'],
            'max_risk': row['max_risk'],
            'critical_rate': round(
                row['critical_entities'] / max(total, 1) * 100, 1
            ),
        }
