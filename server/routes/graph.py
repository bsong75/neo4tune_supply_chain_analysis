from flask import Blueprint, jsonify, request
from db_client import get_driver

graph_bp = Blueprint('graph', __name__)

NODE_COLORS = {
    'Mine': '#A8A8A8',
    'Refinery': '#D0D0D0',
    'ComponentMfg': '#787878',
    'CellMfg': '#606060',
    'PackAssembly': '#909090',
    'OEM': '#B0B0B0',
    'RiskZone': '#FF4444',
}

NODE_SIZES = {
    'RiskZone': 14,
    'OEM': 13,
    'PackAssembly': 12,
    'CellMfg': 11,
    'ComponentMfg': 10,
    'Refinery': 9,
    'Mine': 8,
}

ENTITY_LABELS = ['Mine', 'Refinery', 'ComponentMfg', 'CellMfg', 'PackAssembly', 'OEM']
ENTITY_MATCH = ' OR '.join(f'e:{label}' for label in ENTITY_LABELS)


def node_to_dict(node):
    """Convert a Neo4j node to a dict for react-force-graph."""
    labels = list(node.labels)
    label = labels[0] if labels else 'Unknown'
    props = {}
    for key, val in dict(node).items():
        if key == 'created_at':
            continue
        if hasattr(val, 'isoformat'):
            props[key] = val.isoformat()
        else:
            props[key] = val
    return {
        'id': node.element_id,
        'label': label,
        'properties': props,
        'color': NODE_COLORS.get(label, '#999999'),
        'val': NODE_SIZES.get(label, 6),
    }


def run_and_collect(session, cypher, **params):
    """Run Cypher and return {nodes, links}."""
    nodes_map = {}
    links = []
    result = session.run(cypher, **params)
    for record in result:
        n = record.get('n')
        r = record.get('r')
        m = record.get('m')
        if n is not None:
            nodes_map[n.element_id] = node_to_dict(n)
        if m is not None:
            nodes_map[m.element_id] = node_to_dict(m)
        if r is not None:
            link_data = {
                'source': r.start_node.element_id,
                'target': r.end_node.element_id,
                'type': r.type,
            }
            if r.type == 'CRITICAL_PATH':
                link_data['score'] = r.get('score', None)
                link_data['method'] = r.get('method', None)
            if r.type == 'SUPPLIES_TO':
                link_data['material'] = r.get('material', None)
                link_data['volume'] = r.get('volume', None)
                link_data['lead_time_days'] = r.get('lead_time_days', None)
                link_data['cost_per_unit'] = r.get('cost_per_unit', None)
            links.append(link_data)
    return {'nodes': list(nodes_map.values()), 'links': links}


@graph_bp.route('/graph/full')
def get_full_graph():
    """Get the complete supply chain graph.
    ---
    tags:
      - Graph
    parameters:
      - name: limit
        in: query
        type: integer
        default: 500
    responses:
      200:
        description: Full graph data
    """
    driver = get_driver()
    limit = request.args.get('limit', 500, type=int)
    with driver.session() as session:
        data = run_and_collect(session, """
            MATCH (n)
            OPTIONAL MATCH (n)-[r]->(m)
            RETURN n, r, m
            LIMIT $limit
        """, limit=limit)
    return jsonify(data)


@graph_bp.route('/graph/zone/<zone_id>')
def get_zone_cluster(zone_id):
    """Get all entities in a risk zone.
    ---
    tags:
      - Graph
    parameters:
      - name: zone_id
        in: path
        type: string
        required: true
    responses:
      200:
        description: Risk zone cluster graph data
    """
    driver = get_driver()
    with driver.session() as session:
        data = run_and_collect(session, """
            MATCH (rz:RiskZone {zone_id: $zone_id})<-[:IDENTIFIED_IN]-(e)
            OPTIONAL MATCH (e)-[rel:SUPPLIES_TO]-(neighbor)
            RETURN e AS n, rel AS r, neighbor AS m
            UNION
            MATCH (rz:RiskZone {zone_id: $zone_id})<-[idn:IDENTIFIED_IN]-(e)
            RETURN e AS n, idn AS r, rz AS m
            UNION
            MATCH (rz:RiskZone {zone_id: $zone_id})<-[:IDENTIFIED_IN]-(e1)-[cp:CRITICAL_PATH]-(e2)-[:IDENTIFIED_IN]->(rz)
            RETURN e1 AS n, cp AS r, e2 AS m
        """, zone_id=zone_id)
    return jsonify(data)


