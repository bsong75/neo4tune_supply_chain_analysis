import logging
from dotenv import load_dotenv

load_dotenv()

from flask import Flask
from flask_cors import CORS
from flasgger import Swagger
from routes.ingest import ingest_bp
from routes.analyze import analyze_bp
from routes.graph import graph_bp

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app, origins='*')

app.config['SWAGGER'] = {
    'title': 'EV Battery Supply Chain Analysis API',
    'version': '1.0',
    'description': 'Graph-based supply chain risk analysis API using Neo4j',
    'uiversion': 3,
}
Swagger(app)

app.register_blueprint(ingest_bp, url_prefix='/api')
app.register_blueprint(analyze_bp, url_prefix='/api')
app.register_blueprint(graph_bp, url_prefix='/api')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
