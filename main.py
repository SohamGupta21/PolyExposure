from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from polymarket_api import PolymarketAPI
import uvicorn

app = FastAPI(
    title="PolyExposure API",
    description="FastAPI backend for Polymarket data API",
    version="1.0.0"
)

# Configure CORS to allow frontend connections
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Polymarket API client
polymarket_api = PolymarketAPI()


# Response models
class ErrorResponse(BaseModel):
    error: str
    status_code: Optional[int] = None
    details: Optional[str] = None


# Activity endpoint
@app.get("/api/activity", tags=["Activity"])
async def get_activity(
    user: str = Query(..., description="Wallet address"),
    limit: int = Query(500, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip")
):
    """
    Get activity for a specific wallet address
    
    - **user**: Wallet address (e.g., '0x9f47f1fcb1701bf9eaf31236ad39875e5d60af93')
    - **limit**: Maximum number of results to return (default: 500, max: 1000)
    - **offset**: Number of results to skip (default: 0)
    """
    try:
        result = polymarket_api.get_activity(user, limit, offset)
        if 'error' in result:
            status_code = result.get('status_code', 500)
            raise HTTPException(
                status_code=status_code if status_code else 500,
                detail=result.get('error', 'Unknown error')
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Markets endpoint
@app.get("/api/markets", tags=["Markets"])
async def get_markets(
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    active: Optional[bool] = Query(None, description="Filter by active status")
):
    """
    Get markets from Polymarket
    
    - **limit**: Maximum number of results to return (default: 100, max: 1000)
    - **offset**: Number of results to skip (default: 0)
    - **active**: Filter by active status (optional)
    """
    try:
        result = polymarket_api.get_markets(limit, offset, active)
        if 'error' in result:
            status_code = result.get('status_code', 500)
            raise HTTPException(
                status_code=status_code if status_code else 500,
                detail=result.get('error', 'Unknown error')
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Single market endpoint
@app.get("/api/markets/{market_id}", tags=["Markets"])
async def get_market(market_id: str):
    """
    Get details for a specific market
    
    - **market_id**: The market identifier
    """
    try:
        result = polymarket_api.get_market(market_id)
        if 'error' in result:
            status_code = result.get('status_code', 500)
            raise HTTPException(
                status_code=status_code if status_code else 500,
                detail=result.get('error', 'Unknown error')
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Positions endpoint
@app.get("/api/positions", tags=["Positions"])
async def get_positions(
    user: str = Query(..., description="Wallet address")
):
    """
    Get positions for a specific wallet address
    
    - **user**: Wallet address
    """
    try:
        result = polymarket_api.get_user_positions(user)
        if 'error' in result:
            status_code = result.get('status_code', 500)
            raise HTTPException(
                status_code=status_code if status_code else 500,
                detail=result.get('error', 'Unknown error')
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "PolyExposure API"}


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information"""
    return {
        "message": "PolyExposure API",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "activity": "/api/activity?user=<wallet_address>",
            "markets": "/api/markets",
            "market": "/api/markets/{market_id}",
            "positions": "/api/positions?user=<wallet_address>"
        }
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

