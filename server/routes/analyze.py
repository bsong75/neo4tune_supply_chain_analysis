import io
from flask import Blueprint, request, jsonify, Response
from openpyxl import Workbook
from db_client import get_driver
from supply_chain_analyzer import run_analysis, get_stats

analyze_bp = Blueprint('analyze', __name__)

ENTITY_LABELS = ['Mine', 'Refinery', 'ComponentMfg', 'CellMfg', 'PackAssembly', 'OEM']
ENTITY_MATCH = ' OR '.join(f'e:{label}' for label in ENTITY_LABELS)


@analyze_bp.route('/analyze/run', methods=['POST'])
def analyze():
    """Run supply chain risk analysis.
    ---
    tags:
      - Analysis
    parameters:
      - name: body
        in: body
        schema:
          type: object
          properties:
            critical_threshold:
              type: number
              default: 0.5
    responses:
      200:
        description: Analysis results
    """
    config = request.get_json() or {}
    driver = get_driver()
    result = run_analysis(driver, config)
    return jsonify(result)


@analyze_bp.route('/analyze/stats')
def stats():
    """Get analysis statistics.
    ---
    tags:
      - Analysis
    responses:
      200:
        description: Analysis statistics
    """
    driver = get_driver()
    return jsonify(get_stats(driver))


@analyze_bp.route('/analyze/export')
def export_excel():
    """Export analysis results as Excel with two sheets.
    ---
    tags:
      - Analysis
    produces:
      - application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
    responses:
      200:
        description: Excel file with All Entities and Risk Zones sheets
    """
    driver = get_driver()
    with driver.session() as session:
        result = session.run(f"""
            MATCH (e)
            WHERE {ENTITY_MATCH}
            OPTIONAL MATCH (e)-[:IDENTIFIED_IN]->(rz:RiskZone)
            RETURN e.entity_id AS entity_id,
                   labels(e)[0] AS type,
                   e.name AS name,
                   e.country AS country,
                   e.material AS material,
                   e.component AS component,
                   e.capacity AS capacity,
                   e.tier AS tier,
                   e.status AS status,
                   e.risk_score AS risk_score,
                   e.is_articulation_point AS is_articulation_point,
                   e.cascade_impact AS cascade_impact,
                   e.betweenness_centrality AS betweenness_centrality,
                   e.degree_centrality AS degree_centrality,
                   rz.zone_id AS risk_zone_id
            ORDER BY e.risk_score DESC
        """)
        all_rows = [record.data() for record in result]

    if not all_rows:
        return jsonify({'error': 'No entities found'}), 404

    zones = {}
    for row in all_rows:
        zid = row.get('risk_zone_id')
        if not zid:
            continue
        if zid not in zones:
            zones[zid] = {
                'zone_id': zid,
                'entities': [],
                'types': set(),
                'total_cascade': 0,
                'max_risk': 0,
            }
        z = zones[zid]
        z['entities'].append(row['entity_id'])
        z['types'].add(row['type'])
        z['total_cascade'] += row.get('cascade_impact') or 0
        score = row.get('risk_score') or 0
        if score > z['max_risk']:
            z['max_risk'] = score

    zone_rows = []
    for z in sorted(zones.values(), key=lambda x: x['zone_id']):
        zone_rows.append({
            'zone_id': z['zone_id'],
            'member_count': len(z['entities']),
            'entity_types': ', '.join(sorted(z['types'])),
            'max_risk_score': round(z['max_risk'], 4),
            'total_cascade_impact': z['total_cascade'],
            'entity_ids': ', '.join(z['entities']),
        })

    wb = Workbook()

    ws1 = wb.active
    ws1.title = 'All Entities'
    headers1 = list(all_rows[0].keys())
    ws1.append(headers1)
    for row in all_rows:
        ws1.append([row.get(h) for h in headers1])

    ws2 = wb.create_sheet('Risk Zones')
    if zone_rows:
        headers2 = list(zone_rows[0].keys())
        ws2.append(headers2)
        for row in zone_rows:
            ws2.append([row.get(h) for h in headers2])

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return Response(
        output.getvalue(),
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': 'attachment; filename=supply_chain_risk_results.xlsx'},
    )
