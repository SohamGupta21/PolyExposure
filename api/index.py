from mangum import Mangum
import sys
import os

# Add backend directory to Python path
backend_path = os.path.join(os.path.dirname(__file__), '..', 'backend')
sys.path.insert(0, backend_path)

# Import the FastAPI app from backend
from main import app

# Create the Mangum handler for Vercel serverless
handler = Mangum(app, lifespan="off")

