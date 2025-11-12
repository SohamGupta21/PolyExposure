from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from polymarket_api import PolymarketAPI
import uvicorn

app = FastAPI(title="PolyPortfolio API", description="FastAPI backend for Polymarket data API", version="1.0.0")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

polymarket_api = PolymarketAPI()


def handle_api_result(result: dict):
    if 'error' in result:
        status_code = result.get('status_code', 500)
        raise HTTPException(status_code=status_code or 500, detail=result.get('error', 'Unknown error'))
    return result


@app.get("/api/activity", tags=["Activity"])
async def get_activity(user: str = Query(..., description="Wallet address"), limit: int = Query(500, ge=1, le=1000), offset: int = Query(0, ge=0)):
    return handle_api_result(polymarket_api.get_activity(user, limit, offset))


@app.get("/api/markets", tags=["Markets"])
async def get_markets(limit: int = Query(100, ge=1, le=1000), offset: int = Query(0, ge=0), active: Optional[bool] = Query(None)):
    return handle_api_result(polymarket_api.get_markets(limit, offset, active))


@app.get("/api/markets/{market_id}", tags=["Markets"])
async def get_market(market_id: str):
    return handle_api_result(polymarket_api.get_market(market_id))


@app.get("/api/positions", tags=["Positions"])
async def get_positions(user: str = Query(..., description="Wallet address")):
    return handle_api_result(polymarket_api.get_user_positions(user))


@app.get("/api/pnl", tags=["PNL"])
async def get_pnl(user: str = Query(..., description="Wallet address"), granularity: str = Query("daily")):
    return handle_api_result(polymarket_api.calculate_pnl_history(user, granularity))


@app.get("/api/total-pnl", tags=["PNL"])
async def get_total_pnl(user: str = Query(..., description="Wallet address")):
    return handle_api_result(polymarket_api.calculate_total_pnl(user))


@app.get("/api/unrealized-profit", tags=["PNL"])
async def get_unrealized_profit(user: str = Query(..., description="Wallet address")):
    return handle_api_result(polymarket_api.calculate_unrealized_profit(user))


@app.get("/api/value", tags=["Value"])
async def get_value(user: str = Query(..., description="Wallet address")):
    return handle_api_result(polymarket_api.get_user_value(user))


@app.get("/api/sector-exposure", tags=["Exposure"])
async def get_sector_exposure(user: str = Query(..., description="Wallet address")):
    return handle_api_result(polymarket_api.calculate_sector_exposure(user))


@app.get("/api/closed-positions", tags=["Positions"])
async def get_closed_positions(user: str = Query(..., description="Wallet address")):
    return handle_api_result(polymarket_api.get_closed_positions(user))


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "PolyPortfolio API"}


@app.get("/", tags=["Root"])
async def root():
    return {
        "message": "PolyPortfolio API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "activity": "/api/activity?user=<wallet_address>",
            "markets": "/api/markets",
            "market": "/api/markets/{market_id}",
            "positions": "/api/positions?user=<wallet_address>",
            "pnl": "/api/pnl?user=<wallet_address>"
        }
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