@graph_bp.route('/graph/search')
def search_entities():
    """Search entities by name, country, material, entity_id.
    ---
    tags:
      - Graph
    parameters:
      - name: q
        in: query
        type: string
        required: true
    responses:
      200:
        description: Search results as graph data
    """
    q = request.args.get('q', '')
    if not q:
        return jsonify({'nodes': [], 'links': []})
    driver = get_driver()
    with driver.session() as session:
        data = run_and_collect(session, """
            MATCH (e)
            WHERE (e:Mine OR e:Refinery OR e:ComponentMfg OR e:CellMfg OR e:PackAssembly OR e:OEM)
              AND (toLower(e.name) CONTAINS $q
                   OR toLower(e.country) CONTAINS $q
                   OR toLower(e.entity_id) CONTAINS $q
                   OR toLower(e.material) CONTAINS $q
                   OR toLower(e.component) CONTAINS $q
                   OR toLower(e.tier) CONTAINS $q)
            OPTIONAL MATCH (e)-[rel]->(m)
            RETURN e AS n, rel AS r, m
        """, q=q.lower())
    return jsonify(data)


@graph_bp.route('/graph/zones')
def list_zones():
    """List all risk zones with member details.
    ---
    tags:
      - Graph
    responses:
      200:
        description: List of risk zones
    """
    driver = get_driver()
    with driver.session() as session:
        result = session.run("""
            MATCH (rz:RiskZone)<-[:IDENTIFIED_IN]-(e)
            WITH rz, collect({
                entity_id: e.entity_id,
                name: e.name,
                type: labels(e)[0],
                risk_score: e.risk_score,
                is_articulation_point: e.is_articulation_point,
                cascade_impact: e.cascade_impact
            }) AS members
            RETURN rz.zone_id AS zone_id, rz.member_count AS member_count,
                   rz.risk_score AS risk_score,
                   rz.failure_impact AS failure_impact, members
            ORDER BY rz.risk_score DESC
        """)
        zones = []
        for rec in result:
            zones.append({
                'zone_id': rec['zone_id'],
                'member_count': rec['member_count'],
                'risk_score': rec['risk_score'],
                'failure_impact': rec['failure_impact'],
                'members': rec['members'],
            })
    return jsonify({'zones': zones})


@graph_bp.route('/graph/critical')
def get_critical_nodes():
    """Get top N highest-risk supply chain nodes.
    ---
    tags:
      - Graph
    parameters:
      - name: limit
        in: query
        type: integer
        default: 20
    responses:
      200:
        description: Ranked high-risk nodes
    """
    driver = get_driver()
    limit = request.args.get('limit', 20, type=int)
    with driver.session() as session:
        result = session.run("""
            MATCH (e)
            WHERE e.risk_score IS NOT NULL
            RETURN e.entity_id AS entity_id, e.name AS name,
                   e.country AS country,
                   labels(e)[0] AS type, e.risk_score AS score,
                   e.is_articulation_point AS is_ap,
                   e.cascade_impact AS cascade_impact,
                   e.betweenness_centrality AS betweenness,
                   e.degree_centrality AS degree_centrality
            ORDER BY e.risk_score DESC
            LIMIT $limit
        """, limit=limit)
        nodes = [record.data() for record in result]
    return jsonify({'nodes': nodes})


@graph_bp.route('/graph/schema')
def get_schema():
    """Return available node labels and relationship types.
    ---
    tags:
      - Graph
    responses:
      200:
        description: Schema information
    """
    driver = get_driver()
    with driver.session() as session:
        labels_result = session.run("MATCH (n) RETURN DISTINCT labels(n) AS label")
        labels = []
        for record in labels_result:
            for lbl in record['label']:
                if lbl not in labels:
                    labels.append(lbl)
        rel_result = session.run("MATCH ()-[r]->() RETURN DISTINCT type(r) AS relationshipType")
        rel_types = [record['relationshipType'] for record in rel_result]
    return jsonify({
        'nodeLabels': labels,
        'relationshipTypes': rel_types,
        'nodeColors': NODE_COLORS,
    })
