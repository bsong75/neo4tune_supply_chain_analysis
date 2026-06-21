import os
from flask import Blueprint, request, jsonify
from db_client import get_driver
from graph_builder import (
    ingest_entities, ingest_links, parse_csv, parse_json, parse_xlsx,
    extract_preview, clear_all, TARGET_ENTITY_FIELDS, TARGET_LINK_FIELDS,
)

ingest_bp = Blueprint('ingest', __name__)


@ingest_bp.route('/ingest/preview', methods=['POST'])
def preview_file():
    """Parse uploaded file and return column names + preview rows.
    ---
    tags:
      - Ingest
    consumes:
      - multipart/form-data
    parameters:
      - name: file
        in: formData
        type: file
        required: true
      - name: data_type
        in: formData
        type: string
        description: "'entities' or 'links'"
    responses:
      200:
        description: Column names, preview rows, and all parsed records
    """
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'No file provided'}), 400

    data_type = request.form.get('data_type', 'entities')
    filename = file.filename.lower()

    if filename.endswith('.csv'):
        content = file.read().decode('utf-8')
        records = parse_csv(content)
    elif filename.endswith('.json'):
        content = file.read().decode('utf-8')
        records = parse_json(content)
    elif filename.endswith('.xlsx'):
        records = parse_xlsx(file.read())
    else:
        return jsonify({'error': 'Unsupported file type. Use .csv, .json, or .xlsx'}), 400

    if not records:
        return jsonify({'error': 'No records found in file'}), 400

    columns, preview = extract_preview(records)
    target_fields = TARGET_ENTITY_FIELDS if data_type == 'entities' else TARGET_LINK_FIELDS

    return jsonify({
        'columns': columns,
        'preview': preview,
        'records': records,
        'total_rows': len(records),
        'target_fields': target_fields,
        'data_type': data_type,
    })


@ingest_bp.route('/ingest/mapped', methods=['POST'])
def ingest_mapped():
    """Apply column mapping to records and ingest into Neo4j.
    ---
    tags:
      - Ingest
    parameters:
      - name: body
        in: body
        schema:
          type: object
          properties:
            records:
              type: array
            mapping:
              type: object
            data_type:
              type: string
              description: "'entities' or 'links'"
    responses:
      200:
        description: Ingestion results
    """
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No JSON body provided'}), 400

    raw_records = data.get('records', [])
    mapping = data.get('mapping', {})
    data_type = data.get('data_type', 'entities')

    if not raw_records:
        return jsonify({'error': 'No records provided'}), 400

    mapped_records = []
    for raw in raw_records:
        mapped = {}
        for target_field, source_col in mapping.items():
            if source_col and source_col in raw:
                mapped[target_field] = raw[source_col]
            else:
                mapped[target_field] = ''
        mapped_records.append(mapped)

    driver = get_driver()
    if data_type == 'links':
        result = ingest_links(driver, mapped_records)
    else:
        result = ingest_entities(driver, mapped_records)
    return jsonify(result)


@ingest_bp.route('/ingest/sample', methods=['POST'])
def load_sample():
    """Load built-in sample supply chain data (entities + links).
    ---
    tags:
      - Ingest
    responses:
      200:
        description: Sample data ingestion results
    """
    base = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'sample_data')
    entities_path = os.path.join(base, 'sample_entities.csv')
    links_path = os.path.join(base, 'sample_links.csv')

    if not os.path.exists(entities_path) or not os.path.exists(links_path):
        return jsonify({'error': 'Sample data files not found'}), 404

    with open(entities_path, 'r') as f:
        entity_records = parse_csv(f.read())
    with open(links_path, 'r') as f:
        link_records = parse_csv(f.read())

    driver = get_driver()
    e_result = ingest_entities(driver, entity_records)
    l_result = ingest_links(driver, link_records)

    return jsonify({
        'entities_created': e_result['entities_created'],
        'links_created': l_result['links_created'],
    })


@ingest_bp.route('/ingest/clear', methods=['POST'])
def clear_data():
    """Clear all data from the database.
    ---
    tags:
      - Ingest
    responses:
      200:
        description: Database cleared
    """
    driver = get_driver()
    clear_all(driver)
    return jsonify({'status': 'cleared'})
