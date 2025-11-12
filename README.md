# PolyPortfolio
Portfolio Management for Polymarket Wallets

Users can input Polymarket wallets and see the trades that they've done, see the exposure to different sectors, map that over time, see information like the expected value of your portfolio, when all your contracts are going to get resolved on some sort of calendar, just overall a dashboard to see everything you would need about your current portfolio status, which is really helpful.

## Project Structure

This project is split into two separate directories:

- **`backend/`** - FastAPI backend server
- **`frontend/`** - Next.js frontend application

## Quick Start

### Backend

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the server:
```bash
python run_server.py
```

The backend will be available at `http://localhost:8000`

See [backend/README.md](backend/README.md) for more details.

### Frontend

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
pnpm install
```

3. Run the development server:
```bash
pnpm dev
```

The frontend will be available at `http://localhost:3000`

See [frontend/README.md](frontend/README.md) for more details.

## Development Workflow

1. Start the backend server first (port 8000)
2. Then start the frontend development server (port 3000)
3. The frontend will communicate with the backend API

## API Documentation

When the backend is running, you can access:
- **Interactive API docs (Swagger UI)**: http://localhost:8000/docs
- **Alternative API docs (ReDoc)**: http://localhost:8000/redoc

## 🚀 Deployment

This project is ready to deploy to Vercel!

**Quick Deploy:**
1. Push your code to GitHub
2. Import your repo to [Vercel](https://vercel.com)
3. Set Root Directory to `frontend`
4. Deploy!

**📖 See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment instructions.**

The project includes:
- ✅ Vercel configuration (`vercel.json`)
- ✅ Serverless API adapter (`api/index.py`)
- ✅ Production-ready CORS settings
- ✅ Full deployment guide 
