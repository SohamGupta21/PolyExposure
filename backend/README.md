# PolyExposure Backend

FastAPI backend for the PolyExposure application, providing REST API endpoints for interacting with the Polymarket Data API.

## Installation

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install Python dependencies:
```bash
pip install -r requirements.txt
```

## Running the Server

You can run the FastAPI server in several ways:

**Option 1: Using the startup script**
```bash
python run_server.py
```

**Option 2: Using uvicorn directly**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Option 3: Using Python directly**
```bash
python main.py
```

The server will start on `http://localhost:8000`

## API Documentation

Once the server is running, you can access:
- **Interactive API docs (Swagger UI)**: http://localhost:8000/docs
- **Alternative API docs (ReDoc)**: http://localhost:8000/redoc
- **Health check**: http://localhost:8000/health

## API Endpoints

- `GET /api/activity?user=<wallet_address>&limit=500&offset=0` - Get activity for a wallet
- `GET /api/markets?limit=100&offset=0&active=true` - Get markets list
- `GET /api/markets/{market_id}` - Get specific market details
- `GET /api/positions?user=<wallet_address>` - Get positions for a wallet

## Example Requests

```bash
# Get activity for a wallet
curl "http://localhost:8000/api/activity?user=0x9f47f1fcb1701bf9eaf31236ad39875e5d60af93&limit=100"

# Get markets
curl "http://localhost:8000/api/markets?limit=50&active=true"

# Get specific market
curl "http://localhost:8000/api/markets/0x123..."

# Get positions
curl "http://localhost:8000/api/positions?user=0x9f47f1fcb1701bf9eaf31236ad39875e5d60af93"
```

## Project Structure

```
backend/
├── main.py              # FastAPI application
├── polymarket_api.py    # Polymarket API client
├── run_server.py        # Development server script
└── requirements.txt     # Python dependencies
```

## Development

The server runs with auto-reload enabled in development mode. Any changes to Python files will automatically restart the server.

